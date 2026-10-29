// Keeps the pages around the reader ready to draw, so a turn by hand is instant.
//
// "Ready" means a page's word data is shaped and in memory, and its glyph font is
// fetched and DECODED (see decodePageFont in mushafApi) — the reader registers it
// synchronously on arrival. The work is a single persistent queue, not a job
// restarted on every turn: each turn re-ranks what is needed around the new page,
// keeps whatever is already done, and simply stops asking for pages that are now
// too far away. That matters most to a reader turning quickly — every turn moves
// the window by one, and the next turn is already the first thing in it.
//
// Ranking: two TURNS each way (a turn is one page, or one spread), the nearest
// turn first and, within a turn, forward before back — forward is the way a
// mushaf is read — with a page's data before its font. The NEXT turn forward is
// then also primed (primePageFont: the browser's first layout with a new font,
// done off-screen in small idle steps), and once everything else is in hand, the
// next turn back too. A connection that asks to save data gets none of this, and
// a 2g one only the next turn each way.
//
// Each step starts in idle time, at most two at once (one while the recitation is
// playing: the audio warm-up is pulling files ahead too, so it goes first and
// gets the line between our steps). Failures are remembered for a while and
// skipped — this is a head start, never something anyone waits on.

import {
  fetchMushafPage, peekMushafPage, decodePageFont, isPageFontReady, primePageFont, isPageFontPrimed,
} from './mushafApi';

const TOTAL_PAGES = 604;
const DEPTH = 2;                    // turns each way
const MAX_PARALLEL = 2;
const PLAYING_HEAD_START = 2500;    // ms after a turn before the first step while reciting…
const PLAYING_GAP = 600;            // …and between steps
const FAILED_RETRY_AFTER = 30000;

let focus = null;                   // { visible, step, playing, since }
let held = false;
let inFlight = 0;
const running = new Set();          // task ids in flight
const failedAt = new Map();         // task id → when it last failed
let idleId = null;
let timer = null;

const whenIdle = (fn) => (typeof window.requestIdleCallback === 'function'
  ? window.requestIdleCallback(fn, { timeout: 1000 })
  : setTimeout(fn, 30));
// One idle slot, as a promise — the pace priming takes its small steps at.
const idleStep = () => new Promise((resolve) => whenIdle(resolve));
const cancelIdle = (id) => (typeof window.cancelIdleCallback === 'function'
  ? window.cancelIdleCallback(id)
  : clearTimeout(id));

// How many turns each way this connection should be given.
const depthForConnection = () => {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (c?.saveData) return 0;
  if (c?.effectiveType === '2g' || c?.effectiveType === 'slow-2g') return 1;
  return DEPTH;
};

// Everything wanted around `visible`, best first.
const plan = ({ visible, step }) => {
  const depth = depthForConnection();
  const tasks = [];
  const add = (kind, p) => {
    if (p >= 1 && p <= TOTAL_PAGES && !visible.includes(p)) tasks.push({ id: `${kind}${p}`, kind, p });
  };
  for (let t = 1; t <= depth; t += 1) {
    for (const dir of [1, -1]) {
      const pages = visible.map((p) => p + dir * t * step);
      pages.forEach((p) => add('data', p));
      pages.forEach((p) => add('font', p));
      if (t === 1 && dir === 1) pages.forEach((p) => add('prime', p));
    }
  }
  // Drawing a page's top-of-page juz/hizb ornament reads the page BEFORE it, so
  // the farthest turn back wants one more page of data (data only, last).
  if (depth > 0) add('data', Math.min(...visible) - depth * step - 1);
  if (depth > 0) visible.forEach((p) => add('prime', p - step));
  return tasks;
};

const isDone = ({ kind, p }) => (kind === 'data' ? !!peekMushafPage(p)
  : kind === 'font' ? isPageFontReady(p)
    : isPageFontPrimed(p));
// Priming needs the page's data and decoded font in hand first.
const isReady = ({ kind, p }) => kind !== 'prime' || (!!peekMushafPage(p) && isPageFontReady(p));
const isEligible = (task) =>
  !running.has(task.id) && !isDone(task) && isReady(task)
  && !(Date.now() - (failedAt.get(task.id) ?? -Infinity) < FAILED_RETRY_AFTER);

const runTask = (task) => {
  running.add(task.id);
  inFlight += 1;
  // A page comes back WITHOUT being cached when page+1 (which its header plate
  // needs) could not be had — fetchMushafPage still hands it over for the reader
  // to draw. For the queue that is a failure like any other: counted as done, it
  // is not (isDone stays false), and the queue asked again at once, sending a
  // request for page+1 every idle slot while offline or while quran.com fails.
  const job = task.kind === 'data'
    ? fetchMushafPage(task.p).then(() => { if (!peekMushafPage(task.p)) throw new Error('incomplete page'); })
    : task.kind === 'font' ? decodePageFont(task.p).then((ok) => { if (!ok) throw new Error('font'); })
      : primePageFont(task.p, idleStep).then((ok) => { if (!ok) throw new Error('prime'); });
  job
    .catch(() => { failedAt.set(task.id, Date.now()); })
    .finally(() => {
      running.delete(task.id);
      inFlight -= 1;
      if (focus?.playing) {
        clearTimeout(timer);
        timer = setTimeout(() => { timer = null; pump(); }, PLAYING_GAP);
      } else pump();
    });
};

// Start the best next step(s), if there's room and anything is left to do.
function pump() {
  if (held || !focus || idleId != null || timer != null) return;
  const limit = focus.playing ? 1 : MAX_PARALLEL;
  if (inFlight >= limit || !plan(focus).some(isEligible)) return;
  const wait = focus.playing ? focus.since + PLAYING_HEAD_START - Date.now() : 0;
  if (wait > 0) {
    timer = setTimeout(() => { timer = null; pump(); }, wait);
    return;
  }
  idleId = whenIdle(() => {
    idleId = null;
    if (held || !focus) return;
    // Ranked at the moment it runs, so a turn since the request is honoured.
    const next = plan(focus).find(isEligible);
    if (!next || inFlight >= (focus.playing ? 1 : MAX_PARALLEL)) return;
    runTask(next);
    pump(); // room for a second step?
  });
}

const unschedule = () => {
  if (idleId != null) { cancelIdle(idleId); idleId = null; }
  clearTimeout(timer);
  timer = null;
};

// The reader has these pages on screen (painted): rank the work around them.
export const setPrefetchFocus = ({ visible, step, playing }) => {
  const same = focus && focus.step === step && focus.visible.join() === visible.join();
  const since = same && focus.playing === playing ? focus.since : Date.now();
  focus = { visible: [...visible], step, playing: !!playing, since };
  held = false;
  unschedule();
  pump();
};

// Start nothing new (what is in flight finishes, its result kept): while a page
// is still loading, so the arrival has the connection, and while the scrubber is
// being dragged, since its destination isn't known yet.
export const holdPrefetch = () => {
  held = true;
  unschedule();
};

export const resumePrefetch = () => {
  held = false;
  pump();
};

// The reader has gone: forget the focus. Caches stay for the next visit.
export const stopPrefetch = () => {
  focus = null;
  held = false;
  unschedule();
};
