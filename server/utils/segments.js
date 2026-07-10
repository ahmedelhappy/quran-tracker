// Sub-page (verse-level) memorization: compiling a selectable unit (Juz, Hizb,
// ¼-Hizb, Surah, page, or a raw verse range) into a verse-key range, splitting
// that range across the pages it touches, and merging/subtracting verse ranges
// within a single page's `segments` array (see models/UserProgress.js).
//
// All of the geometry here is pure and derived once from the committed mushaf
// structure file (server/seed/data/quranStructure.json) — the same file
// QuranMetadata is seeded from (see seed/quranData.js) and the same pattern
// progressController.js already uses for FROM_END_ORDER. No DB access needed.

const structure = require('../seed/data/quranStructure.json');

const PAGE_BY_NUMBER = new Map(structure.map((p) => [p.pageNumber, p]));

// Every verse in mushaf reading order, plus O(1) lookups of its page and its
// position in that global order (used to validate/normalize a `verses` ref and
// to walk from one page to the next when splitting a range across pages).
const GLOBAL_VERSES = [];
const VERSE_TO_PAGE = new Map();
const VERSE_GLOBAL_INDEX = new Map();
for (const page of structure) {
  for (const vk of page.verseKeys) {
    VERSE_TO_PAGE.set(vk, page.pageNumber);
    VERSE_GLOBAL_INDEX.set(vk, GLOBAL_VERSES.length);
    GLOBAL_VERSES.push(vk);
  }
}

// The 240 rub-el-hizb start verses, in reading order (4 per hizb, 8 per juz —
// verified against the committed structure file: 30 juz × 8 = 240). Every page
// has at most one rub boundary, so concatenating them in page order is already
// correctly sorted.
const RUB_BOUNDARIES = [];
for (const page of structure) {
  for (const vk of page.rubBoundaries) RUB_BOUNDARIES.push(vk);
}

// First/last verse key of every surah, derived once from the global verse order.
const SURAH_FIRST = new Map();
const SURAH_LAST = new Map();
for (const vk of GLOBAL_VERSES) {
  const surah = Number(vk.split(':')[0]);
  if (!SURAH_FIRST.has(surah)) SURAH_FIRST.set(surah, vk);
  SURAH_LAST.set(surah, vk);
}

// The inclusive verse-key range of rub-el-hizb `n` (1-based, 1..240): from its
// start boundary to the verse right before the next rub's start (or the end of
// the Quran for rub 240).
const rubRange = (n) => {
  const fromVk = RUB_BOUNDARIES[n - 1];
  const nextVk = n < RUB_BOUNDARIES.length ? RUB_BOUNDARIES[n] : null;
  const toIdx = nextVk ? VERSE_GLOBAL_INDEX.get(nextVk) - 1 : GLOBAL_VERSES.length - 1;
  return { from: fromVk, to: GLOBAL_VERSES[toIdx] };
};

