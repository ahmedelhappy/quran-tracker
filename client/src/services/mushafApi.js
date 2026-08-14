// Exact Madinah-mushaf rendering data + fonts.
//
// The real 604-page / 15-lines-per-page mushaf can't be reproduced by flowing
// text — the line breaks are baked into the print. We reproduce it the way
// quran.com / mushafmakkah do: per-page "QCF" glyph fonts (one tiny font per
// page) plus word data that says, for every word, which glyph to draw and which
// of the 15 lines it sits on. We fetch the word/line data from the quran.com
// API and pair it with the self-hosted page fonts under /public/fonts/qcf/.
//
// Identity is kept verse-level so the rest of the reader keeps working:
//  - `id`       = global ayah number (1..6236) — same number the audio CDN and
//                 alquran.cloud tafsir use, so audio + tafsir need no remapping.
//  - `verseKey` = "surah:ayah" — what the per-ayah tafsir endpoints key on, and
//                 the stable anchor for future bookmarks / word annotations.

import { SURAH_PAGES } from '../data/surahPages';

const QURAN_API = 'https://api.quran.com/api/v4';
const FONT_VERSION = 'v1';
const TOTAL_LINES = 15;

// Page number → the FIRST surah that starts on it (SURAH_PAGES is the committed
// mushaf layout, ordered by number). First-wins matters on pages where several
// short surahs begin: only the top one's header can spill onto the previous page.
const SURAH_STARTING_ON = new Map();
for (const s of SURAH_PAGES) if (!SURAH_STARTING_ON.has(s.start)) SURAH_STARTING_ON.set(s.start, s.number);

// A surah's header lines, ordered from the first ayah UPWARD (the item nearest
// the ayah first): [basmala, plate]. Al-Fatiha (1) has its basmala as verse 1 in
// the text, and At-Tawbah (9) has none — both are plate-only.
const headerItemsUp = (surahNumber) =>
  surahNumber !== 1 && surahNumber !== 9 ? ['basmala', 'surah'] : ['surah'];

// ── Per-page fonts (FontFace API, loaded on demand) ──────────────────────────
const loadedFonts = new Set();

export const mushafFontFamily = (page) => `QCF_P${page}`;

// Load p{page}.woff2 and register it as family QCF_P{page}. Resolves to the
// family name; resolves even on failure so the page still renders (in the
// fallback font) rather than hanging.
export const ensurePageFont = async (page) => {
  const family = mushafFontFamily(page);
  if (loadedFonts.has(page) || typeof FontFace === 'undefined') return family;
  try {
    const url = `/fonts/qcf/${FONT_VERSION}/p${page}.woff2`;
    const face = new FontFace(family, `url("${url}") format("woff2")`);
    await face.load();
    document.fonts.add(face);
    loadedFonts.add(page);
  } catch {
    /* leave unloaded — caller falls back to a generic Arabic face */
  }
  return family;
};

// ── Word/line data ───────────────────────────────────────────────────────────
const fetchVersesByPage = async (page) => {
  // NOTE: `text_uthmani` is deliberately NOT requested at the word level. The
  // quran.com API has a boundary bug — when word-level text_uthmani is included,
  // the `page_number` of a page's first/last verse is returned off by one (the
  // adjacent page), which made those verses get filtered out and vanish from the
  // render. We take the verse-level `fields=text_uthmani` instead (used only for
  // the tafsir preview); word grouping relies solely on the now-correct page_number.
  const wordFields = 'code_v1,line_number,char_type_name,page_number';
  // Verse-level fields carry the printed margin structure: the juz / hizb /
  // quarter-hizb the verse opens (for the boundary ornaments) and its sajda
  // number, if any (for the prostration mark). See MushafPage for the render.
  const verseFields = 'text_uthmani,juz_number,hizb_number,rub_el_hizb_number,sajdah_number';
  const base = `${QURAN_API}/verses/by_page/${page}?words=true&fields=${verseFields}&word_fields=${wordFields}`;
  const all = [];
  let p = 1;
  // per_page is capped at 50 server-side; no mushaf page has that many ayahs,
  // but follow pagination defensively so a dense page is never truncated.
  for (;;) {
    const res = await fetch(`${base}&per_page=50&page=${p}`);
    if (!res.ok) throw new Error('Failed to fetch mushaf page');
    const data = await res.json();
    all.push(...data.verses);
    if (!data.pagination?.next_page) break;
    p = data.pagination.next_page;
  }
  return all;
};

