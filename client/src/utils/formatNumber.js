// One decimal place, with a trailing ".0" dropped: 75.57142857142857 -> 75.6,
// and a whole 76 still reads "76" rather than "76.0".
//
// Page totals became fractional when sub-page progress (`segments`) landed — half
// a page counts as 0.5 — so every place that PRINTS a total goes through here.
// Values that are only compared or plotted (badge thresholds, chart points) keep
// their full precision on purpose.
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

// Western digits to Arabic-Indic ones: 12 -> '١٢'. Everything else is kept.
export const toArabicDigits = (n) =>
  String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]);

// A short list of page numbers for a sentence: "3, 12, 40" or "٣، ١٢، ٤٠", with
// the rest summed up past `max` so a long list can't swamp a toast.
export const formatPageList = (pages, isArabic, max = 8) => {
  const shown = pages.slice(0, max).map((n) => (isArabic ? toArabicDigits(n) : String(n)));
  const more = pages.length - shown.length;
  const tail = more > 0 ? ` (+${isArabic ? toArabicDigits(more) : more})` : '';
  return shown.join(isArabic ? '، ' : ', ') + tail;
};
