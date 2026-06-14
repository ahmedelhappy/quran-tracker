import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Make a CSS-anchored element draggable via a translate offset.
 *
 * The element keeps its existing layout anchor (e.g. `fixed bottom-24 end-6`)
 * and is nudged from there with `transform: translate(x, y)`, so it works the
 * same in LTR and RTL. The offset is clamped to the viewport and, when a
 * `storageKey` is given, persisted to localStorage.
 *
 * Usage:
 *   const { ref, style, moved, dragHandlers } = useDraggable('key', { axis: 'y' });
 *   <div ref={ref} style={style}>          // the element that moves
 *     <span {...dragHandlers}>grip</span>  // the drag handle (can be the element itself)
 *   </div>
 *
 * Notes:
 *  - Spread `dragHandlers` onto the grab surface; give it `touch-none` so touch
 *    drags aren't stolen by the browser's scroll gesture.
 *  - `moved` is a ref the caller reads inside onClick to tell a real click apart
 *    from the tail end of a drag (only needed when the handle is also clickable).
 *  - We listen on `window` during a drag instead of using setPointerCapture,
 *    which would otherwise redirect `click` away from child buttons.
 *  - `axis` ('x' | 'y') locks dragging to a single direction.
 */
export function useDraggable(storageKey, { axis } = {}) {
  const ref = useRef(null);
  const moved = useRef(false);

  const [pos, setPos] = useState(() => {
    if (!storageKey) return { x: 0, y: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch { /* ignore malformed value */ }
    return { x: 0, y: 0 };
  });

  const onPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return; // primary button / touch only
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    moved.current = false;

    const start = {
      px: e.clientX,
      py: e.clientY,
      x: pos.x,
      y: pos.y,
      naturalLeft: rect.left - pos.x,
      naturalTop: rect.top - pos.y,
      w: rect.width,
      h: rect.height,
    };
    const margin = 8;

    const onMove = (ev) => {
      const dx = ev.clientX - start.px;
      const dy = ev.clientY - start.py;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;

      let nx = axis === 'y' ? start.x : start.x + dx;
      let ny = axis === 'x' ? start.y : start.y + dy;

      const minX = -start.naturalLeft + margin;
      const maxX = window.innerWidth - start.w - start.naturalLeft - margin;
      const minY = -start.naturalTop + margin;
      const maxY = window.innerHeight - start.h - start.naturalTop - margin;
      nx = Math.min(Math.max(nx, minX), maxX);
      ny = Math.min(Math.max(ny, minY), maxY);

      setPos({ x: nx, y: ny });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [pos, axis]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(pos));
  }, [pos, storageKey]);

  return {
    ref,
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
    moved,
    dragHandlers: { onPointerDown },
  };
}
