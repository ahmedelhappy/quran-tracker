import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * Contextual guidance for the Library reader, built on the same driver.js setup
 * and `.qt-tour` theme as the dashboard tour (see components/dashboardTour.js).
 *
 * Three entry points, each gated by its own localStorage flag in Library.jsx so
 * the resting UI never re-triggers them:
 *   - startLibraryTour       — first-visit spotlight of the reader (4 steps)
 *   - startMemorizeTour      — first ?mode=memorize entry, only the new controls
 *   - startVerseActionsCoachmark — one-time hint on the verse popover buttons
 *
 * Positioning follows the dashboard lesson: every step anchors to a SMALL, stable
 * element (a button, the nav row, the audio bar, the hint line) — never a tall
 * full-height wrapper — so the popover tucks neatly against its target. driver.js
 * positions by physical left/right and is not `dir`-aware; verified against the
 * real RTL layout that physical alignment already anchors each popover beside its
 * element, so side/align are NOT mirrored for RTL (mirroring was tried before and
 * pushed popovers off their targets).
 */

// A target that exists but is laid out (has box geometry) — filters out steps
// whose element is `display:none` at the current width (e.g. hidden on mobile),
// so the tour never points at an empty spotlight.
const isVisible = (el) => !!el && el.getClientRects().length > 0;

// Keep the highlighted target centered in the viewport so driver measures the popover
// against on-screen geometry — no manual scrolling needed. Two problems make this
// non-trivial; both are handled here (the reader has no scrollable sub-container, it
// is window scroll plus a sticky bar, so a plain scrollIntoView reaches the target):
//
//  1. driver's built-in scroll honours the page's `scroll-behavior: smooth`
//     (index.css), so it would place the popover while that scroll is still animating,
//     against stale coordinates. An INSTANT jump in `onHighlightStarted` (which runs
//     BEFORE driver scrolls and before it places the popover) ignores scroll-behavior
//     and makes driver's own scroll a no-op, so the two never fight.
//  2. driver adds `.driver-active-element` to the target AFTER onHighlightStarted, and
//     driver.css forces `overflow:hidden` on that element's parent. That un-sticks a
//     `position:sticky` target — the reader's `sticky bottom` audio bar — dropping it
//     to the bottom of its (tall) column, off-screen. So we re-center on the next
//     frame, once the class has landed and the bar has settled into its final spot.
const centerTarget = (el) => {
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  requestAnimationFrame(() => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
};

// driver positions the popover during the highlight transition — for the first step,
// before the next-frame re-center above. Re-place it once the target has settled so it
// sits against the final on-screen geometry. Guarded: the tour may be gone by then.
const refreshPopover = (driver) => {
  requestAnimationFrame(() => { try { driver.refresh(); } catch { /* tour torn down */ } });
};

const buildSteps = (blueprint, t) =>
  blueprint
    .filter(({ sel }) => isVisible(document.querySelector(sel)))
    .map(({ sel, titleKey, bodyKey, side, align }) => ({
      element: sel,
      popover: { title: t(titleKey), description: t(bodyKey), side, align },
    }));

const makeDriver = ({ t, steps, single = false, onDone }) => {
  // Reflects the actually-applied theme (ThemeContext toggles this class).
  const isDark = document.documentElement.classList.contains('dark');
  const tour = driver({
    showProgress: !single,
    // The coachmark is a single highlight, not a walkthrough — drop the (disabled)
    // Back button so it reads as a light hint with just "Got it" + close.
    showButtons: single ? ['next', 'close'] : ['next', 'previous', 'close'],
    allowClose: true,
    // A translucent tint blends into the dark page, so dark mode gets a solid,
    // more opaque black overlay to make the highlighted area read clearly.
    overlayColor: isDark ? 'rgb(0, 0, 0)' : 'rgba(3, 25, 18, 0.6)',
    overlayOpacity: isDark ? 0.82 : 0.7,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'qt-tour',
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: single ? t('tour.gotIt') : t('tour.done'),
    progressText: t('tour.progress'),
    steps,
    onHighlightStarted: (el) => centerTarget(el),
    onHighlighted: (_el, _step, { driver }) => refreshPopover(driver),
    onDestroyed: () => { onDone?.(); },
  });
  tour.drive();
  return tour;
};

/** First-visit walkthrough of the reader. */
export function startLibraryTour({ t, onDone } = {}) {
  const steps = buildSteps([
    { sel: '[data-tour="lib-nav"]',      titleKey: 'libraryTour.navTitle',      bodyKey: 'libraryTour.navBody',      side: 'bottom', align: 'start' },
    { sel: '[data-tour="lib-audio"]',    titleKey: 'libraryTour.audioTitle',    bodyKey: 'libraryTour.audioBody',    side: 'top',    align: 'start' },
    { sel: '[data-tour="lib-verse"]',    titleKey: 'libraryTour.verseTitle',    bodyKey: 'libraryTour.verseBody',    side: 'bottom', align: 'start' },
    { sel: '[data-tour="lib-memorize"]', titleKey: 'libraryTour.memorizeTitle', bodyKey: 'libraryTour.memorizeBody', side: 'bottom', align: 'start' },
  ], t);
  if (steps.length === 0) { onDone?.(); return undefined; }
  return makeDriver({ t, steps, onDone });
}

/** First memorize-mode entry — only the controls memorize mode adds. */
export function startMemorizeTour({ t, onDone } = {}) {
  const steps = buildSteps([
    { sel: '[data-tour="mem-test"]',  titleKey: 'libraryTour.memTestTitle',   bodyKey: 'libraryTour.memTestBody',   side: 'bottom', align: 'start' },
    { sel: '[data-tour="lib-verse"]', titleKey: 'libraryTour.memRevealTitle', bodyKey: 'libraryTour.memRevealBody', side: 'bottom', align: 'start' },
    { sel: '[data-tour="mem-mark"]',  titleKey: 'libraryTour.memMarkTitle',   bodyKey: 'libraryTour.memMarkBody',   side: 'top',    align: 'start' },
  ], t);
  if (steps.length === 0) { onDone?.(); return undefined; }
  return makeDriver({ t, steps, onDone });
}

/**
 * One-time coachmark on the verse popover's Play + Tafsir buttons. A single,
 * non-navigational highlight (not a recurring tour); the caller must guard
 * against firing it while a tour is active.
 */
export function startVerseActionsCoachmark({ t, onDone } = {}) {
  if (!isVisible(document.querySelector('[data-tour="verse-actions"]'))) {
    onDone?.();
    return undefined;
  }
  const steps = [{
    element: '[data-tour="verse-actions"]',
    popover: { title: t('libraryTour.coachTitle'), description: t('libraryTour.coachBody'), side: 'top', align: 'center' },
  }];
  return makeDriver({ t, steps, single: true, onDone });
}
