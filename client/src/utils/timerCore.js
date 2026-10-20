// The time maths behind the shared timer — pure functions, no React, no storage.
//
// EVERYTHING is computed from wall-clock timestamps, never by counting ticks. A
// run is { startedAt, accumulated }: `accumulated` is the time banked by earlier
// stretches (before a pause), `startedAt` the Date.now() the current stretch
// began (null while paused). Elapsed time is therefore one subtraction away, and
// stays right however rarely the code gets to look: browsers throttle the timers
// of a background tab to once a second (Chrome, after five hidden minutes, to
// once a MINUTE), so a counter of ticks would drift by exactly that much.

export const MAX_DURATION_MS = 600 * 60 * 1000; // 10 hours — far past any session

// Time banked by a run at `now`.
export const elapsedOf = (run, now) =>
  (run?.accumulated || 0) + (run?.startedAt != null ? Math.max(0, now - run.startedAt) : 0);

// The phases of a countdown. Plain: one focus period. With intervals: focus and
// break alternating for `rounds` focus periods — no break after the last one,
// since the session is over then.
export const buildPlan = (durationMs, intervals) => {
  const rounds = intervals?.enabled ? Math.max(1, Math.round(intervals.rounds) || 1) : 1;
  const breakMs = Math.max(0, Math.round((intervals?.breakMin || 0) * 60000));
  const plan = [];
  for (let r = 1; r <= rounds; r++) {
    plan.push({ kind: 'focus', ms: durationMs, round: r, rounds });
    if (r < rounds && breakMs > 0) plan.push({ kind: 'break', ms: breakMs, round: r, rounds });
  }
  return plan;
};

export const planTotal = (plan) => plan.reduce((sum, p) => sum + p.ms, 0);

// Where a countdown stands after `elapsed` ms: the phase it is in, how much of
// that phase is left, and how many phase ends it has passed (`passed`; equal to
// plan.length once the whole countdown is over).
export const phaseAt = (plan, elapsed) => {
  let start = 0;
  for (let i = 0; i < plan.length; i++) {
    const end = start + plan[i].ms;
    if (elapsed < end) {
      return { index: i, phase: plan[i], remaining: end - elapsed, passed: i, done: false };
    }
    start = end;
  }
  const last = plan.length - 1;
  return { index: last, phase: plan[last], remaining: 0, passed: plan.length, done: true };
};

// What a countdown run is doing right now — the one place the UI's status words
// come from. 'done' stays until the reader dismisses it.
export const timerStatus = (run, now) => {
  if (!run) return 'idle';
  if (phaseAt(run.plan, elapsedOf(run, now)).done) return 'done';
  return run.startedAt != null ? 'running' : 'paused';
};

// The time worth showing when there is room for only one — the collapsed
// sidebar row, the edge indicator, the tab title: a countdown that is going (or
// has just ended) first, then a running stopwatch. null when neither is.
export const liveReadout = (state, now) => {
  const run = state.timer.run;
  const status = timerStatus(run, now);
  if (status === 'running' || status === 'done') {
    return { which: 'timer', status, text: formatDuration(phaseAt(run.plan, elapsedOf(run, now)).remaining, { roundUp: true }) };
  }
  if (state.stopwatch.startedAt != null) {
    return { which: 'stopwatch', status: 'running', text: formatDuration(elapsedOf(state.stopwatch, now)) };
  }
  return null;
};

// The wall-clock moment the next phase ends, for a running countdown; null when
// it is paused or over.
export const nextBoundaryAt = (run, now) => {
  if (!run || run.startedAt == null) return null;
  const at = phaseAt(run.plan, elapsedOf(run, now));
  return at.done ? null : now + at.remaining;
};

// The wall-clock moment the `passed`-th phase end happened (for a run whose
// current stretch is still going).
export const boundaryTime = (run, passed) => {
  if (run?.startedAt == null) return null;
  const upTo = run.plan.slice(0, passed).reduce((sum, p) => sum + p.ms, 0);
  return run.startedAt + (upTo - (run.accumulated || 0));
};

// "MM:SS", or "H:MM:SS" from an hour up. A countdown rounds UP (a 10-second
// timer reads 00:10 the moment it starts and 00:00 only when it is over); a
// count-up rounds down, like every stopwatch.
export const formatDuration = (ms, { roundUp = false } = {}) => {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// The wall-clock time in the reader's language and their 12/24-hour choice.
// Arabic asks for Arabic-Indic digits explicitly (`nu-arab`), and gets ص / م.
export const formatClock = (now, { isArabic = false, hour24 = false, seconds = true } = {}) =>
  new Date(now).toLocaleTimeString(isArabic ? 'ar-u-nu-arab' : 'en-US', {
    hour: hour24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hourCycle: hour24 ? 'h23' : 'h12',
  });

// A whole number typed in any of the three digit scripts the app's readers use
// ('12', '١٢', '۱۲'); null when it is not one.
export const parseDigits = (text) => {
  const ascii = String(text ?? '').trim().replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);
  return /^\d+$/.test(ascii) ? Number(ascii) : null;
};
