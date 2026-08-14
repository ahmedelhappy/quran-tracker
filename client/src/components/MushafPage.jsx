import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { SURAH_PAGES } from '../data/surahPages';
import BasmalaGlyph from './BasmalaGlyph';

const surahName = (n) => SURAH_PAGES.find((s) => s.number === n)?.arabic ?? '';

// One printed mushaf page: 15 lines of pre-spaced QCF glyphs plus the surah-name
// plates and basmala lines. Purely presentational — selection/audio/self-test
// state is owned by the reader and passed down; words are addressed by their
// stable `verseKey` (+ `position`).
//
// Self-test styles (`concealMode`):
//   'hide'  — every word blurred, revealed as a PREFIX of the page's reading
//             order (the reader owns the watermark; `isConcealed(verseKey,
//             position)` answers per word). Hovering peeks ONLY the word
//             directly under the cursor — never its neighbours, so the reader
//             still has to recall the rest themselves. A mouse DRAG across
//             words asks the reader to advance the watermark through them
//             (`onRevealThrough`) one word at a time — permanent. A plain
//             click cycles the verse: reveal → select → hide+deselect. On
//             touch, a tap reveals.
//   'cover' — text visible; hovering blurs the NEXT ~5 words in reading order
//             (to the LEFT of the cursor on the line) so you can point at the
//             word you're reciting. Transient. On touch, a tap blurs the verse ~2s.
//   null    — normal reading (hover highlights the verse for the actions).
export default function MushafPage({
  pageData,
  fontFamily,
  selectedVerseKey,
  playingVerseKey,
  concealMode,
  isConcealed,
  onSelectVerse,
  onRevealVerse,
  onRevealThrough,
  onHideVerse,
  // ── Account-saved annotations (verse-anchored, never pixel/offset) ──
  // highlightFor(verseKey, position) → colour name | null (respects a word span);
  // noteVerses / hardVerses are Sets of verse keys; onOpenNote(verseKey) opens the
  // note panel from the end-medallion indicator (null ⇒ indicator is decorative,
  // e.g. while the "mark verses" picking mode owns taps). Rendering stays purely
  // background/overlay so the exact pre-spaced glyph layout is untouched.
  highlightFor,
  noteVerses,
  hardVerses,
  onOpenNote,
  noteIndicatorLabel,
}) {
  const [hoverWord, setHoverWord] = useState(null);       // { line, index, verseKey } | null
  const [tapBlurVerse, setTapBlurVerse] = useState(null); // touch cover-mode transient
  const tapTimerRef = useRef(null);
  const dragRef = useRef(null);                           // active mouse drag { word, x, y, moved }
  const suppressClickRef = useRef(false);                 // swallow the click after a handled mouse press
  const { lines, ornamental } = pageData;
  const rootRef = useRef(null);

  // Touch screens have no hover — in "cover" mode a tap stands in for it.
  const noHover = useMemo(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches,
    []
  );

  // A page/mode change starts a clean slate (React's "adjust state on prop
  // change" pattern — no extra paint, no effect).
  const resetKey = `${pageData.page}|${concealMode ?? ''}`;
  const [seenKey, setSeenKey] = useState(resetKey);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setHoverWord(null);
    setTapBlurVerse(null);
  }
  useEffect(() => { clearTimeout(tapTimerRef.current); dragRef.current = null; }, [pageData, concealMode]);
  useEffect(() => () => clearTimeout(tapTimerRef.current), []);

  // Hide-mode peek: ONLY the word directly under the cursor (no neighbours —
  // peeking ahead would hand the reader words they're meant to recall).
  const inPeek = (ln, idx) => hoverWord && hoverWord.line === ln && idx === hoverWord.index;
  // Cover blurs the words AHEAD in reading order (next slots, visually to the
  // left of the cursor on the same line); the hovered word and those already
  // read (to its right) stay clear.
  const inCoverBlur = (ln, idx) => hoverWord && hoverWord.line === ln && idx > hoverWord.index && idx <= hoverWord.index + 5;

  const handleWordClick = (w) => {
    if (concealMode === 'hide') {
      // Three-state cycle per verse: reveal → select → hide + deselect. Gated
      // on THIS word's own concealed state (the watermark can leave a verse
      // partially revealed after a drag stopped mid-verse).
      if (isConcealed?.(w.verseKey, w.position)) onRevealVerse?.(w.verseKey);
      else if (w.verseKey === selectedVerseKey) onHideVerse?.(w.verseKey);
      else onSelectVerse?.(w.verseKey);
      return;
    }
    if (concealMode === 'cover' && noHover && w.charType === 'word') {
      // Touch stand-in for hover: briefly blur this verse.
      clearTimeout(tapTimerRef.current);
      setTapBlurVerse(w.verseKey);
      tapTimerRef.current = setTimeout(() => setTapBlurVerse(null), 2000);
      return;
    }
    onSelectVerse?.(w.verseKey);
  };

  // A mouse press that stays on one word is a click (handled by onClick); a press
  // that drags across words reveals them (onPointerEnter). On release we clear the
  // drag and, after a real drag, swallow the trailing click. Touch never starts a
  // drag here, so it can't fight the page-turn swipe.
  useEffect(() => {
    const onUp = (e) => {
      const d = dragRef.current;
      dragRef.current = null;
      if (d && e.pointerType === 'mouse' && d.moved) suppressClickRef.current = true;
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  // Fixed-canvas safety net: the canvas width fits every *normal* line, but a
  // handful of unusually wide lines exist in the print (e.g. p443). After the
  // page's glyph font is applied, shrink only the lines that would overflow.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled || !rootRef.current) return;
      rootRef.current.querySelectorAll('.mushaf-line').forEach((line) => {
        line.style.fontSize = '';
        const words = line.querySelectorAll('.mushaf-word');
        if (!words.length) return;
        let left = Infinity, right = -Infinity;
        words.forEach((w) => { const b = w.getBoundingClientRect(); left = Math.min(left, b.left); right = Math.max(right, b.right); });
        const contentW = right - left;
        const boxW = line.getBoundingClientRect().width; // fixed canvas line width (scaled)
        if (contentW > boxW + 0.5) line.style.fontSize = `${(32 * boxW / contentW).toFixed(2)}px`;
      });
    };
    (async () => {
      try {
        const face = fontFamily ? `32px "${fontFamily}"` : null;
        for (let i = 0; i < 60 && !cancelled; i++) {
          if (!face || document.fonts?.check?.(face)) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        await document.fonts?.ready;
      } catch { /* measure anyway */ }
      if (!cancelled) requestAnimationFrame(fit);
    })();
    return () => { cancelled = true; };
  }, [pageData, fontFamily]);

  return (
    <div
      ref={rootRef}
      className={`mushaf-page${ornamental ? ' is-ornamental' : ''}`}
      onMouseLeave={() => setHoverWord(null)}
    >
      {lines.map((line) => {
        // Each row is pinned to its true printed line number (1..15). Ornamental
        // pages 1–2 aren't a 15-line grid — they flow centred, so no row pinning.
        const rowStyle = ornamental ? undefined : { gridRow: line.lineNumber };
        if (line.type === 'blank') {
          return ornamental ? null : <div key={`e-${line.lineNumber}`} className="mushaf-blank" style={rowStyle} aria-hidden="true" />;
        }
        if (line.type === 'surah') {
          return (
            <div key={`s-${line.lineNumber}`} className="mushaf-surah-line" style={rowStyle}>
              <div className="mushaf-surah-frame" role="img" aria-label={`سورة ${surahName(line.surahNumber)}`}>
                <span className="mushaf-surah-glyph">{`${String(line.surahNumber).padStart(3, '0')}surah`}</span>
              </div>
            </div>
          );
        }
        if (line.type === 'basmala') {
          return (
            <div key={`b-${line.lineNumber}`} className="mushaf-surah-line" style={rowStyle}>
              <BasmalaGlyph className="mushaf-basmala-glyph" />
            </div>
          );
        }
        return (
          <div key={`l-${line.lineNumber}`} className={`mushaf-line${line.centered ? ' is-centered' : ''}`} style={rowStyle}>
            {line.words.map((w, i) => {
              const concealed = concealMode === 'cover'
                ? w.charType === 'word' && (inCoverBlur(line.lineNumber, i) || w.verseKey === tapBlurVerse)
                : isConcealed?.(w.verseKey, w.position) && w.charType === 'word' && !inPeek(line.lineNumber, i);
              const hovered = !concealMode && hoverWord?.verseKey === w.verseKey;
              const cls =
                w.verseKey === playingVerseKey
                  ? ' is-playing'
                  : w.verseKey === selectedVerseKey
                    ? ' is-selected'
                    : hovered
                      ? ' is-hover'
                      : '';
              // Annotation layers — background tint / underline only, so glyph
              // metrics never shift. The selection/playing states above still win
              // (their CSS rules come after the highlight rules).
              const hlColor = highlightFor ? highlightFor(w.verseKey, w.position) : null;
              const isHardWord = hardVerses?.has(w.verseKey);
              const annCls = `${hlColor ? ` is-hl-${hlColor}` : ''}${isHardWord ? ' is-hard' : ''}`;
              const isNoteMedallion = w.charType === 'end' && noteVerses?.has(w.verseKey);
              return (
                <span
                  key={`${w.verseKey}-${w.position}`}
                  className={`mushaf-word${w.charType === 'end' ? ' mushaf-word--mark' : ''}${cls}${annCls}`}
                  style={fontFamily ? { fontFamily } : undefined}
                  onPointerDown={(e) => {
                    suppressClickRef.current = false; // fresh interaction
                    if (e.pointerType !== 'mouse') return; // desktop pointer only
                    dragRef.current = { word: w, x: e.clientX, y: e.clientY, moved: false };
                  }}
                  onPointerEnter={(e) => {
                    setHoverWord({ line: line.lineNumber, index: i, verseKey: w.verseKey });
                    const d = dragRef.current;
                    if (d && e.pointerType === 'mouse' && concealMode === 'hide') {
                      d.moved = true;
                      // Advance the watermark to exactly the word under the cursor.
                      onRevealThrough?.(w.verseKey, w.position);
                    }
                  }}
                  onClick={() => {
                    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                    handleWordClick(w);
                  }}
                >
                  <span className={concealed ? 'mushaf-concealed' : undefined}>{w.glyph}</span>
                  {/* Note indicator — an inset dot on the ayah medallion (kept
                      inside the word box so the line's overflow clip never cuts
                      it). Absolutely positioned ⇒ zero effect on glyph spacing.
                      Clickable to open the note when onOpenNote is provided. */}
                  {isNoteMedallion && (onOpenNote ? (
                    <button
                      type="button"
                      className="mushaf-note-dot"
                      aria-label={noteIndicatorLabel}
                      title={noteIndicatorLabel}
                      onClick={(e) => { e.stopPropagation(); onOpenNote(w.verseKey); }}
                      onPointerDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="mushaf-note-dot" aria-hidden="true" />
                  ))}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
