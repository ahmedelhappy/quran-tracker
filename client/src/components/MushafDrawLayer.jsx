import { useRef, useState, useEffect } from 'react';
import { FiCheck, FiX, FiMessageSquare } from 'react-icons/fi';

// ── Free-form ink + text layer for one mushaf page ───────────────────────────
// An SVG overlay (ink) plus an HTML overlay (text notes), both siblings of the
// marks layer inside `.mushaf-frame`. The coordinate space is the page's fixed
// internal space EXTENDED into the surrounding margins (x ∈ [-52, 576], y ∈
// [-34, 834]) so users can annotate the gutter too; the frame's uniform CSS
// scale carries both overlays, so every coordinate scales pixel-perfectly with
// the page. Coordinates match the server's extended bounds (annotationController).
//
// The parent owns the strokes array and text-note list (so the toolbar/undo act
// on them) and debounces saves; this component turns pointer input into strokes
// (pen/highlighter), erases whole strokes (eraser, never text), and places/edits/
// moves/deletes free-floating text notes (the 'text' tool). When not `active`
// (and not `visible`) it renders nothing — the reader's clean-view toggle.

const CANVAS_W = 524;
const CANVAS_H = 800;
const MARGIN_X = 52;      // must match the server's extended bounds
const MARGIN_TOP = 34;
const MARGIN_BOTTOM = 34;
const X_MIN = -MARGIN_X;
const X_MAX = CANVAS_W + MARGIN_X;   // 576
const Y_MIN = -MARGIN_TOP;
const Y_MAX = CANVAS_H + MARGIN_BOTTOM; // 834
const VBW = X_MAX - X_MIN;  // 628
const VBH = Y_MAX - Y_MIN;  // 868
const MIN_STEP = 2;         // decimate: skip points closer than this
const SNAP_RAD = (5 * Math.PI) / 180; // snap a shift-line within 5° of 0/45/90…

