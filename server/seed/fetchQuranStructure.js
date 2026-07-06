// One-time generator: builds seed/data/quranStructure.json — the exact per-page
// structure of the Madinah mushaf (604 pages) pulled from the quran.com API v4.
//
// The heuristic that used to guess which surahs sit on a page (from surah start
// pages) was wrong at surah boundaries (e.g. it bled Al-Baqarah onto page 50,
// which is pure Aal-Imran). This script records the ground truth per verse so the
// app never has to guess — and never calls the external API at runtime.
//
// Run manually, then commit the JSON:
//   node seed/fetchQuranStructure.js
//
// Requires network access. Throttled to ~5 req/s with retries.

const fs = require('fs');
const path = require('path');
const { SURAH_NAME_BY_NUMBER } = require('./surahNames');

const API = 'https://api.quran.com/api/v4/verses/by_page';
const TOTAL_PAGES = 604;
const THROTTLE_MS = 200;      // ~5 requests/second
const MAX_RETRIES = 4;
const OUT_FILE = path.join(__dirname, 'data', 'quranStructure.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch every verse on a mushaf page, following pagination so pages with more
// verses than per_page are still returned in full. Retries with backoff.
async function fetchPageVerses(pageNumber) {
  const verses = [];
  let page = 1;
  for (;;) {
    const url = `${API}/${pageNumber}?fields=text_uthmani&per_page=50&words=false&page=${page}`;
    let data;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = await res.json();
        break;
      } catch (err) {
        if (attempt > MAX_RETRIES) {
          throw new Error(`page ${pageNumber} (chunk ${page}) failed after ${MAX_RETRIES} retries: ${err.message}`);
        }
        await sleep(THROTTLE_MS * attempt * 2); // linear backoff
      }
    }
    verses.push(...data.verses);
    const next = data.pagination?.next_page;
    if (!next) break;
    page = next;
    await sleep(THROTTLE_MS);
  }
  return verses;
}

// Reduce one page's verses to the compact structure record we store.
// `prevRub` is the rub_el_hizb_number of the last verse of the PREVIOUS page, so a
// rub that begins on the very first verse of this page is still flagged.
function buildPageRecord(pageNumber, verses, prevRub) {
  if (!verses.length) throw new Error(`page ${pageNumber} returned no verses`);

  const verseKeys = verses.map((v) => v.verse_key);

  // Ordered distinct surahs (by first appearance) with their names.
  const surahOrder = [];
  const seen = new Set();
  for (const key of verseKeys) {
    const num = Number(key.split(':')[0]);
    if (!seen.has(num)) {
      seen.add(num);
      surahOrder.push(num);
    }
  }
  const surahs = surahOrder.map((num) => {
    const names = SURAH_NAME_BY_NUMBER[num];
    if (!names) throw new Error(`unknown surah number ${num} on page ${pageNumber}`);
    return { number: num, name: names.name, nameArabic: names.nameArabic };
  });

  // Verse keys where the rub_el_hizb_number changes (a new rub el-hizb begins).
  const rubBoundaries = [];
  let running = prevRub;
  for (const v of verses) {
    if (v.rub_el_hizb_number !== running) {
      rubBoundaries.push(v.verse_key);
      running = v.rub_el_hizb_number;
    }
  }

  return {
    record: {
      pageNumber,
      juzNumber: verses[0].juz_number,
      hizbNumber: verses[0].hizb_number,
      firstVerseKey: verseKeys[0],
      lastVerseKey: verseKeys[verseKeys.length - 1],
      verseKeys,
      rubBoundaries,
      surahs,
    },
    lastRub: verses[verses.length - 1].rub_el_hizb_number,
  };
}

async function main() {
  console.log(`Fetching structure for ${TOTAL_PAGES} pages from quran.com …`);
  const pages = [];
  let prevRub = null;

  for (let p = 1; p <= TOTAL_PAGES; p++) {
    const verses = await fetchPageVerses(p);
    const { record, lastRub } = buildPageRecord(p, verses, prevRub);
    pages.push(record);
    prevRub = lastRub;
    if (p % 25 === 0 || p === TOTAL_PAGES) {
      console.log(`  … page ${p}/${TOTAL_PAGES}`);
    }
    await sleep(THROTTLE_MS);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(pages, null, 2) + '\n');

  const multiSurah = pages.filter((p) => p.surahs.length > 1).length;
  console.log(`\nWrote ${pages.length} pages to ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`${multiSurah} pages span multiple surahs.`);
}

main().catch((err) => {
  console.error('\nGenerator failed:', err.message);
  process.exit(1);
});
