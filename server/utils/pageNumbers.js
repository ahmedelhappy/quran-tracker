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

module.exports = { MIN_PAGE, MAX_PAGE, PAGE_RULE, isPageNumber, toPageNumber, parsePageList };
