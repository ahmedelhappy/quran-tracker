// How a recently read page is named in the lists: "Page 291" / "صفحة ٢٩١" (or the
// two pages of a spread), the surah at the top of it, and how long ago it was read.
import { PAGE_FIRST_AYAH } from '../data/pageAyahStarts';
import { SURAH_BY_NUMBER } from '../data/surahPages';
import { verseOfOrd } from './verseIndex';
import { recentKeyOf } from '../services/recentPages';

// The surah a page opens with — what a reader recognises it by.
export const surahAtTopOf = (page) => verseOfOrd(PAGE_FIRST_AYAH[page - 1])?.surahNumber ?? null;

// Coarse on purpose: "just now", minutes, hours, days, weeks, then the date.
export const agoParts = (at, now) => {
  const min = Math.floor(Math.max(0, now - at) / 60000);
  if (min < 1) return { unit: 'now' };
  if (min < 60) return { unit: 'minute', n: min };
  const h = Math.floor(min / 60);
  if (h < 24) return { unit: 'hour', n: h };
  const d = Math.floor(h / 24);
  if (d < 7) return { unit: 'day', n: d };
  const w = Math.floor(d / 7);
  if (w < 5) return { unit: 'week', n: w };
  return { unit: 'date' };
};

export const formatAgo = (at, now, { t, fmtNum, isArabic }) => {
  const { unit, n } = agoParts(at, now);
  if (unit === 'now') return t('library.recent.ago.now');
  if (unit !== 'date') return t(`library.recent.ago.${unit}`, { count: n, n: fmtNum(n) });
  const date = new Date(at);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(isArabic ? 'ar-u-nu-arab' : 'en', {
    day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
};

// Everything a row or a chip shows for an entry.
export const describeRecent = (entry, now, { t, fmtNum, isArabic }) => {
  const [a, b] = entry.pages;
  const surahNumber = surahAtTopOf(a);
  const s = SURAH_BY_NUMBER[surahNumber];
  return {
    entry,
    key: recentKeyOf(entry),
    short: b ? `${fmtNum(a)}–${fmtNum(b)}` : fmtNum(a),
    label: b ? t('library.recent.pages', { a: fmtNum(a), b: fmtNum(b) }) : t('library.recent.page', { n: fmtNum(a) }),
    surah: s ? (isArabic ? s.arabic : s.name) : '',
    ago: formatAgo(entry.at, now, { t, fmtNum, isArabic }),
  };
};