const round1 = (v) => Math.round(v * 10) / 10;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const distToSegSq = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx, cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
};
const strokeHit = (stroke, x, y, threshold) => {
  const pts = stroke.points;
  const th2 = threshold * threshold;
  if (pts.length === 1) return (pts[0][0] - x) ** 2 + (pts[0][1] - y) ** 2 <= th2;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegSq(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= th2) return true;
  }
  return false;
};
const toPath = (pts) => {
  if (!pts.length) return '';
  if (pts.length === 1) { const [x, y] = pts[0]; return `M ${x} ${y} L ${x} ${y}`; }
  return 'M ' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L ');
};
// Straight line from anchor to pt, snapped to the nearest 45° when within 5°.
const snapLine = (anchor, pt) => {
  const dx = pt[0] - anchor[0], dy = pt[1] - anchor[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return pt;
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const nearest = Math.round(ang / step) * step;
  if (Math.abs(ang - nearest) <= SNAP_RAD) {
    return [round1(anchor[0] + Math.cos(nearest) * len), round1(anchor[1] + Math.sin(nearest) * len)];
  }
  return [round1(pt[0]), round1(pt[1])];
};

export default function MushafDrawLayer({
  strokes,
  active = false,
  visible = true,
  tool = 'pen',
  color = 'ink',
  width = 3,
  onStrokesChange,
  textNotes = [],
  onCreateText,
  onUpdateText,
  onDeleteText,
  onReadText,
  placeholder = 'Note',
}) {
  const svgRef = useRef(null);
  const [live, setLive] = useState(null);
  const liveRef = useRef(null);
  const drawingRef = useRef(false);
  const erasingRef = useRef(false);
  const lastRef = useRef(null);
  const shiftRef = useRef(null);  // { anchorIdx } while a shift-straight segment is active
  const strokesRef = useRef(strokes);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);

  // Inline editor state for placing / editing a text note.
  const [editing, setEditing] = useState(null);       // { id?, x, y } | null
  const [draft, setDraft] = useState('');
  const [dragPreview, setDragPreview] = useState(null); // { id, x, y } while dragging a note

  const clientToXY = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = clamp(X_MIN + ((clientX - rect.left) / rect.width) * VBW, X_MIN, X_MAX);
    const y = clamp(Y_MIN + ((clientY - rect.top) / rect.height) * VBH, Y_MIN, Y_MAX);
    return [round1(x), round1(y)];
  };

  const eraseAt = (x, y) => {
    const cur = strokesRef.current;
    const kept = cur.filter((s) => !strokeHit(s, x, y, Math.max(s.width / 2 + 6, 8)));
    if (kept.length !== cur.length) { strokesRef.current = kept; onStrokesChange?.(kept); }
  };

  const openEditor = (id, x, y, text = '') => { setEditing({ id, x, y }); setDraft(text); };
  const closeEditor = () => { setEditing(null); setDraft(''); };
  const commitEditor = () => {
    if (!editing) return;
    const text = draft.trim();
    if (editing.id) {
      if (!text) onDeleteText?.(editing.id);           // cleared an existing note → delete
      else onUpdateText?.(editing.id, { text });
    } else if (text) {
      onCreateText?.(editing.x, editing.y, text, color); // new note
    }
    closeEditor();
  };

  const onDown = (e) => {
    if (!active || e.button === 2) return;
    e.preventDefault();
    const [x, y] = clientToXY(e.clientX, e.clientY);
    if (tool === 'text') { openEditor(null, x, y); return; }
    svgRef.current.setPointerCapture?.(e.pointerId);
    if (tool === 'eraser') { erasingRef.current = true; eraseAt(x, y); return; }
    drawingRef.current = true;
    lastRef.current = [x, y];
    liveRef.current = [[x, y]];
    shiftRef.current = null;
    setLive([[x, y]]);
  };

  const onMove = (e) => {
    if (!active) return;
    if (tool === 'eraser') { if (erasingRef.current) { const [x, y] = clientToXY(e.clientX, e.clientY); eraseAt(x, y); } return; }
    if (!drawingRef.current) return;
    const [x, y] = clientToXY(e.clientX, e.clientY);

    if (e.shiftKey && (tool === 'pen' || tool === 'highlighter')) {
      // Shift → straight line from the anchor (the point where Shift engaged) to
      // the pointer, replacing anything drawn after the anchor.
      if (!shiftRef.current) shiftRef.current = { anchorIdx: Math.max(0, liveRef.current.length - 1) };
      const anchor = liveRef.current[shiftRef.current.anchorIdx];
      const straight = snapLine(anchor, [x, y]);
      setLive([...liveRef.current.slice(0, shiftRef.current.anchorIdx + 1), straight]);
      return;
    }
    if (shiftRef.current) {
      // Shift released mid-stroke → bake the straight segment, resume freehand.
      const anchor = liveRef.current[shiftRef.current.anchorIdx];
      const straight = snapLine(anchor, [x, y]);
      liveRef.current = [...liveRef.current.slice(0, shiftRef.current.anchorIdx + 1), straight];
      shiftRef.current = null;
      lastRef.current = straight;
    }
    const last = lastRef.current;
    if (last && Math.hypot(x - last[0], y - last[1]) < MIN_STEP) return;
    lastRef.current = [x, y];
    (liveRef.current || (liveRef.current = [])).push([x, y]);
    setLive(liveRef.current.slice());
  };

  const endStroke = (e) => {
    svgRef.current?.releasePointerCapture?.(e.pointerId);
    if (tool === 'eraser') { erasingRef.current = false; return; }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    let pts = liveRef.current;
    // If Shift is still held at release, commit the straight segment.
    if (shiftRef.current && pts) {
      const anchor = pts[shiftRef.current.anchorIdx];
      const straight = snapLine(anchor, [e ? clientToXY(e.clientX, e.clientY)[0] : anchor[0], e ? clientToXY(e.clientX, e.clientY)[1] : anchor[1]]);
      pts = [...pts.slice(0, shiftRef.current.anchorIdx + 1), straight];
    }
    shiftRef.current = null;
    liveRef.current = null;
    setLive(null);
    if (pts && pts.length >= 1) {
      const next = [...strokesRef.current, { tool, color, width, points: pts }];
      strokesRef.current = next;
      onStrokesChange?.(next);
    }
  };

  // ── Text-note drag (draw mode only): move updates x/y; a tap opens the editor ──
  const onNoteDown = (e, note) => {
    if (!active) return;
    e.stopPropagation();
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, moved: false };
    const move = (ev) => {
      if (Math.abs(ev.clientX - start.px) > 3 || Math.abs(ev.clientY - start.py) > 3) start.moved = true;
      if (start.moved) { const [x, y] = clientToXY(ev.clientX, ev.clientY); setDragPreview({ id: note._id, x, y }); }
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragPreview(null);
      if (start.moved) { const [x, y] = clientToXY(ev.clientX, ev.clientY); onUpdateText?.(note._id, { x, y }); }
      else openEditor(note._id, note.x, note.y, note.text); // a tap → edit
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!visible && !active) return null;

  return (
    <>
      <svg
        ref={svgRef}
        className={`mushaf-draw-svg${active ? ' is-active' : ''}`}
        viewBox={`${X_MIN} ${Y_MIN} ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        style={active ? { touchAction: 'none' } : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        onContextMenu={active ? (e) => e.preventDefault() : undefined}
      >
        {strokes.map((s, i) => (
          <path key={i} d={toPath(s.points)} strokeWidth={s.width} className={`mushaf-stroke mushaf-stroke--${s.tool} mushaf-stroke--${s.color}`} />
        ))}
        {live && (
          <path d={toPath(live)} strokeWidth={width} className={`mushaf-stroke mushaf-stroke--${tool === 'highlighter' ? 'highlighter' : 'pen'} mushaf-stroke--${color}`} />
        )}
      </svg>

      {/* Text notes + inline editor — an HTML overlay in the same extended box */}
      <div className="mushaf-text-layer" aria-hidden={!active}>
        {/* Text notes render as an ICON only — the text itself never draws on the
            mushaf. Read mode: click opens the note panel. Draw mode: tap edits,
            drag moves, × deletes. Hover shows a short excerpt. */}
        {textNotes.map((n) => {
          const nx = dragPreview?.id === n._id ? dragPreview.x : n.x;
          const ny = dragPreview?.id === n._id ? dragPreview.y : n.y;
          if (editing && editing.id === n._id) return null; // hidden while being edited
          const excerpt = (n.text || '').length > 60 ? (n.text || '').slice(0, 60) + '…' : (n.text || '');
          return (
            <div
              key={n._id}
              className={`mushaf-text-note-anchor${active ? ' is-editable' : ''}`}
              style={{ left: `${nx - X_MIN}px`, top: `${ny - Y_MIN}px` }}
            >
              <button
                type="button"
                className={`mushaf-text-note-icon mushaf-text-note--${n.color || 'ink'}`}
                title={excerpt}
                aria-label={excerpt}
                onPointerDown={active ? (e) => onNoteDown(e, n) : undefined}
                onClick={active ? undefined : (e) => { e.stopPropagation(); onReadText?.(n); }}
              >
                <FiMessageSquare className="w-full h-full" />
              </button>
              {active && (
                <button
                  type="button"
                  className="mushaf-text-note-del"
                  aria-label="Delete note"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDeleteText?.(n._id); }}
                >
                  <FiX className="w-full h-full" />
                </button>
              )}
            </div>
          );
        })}

        {editing && (
          <div className="mushaf-text-editor" style={{ left: `${editing.x - X_MIN}px`, top: `${editing.y - Y_MIN}px` }}>
            <input
              autoFocus
              value={draft}
              maxLength={300}
              dir="auto"
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEditor(); else if (e.key === 'Escape') closeEditor(); }}
              onBlur={commitEditor}
              className={`mushaf-text-input mushaf-text-note--${color}`}
            />
            <button type="button" className="mushaf-text-editor-ok" aria-label="Save note" onMouseDown={(e) => e.preventDefault()} onClick={commitEditor}>
              <FiCheck className="w-full h-full" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
