import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FiPlay, FiPause, FiRotateCcw, FiChevronDown, FiBell, FiVolume2, FiX } from 'react-icons/fi';
import { LuTimer, LuHourglass, LuClock } from 'react-icons/lu';
import { useTimerState, useTimerSettings, useTimerStore, useTimerValue } from '../hooks/useTimer';
import {
  elapsedOf, phaseAt, timerStatus, liveReadout, formatDuration, formatClock, parseDigits, MAX_DURATION_MS,
} from '../utils/timerCore';
import { playChime, unlockChime } from '../services/chime';
import { toArabicDigits } from '../utils/formatNumber';
import Tooltip from './Tooltip';

// The time tool: a stopwatch, a countdown and a clock over the app's ONE shared
// timer (services/timerStore.js), so the Library's sidebar and the Dashboard
// card are two views of the same run. Minimal by default — mode, readout,
// start / pause / reset and the countdown's presets — with everything else
// behind an "Advanced" toggle.

const MODES = ['stopwatch', 'timer', 'clock'];
const MODE_ICONS = { stopwatch: LuTimer, timer: LuHourglass, clock: LuClock };
const PRESET_MINUTES = [5, 10, 15, 25];

const useDigits = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  return { isArabic, digits: (s) => (isArabic ? toArabicDigits(s) : String(s)) };
};

// Something on screen needs the tick only while a time is actually moving.
const isLive = (s) => s.mode === 'clock' || s.stopwatch.startedAt != null || s.timer.run?.startedAt != null;

// ── Readout ─────────────────────────────────────────────────────────────────
function Readout({ mode, done, big }) {
  const { isArabic, digits } = useDigits();
  const state = useTimerState();
  const text = useTimerValue((s, st, now) => {
    if (mode === 'clock') return formatClock(now, { isArabic, hour24: st.clock24, seconds: st.clockSeconds });
    if (mode === 'stopwatch') return digits(formatDuration(elapsedOf(s.stopwatch, now)));
    const run = s.timer.run;
    if (!run) return digits(formatDuration(s.timer.duration));
    return digits(formatDuration(phaseAt(run.plan, elapsedOf(run, now)).remaining, { roundUp: true }));
  }, { live: isLive(state) });
  return (
    // role=timer is a live region that is OFF by default — a screen reader can
    // read it on demand without being told every second. The end is announced
    // separately (TimerProvider). Durations are digits and colons only, pinned
    // LTR; the clock keeps its locale's own order (Arabic puts ص / م after it).
    <div
      role="timer"
      aria-atomic="true"
      dir={mode === 'clock' ? undefined : 'ltr'}
      className={`font-semibold tabular-nums leading-none tracking-tight ${big ? 'text-4xl' : 'text-[32px]'} ${
        done
          ? 'text-amber-600 dark:text-amber-400 timer-done'
          : 'text-[#003527] dark:text-gray-100'
      }`}
    >
      {text}
    </div>
  );
}

// "Focus 2 of 4" / "Break 1 of 3" under an interval countdown.
function PhaseLabel() {
  const { t } = useTranslation();
  const { digits } = useDigits();
  const state = useTimerState();
  const key = useTimerValue((s, _st, now) => {
    const run = s.timer.run;
    if (!run || run.plan.length < 2) return '';
    const at = phaseAt(run.plan, elapsedOf(run, now));
    // There is one break fewer than there are focus periods.
    const total = at.phase.kind === 'break' ? at.phase.rounds - 1 : at.phase.rounds;
    return at.done ? '' : `${at.phase.kind}|${at.phase.round}|${total}`;
  }, { live: state.timer.run?.startedAt != null });
  if (!key) return null;
  const [kind, n, total] = key.split('|');
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#707974] dark:text-gray-400">
      {t(`timer.phase.${kind}`, { n: digits(n), total: digits(total) })}
    </p>
  );
}

// ── Small controls ──────────────────────────────────────────────────────────
const btnBase = 'inline-flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnPrimary = `${btnBase} bg-[#004f35] text-white hover:bg-[#003527]`;
const btnSecondary = `${btnBase} border border-[#dce2f3] dark:border-gray-600 text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700`;
const fieldCls = 'rounded-lg border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-center tabular-nums text-[#1A1A1A] dark:text-gray-100 focus:outline-none focus:border-[#004f35] dark:focus:border-emerald-500 disabled:opacity-40';

