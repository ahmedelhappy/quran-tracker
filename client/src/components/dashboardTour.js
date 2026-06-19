import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

/**
 * First-run guided spotlight tour of the Dashboard, built on driver.js.
 *
 * driver.js handles the overlay cut-out, scroll-into-view, keyboard (Esc),
 * overlay-click-to-skip and a corner close button on every step, so the tour
 * is skippable at any point. It is RTL-ready: the popover is appended to
 * <body>, so its text and button order inherit `dir="rtl"` from <html>; the
 * `.qt-tour` overrides in index.css mirror the arrow/close-button and theme it
 * to match the app (emerald + dark mode).
 *
 * Steps target elements by a stable `data-tour="…"` attribute. Any step whose
 * target is not in the DOM (e.g. the New Memorization column for a Hafiz, or
 * the desktop-only Settings link on mobile) is skipped, so the tour never
 * points at an empty spotlight.
 *
 * @returns the driver instance (so the caller can destroy it on unmount), or
 *          `undefined` when no target elements are present.
 */
export function startDashboardTour({ t, onDone } = {}) {
  // Reflects the actually-applied theme (ThemeContext toggles this class, incl. "auto").
  const isDark = document.documentElement.classList.contains('dark');

  // driver.js positions popovers by physical left/right and is not `dir`-aware.
  // Verified against the real layout (incl. RTL) that physical alignment already
  // anchors each popover next to its element — e.g. the streak pill sits at the
  // right of its card in Arabic, and `align: 'start'` keeps the popover tucked to
  // the right beside it. Mirroring `align` for RTL instead pushed it to the centre.
  // The new-mem/review anchors sit on each column's compact header row (the dot +
  // heading), so `side: 'bottom'` tucks the popover right under the heading — the
  // same way the small listen/streak targets read. Anchoring the full-height column
  // instead gave driver.js a tall box and floated the popover far from the heading.
  const blueprint = [
    { sel: '[data-tour="new-mem"]', titleKey: 'tour.newMemTitle', bodyKey: 'tour.newMemBody', side: 'bottom', align: 'start' },
    { sel: '[data-tour="listen"]',  titleKey: 'tour.listenTitle', bodyKey: 'tour.listenBody', side: 'bottom', align: 'start' },
    { sel: '[data-tour="review"]',  titleKey: 'tour.reviewTitle', bodyKey: 'tour.reviewBody', side: 'bottom', align: 'start' },
    { sel: '[data-tour="streak"]',  titleKey: 'tour.streakTitle', bodyKey: 'tour.streakBody', side: 'bottom', align: 'start' },
    { sel: '[data-tour="settings"]', titleKey: 'tour.settingsTitle', bodyKey: 'tour.settingsBody', side: 'bottom', align: 'end' },
  ];

  const steps = blueprint
    .filter(({ sel }) => document.querySelector(sel))
    .map(({ sel, titleKey, bodyKey, side, align }) => ({
      element: sel,
      popover: { title: t(titleKey), description: t(bodyKey), side, align },
    }));

  if (steps.length === 0) {
    onDone?.();
    return undefined;
  }

  const tour = driver({
    showProgress: true,
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
    doneBtnText: t('tour.done'),
    progressText: t('tour.progress'),
    steps,
    onDestroyed: () => { onDone?.(); },
  });

  tour.drive();
  return tour;
}
