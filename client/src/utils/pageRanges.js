// The editable page-range rows of the memorization pickers (Onboarding and
// the Settings progress editor): rows are { start, end } strings as typed.

// Collapse a list of page numbers into consecutive rows. No pages → one empty row.
export function toPageRanges(sortedPages) {
  if (!sortedPages || sortedPages.length === 0) return [{ start: '', end: '' }];
  const pages = [...sortedPages].sort((a, b) => a - b);
  const ranges = [];
  let start = pages[0], prev = pages[0];
  for (let i = 1; i < pages.length; i++) {
    if (pages[i] !== prev + 1) {
      ranges.push({ start: String(start), end: String(prev) });
      start = pages[i];
    }
    prev = pages[i];
  }
  ranges.push({ start: String(start), end: String(prev) });
  return ranges;
}

// Expand the range rows into the set of pages they cover (rows that are not a
// valid range are skipped; validateRanges says why).
export function rangesToPages(pageRanges) {
  const pages = new Set();
  pageRanges.forEach(({ start, end }) => {
    const s = parseInt(start, 10), e = parseInt(end, 10);
    if (!isNaN(s) && !isNaN(e) && s >= 1 && e <= 604 && s <= e)
      for (let p = s; p <= e; p++) pages.add(p);
  });
  return pages;
}

// Per row, the translation key of what is wrong with its start or end, if anything.
export function validateRanges(pageRanges) {
  const errors = pageRanges.map(() => ({}));
  const parsed = pageRanges.map(r => ({ start: parseInt(r.start, 10), end: parseInt(r.end, 10) }));
  parsed.forEach((r, i) => {
    if (r.start !== '' && !isNaN(r.start) && (r.start < 1 || r.start > 604))
      errors[i].start = 'common.validationRange';
    if (r.end !== '' && !isNaN(r.end) && (r.end < 1 || r.end > 604))
      errors[i].end = 'common.validationRange';
    if (!isNaN(r.start) && !isNaN(r.end) && r.start > r.end)
      errors[i].end = 'common.validationEndGreater';
    parsed.forEach((other, j) => {
      if (i === j) return;
      if (!isNaN(r.start) && !isNaN(r.end) && !isNaN(other.start) && !isNaN(other.end) &&
          r.start < other.end && r.end > other.start)
        errors[i].start = 'common.validationNoOverlap';
    });
  });
  return errors;
}

// How many pages of [start, end] are in the set.
export const countIn = (set, start, end) => {
  let c = 0;
  for (let p = start; p <= end; p++) if (set.has(p)) c++;
  return c;
};