function Check({ checked, onChange, label, disabled = false, note }) {
  return (
    <label className={`flex items-start gap-2 text-xs leading-snug ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-3.5 h-3.5 shrink-0 accent-[#004f35] dark:accent-emerald-500"
      />
      <span className="text-[#404944] dark:text-gray-300">
        {label}
        {note && <span className="block text-[11px] text-[#707974] dark:text-gray-500 mt-0.5">{note}</span>}
      </span>
    </label>
  );
}

// A number field that takes Western or Arabic-Indic digits and shows the
// reader's own. It edits a draft while focused and commits valid values as
// they are typed, so a half-typed "1" never fights the reader.
function NumberField({ value, min, max, onCommit, label, disabled, className = 'w-12' }) {
  const { digits } = useDigits();
  const [draft, setDraft] = useState(null);
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      disabled={disabled}
      value={draft ?? digits(value)}
      onFocus={(e) => { setDraft(digits(value)); e.target.select(); }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = parseDigits(e.target.value);
        if (n != null && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={`${fieldCls} ${className}`}
    />
  );
}

// ── Countdown presets + custom duration ─────────────────────────────────────
function DurationPicker({ locked }) {
  const { t } = useTranslation();
  const { digits } = useDigits();
  const store = useTimerStore();
  const { timer } = useTimerState();
  // Typing "0" minutes on the way to "0:10" passes through 0:00, which is no
  // duration at all. That half-typed pair is held here, not committed, until it
  // becomes a real duration; a change of duration from anywhere else (a
  // preset, another tab) drops it.
  const [pending, setPending] = useState(null);
  const [pendingFor, setPendingFor] = useState(timer.duration);
  if (pendingFor !== timer.duration) {
    setPendingFor(timer.duration);
    setPending(null);
  }
  const minutes = pending?.m ?? Math.floor(timer.duration / 60000);
  const seconds = pending?.s ?? Math.floor((timer.duration % 60000) / 1000);
  const set = (m, s) => {
    if (m * 60 + s > 0) { setPending(null); store.setDuration((m * 60 + s) * 1000); }
    else setPending({ m, s });
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1" role="group" aria-label={t('timer.presets')}>
        {PRESET_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            disabled={locked}
            onClick={() => store.setDuration(m * 60000)}
            aria-pressed={timer.duration === m * 60000}
            aria-label={t('timer.presetLabel', { count: m, n: digits(m) })}
            className={`flex-1 min-w-9 text-xs font-semibold rounded-md px-2 py-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              timer.duration === m * 60000
                ? 'bg-[#e6f0ea] dark:bg-emerald-900/40 text-[#004f35] dark:text-emerald-300 ring-1 ring-[#004f35]/30 dark:ring-emerald-500/40'
                : 'text-[#404944] dark:text-gray-300 bg-[#f0f4ff] dark:bg-gray-700/60 hover:bg-[#e3e9f8] dark:hover:bg-gray-700'
            }`}
          >
            {digits(m)}
          </button>
        ))}
        <span className="text-[11px] text-[#707974] dark:text-gray-500 ms-1">{t('timer.minShort')}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-[#707974] dark:text-gray-400">
        <span>{t('timer.custom')}</span>
        <span className="inline-flex items-center gap-1" dir="ltr">
          <NumberField value={minutes} min={0} max={MAX_DURATION_MS / 60000 - 1} disabled={locked}
            label={t('timer.customMinutes')} onCommit={(m) => set(m, seconds)} />
          <span aria-hidden="true">:</span>
          <NumberField value={String(seconds).padStart(2, '0')} min={0} max={59} disabled={locked}
            label={t('timer.customSeconds')} onCommit={(s) => set(minutes, s)} />
        </span>
      </div>
    </div>
  );
}

// ── Advanced settings ───────────────────────────────────────────────────────
function AdvancedPanel({ id, showRecitationOption }) {
  const { t } = useTranslation();
  const { digits } = useDigits();
  const store = useTimerStore();
  const settings = useTimerSettings();
  const { timer } = useTimerState();
  const [notifyNote, setNotifyNote] = useState(null);
  const notifySupported = typeof Notification !== 'undefined';
  const set = (patch) => store.updateSettings(patch);

  // Permission is asked for HERE, when the reader turns the option on — never
  // on page load. A refusal leaves the option off and says why.
  const toggleNotify = async (on) => {
    if (!on) { set({ notify: false }); setNotifyNote(null); return; }
    if (!notifySupported) return;
    let permission = Notification.permission;
    if (permission === 'default') {
      try { permission = await Notification.requestPermission(); } catch { permission = 'denied'; }
    }
    if (permission === 'granted') { set({ notify: true }); setNotifyNote(null); }
    else { set({ notify: false }); setNotifyNote(t('timer.adv.notifyBlocked')); }
  };

  const iv = settings.intervals;
  const sectionCls = 'flex flex-col gap-2 py-3 first:pt-0 last:pb-0';
  const headCls = 'text-[10px] font-bold uppercase tracking-widest text-[#707974] dark:text-gray-500';
  return (
    <div id={id} className="flex flex-col divide-y divide-[#dce2f3] dark:divide-gray-700">
      <div className={sectionCls}>
        <span className={headCls}>{t('timer.adv.sound')}</span>
        <Check checked={settings.chime} onChange={(v) => set({ chime: v })} label={t('timer.adv.chime')} />
        <div className="flex items-center gap-2">
          <FiVolume2 className="w-3.5 h-3.5 shrink-0 text-[#707974] dark:text-gray-500" aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(settings.volume * 100)}
            disabled={!settings.chime}
            onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
            aria-label={t('timer.adv.volume')}
            aria-valuetext={`${digits(Math.round(settings.volume * 100))}%`}
            className="flex-1 min-w-0 accent-[#004f35] dark:accent-emerald-500 disabled:opacity-40"
          />
          <button
            type="button"
            disabled={!settings.chime}
            onClick={() => { unlockChime(); playChime({ kind: 'end', volume: settings.volume }); }}
            className="shrink-0 text-xs font-medium text-[#004f35] dark:text-emerald-400 hover:underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
          >
            {t('timer.adv.test')}
          </button>
        </div>
      </div>

      <div className={sectionCls}>
        <span className={headCls}>{t('timer.adv.intervals')}</span>
        <Check
          checked={iv.enabled}
          disabled={timer.run != null}
          onChange={(v) => set({ intervals: { enabled: v } })}
          label={t('timer.adv.intervalsOn')}
          note={timer.run != null ? t('timer.adv.nextRun') : null}
        />
        {iv.enabled && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#404944] dark:text-gray-300">
            <label className="inline-flex items-center gap-1.5">
              {t('timer.adv.breakMin')}
              <NumberField value={iv.breakMin} min={1} max={120} disabled={timer.run != null}
                label={t('timer.adv.breakMin')} onCommit={(n) => set({ intervals: { breakMin: n } })} />
            </label>
            <label className="inline-flex items-center gap-1.5">
              {t('timer.adv.rounds')}
              <NumberField value={iv.rounds} min={1} max={20} disabled={timer.run != null}
                label={t('timer.adv.rounds')} onCommit={(n) => set({ intervals: { rounds: n } })} />
            </label>
            <p className="w-full text-[11px] text-[#707974] dark:text-gray-500">
              {t('timer.adv.intervalsSummary', {
                focus: digits(formatDuration(timer.duration)),
                brk: digits(iv.breakMin),
                n: digits(iv.rounds),
              })}
            </p>
          </div>
        )}
      </div>

      <div className={sectionCls}>
        <span className={headCls}>{t('timer.adv.whenItEnds')}</span>
        <Check
          checked={settings.notify && notifySupported}
          disabled={!notifySupported}
          onChange={toggleNotify}
          label={t('timer.adv.notify')}
          note={!notifySupported ? t('timer.adv.notifyUnsupported') : notifyNote}
        />
        {showRecitationOption && (
          <Check checked={settings.pauseRecitation} onChange={(v) => set({ pauseRecitation: v })} label={t('timer.adv.pauseRecitation')} />
        )}
      </div>

      <div className={sectionCls}>
        <span className={headCls}>{t('timer.adv.display')}</span>
        <Check checked={settings.clock24} onChange={(v) => set({ clock24: v })} label={t('timer.adv.clock24')} />
        <Check checked={settings.clockSeconds} onChange={(v) => set({ clockSeconds: v })} label={t('timer.adv.clockSeconds')} />
        <Check checked={settings.titleTime} onChange={(v) => set({ titleTime: v })} label={t('timer.adv.titleTime')} />
      </div>
    </div>
  );
}

// ── The tool ────────────────────────────────────────────────────────────────
// layout 'stack' — the Library sidebar's narrow column; 'row' — the Dashboard
// card, laid out across. `showRecitationOption` offers "pause the recitation"
// where there is one (the Library).
export default function TimeTool({ layout = 'stack', showRecitationOption = false }) {
  const { t } = useTranslation();
  const store = useTimerStore();
  const state = useTimerState();
  const settings = useTimerSettings();
  const advancedId = useId();
  const { mode } = state;
  // The countdown's status, re-read at its end (the tick runs while it runs).
  const status = useTimerValue((s, _st, now) => timerStatus(s.timer.run, now), { live: state.timer.run?.startedAt != null });
  const swRunning = state.stopwatch.startedAt != null;
  const swTouched = swRunning || state.stopwatch.accumulated > 0;
  const done = mode === 'timer' && status === 'done';
  const row = layout === 'row';

  const modeSwitch = (
    <div
      className={`grid grid-cols-3 gap-1 rounded-lg border border-[#dce2f3] dark:border-gray-600 p-1 ${row ? 'sm:grid-cols-[repeat(3,max-content)]' : ''}`}
      role="group"
      aria-label={t('timer.modeLabel')}
    >
      {MODES.map((m) => {
        const Icon = MODE_ICONS[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => store.setMode(m)}
            aria-pressed={mode === m}
            className={`inline-flex items-center justify-center gap-1 text-xs font-semibold rounded-md px-1.5 py-1.5 transition-colors ${
              mode === m ? 'bg-[#004f35] text-white' : 'text-[#404944] dark:text-gray-300 hover:bg-[#f0f4ff] dark:hover:bg-gray-700'
            }`}
          >
            {/* The sidebar's column has room for the three words, not the
                words AND their icons ("Stopwatch" was cut short). */}
            {row && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            <span className="truncate">{t(`timer.mode.${m}`)}</span>
          </button>
        );
      })}
    </div>
  );

  let controls = null;
  if (mode === 'stopwatch') {
    controls = (
      <>
        <button type="button" onClick={() => (swRunning ? store.pauseStopwatch() : store.startStopwatch())} className={`${btnPrimary} flex-1`}>
          {swRunning ? <FiPause className="w-3.5 h-3.5" /> : <FiPlay className="w-3.5 h-3.5" />}
          {swRunning ? t('timer.pause') : swTouched ? t('timer.resume') : t('timer.start')}
        </button>
        <button type="button" onClick={() => store.resetStopwatch()} disabled={!swTouched} className={`${btnSecondary} flex-1`}>
          <FiRotateCcw className="w-3.5 h-3.5" /> {t('timer.reset')}
        </button>
      </>
    );
  } else if (mode === 'timer') {
    controls = done ? (
      <>
        <button type="button" onClick={() => store.resetTimer()} className={`${btnPrimary} flex-1`}>
          <FiX className="w-3.5 h-3.5" /> {t('timer.dismiss')}
        </button>
        <button type="button" onClick={() => { store.resetTimer(); store.startTimer(); }} className={`${btnSecondary} flex-1`}>
          <FiRotateCcw className="w-3.5 h-3.5" /> {t('timer.restart')}
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={() => (status === 'running' ? store.pauseTimer() : store.startTimer())} className={`${btnPrimary} flex-1`}>
          {status === 'running' ? <FiPause className="w-3.5 h-3.5" /> : <FiPlay className="w-3.5 h-3.5" />}
          {status === 'running' ? t('timer.pause') : status === 'paused' ? t('timer.resume') : t('timer.start')}
        </button>
        <button type="button" onClick={() => store.resetTimer()} disabled={status === 'idle'} className={`${btnSecondary} flex-1`}>
          <FiRotateCcw className="w-3.5 h-3.5" /> {t('timer.reset')}
        </button>
      </>
    );
  }

  const readoutBlock = (
    <div className={`flex flex-col gap-1.5 ${row ? 'items-start min-w-34' : 'items-center py-1'}`}>
      <Readout mode={mode} done={done} big={row} />
      {mode === 'timer' && !done && <PhaseLabel />}
      {done && (
        <p className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
          <FiBell className="w-3.5 h-3.5" aria-hidden="true" /> {t('timer.ended.done')}
        </p>
      )}
    </div>
  );

  const advancedToggle = (
    <button
      type="button"
      onClick={() => store.updateSettings({ advancedOpen: !settings.advancedOpen })}
      aria-expanded={settings.advancedOpen}
      aria-controls={advancedId}
      className="inline-flex items-center gap-1 self-start text-xs font-medium text-[#707974] dark:text-gray-400 hover:text-[#004f35] dark:hover:text-emerald-400 transition-colors"
    >
      {t('timer.advanced')}
      <FiChevronDown className={`w-3.5 h-3.5 transition-transform ${settings.advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
  );

  const advanced = settings.advancedOpen && (
    <div className={`rounded-lg border border-[#dce2f3] dark:border-gray-700 p-3 ${row ? 'md:max-w-xl' : ''}`}>
      <AdvancedPanel id={advancedId} showRecitationOption={showRecitationOption} />
    </div>
  );

  if (row) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="w-full sm:w-auto">{modeSwitch}</div>
          {readoutBlock}
          {controls && <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-52">{controls}</div>}
          {mode === 'timer' && <div className="w-full sm:w-auto"><DurationPicker locked={state.timer.run != null} /></div>}
          <div className="sm:ms-auto">{advancedToggle}</div>
        </div>
        {advanced}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {modeSwitch}
      {readoutBlock}
      {controls && <div className="flex items-center gap-2">{controls}</div>}
      {mode === 'timer' && <DurationPicker locked={state.timer.run != null} />}
      {advancedToggle}
      {advanced}
    </div>
  );
}

// ── The one-line summary: the collapsed sidebar row ─────────────────────────
// The time that matters most (utils/timerCore liveReadout), or, with nothing
// running, the selected mode's resting value.
export function TimerSummary() {
  const { t } = useTranslation();
  const { isArabic, digits } = useDigits();
  const state = useTimerState();
  const key = useTimerValue((s, st, now) => {
    const lr = liveReadout(s, now);
    if (lr) return `${lr.which}|${lr.status}|${digits(lr.text)}`;
    if (s.mode === 'clock') return `clock|idle|${formatClock(now, { isArabic, hour24: st.clock24, seconds: st.clockSeconds })}`;
    if (s.mode === 'stopwatch') return `stopwatch|${s.stopwatch.accumulated > 0 ? 'paused' : 'idle'}|${digits(formatDuration(s.stopwatch.accumulated))}`;
    const run = s.timer.run;
    if (run) return `timer|paused|${digits(formatDuration(phaseAt(run.plan, elapsedOf(run, now)).remaining, { roundUp: true }))}`;
    return `timer|idle|${digits(formatDuration(s.timer.duration))}`;
  }, { live: isLive(state) });
  const [which, status, text] = key.split('|');
  const Icon = MODE_ICONS[which];
  const tone = status === 'done'
    ? 'text-amber-700 dark:text-amber-300'
    : status === 'running'
      ? 'text-[#004f35] dark:text-emerald-400'
      : 'text-[#707974] dark:text-gray-400';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${tone}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-current timer-live-dot" aria-hidden="true" />}
      {status === 'done' ? <FiBell className="w-3.5 h-3.5" aria-hidden="true" /> : <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
      <span dir={which === 'clock' ? undefined : 'ltr'}>{status === 'done' ? t('timer.ended.short') : text}</span>
      {status === 'paused' && <span className="sr-only">{t('timer.pausedSr')}</span>}
    </span>
  );
}

// ── The edge indicator: a running time while the sidebar is hidden ──────────
// It hangs under the sidebar's own edge handle, as narrow as the handle, with
// its text turned sideways the way an IDE labels a tool window on its edge
// stripe. Narrow on purpose: the handle's 24px is the room the reader already
// gives up beside the page, so the indicator never reaches the page text. It
// is a button: pressing it brings the sidebar (and the timer) back.
export function TimerEdgeIndicator({ onOpen, top }) {
  const { t } = useTranslation();
  const { digits } = useDigits();
  const state = useTimerState();
  const key = useTimerValue((s, _st, now) => {
    const lr = liveReadout(s, now);
    return lr ? `${lr.which}|${lr.status}|${digits(lr.text)}` : '';
  }, { live: isLive(state) });
  if (!key) return null;
  const [which, status, text] = key.split('|');
  const Icon = status === 'done' ? FiBell : MODE_ICONS[which];
  const label = status === 'done'
    ? t('timer.indicator.done')
    : t(`timer.indicator.${which}`, { time: text });
  return (
    <div className="reader-edge-tab fixed z-40" style={{ insetInlineStart: 0, top }}>
      <Tooltip label={label} placement="bottom">
        <button
          type="button"
          onClick={onOpen}
          aria-label={label}
          data-testid="timer-edge-indicator"
          className={`inline-flex flex-col items-center gap-1 w-6 py-2 rounded-e-lg border border-s-0 shadow-md backdrop-blur transition-colors ${
            status === 'done'
              ? 'bg-amber-50/95 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 timer-done'
              : 'bg-white/95 dark:bg-gray-800/95 border-[#dce2f3] dark:border-gray-700 text-[#004f35] dark:text-emerald-400 hover:bg-white dark:hover:bg-gray-700'
          }`}
        >
          <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="timer-edge-text text-[11px] font-semibold tabular-nums leading-none" aria-hidden="true">
            {status === 'done' ? digits('00:00') : text}
          </span>
        </button>
      </Tooltip>
    </div>
  );
}
