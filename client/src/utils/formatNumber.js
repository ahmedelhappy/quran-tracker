// One decimal place, with a trailing ".0" dropped: 75.57142857142857 -> 75.6,
// and a whole 76 still reads "76" rather than "76.0".
//
// Page totals became fractional when sub-page progress (`segments`) landed — half
// a page counts as 0.5 — so every place that PRINTS a total goes through here.
// Values that are only compared or plotted (badge thresholds, chart points) keep
// their full precision on purpose.
export const round1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
