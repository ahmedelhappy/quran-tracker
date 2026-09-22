import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Zoom for the mushaf — an opt-in escape from "the page fits the window", which
 * stays the default.
 *
 * HOW IT SCALES. Not with a transform. The page's size already comes from a cap
 * in index.css (`--mushaf-fit-w`); zoom multiplies that cap through
 * `--mushaf-zoom`, so the page is genuinely LAID OUT larger. Everything that
 * hit-tests the page — word taps, annotate-mode ink, drag-select, the edge turns —
 * keeps working on real geometry, and the frame's fixed 576x852 space that every
 * overlay is stored in scales with it for free.
 *
 * WHY THE VALUE LIVES OUTSIDE REACT. A trackpad pinch delivers dozens of wheel
 * events a second. Putting the level in the reader's state would re-render the
 * whole reader (both pages, every word) per event. Instead it is written straight
 * onto the scroller as a CSS variable — the frame is a fixed-size box scaled by a
 * container unit, so a new width costs a cheap relayout, not a re-render — and a
 * tiny store tells only the zoom control what to display.
 *
 * WHERE IT APPLIES. Only while the pointer is over the page itself. Ctrl+wheel
 * (and a pinch, which browsers deliver as exactly that) anywhere else is left to
 * the browser, and Ctrl +/−/0 are never touched: people rely on browser zoom for
 * accessibility. Touch pinch is not intercepted either — phones already pinch
 * natively — so touch readers get the +/− buttons.
 *
 * PANNING. A zoomed page is shown through a scroll box exactly as tall as the
 * fitted card. The pan scheme never needs a plain press-and-drag on the page,
 * because every press-and-drag there already means something (a verse range, an
 * ink stroke, a self-test reveal, a swipe):
 *   - wheel / trackpad scroll, Shift+wheel sideways, and the scrollbars;
 *   - one-finger touch pan (native), which the swipe-to-turn yields to;
 *   - the keyboard: after clicking on the page, the browser's own arrow/Page keys
 *     scroll the box (the reader keeps ←/→ and PageUp/PageDown for turning);
 *   - HOLDING SPACE and dragging — the hand tool of every document viewer. While
 *     Space is held, the pan owns the pointer outright (captured on the window
 *     before anything else sees it), so a pan can never also start a range or a
 *     stroke.
 */

export const ZOOM_MIN = 1;   // fit. Smaller than the window has no purpose.
// 300%: on a 1366x768 laptop a fitted page's glyphs are ~18px tall; at 3x they are
// ~55px and a single printed line is already ~1000px wide, so reading means
// panning along every line. Past that the page stops being a page. It also keeps
// the largest spread (2 x 920px cards) to a raster the GPU handles comfortably.
export const ZOOM_MAX = 3;
export const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const STORAGE_KEY = 'mushafZoom';
const EPS = 0.001;
// One Ctrl+wheel gesture keeps zooming the page even if the page shrinks out from
// under the pointer mid-gesture, instead of handing the rest to the browser.
const LATCH_MS = 400;

export const clampZoom = (z) => {
  const c = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  // Snap the last sliver onto fit, so a pinch that ends at 101% doesn't leave the
  // reader in a scroll box a few pixels bigger than its window.
  return c < ZOOM_MIN + 0.02 ? ZOOM_MIN : Math.round(c * 1000) / 1000;
};

const stepFrom = (z, dir) => (dir > 0
  ? ZOOM_STEPS.find((s) => s > z + EPS) ?? ZOOM_MAX
  : [...ZOOM_STEPS].reverse().find((s) => s < z - EPS) ?? ZOOM_MIN);

function readStored() {
  try {
    const v = parseFloat(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) ? clampZoom(v) : ZOOM_MIN;
  } catch { return ZOOM_MIN; }
}
function persist(z) {
  try { localStorage.setItem(STORAGE_KEY, String(z)); } catch { /* storage unavailable */ }
}

// The smallest possible store, so the zoom control can subscribe with
// useSyncExternalStore without the reader re-rendering.
function createZoomStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(v) { if (v !== value) { value = v; listeners.forEach((l) => l()); } },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}

