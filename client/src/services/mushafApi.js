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
// A page's font goes through three steps: its bytes are fetched, they are DECODED
// into a FontFace (parsed and checked, off the critical path), and the face is
// REGISTERED with document.fonts so text can use it. Registering is the step with
// a cost to the whole document — it makes the browser re-check the text styles of
// everything on screen — so it is not done for every neighbour: a face waits
// decoded until its page is drawn, and is registered then, synchronously, in the
// frame that has to lay out the new page anyway. (Registering the neighbours' faces
// all at once in an earlier prefetch took /library's blocking time 230 → 510ms.)
// The one exception is the page most likely to be turned to next, which is PRIMED
// ahead in small idle steps — see primePageFont below.
const decodedFaces = new Map();    // page → loaded FontFace, not yet registered
const registeredFaces = new Map(); // page → FontFace in document.fonts
const decoding = new Map();        // page → in-flight decode, so callers share one
const primedFaces = new Set();     // pages whose face has been laid out once (see primePageFont)

// Decoded-but-unregistered faces cost only memory (~80 KB of font each), so keep
// enough for two turns either way of a spread plus some slack. Registered faces
// are capped too: a long reading session must not grow document.fonts to 604.
const MAX_DECODED_FACES = 16;
const MAX_REGISTERED_FACES = 12;

export const mushafFontFamily = (page) => `QCF_P${page}`;
const fontUrl = (page) => `/fonts/qcf/${FONT_VERSION}/p${page}.woff2`;
const hasFontFace = () => typeof FontFace !== 'undefined' && typeof document !== 'undefined' && !!document.fonts;

// Fetch and decode p{page}.woff2 into a FontFace WITHOUT registering it. The
// fetch reads the bytes ourselves (rather than a url() source) so a face can be
// made and parsed ahead of time and handed to document.fonts later in one
// synchronous step. Resolves either way — to whether the face is ready — so a
// failure never hangs a turn; nothing about a failure is remembered here, so the
// next ask (the page's arrival, at the latest) simply tries again.
export const decodePageFont = (page) => {
  if (!hasFontFace() || registeredFaces.has(page) || decodedFaces.has(page)) return Promise.resolve(true);
  if (decoding.has(page)) return decoding.get(page);
  const job = fetch(fontUrl(page))
    .then((r) => { if (!r.ok) throw new Error('font'); return r.arrayBuffer(); })
    .then((buf) => {
      const face = new FontFace(mushafFontFamily(page), buf);
      return face.load();
    })
    .then((face) => {
      if (!registeredFaces.has(page)) {
        decodedFaces.delete(page);
        decodedFaces.set(page, face);
        while (decodedFaces.size > MAX_DECODED_FACES) decodedFaces.delete(decodedFaces.keys().next().value);
      }
      return true;
    })
    .catch(() => false)
    .finally(() => { decoding.delete(page); });
  decoding.set(page, job);
  return job;
};

// Can this page's font be applied right now, with no waiting? True once it is
// registered or decoded — registerPageFont finishes the job synchronously.
export const isPageFontReady = (page) =>
  !hasFontFace() || registeredFaces.has(page) || decodedFaces.has(page);

// Unregister the faces furthest from `page`, down to the cap — never `page` or
// the pages either side of it (in a spread the other half is one of those), nor
// the last few registered: after a jump, those include the page still sliding out
// in the turn animation. Removing a face re-checks styles just as adding one
// does, so it is done here, in the same step that registers the arriving page:
// one style pass, not two.
const trimRegisteredFaces = (page) => {
  if (registeredFaces.size <= MAX_REGISTERED_FACES) return;
  const order = [...registeredFaces.keys()];
  const recent = new Set(order.slice(-4));
  const far = order
    .filter((p) => Math.abs(p - page) > 1 && !recent.has(p))
    .sort((a, b) => Math.abs(b - page) - Math.abs(a - page));
  for (const p of far) {
    if (registeredFaces.size <= MAX_REGISTERED_FACES) break;
    document.fonts.delete(registeredFaces.get(p));
    registeredFaces.delete(p);
    primedFaces.delete(p);
  }
};

