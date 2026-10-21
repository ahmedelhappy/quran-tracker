// One-time generator: builds client/public/data/search-index.json — the text the
// Library's verse search matches against, word by word, for all 6236 verses.
//
// The reader draws each page from the quran.com API's per-word data and tags every
// word with its verse key and `position` (MushafPage: data-verse-key /
// data-word-position). A search hit has to land on those exact glyphs, so this index
// is built from the SAME words: one entry per word of type "word" (the ayah-number
// medallions, type "end", are not searchable), in position order.
//
// Text: each word's `text_imlaei` — the Quran in modern (imla'i) spelling WITH its
// tashkeel. Modern spelling is what people type ("الصلاة", not the Uthmani
// "ٱلصَّلَوٰة"), and the tashkeel keeps the suggestion snippets properly voweled
// (NFR-07). `text_imlaei_simple` is NOT used: it spells the dagger alef out
// ("الرحمان"), which nobody types. The client strips the marks to match.
//
// Alignment is checked, not assumed. Two sets of requests are made:
//   1. /verses/by_page/{p} with exactly the word fields the reader asks for — the
//      ground truth of which (verse, position) pairs the mushaf renders, and on
//      which page;
//   2. /verses/by_chapter/{s} with text_imlaei — the text.
// The script fails unless, for every verse, both agree on the word positions, the
// positions run 1..n with the end medallion at n+1 (so a word's position is its
// index + 1 and need not be stored), and the verse sits on the page the committed
// structure data says.
//
// Output format (kept small; it is lazy-loaded the first time search opens):
//   { "v": 1, "verses": ["w1|w2|…", …] }  — verses[ord - 1] for global ayah number
//   ord (1..6236, reading order), its words joined by "|" (a word may itself
//   contain a space: "يَا أَيُّهَا" is ONE Uthmani word, position 1 of 2:104).
//
// Run manually, then commit the JSON:
//   node seed/fetchSearchIndex.js
//
// Requires network access. Throttled to ~5 req/s with retries.

const fs = require('fs');
const path = require('path');

const API = 'https://api.quran.com/api/v4';
const TOTAL_PAGES = 604;
const TOTAL_SURAHS = 114;
const TOTAL_AYAHS = 6236;
const THROTTLE_MS = 200;
const MAX_RETRIES = 4;
const STRUCTURE = path.join(__dirname, 'data', 'quranStructure.json');
const OUT_FILE = path.join(__dirname, '..', '..', 'client', 'public', 'data', 'search-index.json');
// The reader's own word fields (client/src/services/mushafApi.js), so the positions
// checked here are the positions it renders.
const READER_WORD_FIELDS = 'code_v1,line_number,char_type_name,page_number';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt > MAX_RETRIES) throw new Error(`${url} failed after ${MAX_RETRIES} retries: ${err.message}`);
      await sleep(THROTTLE_MS * attempt * 2);
    }
  }
}

// Every verse of a listing endpoint, following its pagination.
async function fetchAllVerses(base) {
  const verses = [];
  for (let page = 1; ; ) {
    const data = await getJson(`${base}&per_page=50&page=${page}`);
    verses.push(...data.verses);
    await sleep(THROTTLE_MS);
    const next = data.pagination?.next_page;
    if (!next) return verses;
    page = next;
  }
}

const fail = (msg) => { throw new Error(msg); };

async function main() {
  const structure = JSON.parse(fs.readFileSync(STRUCTURE, 'utf8'));
  const pageOfKey = new Map();
  for (const p of structure) for (const k of p.verseKeys) pageOfKey.set(k, p.pageNumber);

  // 1. What the reader renders: verse key → { page, positions of "word" words, end position }.
  console.log(`Reading the rendered word positions of ${TOTAL_PAGES} pages …`);
  const rendered = new Map();
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const verses = await fetchAllVerses(`${API}/verses/by_page/${p}?words=true&word_fields=${READER_WORD_FIELDS}`);
    for (const v of verses) {
      const words = v.words.filter((w) => w.page_number === p);
      if (words.length !== v.words.length) fail(`${v.verse_key} straddles pages ${p} and another`);
      const types = new Set(words.map((w) => w.char_type_name));
      for (const t of types) if (t !== 'word' && t !== 'end') fail(`${v.verse_key}: unexpected word type "${t}"`);
      if (rendered.has(v.verse_key)) fail(`${v.verse_key} listed on two pages`);
      rendered.set(v.verse_key, {
        page: p,
        word: words.filter((w) => w.char_type_name === 'word').map((w) => w.position),
        end: words.filter((w) => w.char_type_name === 'end').map((w) => w.position),
      });
    }
    if (p % 50 === 0 || p === TOTAL_PAGES) console.log(`  … page ${p}/${TOTAL_PAGES}`);
  }
  if (rendered.size !== TOTAL_AYAHS) fail(`expected ${TOTAL_AYAHS} verses on the pages, got ${rendered.size}`);

  // 2. The text, surah by surah, in reading order.
  console.log(`Reading the imla'i text of ${TOTAL_SURAHS} surahs …`);
  const out = [];
  let wordCount = 0;
  for (let s = 1; s <= TOTAL_SURAHS; s++) {
    const verses = await fetchAllVerses(`${API}/verses/by_chapter/${s}?words=true&word_fields=text_imlaei,char_type_name`);
    for (const v of verses) {
      const r = rendered.get(v.verse_key) ?? fail(`${v.verse_key} not rendered on any page`);
      if (pageOfKey.get(v.verse_key) !== r.page) fail(`${v.verse_key}: page ${r.page} vs structure ${pageOfKey.get(v.verse_key)}`);
      const words = v.words.filter((w) => w.char_type_name === 'word');
      const positions = words.map((w) => w.position);
      // Same positions as the page draws, numbered 1..n, the medallion at n+1.
      if (positions.join() !== r.word.join()) fail(`${v.verse_key}: text positions [${positions}] vs rendered [${r.word}]`);
      positions.forEach((pos, i) => { if (pos !== i + 1) fail(`${v.verse_key}: position ${pos} at index ${i}`); });
      if (r.end.join() !== String(positions.length + 1)) fail(`${v.verse_key}: end medallion at [${r.end}], expected ${positions.length + 1}`);
      const texts = words.map((w) => {
        const text = (w.text_imlaei ?? '').trim();
        if (!text) fail(`${v.verse_key}:${w.position} has no text`);
        if (text.includes('|')) fail(`${v.verse_key}:${w.position} contains the separator`);
        return text;
      });
      wordCount += texts.length;
      out.push(texts.join('|'));
    }
    if (s % 19 === 0 || s === TOTAL_SURAHS) console.log(`  … surah ${s}/${TOTAL_SURAHS}`);
  }
  if (out.length !== TOTAL_AYAHS) fail(`expected ${TOTAL_AYAHS} verses of text, got ${out.length}`);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  // One verse per line: still one JSON value, but a diff of a regeneration is readable.
  fs.writeFileSync(OUT_FILE, `{"v":1,"verses":[\n${out.map((t) => JSON.stringify(t)).join(',\n')}\n]}\n`);
  const bytes = fs.statSync(OUT_FILE).size;
  console.log(`\nWrote ${out.length} verses / ${wordCount} words to ${path.relative(process.cwd(), OUT_FILE)} (${(bytes / 1024).toFixed(0)} KB)`);
  console.log('Every word position matches the rendered mushaf.');
}

main().catch((err) => {
  console.error('\nGenerator failed:', err.message);
  process.exit(1);
});
