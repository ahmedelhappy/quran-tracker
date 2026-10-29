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