// ── Anchoring ──────────────────────────────────────────────────────────────────
// A point is remembered as a FRACTION OF A PAGE CANVAS. The canvas is the one box
// that scales exactly uniformly — card padding, the running head and the gap in a
// spread don't — so a point on the page lands back exactly where it was.
function canvasNear(root, x) {
  let best = null;
  let bestD = Infinity;
  root.querySelectorAll('.mushaf-canvas').forEach((c) => {
    const r = c.getBoundingClientRect();
    const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
    if (d < bestD) { bestD = d; best = c; }
  });
  return best;
}
function captureAnchor(root, x, y) {
  const el = root && canvasNear(root, x);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { el, fx: (x - r.left) / r.width, fy: (y - r.top) / r.height, x, y };
}
// Scroll so the anchored point sits at (x, y) again. Relative moves only, so it
// is the same arithmetic in a left-to-right and a right-to-left scroller.
function restoreAnchor(scroller, a, x = a.x, y = a.y) {
  if (!a?.el?.isConnected) return false;
  const r = a.el.getBoundingClientRect();
  const dx = r.left + a.fx * r.width - x;
  const dy = r.top + a.fy * r.height - y;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return false;
  scroller.scrollTo({ left: scroller.scrollLeft + dx, top: scroller.scrollTop + dy, behavior: 'instant' });
  return true;
}
// The scroller's client box — clientLeft includes a scrollbar that a
// right-to-left box draws on its LEFT.
function clientBox(s) {
  const r = s.getBoundingClientRect();
  const left = r.left + s.clientLeft;
  const top = r.top + s.clientTop;
  return { left, top, right: left + s.clientWidth, bottom: top + s.clientHeight };
}
function visibleCenter(s) {
  const b = clientBox(s);
  const top = Math.max(b.top, 0);
  const bottom = Math.min(b.bottom, window.innerHeight);
  return { x: (b.left + b.right) / 2, y: bottom > top ? (top + bottom) / 2 : (b.top + b.bottom) / 2 };
}

