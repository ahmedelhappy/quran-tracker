import { toArabicDigits } from '../services/quranApi';

export const formatSurahNames = (page, isArabic) => {
  const surahs = page?.surahs?.length
    ? page.surahs
    : [{ name: page?.surahName, nameArabic: page?.surahNameArabic }];
  return surahs
    .map(s => isArabic ? (s.nameArabic || s.name) : s.name)
    .filter(Boolean)
    .join(' · ');
};

// Localize a "surah:ayah" verse key for display, converting to Arabic-Indic
// digits in Arabic (e.g. "2:187" → "٢:١٨٧"). Returns '' for missing keys.
export const localizeVerseKey = (key, isArabic) =>
  key ? (isArabic ? toArabicDigits(key) : key) : '';