// Hand a decoded face to document.fonts — synchronous, so a page whose font is
// ready can be drawn in the very frame it is turned to.
export const registerPageFont = (page) => {
  if (registeredFaces.has(page)) {
    // Already in: just mark it recently shown (the trim's order is recency).
    const f = registeredFaces.get(page);
    registeredFaces.delete(page);
    registeredFaces.set(page, f);
    return;
  }
  const face = decodedFaces.get(page);
  if (!face) return;
  decodedFaces.delete(page);
  document.fonts.add(face);
  registeredFaces.set(page, face);
  trimRegisteredFaces(page);
};

// ── Priming: the first layout with a new font ────────────────────────────────
// A registered, decoded face still costs a lot the first time text is laid out
// with it — the browser builds its glyph and shaping data then. Measured on a
// turn at 4x CPU: that one layout took 188ms for a page seen for the first time
// and 35ms for one seen before. So the page the reader is most likely to turn
// to next is PRIMED: its face registered and its lines laid out once, off-screen
// and invisible, a few lines per idle callback so no step is a long task. The
// real page then lays out like one already seen.
const PRIME_LINES_PER_STEP = 3;
let primeBox = null;

export const isPageFontPrimed = (page) => !hasFontFace() || primedFaces.has(page);

// `idle` is a () => Promise that resolves in idle time (the caller's scheduler).
// Resolves to whether the page ended up primed.
export const primePageFont = async (page, idle) => {
  if (isPageFontPrimed(page)) return true;
  const data = pageCache.get(page);
  if (!data || !isPageFontReady(page)) return false;
  registerPageFont(page);
  const lines = data.lines.filter((l) => l.type === 'ayah');
  if (!primeBox) {
    // The reader's own classes, so the glyphs are set exactly as on the page.
    primeBox = document.createElement('div');
    primeBox.className = 'mushaf-page';
    primeBox.setAttribute('aria-hidden', 'true');
    primeBox.style.cssText = 'position:fixed;top:0;left:-10000px;width:524px;height:auto;display:block;'
      + 'visibility:hidden;pointer-events:none;contain:layout style paint';
  }
  if (!primeBox.isConnected) document.body.appendChild(primeBox);
  try {
    for (let i = 0; i < lines.length; i += PRIME_LINES_PER_STEP) {
      await idle();
      if (!registeredFaces.has(page)) return false; // trimmed away meanwhile
      primeBox.textContent = '';
      for (const line of lines.slice(i, i + PRIME_LINES_PER_STEP)) {
        const row = document.createElement('div');
        row.className = 'mushaf-line';
        for (const w of line.words) {
          const span = document.createElement('span');
          span.className = w.charType === 'end' ? 'mushaf-word mushaf-word--mark' : 'mushaf-word';
          span.style.fontFamily = mushafFontFamily(page);
          span.textContent = w.glyph;
          row.appendChild(span);
        }
        primeBox.appendChild(row);
      }
      void primeBox.offsetWidth; // lay it out now, inside this idle step
    }
  } finally {
    primeBox.textContent = '';
  }
  primedFaces.add(page);
  return true;
};

// Load (if needed) and register a page's font. Resolves to the family name;
// resolves even on failure so the page still renders (in the fallback font)
// rather than hanging.
export const ensurePageFont = async (page) => {
  await decodePageFont(page);
  if (hasFontFace()) registerPageFont(page);
  return mushafFontFamily(page);
};

