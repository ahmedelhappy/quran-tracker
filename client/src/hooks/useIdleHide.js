import { useState, useEffect, useRef } from 'react';

/**
 * Hide a fixed top bar once the reader has been still for a while, and bring it
 * straight back when they reach for it.
 *
 * Why idle-hide rather than the usual scroll-direction hiding: the reader page is
 * sized to fit the window, so there is normally nothing to scroll — a
 * scroll-driven bar would simply never hide. Time is the signal that's actually
 * available here.
 *
 * It comes back on any of:
 *   - the pointer moving into the top `revealZone` px of the window,
 *   - keyboard focus entering the bar (so Tab can always reach it),
 *   - Escape,
 *   - a touch anywhere in that top zone (touch has no hover to trigger on).
 *
 * It never hides while `holdOpen` is true — one of the bar's own menus being open,
 * a tour running — and never on a device without hover at all, where there is no
 * cheap way to get it back.
 *
 * It also SPENDS THE FIRST BIT OF SCROLL on itself: a wheel gesture downward
 * hides the bar before the page moves, and once hidden the same gesture scrolls
 * normally. Scrolling back up at the top of the page spends its first bit
 * bringing the bar back. That is the behaviour people expect from a bar that
 * hides, and it works even on a page that has somewhere to scroll — unlike
 * hiding purely on scroll direction, which a page that fits the window would
 * never trigger at all.
 *
 * The caller animates with a transform, never by changing layout: reclaiming the
 * space by reflowing would make the mushaf jump, which is worse than the space.
 */
export function useIdleHide({ enabled, holdOpen = false, delay = 2750, revealZone = 60, scrollStep = 60 } = {}) {
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef(null);
  // The listeners below close over this rather than `hidden`, so they don't have
  // to be torn down and rebuilt every time the bar toggles.
  const hiddenRef = useRef(false);
  const wheelSpentRef = useRef(0);
  // A device with no hover can't reveal by moving the pointer, so never hide there.
  const [hoverCapable] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(hover: hover)').matches
  );

  // Whether hiding applies at all right now. Kept out of the effect so turning it
  // off is a plain derivation rather than a state write during render.
  const active = enabled && hoverCapable && !holdOpen;

  useEffect(() => {
    if (!active) return undefined;

    const arm = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { hiddenRef.current = true; setHidden(true); }, delay);
    };
    const setHiddenBoth = (v) => { hiddenRef.current = v; setHidden(v); };
    const reveal = () => {
      setHiddenBoth(false);
      arm();
    };

    // Spend the first `scrollStep` px of a wheel gesture on the bar itself.
    const onWheel = (e) => {
      // Panels and lists do their own scrolling — never eat a gesture aimed at one.
      if (e.target?.closest?.('[data-testid="tafsir-panel"], aside, [data-scrolls]')) return;
      if (e.deltaY > 0 && !hiddenRef.current) {
        e.preventDefault();                       // the page holds still...
        wheelSpentRef.current += e.deltaY;
        if (wheelSpentRef.current >= scrollStep) { // ...until the bar is away
          wheelSpentRef.current = 0;
          setHiddenBoth(true);
        }
        return;
      }
      if (e.deltaY < 0 && hiddenRef.current && window.scrollY <= 0) {
        e.preventDefault();
        wheelSpentRef.current += -e.deltaY;
        if (wheelSpentRef.current >= scrollStep) {
          wheelSpentRef.current = 0;
          reveal();
        }
        return;
      }
      wheelSpentRef.current = 0;                  // a gesture that scrolls resets it
    };

    const onPointerMove = (e) => {
      if (e.clientY <= revealZone) reveal();
      else arm();                                  // active elsewhere: restart the clock
    };
    const onTouch = (e) => {
      const y = e.touches?.[0]?.clientY ?? 0;
      if (y <= revealZone) reveal(); else arm();
    };
    const onKey = (e) => { if (e.key === 'Escape') reveal(); else arm(); };
    const onFocusIn = (e) => { if (e.target?.closest?.('header')) reveal(); };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('focusin', onFocusIn);
    arm();

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
      document.removeEventListener('focusin', onFocusIn);
      wheelSpentRef.current = 0;
      hiddenRef.current = false;
      setHidden(false);   // start visible again next time hiding applies
    };
  }, [active, delay, revealZone, scrollStep]);

  return active && hidden;
}