// A hizb is 4 consecutive rubs; a juz is 8 (2 hizbs).
const hizbRange = (n) => {
  const startRub = 4 * (n - 1) + 1;
  return { from: rubRange(startRub).from, to: rubRange(startRub + 3).to };
};
const juzRange = (n) => {
  const startRub = 8 * (n - 1) + 1;
  return { from: rubRange(startRub).from, to: rubRange(startRub + 7).to };
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Coerces `ref` to an integer within [min, max] or throws — used for every unit
// whose ref is a single number (juz/hizb/rub/surah/page). Rejecting non-numeric
// refs (objects, arrays) here means a unit ref can never reach a Mongo query.
const toRangeInt = (ref, min, max, label) => {
  const n = typeof ref === 'number' ? ref : typeof ref === 'string' ? Number(ref) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return n;
};

const UNIT_TYPES = ['juz', 'hizb', 'rub', 'surah', 'page', 'verses'];

// Compiles a { unit, ref } selection into an inclusive global verse-key range.
// Throws a descriptive Error for anything invalid — callers turn that into a 400.
const compileUnitRange = (unit, ref) => {
  switch (unit) {
    case 'juz':
      return juzRange(toRangeInt(ref, 1, 30, 'juz'));
    case 'hizb':
      return hizbRange(toRangeInt(ref, 1, 60, 'hizb'));
    case 'rub':
      return rubRange(toRangeInt(ref, 1, 240, 'rub'));
    case 'surah': {
      const n = toRangeInt(ref, 1, 114, 'surah');
      const from = SURAH_FIRST.get(n);
      const to = SURAH_LAST.get(n);
      if (!from || !to) throw new Error('Unknown surah');
      return { from, to };
    }
    case 'page': {
      const n = toRangeInt(ref, 1, 604, 'page');
      const meta = PAGE_BY_NUMBER.get(n);
      if (!meta) throw new Error('Unknown page');
      return { from: meta.firstVerseKey, to: meta.lastVerseKey };
    }
    case 'verses': {
      if (!isPlainObject(ref) || typeof ref.from !== 'string' || typeof ref.to !== 'string') {
        throw new Error('verses ref must be an object with string from/to verse keys');
      }
      const fromIdx = VERSE_GLOBAL_INDEX.get(ref.from);
      const toIdx = VERSE_GLOBAL_INDEX.get(ref.to);
      if (fromIdx === undefined || toIdx === undefined) throw new Error('Unknown verse key');
      // Normalize order — the two tapped words needn't be tapped start-then-end.
      return fromIdx <= toIdx ? { from: ref.from, to: ref.to } : { from: ref.to, to: ref.from };
    }
    default:
      throw new Error(`unit must be one of ${UNIT_TYPES.join(', ')}`);
  }
};

// Splits a global verse-key range across the pages it touches. Each entry's
// fromVerseKey/toVerseKey is that page's intersection with the range;
// coversWholePage is true when the intersection is the page's entire span.
const rangeToPages = (fromVk, toVk) => {
  const fromIdx = VERSE_GLOBAL_INDEX.get(fromVk);
  const toIdx = VERSE_GLOBAL_INDEX.get(toVk);
  if (fromIdx === undefined || toIdx === undefined || fromIdx > toIdx) return [];

  const startPage = VERSE_TO_PAGE.get(fromVk);
  const endPage = VERSE_TO_PAGE.get(toVk);
  const pages = [];
  for (let pg = startPage; pg <= endPage; pg++) {
    const meta = PAGE_BY_NUMBER.get(pg);
    if (!meta || !meta.verseKeys.length) continue;
    const segFrom = pg === startPage ? fromVk : meta.firstVerseKey;
    const segTo = pg === endPage ? toVk : meta.lastVerseKey;
    pages.push({
      pageNumber: pg,
      fromVerseKey: segFrom,
      toVerseKey: segTo,
      coversWholePage: segFrom === meta.firstVerseKey && segTo === meta.lastVerseKey,
    });
  }
  return pages;
};

// --- Index-range primitives, scoped to a single page's verseKeys array ---
// A "range" here is [startIndex, endIndex] (inclusive, 0-based) into that page's
// verseKeys. Working in indices (rather than verse keys) makes merge/subtract
// trivial interval arithmetic.

const segToRange = (fromVk, toVk, verseKeys) => {
  const i = verseKeys.indexOf(fromVk);
  const j = verseKeys.indexOf(toVk);
  if (i === -1 || j === -1 || i > j) return null;
  return [i, j];
};

const segmentsToRanges = (segments, verseKeys) => {
  const ranges = (segments || []).map((s) => segToRange(s.from, s.to, verseKeys)).filter(Boolean);
  return mergeRanges(ranges);
};

const rangesToSegments = (ranges, verseKeys) => ranges.map(([i, j]) => ({ from: verseKeys[i], to: verseKeys[j] }));

// Sorts and merges overlapping/adjacent ranges into their minimal covering set.
function mergeRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0].slice()];
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i];
    const last = out[out.length - 1];
    if (s <= last[1] + 1) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

