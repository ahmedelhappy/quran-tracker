// Verse-exact spans for the memorization units, and coverage maths over them.
//
// The Juz / Surah / Range tabs of the memorized-pages editors are genuinely
// page-aligned: a juz and a surah both begin at the top of a page, so selecting
// one is the same thing as selecting its pages. Hizb and quarter-hizb are NOT —
// their boundaries land mid-page, and ADJACENT UNITS SHARE THE PAGE THEY MEET ON:
//
//   rub 125 (32.1) = pages 312-315 | rub 126 (32.2) = 315-317 | rub 127 = 317-319
//
// so rounding rub 126 up to whole pages claimed all of 315 and all of 317 and
// bled into both of its neighbours. These helpers give the exact verse span
// instead, which is what the /api/progress/units endpoint stores (it writes
// partial `segments` rows on the boundary pages).
//
// Everything here is pure lookup over committed data, so it costs no request.

import { RUB_BOUNDARIES } from '../data/rubBoundaries';
import { PAGE_FIRST_AYAH } from '../data/pageAyahStarts';
import { ordOfKey, keyOfOrd, TOTAL_AYAHS, TOTAL_PAGES } from './verseIndex';

// Global ayah number each rub opens on, in reading order.
const RUB_START_ORDS = RUB_BOUNDARIES.map(ordOfKey);

// Rub n (1..240): from its own start to the verse before the next rub's start.
export const rubOrdRange = (n) => {
  if (!(n >= 1 && n <= 240)) return null;
  const from = RUB_START_ORDS[n - 1];
  const to = n === 240 ? TOTAL_AYAHS : RUB_START_ORDS[n] - 1;
  return { from, to };
};

// A hizb is four consecutive rubs.
export const hizbOrdRange = (n) => {
  if (!(n >= 1 && n <= 60)) return null;
  const first = rubOrdRange(n * 4 - 3);
  const last = rubOrdRange(n * 4);
  return first && last ? { from: first.from, to: last.to } : null;
};

export const unitOrdRange = (unit, ref) =>
  unit === 'hizb' ? hizbOrdRange(ref) : unit === 'rub' ? rubOrdRange(ref) : null;

// The verses a whole mushaf page holds. A verse that straddles a page break
// belongs to the page it STARTS on, which is exactly how PAGE_FIRST_AYAH is built.
export const pageOrdRange = (p) => {
  if (!(p >= 1 && p <= TOTAL_PAGES)) return null;
  return { from: PAGE_FIRST_AYAH[p - 1], to: p === TOTAL_PAGES ? TOTAL_AYAHS : PAGE_FIRST_AYAH[p] - 1 };
};

// Sort and coalesce, so coverage tests are a walk over a short list. Ranges that
// merely touch (to + 1 === from) are joined too — they cover a continuous run.
export const mergeOrdRanges = (ranges) => {
  const sorted = ranges.filter(Boolean).slice().sort((a, b) => a.from - b.from);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 1) last.to = Math.max(last.to, r.to);
    else out.push({ from: r.from, to: r.to });
  }
  return out;
};

// 'full' | 'partial' | 'none' — how much of `range` the merged coverage holds.
// This is what a Hizb / quarter-Hizb tile shows: full only when every verse of
// the unit is covered, partial when some are, so a unit whose neighbour merely
// shares its boundary page no longer looks selected.
export const coverageOf = (merged, range) => {
  if (!range) return 'none';
  let covered = 0;
  for (const m of merged) {
    if (m.to < range.from) continue;
    if (m.from > range.to) break;
    covered += Math.min(m.to, range.to) - Math.max(m.from, range.from) + 1;
  }
  if (covered === 0) return 'none';
  return covered === range.to - range.from + 1 ? 'full' : 'partial';
};

// The verse-key ranges to send to PUT /api/progress/units as `unit: 'verses'`.
// Selections are merged first, so picking a whole hizb-worth of quarters costs
// one request rather than four, and "select everything" costs one rather than 240.
export const toVerseKeyRanges = (ranges) =>
  mergeOrdRanges(ranges).map((r) => ({ from: keyOfOrd(r.from), to: keyOfOrd(r.to) }));

// Everything in `ranges` that `cut` does not cover.
export const subtractOrdRanges = (ranges, cut) => {
  const holes = mergeOrdRanges(cut);
  const out = [];
  for (const r of mergeOrdRanges(ranges)) {
    let from = r.from;
    for (const h of holes) {
      if (h.to < from) continue;
      if (h.from > r.to) break;
      if (h.from > from) out.push({ from, to: Math.min(h.from - 1, r.to) });
      from = Math.max(from, h.to + 1);
      if (from > r.to) break;
    }
    if (from <= r.to) out.push({ from, to: r.to });
  }
  return out;
};

// The pages whose every verse is covered. This is the page-shaped view the
// Juz / Surah / Range tabs edit, derived from the one verse-level model rather
// than kept alongside it.
export const fullyCoveredPages = (merged) => {
  const pages = new Set();
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    if (coverageOf(merged, pageOrdRange(p)) === 'full') pages.add(p);
  }
  return pages;
};

// Split a coverage into what the whole-page endpoint can express and what is
// left over. The leftovers are the sub-page bits — a hizb boundary landing
// mid-page — which go through the units endpoint as verse ranges instead.
export const splitCoverageForSave = (merged) => {
  const fullPages = [...fullyCoveredPages(merged)].sort((a, b) => a - b);
  const wholePageRanges = fullPages.map(pageOrdRange);
  return { fullPages, leftovers: subtractOrdRanges(merged, wholePageRanges) };
};

// Seed a coverage from what the server reports: whole pages, plus the exact
// verse ranges of any page that is only partly memorized.
export const coverageFromProgress = (memorizedPages, partialPages = []) => {
  const partialByPage = new Map(partialPages.map((p) => [p.pageNumber, p.segments ?? []]));
  const ranges = [];
  for (const p of memorizedPages) {
    const segs = partialByPage.get(p);
    if (!segs) { ranges.push(pageOrdRange(p)); continue; }
    for (const s of segs) {
      const from = ordOfKey(s.from);
      const to = ordOfKey(s.to);
      if (from && to) ranges.push({ from: Math.min(from, to), to: Math.max(from, to) });
    }
  }
  return mergeOrdRanges(ranges);
};
