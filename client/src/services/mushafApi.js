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

const QURAN_API = 'https://api.quran.com/api/v4';
const FONT_VERSION = 'v1';
const TOTAL_LINES = 15;

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
// top lines the API omits as surah-name / basmala headers.
const buildLines = (page, verses) => {
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

  // The blank lines directly above a surah's first ayah are its header: the
  // surah-name plate on top, the basmala just beneath it. Al-Fatiha (1) and
  // At-Tawbah (9) have no basmala line.
  const headers = new Map(); // lineNumber -> { type:'surah'|'basmala', surahNumber }
  for (const [surahNumber, startLine] of surahStartLine) {
    const empties = [];
    for (let l = startLine - 1; l >= 1 && !lineWords.has(l) && !headers.has(l); l--) {
      empties.unshift(l);
    }
    if (empties.length === 0) continue; // header sat on the previous page
    const hasBasmala = surahNumber !== 1 && surahNumber !== 9;
    const nameLine = hasBasmala && empties.length >= 2 ? empties[empties.length - 2] : empties[empties.length - 1];
    headers.set(nameLine, { type: 'surah', surahNumber });
    if (hasBasmala && empties.length >= 2) {
      headers.set(empties[empties.length - 1], { type: 'basmala', surahNumber });
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

const shapePage = (page, rawVerses) => {
  const verses = rawVerses.map((v) => {
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
  return { page, verses, lines: buildLines(page, verses), ornamental: page <= 2 };
};

const pageCache = new Map();

export const fetchMushafPage = async (page) => {
  if (pageCache.has(page)) return pageCache.get(page);
  const shaped = shapePage(page, await fetchVersesByPage(page));
  pageCache.set(page, shaped);
  return shaped;
};

// Read an already-fetched page from the in-session cache without a network
// round-trip (null if it hasn't been loaded). Used to look at the previous
// page's last verse when deciding whether a juz/hizb/quarter boundary lands on
// a page's very first verse — where there's no preceding verse on the page
// itself to compare against.
export const peekMushafPage = (page) => pageCache.get(page) ?? null;
