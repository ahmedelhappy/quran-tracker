// The app's ONE timer: stopwatch, countdown and clock state shared by every page
// (the Library's sidebar and the Dashboard show the same timer), kept in
// localStorage so it survives a reload and works without an account, and kept
// identical across tabs through the `storage` event.
//
// It lives outside React on purpose, like the zoom store in useMushafZoom: a
// running display changes every second, and holding that in a provider's state
// would re-render the whole Library with it. Components subscribe to exactly what
// they show (hooks/useTimer.js) and re-render only when that text changes.
//
// The maths is all wall-clock (utils/timerCore.js): nothing here counts ticks.
// The tick only decides how often a display LOOKS at the clock.
import { buildPlan, elapsedOf, phaseAt, nextBoundaryAt, boundaryTime, timerStatus, MAX_DURATION_MS } from '../utils/timerCore';
import { unlockChime } from './chime';

const STATE_KEY = 'timerState';
const SETTINGS_KEY = 'timerSettings';
const MODES = ['stopwatch', 'timer', 'clock'];
const TICK_MS = 250;
// A hidden tab waits this long before claiming a phase end, so that a visible
// tab — whose timers are not throttled — gets to chime first.
const HIDDEN_CLAIM_DELAY_MS = 1200;
// A phase end found this late (the tab was frozen, or the browser closed) is
// marked as seen but not chimed: a bell a minute after the fact is just noise.
const LATE_MS = 30000;

export const DEFAULT_SETTINGS = {
  chime: true,
  volume: 0.7,
  intervals: { enabled: false, breakMin: 5, rounds: 4 },
  notify: false,
  pauseRecitation: false,
  clock24: false,
  clockSeconds: true,
  titleTime: false,
  advancedOpen: false,
};

const DEFAULT_STATE = {
  mode: 'timer',
  stopwatch: { startedAt: null, accumulated: 0 },
  timer: { duration: 10 * 60000, run: null },
};

const readJSON = (key) => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
const parseJSON = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};
const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / full: in-memory only */ }
};

// Stored values are untrusted (another version of the app, a hand edit): every
// field is checked, and anything odd falls back to its default.
const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const sanitizeRun = (r) => {
  if (!r || typeof r !== 'object' || !Array.isArray(r.plan)) return null;
  const plan = r.plan
    .filter((p) => p && (p.kind === 'focus' || p.kind === 'break') && Number.isFinite(p.ms) && p.ms > 0)
    .map((p) => ({ kind: p.kind, ms: p.ms, round: finite(p.round, 1), rounds: finite(p.rounds, 1) }));
  if (!plan.length) return null;
  return {
    id: typeof r.id === 'string' ? r.id : `r${Date.now()}`,
    plan,
    startedAt: Number.isFinite(r.startedAt) ? r.startedAt : null,
    accumulated: Math.max(0, finite(r.accumulated, 0)),
    announced: clamp(Math.round(finite(r.announced, 0)), 0, plan.length),
  };
};

const sanitizeState = (s) => {
  if (!s || typeof s !== 'object') return DEFAULT_STATE;
  const sw = s.stopwatch ?? {};
  return {
    mode: MODES.includes(s.mode) ? s.mode : DEFAULT_STATE.mode,
    stopwatch: {
      startedAt: Number.isFinite(sw.startedAt) ? sw.startedAt : null,
      accumulated: Math.max(0, finite(sw.accumulated, 0)),
    },
    timer: {
      duration: clamp(finite(s.timer?.duration, DEFAULT_STATE.timer.duration), 1000, MAX_DURATION_MS),
      run: sanitizeRun(s.timer?.run),
    },
  };
};

const sanitizeSettings = (s) => {
  const d = DEFAULT_SETTINGS;
  if (!s || typeof s !== 'object') return d;
  const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
  const iv = s.intervals ?? {};
  return {
    chime: bool(s.chime, d.chime),
    volume: clamp(finite(s.volume, d.volume), 0, 1),
    intervals: {
      enabled: bool(iv.enabled, d.intervals.enabled),
      breakMin: clamp(Math.round(finite(iv.breakMin, d.intervals.breakMin)), 1, 120),
      rounds: clamp(Math.round(finite(iv.rounds, d.intervals.rounds)), 1, 20),
    },
    notify: bool(s.notify, d.notify),
    pauseRecitation: bool(s.pauseRecitation, d.pauseRecitation),
    clock24: bool(s.clock24, d.clock24),
    clockSeconds: bool(s.clockSeconds, d.clockSeconds),
    titleTime: bool(s.titleTime, d.titleTime),
    advancedOpen: bool(s.advancedOpen, d.advancedOpen),
  };
};

