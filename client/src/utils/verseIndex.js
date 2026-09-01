// Addressing any verse in the Quran, not just the ones on screen.
//
// The reader normally works with the verses of the visible page(s). Anything that
// reaches beyond them — a repeat range that ends two pages later, playback that
// keeps going past the page break — needs a single number per verse that exists
// whether or not its page is loaded. That number is the GLOBAL AYAH NUMBER (1–6236,
// reading order), which is also exactly what the audio CDN addresses its files by,
// so a verse's audio URL is available without loading its page first.
//
// Everything here is pure lookup over committed data (surah verse counts +
// pageAyahStarts), so it costs no network request.

import { SURAH_PAGES } from '../data/surahPages';
import { PAGE_FIRST_AYAH } from '../data/pageAyahStarts';

export const TOTAL_AYAHS = 6236;
export const TOTAL_PAGES = 604;

// Ordered by surah number, with the running total of the verses before each surah.
const SURAHS = [...SURAH_PAGES].sort((a, b) => a.number - b.number);
const OFFSETS = [0, 0]; // OFFSETS[s] = verses in surahs 1..s-1
for (const s of SURAHS) OFFSETS[s.number + 1] = OFFSETS[s.number] + s.ayahs;

export const ayahCount = (surahNumber) => SURAHS[surahNumber - 1]?.ayahs ?? 0;

// "2:255" | (2, 255) → 262 (the global ayah number).
export const ordOf = (surahNumber, ayahNumber) => {
  const offset = OFFSETS[surahNumber];
  if (offset == null) return null;
  if (ayahNumber < 1 || ayahNumber > ayahCount(surahNumber)) return null;
  return offset + ayahNumber;
};

export const ordOfKey = (verseKey) => {
  const [s, a] = String(verseKey).split(':').map(Number);
  return Number.isFinite(s) && Number.isFinite(a) ? ordOf(s, a) : null;
};

// 262 → { surahNumber: 2, ayahNumber: 255 }
export const verseOfOrd = (ord) => {
  if (!(ord >= 1 && ord <= TOTAL_AYAHS)) return null;
  // Linear over 114 entries — cheaper than the binary search's bookkeeping.
  for (let s = 1; s <= SURAHS.length; s++) {
    if (ord <= OFFSETS[s + 1]) return { surahNumber: s, ayahNumber: ord - OFFSETS[s] };
  }
  return null;
};

export const keyOfOrd = (ord) => {
  const v = verseOfOrd(ord);
  return v ? `${v.surahNumber}:${v.ayahNumber}` : null;
};

// The mushaf page a verse starts on. PAGE_FIRST_AYAH is strictly increasing, so the
// answer is the last page whose first verse is at or before `ord`.
export const pageOfOrd = (ord) => {
  if (!(ord >= 1 && ord <= TOTAL_AYAHS)) return null;
  let lo = 0, hi = PAGE_FIRST_AYAH.length - 1, found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (PAGE_FIRST_AYAH[mid] <= ord) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found + 1;
};

export const clampOrd = (ord) => Math.min(Math.max(Math.round(ord) || 1, 1), TOTAL_AYAHS);
