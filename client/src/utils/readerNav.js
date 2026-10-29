// Small pure decisions of the Library reader's page navigation, kept here so
// they can be tested without rendering the whole reader (L-17).

export const TOTAL_PAGES = 604;

// Any value → a real page number. Whole numbers only: "12.5" (typed, or a
// ?page=12.5 deep link) used to become page 12.5, which reached the page fetch
// and ended in an error state. A fraction is truncated, as the page it is on.
export const clampPage = (n) => Math.max(1, Math.min(TOTAL_PAGES, Math.trunc(Number(n)) || 1));

// What the go-to-page box means: a page, or null when the text is not one
// (empty, "abc", "0", "605", "12.5"). Enter and leaving the box both use it, so
// Enter on an empty box no longer jumps to page 1.
export const pageFromInput = (text) => {
  const s = String(text ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= TOTAL_PAGES ? n : null;
};

// The next (dir > 0) or previous annotated page from what is on screen,
// wrapping around. In the two-page spread both pages are on screen, so "next"
// must look past the LEFT page and "previous" before the RIGHT one: comparing
// with the anchor (right) page alone picked the left page again and again, and
// the button pulsed it forever.
export const adjacentAnnotatedPage = (annotatedPages, visiblePages, dir) => {
  if (!annotatedPages.length) return null;
  const sorted = [...annotatedPages].sort((a, b) => a - b);
  const last = Math.max(...visiblePages);
  const first = Math.min(...visiblePages);
  if (dir > 0) return sorted.find((p) => p > last) ?? sorted[0];
  return [...sorted].reverse().find((p) => p < first) ?? sorted[sorted.length - 1];
};