// Build the ordered list of (up to) 15 lines for a page, classifying the blank
// top lines the API omits as surah-name / basmala headers. `nextSpill`, when
// given, is { surahNumber, leadingBlanks } for a surah that starts on page+1 —
// the print puts the overflow of its header (typically the surah-name plate) on
// THIS page's trailing blank slots (e.g. An-Nisa: plate on 76:15, basmala 77:1).
const buildLines = (page, verses, nextSpill = null) => {
  // Words that physically sit on THIS page (a verse can straddle a page break).
  const lineWords = new Map(); // lineNumber -> words[] in reading order
  verses.forEach((v) =>
    v.words.forEach((w) => {
      if (w.page !== page) return;
      if (!lineWords.has(w.lineNumber)) lineWords.set(w.lineNumber, []);
      lineWords.get(w.lineNumber).push(w);
    })
  );

  // Where does each surah that begins on this page place its first word?
  const surahStartLine = new Map();
  verses.forEach((v) => {
    if (v.ayahNumber !== 1) return;
    const first = v.words.find((w) => w.page === page);
    if (first) surahStartLine.set(v.surahNumber, first.lineNumber);
  });

  const headers = new Map(); // lineNumber -> { type:'surah'|'basmala', surahNumber }

  // (1) Surahs that BEGIN on this page: fill the blank lines directly above the
  // first ayah, from the ayah UPWARD (basmala nearest the ayah, plate above it).
  // Whatever runs off the top of the page (the plate, when there's only one blank
  // slot) spilled onto the previous page and is placed when THAT page builds.
  for (const [surahNumber, startLine] of surahStartLine) {
    const empties = [];
    for (let l = startLine - 1; l >= 1 && !lineWords.has(l) && !headers.has(l); l--) {
      empties.unshift(l);
    }
    if (empties.length === 0) continue; // whole header sat on the previous page
    const items = headerItemsUp(surahNumber); // ayah-upward
    for (let i = 0; i < items.length; i++) {
      const slot = empties[empties.length - 1 - i]; // closest-to-ayah first, then up
      if (slot == null) break;                      // ran out → the rest spilled up a page
      headers.set(slot, { type: items[i], surahNumber });
    }
  }

  // (2) The overflow of the NEXT page's opening surah, landing on this page's
  // trailing blanks. `leadingBlanks` is how many blank slots that surah has above
  // its first ayah on page+1; the top `overflow` header items sit here, adjacent
  // to the page break (the item nearest the break on the lowest line).
  if (nextSpill) {
    const items = headerItemsUp(nextSpill.surahNumber); // ayah-upward
    const overflow = items.length - nextSpill.leadingBlanks;
    if (overflow > 0) {
      const overflowItems = items.slice(nextSpill.leadingBlanks); // ayah-upward
      let l = TOTAL_LINES;
      for (const item of overflowItems) {
        while (l >= 1 && (lineWords.has(l) || headers.has(l))) l--;
        if (l < 1) break;
        headers.set(l, { type: item, surahNumber: nextSpill.surahNumber });
        l--;
      }
    }
  }

  // Emit all 15 rows, in order, so the renderer can place every line at its true
  // printed row. Genuinely blank lines (the print leaves some rows empty) are
  // kept as `blank` slots — dropping them would let the remaining lines drift
  // upward and lose their vertical registration with the printed page.
  const lines = [];
  for (let L = 1; L <= TOTAL_LINES; L++) {
    if (lineWords.has(L)) lines.push({ lineNumber: L, type: 'ayah', words: lineWords.get(L) });
    else if (headers.has(L)) lines.push({ lineNumber: L, ...headers.get(L) });
    else lines.push({ lineNumber: L, type: 'blank' });
  }

  // Centre short lines so words aren't stretched across the page: the ornamental
  // first spread (Fatiha + the opening of Al-Baqarah) is fully centred, and any
  // line that ends a surah (the next slot is a surah-name plate) is centred too.
  const ornamental = page <= 2;
  lines.forEach((line, i) => {
    if (line.type !== 'ayah') return;
    line.centered = ornamental || lines[i + 1]?.type === 'surah';
  });

  return lines;
};