const isTextEntry = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function useMushafZoom({ scrollerRef, viewportRef, isBlocked }) {
  const [store] = useState(() => createZoomStore(readStored()));
  const zoomRef = useRef(store.get());
  const centerRef = useRef(null);      // the visible centre, as a page anchor
  // Set while the page is resizing because WE zoomed it, so the keep-the-centre
  // observer below doesn't answer our own resize with a correction of its own.
  const selfResizeRef = useRef(false);
  // The offsets our own last programmatic scroll left the box at. Its scroll event
  // arrives a frame later — possibly after the NEXT resize step is already laid
  // out — and re-recording the centre then would record the drifted one.
  const ownScrollRef = useRef(null);
  const markOwnScroll = useCallback(() => {
    const s = scrollerRef.current;
    if (s) ownScrollRef.current = { left: s.scrollLeft, top: s.scrollTop };
  }, [scrollerRef]);
  const isBlockedRef = useRef(isBlocked);
  useEffect(() => { isBlockedRef.current = isBlocked; }, [isBlocked]);

  const writeDom = useCallback((z) => {
    const s = scrollerRef.current;
    if (!s) return;
    s.style.setProperty('--mushaf-zoom', String(z));
    // `data-scrolls` tells the navbar's idle-hide this is a box that does its own
    // scrolling, so a pan is never spent on hiding the bar.
    for (const attr of ['data-zoomed', 'data-scrolls']) {
      if (z > ZOOM_MIN) s.setAttribute(attr, ''); else s.removeAttribute(attr);
    }
  }, [scrollerRef]);

  const recordCenter = useCallback(() => {
    const s = scrollerRef.current;
    if (!s || zoomRef.current <= ZOOM_MIN) { centerRef.current = null; return; }
    const c = visibleCenter(s);
    centerRef.current = captureAnchor(viewportRef.current, c.x, c.y);
  }, [scrollerRef, viewportRef]);

  // Set the level, keeping the page point under `at` ({x, y} in client px) where it
  // was. With no `at`, the middle of what is currently visible stays put. A caller
  // making several steps (a pinch) passes the anchor it captured at the START, so
  // each step lands that same page point back under the pointer — re-capturing it
  // per step would pick up each step's sub-pixel rounding and let it accumulate.
  const apply = useCallback((next, at, heldAnchor) => {
    const s = scrollerRef.current;
    const z = clampZoom(next);
    if (!s || z === zoomRef.current) return;
    const point = at ?? visibleCenter(s);
    const anchor = heldAnchor ?? captureAnchor(viewportRef.current, point.x, point.y);
    zoomRef.current = z;
    // The observer fires after this frame's layout; two frames covers a call made
    // from inside a frame callback as well as one made from an event.
    selfResizeRef.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => { selfResizeRef.current = false; }));
    writeDom(z);
    if (anchor && z > ZOOM_MIN && restoreAnchor(s, anchor, point.x, point.y)) markOwnScroll();
    recordCenter();
    store.set(z);
    persist(z);
  }, [scrollerRef, viewportRef, writeDom, recordCenter, markOwnScroll, store]);

  const zoomIn = useCallback(() => apply(stepFrom(zoomRef.current, 1)), [apply]);
  const zoomOut = useCallback(() => apply(stepFrom(zoomRef.current, -1)), [apply]);
  const reset = useCallback(() => apply(ZOOM_MIN), [apply]);
  const isZoomed = useCallback(() => zoomRef.current > ZOOM_MIN, []);

  // A new page opens where a page is read from: its top, and its RIGHT edge — the
  // mushaf is right-to-left whatever the interface language.
  const toReadingStart = useCallback(() => {
    const s = scrollerRef.current;
    if (!s || zoomRef.current <= ZOOM_MIN) return;
    const rtl = getComputedStyle(s).direction === 'rtl';
    s.scrollTo({ top: 0, left: rtl ? 0 : s.scrollWidth, behavior: 'instant' });
    markOwnScroll();
    recordCenter();
  }, [scrollerRef, recordCenter, markOwnScroll]);

  // Bring a verse into view when it moves off the visible part of a zoomed page
  // (the recitation, or the popover's next/previous verse). A verse too big for
  // the window shows its START — top line, right-hand end.
  const revealWords = useCallback((els) => {
    const s = scrollerRef.current;
    if (!s || zoomRef.current <= ZOOM_MIN || !els?.length) return;
    const pad = 24;
    const b = clientBox(s);
    const view = { left: b.left + pad, right: b.right - pad, top: Math.max(b.top, 0) + pad, bottom: Math.min(b.bottom, window.innerHeight) - pad };
    const rects = [...els].map((el) => el.getBoundingClientRect());
    const u = rects.reduce((a, r) => ({
      left: Math.min(a.left, r.left), right: Math.max(a.right, r.right),
      top: Math.min(a.top, r.top), bottom: Math.max(a.bottom, r.bottom),
    }), { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });
    const first = rects[0];
    const axis = (lo, hi, vlo, vhi, startLo, startHi, fromHigh) => {
      if (hi - lo <= vhi - vlo) return lo < vlo ? lo - vlo : hi > vhi ? hi - vhi : 0;
      // Too big to fit: align its start.
      if (fromHigh) return startHi > vhi || startHi < vlo ? startHi - vhi : 0;
      return startLo < vlo || startLo > vhi ? startLo - vlo : 0;
    };
    const dy = axis(u.top, u.bottom, view.top, view.bottom, first.top, first.bottom, false);
    const dx = axis(u.left, u.right, view.left, view.right, first.left, first.right, true);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    s.scrollBy({ left: dx, top: dy, behavior: reducedMotion() ? 'instant' : 'smooth' });
  }, [scrollerRef]);

  // Apply the stored level before first paint.
  useLayoutEffect(() => { writeDom(zoomRef.current); }, [writeDom]);

  // Ctrl+wheel / pinch over the page, coalesced to one layout per frame.
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return undefined;
    let raf = 0;
    let latchUntil = 0;
    let held = null;   // { anchor, x, y }: the page point this gesture is zooming about
    const pending = { factor: 1, steps: 0, x: 0, y: 0 };
    const flush = () => {
      raf = 0;
      let z = zoomRef.current * pending.factor;
      for (let i = 0; i < Math.abs(pending.steps); i++) z = stepFrom(z, Math.sign(pending.steps));
      pending.factor = 1;
      pending.steps = 0;
      // Same gesture, pointer still: keep zooming about the SAME page point.
      if (!held || Math.abs(held.x - pending.x) > 2 || Math.abs(held.y - pending.y) > 2) {
        held = { anchor: captureAnchor(viewportRef.current, pending.x, pending.y), x: pending.x, y: pending.y };
      }
      apply(z, { x: held.x, y: held.y }, held.anchor);
    };
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const onPage = viewportRef.current?.contains(e.target);
      const now = performance.now();
      if (!onPage && now > latchUntil) return;   // not the page: the browser's zoom
      if (now > latchUntil) held = null;          // a new gesture: anchor afresh
      latchUntil = now + LATCH_MS;
      e.preventDefault();
      // A mouse notch (or a line/page-mode delta) is one step between presets; a
      // pinch streams small pixel deltas and maps continuously, the way the
      // browser's own pinch does (scale = e^(-deltaY / 100)).
      if (e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50) pending.steps += e.deltaY < 0 ? 1 : -1;
      else pending.factor *= Math.exp(-Math.max(-50, Math.min(50, e.deltaY)) / 100);
      pending.x = e.clientX;
      pending.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    s.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      s.removeEventListener('wheel', onWheel);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollerRef, viewportRef, apply]);

  // Keep the middle of the view where it was when the box or the page changes size
  // — a window resize, the tafsir panel being dragged wider, the sidebar opening.
  // The browser clamps the offsets on its own; this keeps the reader's place too.
  useEffect(() => {
    const s = scrollerRef.current;
    const v = viewportRef.current;
    if (!s || !v || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      if (selfResizeRef.current || zoomRef.current <= ZOOM_MIN || !centerRef.current) return;
      const c = visibleCenter(s);
      if (restoreAnchor(s, centerRef.current, c.x, c.y)) markOwnScroll();
    });
    // A scroll the READER made moves the centre worth keeping; one of ours doesn't.
    const onScroll = () => {
      const own = ownScrollRef.current;
      ownScrollRef.current = null;
      if (own && own.left === s.scrollLeft && own.top === s.scrollTop) return;
      recordCenter();
    };
    ro.observe(s);
    ro.observe(v);
    s.addEventListener('scroll', onScroll, { passive: true });
    return () => { ro.disconnect(); s.removeEventListener('scroll', onScroll); };
  }, [scrollerRef, viewportRef, recordCenter, markOwnScroll]);

  // Hold Space to pan with the mouse.
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return undefined;
    let held = false;
    let pan = null;
    let swallowClick = false;
    const setMode = (m) => { if (m) s.setAttribute('data-panning', m); else s.removeAttribute('data-panning'); };
    const isSpace = (e) => e.code === 'Space' || e.key === ' ';
    const onKeyDown = (e) => {
      if (!isSpace(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      // Only for a zoomed page with the pointer over it; never while typing.
      if (!held && (zoomRef.current <= ZOOM_MIN || !s.matches(':hover') || isTextEntry(e.target) || isBlockedRef.current?.())) return;
      e.preventDefault();   // no page scroll, and no click on a focused button
      if (!held) { held = true; setMode('ready'); }
    };
    const onKeyUp = (e) => {
      if (!isSpace(e) || !held) return;
      e.preventDefault();
      held = false;
      if (!pan) setMode(null);
    };
    const onPointerDown = (e) => {
      if (!held || e.button !== 0 || !s.contains(e.target)) return;
      // Window capture runs before every other listener, so this press never
      // reaches the page: no range, no stroke, no selection change.
      e.preventDefault();
      e.stopPropagation();
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, left: s.scrollLeft, top: s.scrollTop };
      setMode('active');
    };
    const onPointerMove = (e) => {
      if (!pan || e.pointerId !== pan.id) return;
      e.stopPropagation();
      s.scrollTo({ left: pan.left - (e.clientX - pan.x), top: pan.top - (e.clientY - pan.y), behavior: 'instant' });
    };
    const onPointerUp = (e) => {
      if (!pan || e.pointerId !== pan.id) return;
      e.stopPropagation();
      pan = null;
      swallowClick = true;
      setMode(held ? 'ready' : null);
    };
    const onClick = (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.stopPropagation();
      e.preventDefault();
    };
    const onBlur = () => { held = false; pan = null; setMode(null); };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [scrollerRef]);

  return { store, zoomIn, zoomOut, reset, isZoomed, toReadingStart, revealWords };
}