// Removes [subS, subE] from every range in `ranges`, splitting a range in two
// when the cut falls in its middle.
function subtractOne(ranges, [subS, subE]) {
  const out = [];
  for (const [s, e] of ranges) {
    if (subE < s || subS > e) { out.push([s, e]); continue; }
    if (subS > s) out.push([s, subS - 1]);
    if (subE < e) out.push([subE + 1, e]);
  }
  return out;
}

const isWholePage = (ranges, verseKeys) =>
  ranges.length === 1 && ranges[0][0] === 0 && ranges[0][1] === verseKeys.length - 1;

// Merges [fromVk, toVk] into a page's existing segments. Returns the new
// `segments` value to store (empty array once merged coverage is the whole
// page — the model's "full page" representation) and whether it is now full.
const addRangeToPage = (existingSegments, fromVk, toVk, pageMeta) => {
  const verseKeys = pageMeta.verseKeys;
  const newRange = segToRange(fromVk, toVk, verseKeys);
  if (!newRange) throw new Error('Verse range not found on this page');
  const merged = mergeRanges([...segmentsToRanges(existingSegments, verseKeys), newRange]);
  const full = isWholePage(merged, verseKeys);
  return { segments: full ? [] : rangesToSegments(merged, verseKeys), full };
};

// Subtracts [fromVk, toVk] from a page's existing coverage (absent/empty
// segments means the whole page). Returns { deleted: true } when nothing is
// left, otherwise the resulting `segments` value and whether it's still full
// (only possible if the subtracted range didn't actually overlap anything).
const removeRangeFromPage = (existingSegments, fromVk, toVk, pageMeta) => {
  const verseKeys = pageMeta.verseKeys;
  const subRange = segToRange(fromVk, toVk, verseKeys);
  if (!subRange) throw new Error('Verse range not found on this page');
  const currentRanges = existingSegments && existingSegments.length
    ? segmentsToRanges(existingSegments, verseKeys)
    : [[0, verseKeys.length - 1]];
  const remaining = subtractOne(currentRanges, subRange);
  if (!remaining.length) return { deleted: true };
  const full = isWholePage(remaining, verseKeys);
  return { deleted: false, segments: full ? [] : rangesToSegments(remaining, verseKeys), full };
};

// The portion of a page NOT covered by `segments` (empty segments ⇒ nothing
// covered yet, i.e. the whole page is remaining) — used to find what's left to
// finish on a page a half-page plan has already started.
const remainderRanges = (verseKeys, segments) => {
  const covered = segmentsToRanges(segments, verseKeys);
  return covered.reduce((acc, r) => subtractOne(acc, r), [[0, verseKeys.length - 1]]);
};

// Fraction (0..1] of a page's verses covered by `segments`. Absent/empty
// segments means the whole page, per the model's convention.
const pageFraction = (pageNumber, segments) => {
  if (!segments || segments.length === 0) return 1;
  const meta = PAGE_BY_NUMBER.get(pageNumber);
  if (!meta || !meta.verseKeys.length) return 1;
  const ranges = segmentsToRanges(segments, meta.verseKeys);
  const covered = ranges.reduce((sum, [i, j]) => sum + (j - i + 1), 0);
  return covered / meta.verseKeys.length;
};

// Sum of pageFraction across a list of { pageNumber, segments } — the
// fractional analogue of `progress.length` used throughout the stats endpoints.
const totalMemorizedFraction = (docs) => docs.reduce((sum, d) => sum + pageFraction(d.pageNumber, d.segments), 0);

module.exports = {
  UNIT_TYPES,
  PAGE_BY_NUMBER,
  compileUnitRange,
  rangeToPages,
  addRangeToPage,
  removeRangeFromPage,
  remainderRanges,
  pageFraction,
  totalMemorizedFraction,
};
