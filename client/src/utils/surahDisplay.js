export const formatSurahNames = (page, isArabic) => {
  const surahs = page?.surahs?.length
    ? page.surahs
    : [{ name: page?.surahName, nameArabic: page?.surahNameArabic }];
  return surahs
    .map(s => isArabic ? (s.nameArabic || s.name) : s.name)
    .filter(Boolean)
    .join(' · ');
};
