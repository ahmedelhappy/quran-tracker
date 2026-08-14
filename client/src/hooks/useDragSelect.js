import { useRef, useCallback } from 'react';

// Drag to multi-select across a grid of tiles (Juz / Surah / Hizb / ¼-Hizb).
// Pressing and sweeping toggles every tile the pointer crosses, exactly as if each
// were clicked. Works for mouse + touch (moves are read off `window` and the tile
// under the pointer is found with elementFromPoint, so touch's implicit pointer
// capture doesn't hide sibling tiles). Selection activates only once the drag
// clearly leaves the origin tile, so a plain click still just toggles one tile and
// a vertical scroll isn't hijacked (pair with `touch-action: pan-y` on the tiles).
//
// Usage per grid:
//   const ds = useDragSelect();
//   <button data-tile-id={id} className="… touch-pan-y"
//     onPointerDown={(e) => ds.start(e, id, toggle)}
//     onClick={() => ds.handleClick(id, toggle)} />
// where `toggle(id)` performs the same toggle a click would.
export function useDragSelect() {
  const suppressClick = useRef(false);

  const start = useCallback((e, startId, toggle) => {
    if (e.button != null && e.button !== 0) return; // primary button / touch only
    const sx = e.clientX, sy = e.clientY;
    let active = false;
    const done = new Set();

    const tileAt = (x, y) => document.elementFromPoint(x, y)?.closest('[data-tile-id]');

    const move = (ev) => {
      const tile = tileAt(ev.clientX, ev.clientY);
      if (!active) {
        // Activate only once the drag has clearly swept onto a DIFFERENT tile.
        const far = Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6;
        if (!(far && tile && tile.dataset.tileId !== String(startId))) return;
        active = true;
        toggle(startId);                 // the origin tile (its trailing click is suppressed)
        done.add(String(startId));
      }
      ev.preventDefault();               // stop scrolling once we own the gesture
      if (tile) {
        const id = tile.dataset.tileId;
        if (!done.has(id)) { done.add(id); toggle(Number(id)); }
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (active) suppressClick.current = true; // swallow the click that ends a drag
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }, []);

  const handleClick = useCallback((id, toggle) => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    toggle(id);
  }, []);

  return { start, handleClick };
}
