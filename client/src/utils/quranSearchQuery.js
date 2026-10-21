// Reading what someone typed into the Library's search box.
//
// Two kinds of query, both handled here as pure functions (no React, no index):
//
//  1. TEXT — Arabic words matched against the Quran. Both the index and the query go
//     through the same `normalizeArabic`, so a query typed with full tashkeel, with
//     none, or pasted from a mushaf all meet the text on the same letters.
//  2. JUMPS — references and names that go straight somewhere: "2:255", "البقرة 255",
//     "Al-Baqarah 255", a surah name in Arabic or a common English spelling,
//     "page 50" / "صفحة 50", "juz 30" / "جزء 30", "hizb 5" / "حزب 5".

import { SURAH_PAGES } from '../data/surahPages';
import { HIZB_RANGES } from '../data/hizbRanges';
import { ayahCount } from './verseIndex';

// ── Arabic normalisation ─────────────────────────────────────────────────────
// Removed outright (they never change which word it is):
//   U+064B–U+065F  tashkeel — fathatan … sukun, shadda, plus the combining hamza
//                  above/below and the other small vowel signs
//   U+0670         dagger (superscript) alef — "الرَّحْمَٰن" reads as typed "الرحمن"
//   U+0610–U+061A  Quranic honorific / small signs above letters
//   U+06D6–U+06ED  Quranic annotation marks: waqf signs (ۚ ۖ ۗ …), small high
//                  letters, ۞ (rub el-hizb), ۩ (sajda)
//   U+08D3–U+08FF  extended Arabic marks used by some Quran texts
//   U+0640         tatweel (ـ)
//   U+200B–U+200F, U+061C, U+FEFF  zero-width and direction marks
// Unified (the spelling varies, the word does not):
//   أ إ آ ٱ ٲ ٳ → ا   every alef carrying a hamza or a madda, and alef wasla
//   ؤ ئ ء → ء          the hamza, whatever seat it is written on: "مسؤول" and the
//                      Quran's "مَسْئُولًا" are one word spelled two ways
//   ى ی → ي            alef maqsura and the Persian yeh read as yeh
//   ة → ه              ta marbuta, as it is often typed at the end of a word
//   ک → ك, ە ۀ → ه     Persian / Kurdish keyboard forms
//   وٰ → ا             the Uthmani waw-with-dagger-alef, so "ٱلصَّلَوٰة" pasted from a
//                      mushaf meets the imla'i "الصلاة" (the index never contains وٰ)
// The hamza itself is never DROPPED: that would merge different words — "ماء"
// (water) would become "ما", one of the commonest words in the text.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640\u200B-\u200F\u061C\uFEFF]/g;
const UTHMANI_WAW_ALEF = /\u0648[\u064B-\u0652\u0640]*\u0670/g;
const LETTER_MAP = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا',
  'ؤ': 'ء', 'ئ': 'ء',
  'ى': 'ي', 'ی': 'ي', 'ة': 'ه', 'ک': 'ك', 'ە': 'ه', 'ۀ': 'ه',
};
const MAPPED = new RegExp(`[${Object.keys(LETTER_MAP).join('')}]`, 'g');

// Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits → ASCII.
export const toLatinDigits = (s) =>
  s.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) & 0xf));

// NFC first, so a hamza or madda typed as a separate combining mark lands on its
// letter (ا + ٔ → أ, ي + ٔ → ئ) before the maps above see it.
export const normalizeArabic = (s) =>
  toLatinDigits(String(s ?? '').normalize('NFC'))
    .replace(UTHMANI_WAW_ALEF, 'ا')
    .replace(MARKS, '')
    .replace(MAPPED, (c) => LETTER_MAP[c]);

// Normalised search tokens: Arabic letters and digits; anything else separates words.
export const arabicTokens = (s) =>
  normalizeArabic(s).replace(/[^\u0621-\u064A0-9]+/g, ' ').trim().split(' ').filter(Boolean);

