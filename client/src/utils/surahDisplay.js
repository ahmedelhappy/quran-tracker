import { toArabicDigits } from '../services/quranApi';
import { SURAH_BY_NUMBER } from '../data/surahPages';

export const formatSurahNames = (page, isArabic) => {
  const surahs = page?.surahs?.length
    ? page.surahs
    : [{ name: page?.surahName, nameArabic: page?.surahNameArabic }];
  return surahs
    .map(s => isArabic ? (s.nameArabic || s.name) : s.name)
    .filter(Boolean)
    .join(' · ');
};

const parseVerseKey = (key) => {
  if (!key) return null;
  const [surah, ayah] = key.split(':').map(Number);
  return { surah, ayah };
};

// Directional isolate marks (LRI/PDI) so a numeric range embedded in Arabic text
// always renders start–end left-to-right, regardless of the surrounding paragraph
// direction — otherwise the bidi algorithm can visually flip "187–190".
const LRI = '⁦';
const PDI = '⁩';

const formatVerseRangeDigits = (from, to, isArabic) => {
  const f = isArabic ? toArabicDigits(from) : String(from);
  const l = isArabic ? toArabicDigits(to) : String(to);
  return `${LRI}${f}–${l}${PDI}`;
};

// Computes, for each surah on a page, its verse range (from/to) and whether the
// surah appears in full on that page. `from` defaults to 1 unless this surah owns
// the page's firstVerseKey; `to` defaults to the surah's total ayah count (from
// SURAH_BY_NUMBER, derived from the same mushaf structure data as the backend)
// unless this surah owns the page's lastVerseKey.
export const getPageSurahRanges = (page) => {
  const surahs = page?.surahs?.length
    ? page.surahs
    : (page?.surahName ? [{ name: page.surahName, nameArabic: page.surahNameArabic }] : []);
  if (!surahs.length) return [];

  const first = parseVerseKey(page.firstVerseKey);
  const last = parseVerseKey(page.lastVerseKey);

  return surahs.map((s) => {
    const total = s.number != null ? SURAH_BY_NUMBER[s.number]?.ayahs ?? null : null;
    const from = first && first.surah === s.number ? first.ayah : 1;
    const to = last && last.surah === s.number ? last.ayah : (total ?? from);
    const isComplete = total != null && from === 1 && to === total;
    return { number: s.number, name: s.name, nameArabic: s.nameArabic, from, to, isComplete };
  });
};

// Builds the "SurahName · SurahName · verses a–b" label for a page: surah names in
// mushaf order, with a verse-number range appended only to surahs that are
// partial on this page. Complete surahs show their name alone. A single-ayah
// partial ("verse 176") uses the singular string instead of "verses 176–176".
// `t` is the i18next translate function (needs `dashboard.versesRange` and
// `dashboard.verseSingle`).
export const formatSurahRangesLabel = (page, isArabic, t) => {
  const ranges = getPageSurahRanges(page);
  return ranges
    .map((r) => {
      const name = isArabic ? (r.nameArabic || r.name) : r.name;
      if (!name) return null;
      if (r.isComplete) return name;
      if (r.from === r.to) {
        const verse = isArabic ? toArabicDigits(r.from) : String(r.from);
        return `${name} · ${t('dashboard.verseSingle', { verse })}`;
      }
      const range = formatVerseRangeDigits(r.from, r.to, isArabic);
      return `${name} · ${t('dashboard.versesRange', { range })}`;
    })
    .filter(Boolean)
    .join(' · ');
};
