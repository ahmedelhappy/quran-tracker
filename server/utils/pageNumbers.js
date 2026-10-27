// One rule for every page number that reaches the progress API: an integer from
// 1 to 604. The type gate in middleware/validate.js only checks "is it a number",
// and the schema's min/max never ran on upserts, so 1.5, 0, -5 and 99999 were all
// stored — one account reached 2,004 "pages" and the top of the leaderboard (M-01).

const MIN_PAGE = 1;
const MAX_PAGE = 604;

const PAGE_RULE = `must be an integer between ${MIN_PAGE} and ${MAX_PAGE}`;

const isPageNumber = (n) => Number.isInteger(n) && n >= MIN_PAGE && n <= MAX_PAGE;

// A single page number from a request body, or null when it is not a valid page.
// A numeric string ("12") is accepted the way the type gate accepts it, but
// "4.5" is not a page any more than 4.5 is.
const toPageNumber = (value) => {
  const n = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return isPageNumber(n) ? n : null;
};

// A list of page numbers: every entry must be a valid page, the list can hold no
// more entries than the mushaf has pages, and duplicates collapse. Returns
// { pages } or { error } for a 400.
const parsePageList = (list, field) => {
  if (!Array.isArray(list)) return { error: `${field} must be an array` };
  if (list.length > MAX_PAGE) return { error: `${field} cannot hold more than ${MAX_PAGE} pages` };
  const bad = list.find((n) => !isPageNumber(n));
  if (bad !== undefined) return { error: `Every entry in ${field} ${PAGE_RULE} (got ${JSON.stringify(bad)})` };
  return { pages: [...new Set(list)] };
};

// A query condition that matches only rows on a real page, for reads of stored
// progress. Rows written before this validation (99999, 1.5, 0) stay in the
// database until scripts/cleanupInvalidPages.js is run; reading them back put
// them into the editors' save, which then failed for good (a 400 when sent
// back, a 409 when left out), and into counts and the review queue. Every
// value the driver stores is a double, so "integer" has to be checked in $expr.
// A function, so each query gets its own objects to cast.
const realPageMatch = () => ({
  pageNumber: { $gte: MIN_PAGE, $lte: MAX_PAGE },
  $expr: { $cond: [{ $isNumber: '$pageNumber' }, { $eq: ['$pageNumber', { $trunc: '$pageNumber' }] }, false] },
});

module.exports = { MIN_PAGE, MAX_PAGE, PAGE_RULE, realPageMatch, isPageNumber, toPageNumber, parsePageList };
