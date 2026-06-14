import { useState, useRef, useLayoutEffect, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { FiInfo } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

/**
 * A tiny "ⓘ" button that TAPS open (works on touch, unlike a hover tooltip) to
 * reveal a one- or two-sentence plain-language explanation of a CONCEPT.
 *
 * Use this to teach terms a newcomer won't know (Juz, Muraja'ah, Tafsir, …).
 * Use <Tooltip> instead for naming buttons.
 *
 * - Closes on outside click or Escape, and is keyboard operable.
 * - The popover is portalled with fixed positioning (never clipped, flips up
 *   near the bottom edge) and inherits the document `dir` for RTL.
 */
const GAP = 6;
const MARGIN = 8;
const WIDTH = 260;

export default function InfoHint({ text, label, className = '', size = 'sm' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const b = btnRef.current.getBoundingClientRect();
    const p = popRef.current.getBoundingClientRect();

    let place = 'bottom';
    if (b.bottom + p.height + GAP + MARGIN > window.innerHeight && b.top - p.height - GAP > MARGIN) {
      place = 'top';
    }
    const centerX = b.left + b.width / 2;
    let left = centerX - WIDTH / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - WIDTH - MARGIN));
    const top = place === 'top' ? b.top - p.height - GAP : b.bottom + GAP;
    setPos({ top, left });
  }, [open, text]);

  // Close on Escape; reposition is handled by re-measuring on open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const iconCls = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label ?? t('hints.moreInfo')}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`inline-flex items-center justify-center rounded-full text-[#9aa3a0] dark:text-gray-500 hover:text-[#003527] dark:hover:text-emerald-400 hover:bg-[#003527]/5 dark:hover:bg-emerald-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004f35]/40 transition-colors align-middle ${size === 'xs' ? 'w-4 h-4' : 'w-5 h-5'} ${className}`}
      >
        <FiInfo className={iconCls} />
      </button>

      {open && createPortal(
        <>
          {/* Invisible catcher closes the popover on any outside interaction */}
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH, zIndex: 999 }}
            className={`rounded-xl bg-white dark:bg-gray-800 border border-[#dce2f3] dark:border-gray-700 shadow-xl px-4 py-3 text-xs leading-relaxed text-[#404944] dark:text-gray-300 transition-opacity duration-100 ${
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
