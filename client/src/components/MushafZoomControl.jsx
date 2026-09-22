import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { FiZoomIn, FiZoomOut, FiMinimize2 } from 'react-icons/fi';
import Tooltip from './Tooltip';
import { ZOOM_MIN, ZOOM_MAX } from '../hooks/useMushafZoom';

const BTN = 'inline-flex items-center justify-center w-8 h-8 rounded-full shrink-0 text-[#404944] dark:text-gray-300 ' +
  'hover:bg-[#f0f4ff] dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors';

// The reader's zoom control: a magnifier that opens into − · level · + · fit.
//
// WHERE: in the sticky audio bar — the one strip of the reader that is always on
// screen, already counted in the page's height budget and outside the zoomed
// page's scroll box. So it can never cover a glyph, never crowds the pencil, the
// eye or the footer tick, and stays in reach however far a zoomed page is panned.
// On touch screens it is the only way to zoom the page (a pinch there is left to
// the browser).
//
// WHY A MAGNIFIER THAT OPENS: the bar has room for one more button, not four —
// measured, the full group wrapped it onto a second row at every desktop width,
// and a taller bar covers the page's footer. So the open controls are drawn OVER
// the bar's own controls, anchored at the magnifier (opening toward the rest of
// the bar from whichever end it sits at), and never change its layout.
//
// It subscribes to the zoom store directly, so a pinch re-renders this and not
// the reader.
export default function MushafZoomControl({ zoom, fmtNum, className = '' }) {
  const { t } = useTranslation();
  const level = useSyncExternalStore(zoom.store.subscribe, zoom.store.get);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const zoomed = level > ZOOM_MIN;
  const pct = t('library.zoom.percent', { n: fmtNum(Math.round(level * 100)) });

  // Closes the way the reader's other menus do: a press anywhere else (capture
  // phase, never swallowed), or Escape — which it takes, so the same key doesn't
  // also close the panel or selection underneath.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = (
    <Tooltip label={zoomed ? t('library.zoom.toggleZoomed', { pct }) : t('library.zoom.toggle')}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={zoomed ? t('library.zoom.toggleZoomed', { pct }) : t('library.zoom.toggle')}
        data-testid="zoom-toggle"
        className={`${BTN} relative ${zoomed || open ? 'text-[#004f35] dark:text-emerald-400' : ''}`}
      >
        <FiZoomIn className="w-4 h-4" />
        {/* Zoomed and folded away: a dot says the page is not at fit. */}
        {zoomed && !open && <span className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-[#004f35] dark:bg-emerald-400" aria-hidden="true" />}
      </button>
    </Tooltip>
  );

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      {/* Hidden (not removed) while open: the panel's own copy sits exactly over it. */}
      <div className={open ? 'invisible' : undefined}>{toggle}</div>
      {open && (
        <div
          role="group"
          aria-label={t('library.zoom.group')}
          data-testid="zoom-panel"
          className="absolute start-0 sm:start-auto sm:end-0 top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 rounded-full border border-[#dce2f3] dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md p-0.5"
        >
          <Tooltip label={t('library.zoom.out')}>
            <button type="button" onClick={zoom.zoomOut} disabled={!zoomed} data-testid="zoom-out" className={BTN}>
              <FiZoomOut className="w-4 h-4" />
            </button>
          </Tooltip>
          <span data-testid="zoom-level" aria-live="polite" className="min-w-12 text-center text-xs font-semibold tabular-nums text-[#003527] dark:text-gray-200">
            {pct}
          </span>
          <Tooltip label={t('library.zoom.in')}>
            <button type="button" onClick={zoom.zoomIn} disabled={level >= ZOOM_MAX} data-testid="zoom-in" className={BTN}>
              <FiZoomIn className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip label={t('library.zoom.fit')}>
            <button type="button" onClick={zoom.reset} disabled={!zoomed} data-testid="zoom-fit" className={BTN}>
              <FiMinimize2 className="w-4 h-4" />
            </button>
          </Tooltip>
          <span className="w-px h-5 bg-[#dce2f3] dark:bg-gray-600 mx-0.5" aria-hidden="true" />
          {toggle}
        </div>
      )}
    </div>
  );
}