// ── Printed-line corrections ─────────────────────────────────────────────────
// The API's per-word `line_number` matches the print everywhere we have checked
// but for a handful of words, where it puts a word one line EARLIER than the
// printed mushaf does.
//
// The tell is a line that stops fitting the measure. Every printed line is set
// to the same width, so the canvas is sized to the widest of them; a line that
// overflows has a word on it that the print does not put there. Page 443 line 12
// came out 10.2% too wide — the only overflowing line in a 439-line sweep —
// because وَصَدَقَ was placed at its end. In the print, line 12 ends at
// ٱلرَّحْمَـٰنُ and line 13 opens with وَصَدَقَ ٱلْمُرْسَلُونَ (checked against a scan of
// the page). The same wrong number comes back for mushaf=1 and mushaf=2, so it
// is the dataset itself, not the layout we ask it for.
//
// Keyed "surah:ayah:wordPosition" → the printed line. A short list of individually
// verified corrections, never a guess: nothing here alters a glyph or a word, only
// which of the 15 lines it is drawn on.
const LINE_CORRECTIONS = new Map([
  ['36:52:11', 13],   // وَصَدَقَ — p443: the data ends line 12 with it, the print opens line 13
]);

const applyLineCorrections = (verses) => {
  for (const v of verses) {
    for (const w of v.words) {
      const printed = LINE_CORRECTIONS.get(`${v.verse_key}:${w.position}`);
      if (printed != null) w.line_number = printed;
    }
  }
  return verses;
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
  return applyLineCorrections(all);
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

// The page-data caches are LRU-capped (a Map keeps insertion order; touching an
// entry moves it to the back), so a long session reads through the mushaf without
// holding all 604 pages. A shaped page is a few hundred word objects; this many
// covers two turns either way of a spread several times over.
const MAX_CACHED_PAGES = 40;
const lruGet = (map, key) => {
  const v = map.get(key);
  if (v !== undefined) { map.delete(key); map.set(key, v); }
  return v;
};
const lruSet = (map, key, value) => {
  map.delete(key);
  map.set(key, value);
  while (map.size > MAX_CACHED_PAGES) map.delete(map.keys().next().value);
};

// Raw verse data cached by page so the next-page peek (below) and later
// navigation don't re-fetch the same page. It holds the PROMISE, so a prefetch
// and an arrival asking for the same page at once share one request; a failed
// request is dropped again so the next ask retries.
const rawCache = new Map();
const fetchVersesCached = (page) => {
  const hit = lruGet(rawCache, page);
  if (hit) return hit;
  const job = fetchVersesByPage(page);
  lruSet(rawCache, page, job);
  job.catch(() => { if (rawCache.get(page) === job) rawCache.delete(page); });
  return job;
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

const pageCache = new Map();    // page → shaped page
const shaping = new Map();      // page → in-flight fetchMushafPage, shared by every caller

export const fetchMushafPage = (page) => {
  const hit = lruGet(pageCache, page);
  if (hit) return Promise.resolve(hit);
  if (shaping.has(page)) return shaping.get(page);
  const job = (async () => {
    const verses = shapeVerses(page, await fetchVersesCached(page));
    const nextSpill = await computeNextSpill(page, verses);
    const shaped = { page, verses, lines: buildLines(page, verses, nextSpill), ornamental: page <= 2 };
    lruSet(pageCache, page, shaped);
    return shaped;
  })().finally(() => shaping.delete(page));
  shaping.set(page, job);
  return job;
};

// Read an already-fetched page from the in-session cache without a network
// round-trip (null if it hasn't been loaded). Used to look at the previous
// page's last verse when deciding whether a juz/hizb/quarter boundary lands on
// a page's very first verse — where there's no preceding verse on the page
// itself to compare against — and by the reader to draw a page it already has
// without waiting a tick.
export const peekMushafPage = (page) => pageCache.get(page) ?? null;

// Everything the visible pages need to be drawn THIS frame — their data and a
// font that can be applied synchronously — or null if any of it is still to come.
// Registers the fonts as it goes (cheap, synchronous; see registerPageFont).
export const takeReadyPages = (pages) => {
  const datas = pages.map((p) => lruGet(pageCache, p));
  if (datas.some((d) => !d) || !pages.every(isPageFontReady)) return null;
  if (hasFontFace()) pages.forEach(registerPageFont);
  return datas;
};
