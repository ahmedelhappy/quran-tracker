import { useState, useRef, useLayoutEffect } from 'react';
import { SURAH_PAGES } from '../data/surahPages';
import BasmalaGlyph from './BasmalaGlyph';

const surahName = (n) => SURAH_PAGES.find((s) => s.number === n)?.arabic ?? '';

// One printed mushaf page: 15 lines of pre-spaced QCF glyphs plus the surah-name
// plates and basmala lines. Purely presentational — selection/audio/self-test
// state is owned by the reader and passed down; words are addressed by their
// stable `verseKey` (+ `position`), the same anchor future bookmarks/notes use.
export default function MushafPage({
  pageData,
  fontFamily,
  selectedVerseKey,
  playingVerseKey,
  isConcealed,
  onSelectVerse,
  onRevealVerse,
}) {
  const [hoverVerse, setHoverVerse] = useState(null);
  const { lines, ornamental } = pageData;
  const rootRef = useRef(null);

  // Fixed-canvas safety net: the canvas width fits every *normal* line, but a
  // handful of unusually wide lines exist in the print (e.g. p443). After the
  // page's glyph font is applied, shrink only the lines that would overflow —
  // a horizontal squeeze of a few percent, imperceptible and lossless (vs.
  // clipping). Runs once per page; selection/hover don't change line widths.
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
        // Shrink the font of an over-wide line so it fits; text-align re-centers
        // it cleanly (a transform would mis-centre RTL overflow). Base font 32px.
        if (contentW > boxW + 0.5) line.style.fontSize = `${(32 * boxW / contentW).toFixed(2)}px`;
      });
    };
    (async () => {
      // Line widths depend on THIS page's glyph font, which can finish loading
      // after document.fonts.ready — wait for it (poll), then measure once.
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
    <div ref={rootRef} className={`mushaf-page${ornamental ? ' is-ornamental' : ''}`}>
      {lines.map((line) => {
        // Each row is pinned to its true printed line number (1..15). Ornamental
        // pages 1–2 aren't a 15-line grid — they flow centred, so no row pinning.
        const rowStyle = ornamental ? undefined : { gridRow: line.lineNumber };
        if (line.type === 'blank') {
          // A genuinely empty printed row — a reserved slot, nothing to draw. Kept
          // (not dropped) so the lines above and below stay on their real rows.
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
            {line.words.map((w) => {
              const concealed = isConcealed?.(w.verseKey) && w.charType === 'word';
              const cls =
                w.verseKey === playingVerseKey
                  ? ' is-playing'
                  : w.verseKey === selectedVerseKey
                    ? ' is-selected'
                    : w.verseKey === hoverVerse
                      ? ' is-hover'
                      : '';
              return (
                <span
                  key={`${w.verseKey}-${w.position}`}
                  className={`mushaf-word${w.charType === 'end' ? ' mushaf-word--mark' : ''}${cls}`}
                  style={fontFamily ? { fontFamily } : undefined}
                  onMouseEnter={() => setHoverVerse(w.verseKey)}
                  onMouseLeave={() => setHoverVerse((h) => (h === w.verseKey ? null : h))}
                  onClick={() => {
                    // While self-testing, the first tap peeks at a hidden verse;
                    // otherwise a tap selects it for the listen/tafsir actions.
                    if (isConcealed?.(w.verseKey)) onRevealVerse?.(w.verseKey);
                    else onSelectVerse?.(w.verseKey);
                  }}
                >
                  <span className={concealed ? 'mushaf-concealed' : undefined}>{w.glyph}</span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
