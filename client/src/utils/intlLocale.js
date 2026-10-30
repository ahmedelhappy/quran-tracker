// The one locale tag every date, time and number formatter in the app uses
// (L-08). It used to be a mix — 'ar-SA' in some places, 'ar-u-nu-arab' or
// 'ar-u-ca-gregory-nu-arab' in others — and 'ar-SA' defaults to the Islamic
// (Umm al-Qura) calendar, so the same day showed as a Hijri date on one card
// and a Gregorian one on the next.
//
// Arabic is 'ar-u-ca-gregory-nu-arab':
//   - plain 'ar', no region: the app is not for one country, and a region would
//     pull in that country's defaults;
//   - ca-gregory: the plan, the streak and every date the server sends are
//     Gregorian (UTC calendar days), so the dates shown must be too;
//   - nu-arab: Arabic-Indic digits, as the rest of the Arabic interface uses
//     (formatNumber.toArabicDigits).
// English is 'en-US'.
export const AR_LOCALE = 'ar-u-ca-gregory-nu-arab';
export const EN_LOCALE = 'en-US';

export const intlLocale = (isArabic) => (isArabic ? AR_LOCALE : EN_LOCALE);
