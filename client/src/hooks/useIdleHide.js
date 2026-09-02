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
 * The caller animates with a transform, never by changing layout: reclaiming the
 * space by reflowing would make the mushaf jump, which is worse than the space.
 */
export function useIdleHide({ enabled, holdOpen = false, delay = 2750, revealZone = 60 } = {}) {
  const [hidden, setHidden] = useState(false);
  const timerRef = useRef(null);
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
      timerRef.current = setTimeout(() => setHidden(true), delay);
    };
    const reveal = () => {
      setHidden(false);
      arm();
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
    document.addEventListener('focusin', onFocusIn);
    arm();

    return () => {
      clearTimeout(timerRef.current);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      setHidden(false);   // start visible again next time hiding applies
    };
  }, [active, delay, revealZone]);

  return active && hidden;
}
