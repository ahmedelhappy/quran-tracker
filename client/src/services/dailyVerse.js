// Daily motivational verse, language-aware.
//
// The Dashboard shows one encouraging Qur'an verse per day. It MUST match the UI
// language and is NEVER translated across languages: when the UI is Arabic we read
// the Uthmani Arabic text; when it's English we read an English translation edition.
// Each endpoint returns content already native to that language, so we never render
// an Arabic verse under an English UI (or vice-versa).
//
// The verse is picked deterministically by day-of-year from a curated list of
// uplifting ayat (patience, remembrance, and the virtue of the Qur'an — fitting a
// memorization tracker), cached per day+language in localStorage, and fetched from
// the same alquran.cloud API the reader already uses. On any failure the caller
// falls back to the offline curated quotes in the locale files.

import { toArabicDigits } from './quranApi';

const ALQURAN_API = 'https://api.alquran.cloud/v1';

// Curated uplifting verses, as "surah:ayah" keys. Short, encouraging, and on
// theme for daily memorization. alquran.cloud resolves a "surah:ayah" reference
// directly, so no global-ayah-number table is needed here.
const VERSE_KEYS = [
  '2:286',  // Allah does not burden a soul beyond what it can bear
  '94:6',   // indeed, with hardship comes ease
  '65:3',   // whoever relies upon Allah — He is sufficient for him
  '13:28',  // in the remembrance of Allah hearts find rest
  '39:53',  // do not despair of the mercy of Allah
  '2:152',  // remember Me; I will remember you
  '3:139',  // do not weaken, do not grieve — you will be superior
  '40:60',  // call upon Me; I will respond to you
  '2:45',   // seek help through patience and prayer
  '8:46',   // be patient — Allah is with the patient
  '29:69',  // those who strive for Us, We will surely guide
  '54:17',  // We have made the Qur'an easy to remember
  '17:9',   // this Qur'an guides to what is most upright
  '20:114', // My Lord, increase me in knowledge
  '93:5',   // your Lord will give you, and you will be satisfied
  '64:11',  // whoever believes in Allah, He guides his heart
];

// Native-language editions — Arabic reads the Uthmani script, English reads the
// Sahih International translation. Never cross-translated.
const EDITION = { ar: 'quran-uthmani', en: 'en.sahih' };

const dayOfYear = () => {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
};

const todayKey = () => new Date().toISOString().split('T')[0];

const readCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / unavailable — the in-day fetch still works, just uncached */
  }
};

// Returns { text, source, lang } for today's verse in the given UI language, or
// throws if the API is unreachable (so the caller can fall back). Cached per
// (day, language) in localStorage.
export const getDailyVerse = async (lang) => {
  const code = lang === 'ar' ? 'ar' : 'en';
  const cacheKey = `dailyVerse:${todayKey()}:${code}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const verseKey = VERSE_KEYS[dayOfYear() % VERSE_KEYS.length];
  const res = await fetch(`${ALQURAN_API}/ayah/${verseKey}/${EDITION[code]}`);
  if (!res.ok) throw new Error('Failed to fetch daily verse');
  const { data } = await res.json();
  if (!data?.text) throw new Error('Empty daily verse');

  const source = code === 'ar'
    ? `${data.surah.name} · ${toArabicDigits(data.numberInSurah)}`
    : `${data.surah.englishName} ${data.surah.number}:${data.numberInSurah}`;
  const verse = { text: data.text, source, lang: code };
  writeCache(cacheKey, verse);
  return verse;
};