const shapeVerses = (page, rawVerses) =>
  rawVerses.map((v) => {
    const [surahNumber, ayahNumber] = v.verse_key.split(':').map(Number);
    const meta = { verseKey: v.verse_key, id: v.id, surahNumber, ayahNumber };
    return {
      ...meta,
      textUthmani: v.text_uthmani, // whole-ayah text (tafsir preview); see fetch note
      // Printed-mushaf margin data (verse-level). rubElHizb is the global 1..240
      // quarter index the ornaments are derived from; sajdah is null unless the
      // verse carries a prostration mark.
      juz: v.juz_number,
      hizb: v.hizb_number,
      rubElHizb: v.rub_el_hizb_number,
      sajdah: v.sajdah_number ?? null,
      words: v.words.map((w) => ({
        ...meta,
        position: w.position,
        glyph: w.code_v1,
        lineNumber: w.line_number,
        page: w.page_number,
        charType: w.char_type_name, // 'word' | 'end' (end = ayah-number medallion)
      })),
    };
  });

// Raw verse data cached by page so the next-page peek (below) and later
// navigation don't re-fetch the same page.
const rawCache = new Map();
const fetchVersesCached = async (page) => {
  if (rawCache.has(page)) return rawCache.get(page);
  const v = await fetchVersesByPage(page);
  rawCache.set(page, v);
  return v;
};

// Does a surah open at the top of page+1 with its header (partly) spilling onto
// this page's trailing blanks? Returns { surahNumber, leadingBlanks } or null.
// Only peeks page+1 when this page actually has a trailing blank AND a surah
// starts on page+1 AND this page's last verse ends the previous surah (so a
// mid-page surah start — whose header sits wholly on its own page — is excluded).
const computeNextSpill = async (page, verses) => {
  const nextSurah = SURAH_STARTING_ON.get(page + 1);
  if (!nextSurah || nextSurah === 1) return null;
  let lastLine = 0, lastVerseSurah = null;
  verses.forEach((v) => v.words.forEach((w) => {
    if (w.page === page && w.lineNumber > lastLine) { lastLine = w.lineNumber; lastVerseSurah = v.surahNumber; }
  }));
  if (lastLine >= TOTAL_LINES) return null;             // no trailing blank on this page
  if (lastVerseSurah !== nextSurah - 1) return null;    // last verse isn't the previous surah's end

  const nextRaw = await fetchVersesCached(page + 1);
  const nextContent = new Set();
  let firstLine = null;
  for (const v of nextRaw) {
    const [s, a] = v.verse_key.split(':').map(Number);
    for (const w of v.words) {
      if (w.page_number !== page + 1) continue;
      nextContent.add(w.line_number);
      if (s === nextSurah && a === 1 && (firstLine === null || w.line_number < firstLine)) firstLine = w.line_number;
    }
  }
  if (firstLine === null) return null;
  let leadingBlanks = 0;
  for (let l = firstLine - 1; l >= 1 && !nextContent.has(l); l--) leadingBlanks++;
  return { surahNumber: nextSurah, leadingBlanks };
};

const pageCache = new Map();

export const fetchMushafPage = async (page) => {
  if (pageCache.has(page)) return pageCache.get(page);
  const verses = shapeVerses(page, await fetchVersesCached(page));
  const nextSpill = await computeNextSpill(page, verses);
  const shaped = { page, verses, lines: buildLines(page, verses, nextSpill), ornamental: page <= 2 };
  pageCache.set(page, shaped);
  return shaped;
};

// Read an already-fetched page from the in-session cache without a network
// round-trip (null if it hasn't been loaded). Used to look at the previous
// page's last verse when deciding whether a juz/hizb/quarter boundary lands on
// a page's very first verse — where there's no preceding verse on the page
// itself to compare against.
export const peekMushafPage = (page) => pageCache.get(page) ?? null;