// ── Surah names ──────────────────────────────────────────────────────────────
// Latin: transliterations wander ("Baqarah", "baqara", "Al Baqara", "Yaseen",
// "Ya-Sin", "Taubah"), so names and queries are squashed to one rough spelling
// before comparing: accents, apostrophes and hyphens dropped, o→u, e→i, q→k,
// aw/ay before a consonant → au/ai, doubled letters single, and a final h dropped.
const LATIN_ARTICLE = /^(?:al|an|ar|as|ash|at|ath|ad|adh|az|aal|el)[\s'’ʿʾ`-]+/;
const latinBase = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const squash = (s) => s
  .replace(/[^a-z]/g, '')
  .replace(/ou|oo|o/g, 'u')
  .replace(/e/g, 'i')
  .replace(/q/g, 'k')
  .replace(/a([wy])(?=[^aeiou]|$)/g, (_, c) => (c === 'w' ? 'au' : 'ai'))
  .replace(/(.)\1+/g, '$1')
  .replace(/h$/, '');
// A name as typed → the keys it can match on: with and without its article.
const latinKeys = (s) => {
  const base = latinBase(s);
  const keys = new Set([squash(base)]);
  const bare = base.replace(LATIN_ARTICLE, '');
  if (bare !== base) keys.add(squash(bare));
  return [...keys].filter(Boolean);
};
const arabicKeys = (s) => {
  const flat = arabicTokens(s).join('');
  return flat.startsWith('ال') && flat.length > 3 ? [flat, flat.slice(2)] : [flat];
};

// Other names a surah is widely known by, beyond the one the app displays.
const ALIASES = {
  1: ['Fatihah', 'Al-Hamd', 'الحمد', 'أم الكتاب'],
  3: ['Al-Imran', 'Ali Imran', 'Imran'],
  9: ["Bara'ah", 'Baraah', 'براءة'],
  17: ['Bani Israil', 'بني إسرائيل'],
  19: ['Mariam'],
  20: ['Taha'],
  36: ['Yasin', 'Yaseen'],
  38: ['Saad'],
  40: ["Al-Mu'min", 'Mumin', 'المؤمن'],
  41: ['Ha Mim Sajdah', 'Hamim Sajdah', 'حم السجدة'],
  47: ['Al-Qital', 'القتال'],
  50: ['Qaaf'],
  55: ['Rahman', 'Rehman'],
  76: ['Ad-Dahr', 'Dahr', 'الدهر'],
  94: ['Al-Inshirah', 'Inshirah', 'Alam Nashrah', 'الانشراح'],
  111: ['Al-Lahab', 'Lahab', 'Tabbat', 'اللهب', 'تبت'],
  112: ['At-Tawhid', 'Tawhid', 'التوحيد'],
};

const keysOf = (names) => {
  const keys = new Set();
  for (const n of names) for (const k of (/[a-z]/i.test(n) ? latinKeys(n) : arabicKeys(n))) keys.add(k);
  return [...keys];
};
const SURAH_KEYS = SURAH_PAGES.map((s) => ({
  surah: s,
  keys: keysOf([s.name, s.arabic]),
  aliasKeys: keysOf(ALIASES[s.number] ?? []),
}));

// Surahs a name (no number) could mean: exact matches first, then — while it is
// still being typed — the names it begins (from 2 Arabic / 3 Latin letters).
// Aliases only ever match whole: as prefixes they would suggest Al-Masad (alias
// "اللهب") to anyone typing "الله".
export const matchSurahNames = (name, limit = 4) => {
  const latin = /[a-z]/i.test(name);
  const qs = latin ? latinKeys(name) : arabicKeys(name);
  if (!qs.length || !qs[0]) return [];
  const minPrefix = latin ? 3 : 2;
  const exact = [];
  const prefix = [];
  for (const { surah, keys, aliasKeys } of SURAH_KEYS) {
    if (keys.some((k) => qs.includes(k)) || aliasKeys.some((k) => qs.includes(k))) exact.push(surah);
    else if (keys.some((k) => qs.some((q) => q.length >= minPrefix && k.startsWith(q)))) prefix.push(surah);
  }
  return [...exact, ...prefix].slice(0, limit);
};

// ── Jumps ────────────────────────────────────────────────────────────────────
const PAGE_WORDS = new Set(['page', 'pg', 'p', 'صفحة', 'الصفحة', 'صفحه', 'ص']);
const JUZ_WORDS = new Set(['juz', "juz'", 'juzz', 'jiz', 'para', 'part', 'جزء', 'الجزء', 'جز']);
const HIZB_WORDS = new Set(['hizb', 'حزب', 'الحزب']);
// Words that only say what kind of thing follows: "surah", "verse", "آية".
const FILLER = new Set(['surah', 'surat', 'sura', 'suurah', 'chapter', 'ayah', 'aya', 'ayat', 'verse', 'v',
  'سورة', 'سوره', 'آية', 'اية', 'الآية', 'الاية', 'آيه', 'ايه']);

const JUZ_START = [1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282,
  302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

const verseJump = (surahNumber, ayahNumber) =>
  surahNumber >= 1 && surahNumber <= 114 && ayahNumber >= 1 && ayahNumber <= ayahCount(surahNumber)
    ? { type: 'verse', surahNumber, ayahNumber }
    : null;

// Every place the query could be a reference to, most specific first. A jump is
// { type: 'verse', surahNumber, ayahNumber } | { type: 'surah', surahNumber }
// | { type: 'page', page } | { type: 'juz', juz, page } | { type: 'hizb', hizb, page }.
export const parseJumps = (raw) => {
  const q = toLatinDigits(String(raw ?? '')).trim().replace(/\s+/g, ' ');
  if (!q) return [];
  const out = [];
  const push = (j) => { if (j && !out.some((o) => JSON.stringify(o) === JSON.stringify(j))) out.push(j); };
  let m;

  // 2:255, 2.255, 2/255, 2-255, "2 255"
  if ((m = q.match(/^(\d{1,3})\s*(?:[:：.\\/-]\s*|\s)(\d{1,3})$/))) push(verseJump(+m[1], +m[2]));

  const words = q.toLowerCase().split(' ');
  // page 50 / صفحة 50 / p50 / juz 30 / جزء 30 / hizb 5
  const [head, ...rest] = words;
  const glued = q.toLowerCase().match(/^([^\d\s]+)\s*(\d{1,3})$/); // "p50", "juz30"
  const kind = glued ? glued[1].replace(/\.$/, '') : head;
  const num = glued ? +glued[2] : (rest.length === 1 && /^\d{1,3}$/.test(rest[0]) ? +rest[0] : null);
  if (num != null) {
    if (PAGE_WORDS.has(kind) && num >= 1 && num <= 604) push({ type: 'page', page: num });
    if (JUZ_WORDS.has(kind) && num >= 1 && num <= 30) push({ type: 'juz', juz: num, page: JUZ_START[num - 1] });
    if (HIZB_WORDS.has(kind) && num >= 1 && num <= 60) push({ type: 'hizb', hizb: num, page: HIZB_RANGES[num - 1].start });
  }

  // A bare number: a page, and a surah by its number.
  if ((m = q.match(/^(\d{1,3})$/))) {
    const n = +m[1];
    if (n >= 1 && n <= 604) push({ type: 'page', page: n });
    if (n >= 1 && n <= 114) push({ type: 'surah', surahNumber: n });
  }

  // A surah name, with an ayah number before or after it: "البقرة 255",
  // "Al-Baqarah 255", "255 البقرة", "surah kahf", "سورة الكهف".
  const named = words.filter((w) => !FILLER.has(w) && !FILLER.has(normalizeArabic(w)));
  const tail = named.length > 1 && /^\d{1,3}$/.test(named[named.length - 1]);
  const lead = !tail && named.length > 1 && /^\d{1,3}$/.test(named[0]);
  const ayah = tail ? +named[named.length - 1] : lead ? +named[0] : null;
  const name = (tail ? named.slice(0, -1) : lead ? named.slice(1) : named).join(' ');
  if (name && !/\d/.test(name)) {
    for (const s of matchSurahNames(name)) {
      push(ayah != null ? verseJump(s.number, ayah) : { type: 'surah', surahNumber: s.number });
    }
  }
  return out;
};
