import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from './Tooltip';

// ── Printed-mushaf margin marks ──────────────────────────────────────────────
// The Madinah print carries small ornaments in the OUTER margin: a rub-el-hizb
// star (۞) at every juz / hizb / quarter-hizb boundary, and a sajda medallion
// (۩) beside a prostration verse. We derive them from the verse-level juz /
// hizb / rub-el-hizb / sajda fields the API returns (see mushafApi).
//
// Rendered as a SIBLING of MushafPage's own 15-row grid (not a child of it) —
// that grid, and the page-turn wrapper around it, both clip overflow, which
// would cut the ornaments off right as they cross the frame's border into the
// margin. Living one level up, directly in `.mushaf-frame` (which doesn't
// clip), lets them hang past the border like the print.

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const toArabicNumerals = (n) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[+d]);

// The quarter labels stay Arabic in both UI languages — it's the mushaf, like
// the print. Indexed by the quarter position within the hizb (1..3; 0 is the
// whole-hizb / juz start, handled separately).
const QUARTER_LABELS = ['', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'];

// Line (1..15) of the verse's first / last word that physically sits on THIS
// page — a verse can straddle a page break, so we only look at words on-page.
const firstWordLine = (verse, page) => verse.words.find((w) => w.page === page)?.lineNumber ?? null;
const lastWordLine = (verse, page) => {
  let line = null;
  verse.words.forEach((w) => { if (w.page === page) line = w.lineNumber; });
  return line;
};

// Build the page's margin marks. `prevLastRub` is the rub-el-hizb of the last
// verse of the PREVIOUS page (or null if unknown) — needed only to catch a
// boundary that lands exactly on this page's first verse.
const computeMarks = (pageData, prevLastRub) => {
  const { page, verses } = pageData;
  const marks = [];

  // A quarter boundary is a verse whose rub-el-hizb number is greater than the
  // previous verse's — the previous verse on this page, or (for the first verse)
  // the last verse of the previous page.
  verses.forEach((v, i) => {
    const rub = v.rubElHizb;
    if (rub == null) return;
    const prevRub = i === 0 ? prevLastRub : verses[i - 1].rubElHizb;
    if (prevRub == null || rub <= prevRub) return;
    const line = firstWordLine(v, page);
    if (line == null) return;
    const q = (rub - 1) % 4;                 // 0 = hizb/juz start, 1..3 = quarters
    if (q === 0) {
      // Every other hizb also opens a new juz (a juz is two hizbs = eight rubs).
      const isJuz = (rub - 1) % 8 === 0;
      marks.push(
        isJuz
          ? { key: `juz-${v.verseKey}`, line, kind: 'juz', label: `الجزء ${toArabicNumerals(v.juz)}`, tip: { k: 'juz', n: v.juz } }
          : { key: `hizb-${v.verseKey}`, line, kind: 'hizb', label: `الحزب ${toArabicNumerals(v.hizb)}`, tip: { k: 'hizb', n: v.hizb } }
      );
    } else {
      // A quarter/half mark names the hizb it belongs to, like the print
      // (e.g. "ربع الحزب ٧") — the hizb hasn't advanced yet at a quarter
      // boundary (only whole-hizb starts, q===0, bump it), so derive it from
      // the rub number rather than reading the verse's own (still-previous) hizb.
      const hizbNum = Math.floor((rub - 1) / 4) + 1;
      marks.push({
        key: `rub-${v.verseKey}`,
        line,
        kind: 'rub',
        label: `${QUARTER_LABELS[q]} ${toArabicNumerals(hizbNum)}`,
        tip: { k: `quarter${q}`, n: hizbNum },
      });
    }
  });

  // Sajda medallions — aligned to the verse's last word on the page (the sajda
  // word sits at/near the verse end and already carries the print's overline).
  verses.forEach((v) => {
    if (v.sajdah == null) return;
    const line = lastWordLine(v, page);
    if (line == null) return;
    marks.push({ key: `sajda-${v.verseKey}`, line, kind: 'sajda', label: null, tip: { k: 'sajda' } });
  });

  // Stack marks that share a line (e.g. a sajda + a quarter medallion) so they
  // don't overlap — see the vertical offset applied at render.
  const byLine = new Map();
  marks.forEach((m) => { const g = byLine.get(m.line) ?? []; g.push(m); byLine.set(m.line, g); });
  byLine.forEach((g) => g.forEach((m, idx) => { m.stackIndex = idx; m.stackCount = g.length; }));
  return marks;
};

// Reference-frame (576px-wide) distance from the text edge to where an
// ornament hangs: clears the frame's decorative border + padding (14 + 12 =
// 26px) plus a visible gap, so it reads as hanging IN the margin rather than
// sitting on the border art. Sized to fit inside the outer gutter
// `.mushaf-canvas-frame` reserves around the canvas (see index.css) — keep the
// two in sync if either the mark size or the gutter percentage changes.
const MARK_HANG = 80;

export default function MushafMarks({ pageData, outerEdge = 'right', prevLastRub = null }) {
  const { t, i18n } = useTranslation();
  const { ornamental } = pageData;

  // The ornamental opening spread (pages 1–2) isn't a 15-line grid, so it
  // carries no margin marks.
  const marks = useMemo(
    () => (ornamental ? [] : computeMarks(pageData, prevLastRub)),
    [pageData, prevLastRub, ornamental]
  );
  const isArabic = i18n.language?.startsWith('ar');
  const markTooltip = (m) => {
    const n = m.tip.n != null ? (isArabic ? toArabicNumerals(m.tip.n) : String(m.tip.n)) : undefined;
    return t(`library.marks.${m.tip.k}`, n != null ? { n } : undefined);
  };

  if (!marks.length) return null;

  return (
    <div className="mushaf-marks" dir="rtl">
      {marks.map((m) => {
        const top = ((m.line - 0.5) / 15) * 100;
        const stackOffset = (m.stackIndex - (m.stackCount - 1) / 2) * 26; // px, scales with frame
        const tip = markTooltip(m);
        return (
          <div
            key={m.key}
            className={`mushaf-mark mushaf-mark--${m.kind}`}
            style={{ top: `${top}%`, [outerEdge]: `-${MARK_HANG}px`, transform: `translateY(calc(-50% + ${stackOffset}px))` }}
          >
            <Tooltip label={tip}>
              <span className="mushaf-mark-btn" role="img" aria-label={tip}>
                <span className="mushaf-mark-star">{m.kind === 'sajda' ? '۩' : '۞'}</span>
                {m.label && <span className="mushaf-mark-label">{m.label}</span>}
              </span>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}
