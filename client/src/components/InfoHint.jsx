import { useState, useRef, useLayoutEffect, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

/**
 * The app's one way to EXPLAIN something: a small "ⓘ" toggletip.
 *
 * Use it for concepts a newcomer won't know (Juz, Muraja'ah, Tafsir, …), for
 * the description of a setting, and for keyboard-shortcut lists — anything
 * that explains rather than something the user needs in order to act (labels,
 * button text and errors stay visible). Use <Tooltip> to NAME icon buttons.
 *
 * It opens three ways, so the text is never lost:
 *   - mouse hover (closes when the pointer leaves),
 *   - keyboard focus (closes on blur),
 *   - a click or tap, which PINS it open until a second tap, an outside tap or
 *     Escape — phones have no hover, so tap is their way in.
 * While it is open the button is described by the bubble (aria-describedby),
 * so a screen reader reads the text on focus; aria-expanded reports the state.
 *
 * The bubble is portalled with fixed positioning (never clipped by a parent's
 * overflow), stays 8 px inside the viewport on both sides, flips above the
 * button near the bottom edge, and inherits the document `dir` for RTL.
 */
const GAP = 6;
const MARGIN = 8;
const WIDTH = 260;

// Keyboard focus only: a tap focuses the button too, and a tap is handled as a
// click (pin), so it must not also count as a focus-open.
const isFocusVisible = (el) => {
  try { return el.matches(':focus-visible'); } catch { return true; }
};

export default function InfoHint({ text, label, className = '', size = 'sm' }) {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();
  const open = pinned || hover || focused;
  // Hover closes after a short delay, so the pointer can cross the gap into
  // the bubble (to select or read long text) without it vanishing.
  const hoverTimer = useRef(null);
  const skipFocusOpen = useRef(false);
  const hoverOn = useCallback((e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer.current);
    setHover(true);
  }, []);
  const hoverOff = useCallback((e) => {
    if (e.pointerType === 'touch') return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(false), 150);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const close = useCallback(() => { setPinned(false); setHover(false); setFocused(false); }, []);

  useLayoutEffect(() => {
    // Measured before paint, so a reopened bubble never shows at its old spot.
    if (!open || !btnRef.current || !popRef.current) return;
    const b = btnRef.current.getBoundingClientRect();
    const p = popRef.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - MARGIN * 2);

    let place = 'bottom';
    if (b.bottom + p.height + GAP + MARGIN > window.innerHeight && b.top - p.height - GAP > MARGIN) {
      place = 'top';
    }
    const centerX = b.left + b.width / 2;
    let left = centerX - width / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
    const top = place === 'top' ? b.top - p.height - GAP : b.bottom + GAP;
    setPos({ top, left, width });
  }, [open, text]);

  // Escape closes however it was opened and hands focus back to the button.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
      // Focus goes back to the button without reopening the hint.
      if (pinned || focused) { skipFocusOpen.current = true; btnRef.current?.focus(); skipFocusOpen.current = false; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, pinned, focused, close]);

  const iconCls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          // A click on a hover- or focus-opened hint pins it; a click on a
          // pinned one closes it.
          if (pinned) close();
          else setPinned(true);
        }}
        onPointerEnter={hoverOn}
        onPointerLeave={hoverOff}
        onFocus={(e) => { if (!skipFocusOpen.current && isFocusVisible(e.currentTarget)) setFocused(true); }}
        onBlur={() => { setFocused(false); setPinned(false); }}
        aria-label={label ?? t('hints.moreInfo')}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        className={`inline-flex items-center justify-center rounded-full text-[#9aa3a0] dark:text-gray-500 hover:text-[#003527] dark:hover:text-emerald-400 hover:bg-[#003527]/5 dark:hover:bg-emerald-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004f35]/40 transition-colors align-middle shrink-0 ${size === 'xs' ? 'w-4 h-4' : 'w-5 h-5'} ${open ? 'text-[#003527] dark:text-emerald-400' : ''} ${className}`}
      >
        <FiInfo className={iconCls} aria-hidden="true" />
      </button>

      {open && createPortal(
        <>
          {/* Only a PINNED hint gets the outside-tap catcher: under a hover-open
              one it would sit beneath the pointer and close it at once. */}
          {pinned && <div className="fixed inset-0 z-[998]" onClick={close} aria-hidden="true" />}
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            onPointerEnter={hoverOn}
            onPointerLeave={hoverOff}
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? WIDTH, zIndex: 999 }}
            className={`rounded-xl bg-white dark:bg-gray-800 border border-[#dce2f3] dark:border-gray-700 shadow-xl px-4 py-3 text-xs leading-relaxed text-[#404944] dark:text-gray-300 text-start whitespace-normal normal-case tracking-normal font-normal transition-opacity duration-100 ${
              pos ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {text}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