// Exactly ONE tab gets to chime for a given phase end. A Web Lock is granted by
// the browser atomically across tabs; holding it for a minute means a second
// tab's `ifAvailable` request comes back empty. (Reading localStorage alone is
// not enough: each tab sees the others' writes slightly late.) Without Web Locks
// the stored `announced` count is the only guard.
const claimOnce = (name) => new Promise((resolve) => {
  if (!navigator.locks?.request) { resolve(true); return; }
  navigator.locks.request(name, { ifAvailable: true }, (lock) => {
    resolve(!!lock);
    return lock ? new Promise((done) => setTimeout(done, 60000)) : undefined;
  }).catch(() => resolve(true));
});

export function createTimerStore() {
  let state = sanitizeState(readJSON(STATE_KEY));
  let settings = sanitizeSettings(readJSON(SETTINGS_KEY));
  let now = Date.now();
  const listeners = new Set();
  const live = new Set();
  const eventListeners = new Set();
  const claiming = new Set();

  // The phase ends THIS tab has already reacted to, so a reload or a run that
  // arrives from another tab doesn't replay old ones.
  const passedNow = (run) => (run ? phaseAt(run.plan, elapsedOf(run, Date.now())).passed : 0);
  let seen = { runId: state.timer.run?.id ?? null, passed: passedNow(state.timer.run) };

  const notify = () => { for (const fn of listeners) fn(); };
  const emit = (event) => { for (const fn of eventListeners) fn(event); };

  const commit = (next) => {
    state = next;
    now = Date.now();
    writeJSON(STATE_KEY, state);
    notify();
    check();
  };

  // ── Phase ends: react locally in every tab, announce from exactly one ──
  const announce = (run, passed) => {
    const key = `${run.id}:${passed}`;
    if (claiming.has(key)) return;
    claiming.add(key);
    const at = boundaryTime(run, passed);
    const late = at != null && Date.now() - at > LATE_MS;
    const go = async () => {
      const stored = sanitizeState(readJSON(STATE_KEY));
      const fresh = stored.timer.run;
      if (!fresh || fresh.id !== run.id || fresh.announced >= passed) return;
      if (!late && !(await claimOnce(`quran-timer:${key}`))) return;
      // Build on what is STORED, not on this tab's copy: another tab may have
      // just paused or reset, and this write must not undo that.
      const latest = sanitizeState(readJSON(STATE_KEY));
      if (latest.timer.run?.id !== run.id) return;
      // The countdown is over: show it. Whatever mode was on screen switches to
      // the timer, so its end state is what the reader sees.
      const done = passed >= run.plan.length;
      state = { ...latest, mode: done ? 'timer' : latest.mode, timer: { ...latest.timer, run: { ...latest.timer.run, announced: passed } } };
      writeJSON(STATE_KEY, state);
      notify();
      if (!late) {
        const ended = run.plan[passed - 1];
        emit({ type: 'announce', kind: ended.kind, done, next: run.plan[passed] ?? null, settings });
      }
    };
    if (document.visibilityState === 'hidden' && !late) setTimeout(go, HIDDEN_CLAIM_DELAY_MS);
    else go();
  };

  let boundaryTimer = null;
  let boundaryFor = null;
  // One timeout aimed at the exact moment the current phase ends. It is not part
  // of a chain of timers, so a background tab's "intensive" throttling (which
  // only batches chained timers) leaves it at the ordinary one-second precision.
  const schedule = () => {
    const at = nextBoundaryAt(state.timer.run, Date.now());
    if (at === boundaryFor) return;
    clearTimeout(boundaryTimer);
    boundaryFor = at;
    boundaryTimer = at == null ? null : setTimeout(() => {
      boundaryFor = null;
      now = Date.now();
      notify();
      check();
    }, Math.max(0, at - Date.now()) + 15);
  };

  function check() {
    const run = state.timer.run;
    if (!run) { seen = { runId: null, passed: 0 }; schedule(); return; }
    const at = phaseAt(run.plan, elapsedOf(run, Date.now()));
    if (seen.runId !== run.id) seen = { runId: run.id, passed: at.passed };
    if (at.passed > seen.passed) {
      seen = { runId: run.id, passed: at.passed };
      const ended = run.plan[at.passed - 1];
      emit({ type: 'phaseEnd', kind: ended.kind, done: at.done, next: at.done ? null : at.phase, settings });
    }
    if (at.passed > run.announced) announce(run, at.passed);
    schedule();
  }

  // ── The display tick: only while something on screen shows a live time ──
  let tickTimer = null;
  const tick = () => { now = Date.now(); for (const fn of live) fn(); check(); };
  const syncTicker = () => {
    if (live.size && !tickTimer) tickTimer = setInterval(tick, TICK_MS);
    else if (!live.size && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  };

  const setTimer = (patch) => commit({ ...state, timer: { ...state.timer, ...patch } });
  const newRun = () => {
    const run = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      plan: buildPlan(state.timer.duration, settings.intervals),
      startedAt: Date.now(),
      accumulated: 0,
      announced: 0,
    };
    seen = { runId: run.id, passed: 0 };
    return run;
  };

  return {
    getState: () => state,
    getSettings: () => settings,
    getNow: () => now,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // For displays of a running time: state changes AND the tick.
    subscribeLive(fn) {
      listeners.add(fn);
      live.add(fn);
      syncTicker();
      return () => { listeners.delete(fn); live.delete(fn); syncTicker(); };
    },
    onEvent(fn) {
      eventListeners.add(fn);
      return () => eventListeners.delete(fn);
    },

    setMode(mode) {
      if (MODES.includes(mode) && mode !== state.mode) commit({ ...state, mode });
    },

    startStopwatch() {
      const sw = state.stopwatch;
      if (sw.startedAt != null) return;
      commit({ ...state, stopwatch: { startedAt: Date.now(), accumulated: sw.accumulated } });
    },
    pauseStopwatch() {
      const sw = state.stopwatch;
      if (sw.startedAt == null) return;
      commit({ ...state, stopwatch: { startedAt: null, accumulated: elapsedOf(sw, Date.now()) } });
    },
    resetStopwatch() {
      commit({ ...state, stopwatch: { startedAt: null, accumulated: 0 } });
    },

    setDuration(ms) {
      if (state.timer.run) return;   // a run keeps the plan it started with
      const duration = clamp(Math.round(finite(ms, 0)), 1000, MAX_DURATION_MS);
      if (duration !== state.timer.duration) setTimer({ duration });
    },
    // Start, resume, or start again after the end. Called from a click, so this
    // is also where the chime's audio gets unlocked.
    startTimer() {
      unlockChime();
      const run = state.timer.run;
      const status = timerStatus(run, Date.now());
      if (status === 'running') return;
      if (status === 'paused') setTimer({ run: { ...run, startedAt: Date.now() } });
      else setTimer({ run: newRun() });
    },
    pauseTimer() {
      const run = state.timer.run;
      if (timerStatus(run, Date.now()) !== 'running') return;
      setTimer({ run: { ...run, startedAt: null, accumulated: elapsedOf(run, Date.now()) } });
    },
    resetTimer() {
      if (state.timer.run) setTimer({ run: null });
    },

    updateSettings(patch) {
      settings = sanitizeSettings({
        ...settings,
        ...patch,
        intervals: { ...settings.intervals, ...(patch.intervals ?? {}) },
      });
      writeJSON(SETTINGS_KEY, settings);
      notify();
    },

    // Wire the store to the window: other tabs' writes, and coming back to a
    // hidden tab. Also catches a phase end that passed while the page was
    // closed or reloading. Returns the matching teardown.
    attach() {
      const onStorage = (e) => {
        if (e.storageArea !== localStorage) return;
        if (e.key === STATE_KEY || e.key === null) {
          state = sanitizeState(e.key === null ? readJSON(STATE_KEY) : parseJSON(e.newValue));
          now = Date.now();
          notify();
          check();
        }
        if (e.key === SETTINGS_KEY || e.key === null) {
          settings = sanitizeSettings(e.key === null ? readJSON(SETTINGS_KEY) : parseJSON(e.newValue));
          notify();
        }
      };
      // Coming back: a hidden tab shown again, a frozen page resumed (the Page
      // Lifecycle `resume` — a freeze need not hide the page, so it brings no
      // visibilitychange), or a page restored from the back/forward cache. Its
      // timers were stopped or throttled, so look at the clock at once rather
      // than at the next tick. (Not only when visible: a resumed page can still
      // be reported hidden, and its throttled tick would then be a second late.)
      const onWake = () => {
        now = Date.now();
        notify();
        check();
      };
      window.addEventListener('storage', onStorage);
      document.addEventListener('visibilitychange', onWake);
      document.addEventListener('resume', onWake);
      window.addEventListener('pageshow', onWake);
      check();
      return () => {
        window.removeEventListener('storage', onStorage);
        document.removeEventListener('visibilitychange', onWake);
        document.removeEventListener('resume', onWake);
        window.removeEventListener('pageshow', onWake);
        clearTimeout(boundaryTimer);
        boundaryTimer = null;
        boundaryFor = null;
      };
    },
  };
}
