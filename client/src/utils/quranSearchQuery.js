// Reading what someone typed into the Library's search box.
//
// Two kinds of query, both handled here as pure functions (no React, no index):
//
//  1. TEXT — Arabic words matched against the Quran. Both the index and the query go
//     through the same `normalizeArabic`, so a query typed with full tashkeel or with
//     none meets the text on the same letters. The index is in the plain (imla'i)
//     spelling, though, and text pasted from a mushaf is Uthmani, which spells many
//     words differently (ٱلْكِتَـٰبَ for الكتاب, يَـٰٓأَيُّهَا for يا أيها): such a query
//     is read through `uthmaniQuerySlots` instead, which offers each word's plain
//     spellings.
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
// (water) would become "ما", one of the commonest words in the text. (A combining
// hamza that NFC cannot seat on a letter, as Uthmani writes it on a tatweel in
// مَسْـُٔولًا, is still stripped as a mark here; uthmaniQuerySlots turns it into ء.)
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

// ── Uthmani text pasted from a mushaf ────────────────────────────────────────
// The index is in the plain spelling, and Uthmani differs from it in ways no single
// normalisation can undo: the dagger alef stands for a written alef in كتاب
// (ٱلْكِتَـٰبَ) but for nothing in الرحمن (ٱلرَّحْمَـٰنِ); the small yeh is a real yeh in
// إبراهيم (إِبْرَٰهِـۧمَ) and an unwritten one in بِهِۦ. So a pasted word becomes a short
// list of the plain spellings it can stand for, and the search accepts any of them.
// Typed text never contains these signs, so it never comes this way and matches
// exactly what it matched before.
//
// The signs: the dagger alef, alef wasla, the Quranic marks, a hamza on a
// tatweel, and two hamza spellings the plain script never uses — ءَا / ءَأ for آ / أأ
// (ءَامَنُوا۟, ءَأَنتُمْ) and أ followed by a bare ء (أَءِذَا for أإذا).
const UTHMANI_SIGNS = /\u0671|[\u0670\u06D6-\u06ED\u08D3-\u08FF]|\u0640[\u064B-\u0652]*\u0654|\u0621\u064E[\u0622\u0623\u0627]|\u0623[\u064B-\u0652]*\u0621/;
export const looksUthmani = (s) => UTHMANI_SIGNS.test(String(s ?? '').normalize('NFC'));

// The hamza Uthmani seats on a tatweel (شَيْـًٔا, بِـَٔايَـٰتِ) is the plain ء.
const HAMZA_ON_TATWEEL = /\u0640[\u064B-\u0652]*\u0654|\u0654/g;
// Small letters written above or below a word: present in some plain spellings
// (يُحْيِۦ, ٱلْغَاوُۥنَ, نُـۨجِى) and absent in others (بِهِۦ, لَهُۥ).
const SMALL_LETTERS = { '\u06E5': 'و', '\u06E6': 'ي', '\u06E7': 'ي', '\u06E8': 'ن' };
const IS_MARK = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u08D3-\u08FF\u0640]/;
const MAX_SPELLINGS = 64; // per word; real words need far fewer

const replaceLast = (s, from, to) => {
  const i = s.lastIndexOf(from);
  return i < 0 ? s : s.slice(0, i) + to + s.slice(i + from.length);
};

// One pasted word → its possible plain spellings, each as normalised tokens (a
// spelling can be two tokens: the vocative يَـٰٓأَيُّهَا is the index's "يا أيها").
export const uthmaniWordSpellings = (word) => {
  const chars = [...String(word ?? '').normalize('NFC').replace(HAMZA_ON_TATWEEL, 'ء')];
  let outs = [''];
  const letters = []; // the word's letters so far, marks left out
  chars.forEach((c) => {
    const lastLetter = letters[letters.length - 1] ?? null;
    let next;
    if (c === '\u0670') {
      // The dagger alef: written as ا (كتاب), or not at all (الرحمن). After و or ى
      // it can replace that letter (الصلاة, مولانا); after a word-initial ي or ه
      // it closes the vocative / attention particle (يا قوم, ها أنتم, ويا قوم).
      const initial = letters.length === 1 || (letters.length === 2 && 'وف'.includes(letters[0]));
      next = outs.flatMap((o) => {
        const alts = [o, `${o}ا`];
        if (lastLetter === 'و' || lastLetter === 'ى' || lastLetter === 'ي') alts.push(replaceLast(o, lastLetter, 'ا'));
        if (initial && (lastLetter === 'ي' || lastLetter === 'ه')) alts.push(`${o}ا `);
        return alts;
      });
    } else if (SMALL_LETTERS[c]) {
      next = outs.flatMap((o) => [o, o + SMALL_LETTERS[c]]);
    } else if (c === '\u06DC' && lastLetter === 'ص') {
      next = outs.flatMap((o) => [o, replaceLast(o, 'ص', 'س')]); // بَصْۜطَةً is بسطة
    } else if ((c === '\u06DF' || c === '\u06E0') && lastLetter) {
      // The small zero marks a letter that is written but not read: the plain
      // spelling sometimes keeps it (تَجِدُوا۟, أُو۟لُوا۟ → أولو) and sometimes not
      // (يَتْلُوا۟ → يتلو, سَأُو۟رِيكُمْ → سأريكم).
      next = outs.flatMap((o) => [o, replaceLast(o, lastLetter, '')]);
    } else if (c === 'ء') {
      // Uthmani writes a bare ء where the plain spelling seats it on an alef:
      // أَرَءَيْتُمْ is أرأيتم, أَءِذَا is أإذا, يَسْـَٔلُونَكَ is يسألونك.
      next = outs.flatMap((o) => [o + c, `${o}ا`]);
      letters.push(c);
    } else {
      next = outs.map((o) => o + c);
      if (!IS_MARK.test(c)) letters.push(c);
    }
    outs = next.slice(0, MAX_SPELLINGS);
  });
  const spellings = new Map();
  const add = (tokens) => {
    // A verse number pasted along with the text is not a word of it.
    const words = tokens.filter((t) => !/^[0-9]+$/.test(t));
    if (words.length) spellings.set(words.join(' '), words);
  };
  for (const o of outs) {
    // One lam for two: ٱلَّيْلِ is الليل.
    const variants = [o, o.replace(/(\u0671|\u0627)\u0644([\u064B-\u0650\u0652]*\u0651)/, '$1\u0644\u0644$2')];
    for (const v of variants) {
      const tokens = arabicTokens(v);
      add(tokens);
      // ءَا is the plain آ: ءَامَنُوا۟ is آمنوا, ٱلْقُرْءَانُ is القرآن.
      if (tokens.some((t) => t.includes('ءا'))) add(tokens.map((t) => t.replaceAll('ءا', 'ا')));
    }
  }
  return [...spellings.values()].slice(0, MAX_SPELLINGS);
};

// A pasted query → one slot per word, each the list of spellings it may match; or
// null when the query is not Uthmani text and goes through arabicTokens as typed.
export const uthmaniQuerySlots = (query) => {
  if (!looksUthmani(query)) return null;
  return String(query).split(/\s+/).map(uthmaniWordSpellings).filter((slot) => slot.length);
};

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
