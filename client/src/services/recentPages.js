// The pages the reader recently READ — one list, kept in this browser.
//
// localStorage (`recentPages`) rather than the account: the Library is public, so
// this works signed out, and it is the same in every tab of the browser (the
// `storage` event carries a change made in one tab to the others). It does not
// follow the reader to another device — that would need the account, and the
// list is a convenience, not a record.
//
// An entry is { pages, page, at }:
//   pages — what was on screen: one page, or the two of a spread (ONE entry);
//   page  — the page the reader was on, which is where tapping it goes back to;
//   at    — when it was read (ms since the epoch), for "2h ago".
// Newest first, at most RECENT_CAP. Reading a page again moves it to the top: a
// new entry replaces every older one it shares a page with, so page 10 read alone
// and then as the spread 10–11 is one entry, not two.
//
// WHAT counts as read is decided by the reader (hooks/useRecentPageTracker.js);
// this module only keeps the list.

export const RECENT_KEY = 'recentPages';
export const RECENT_CAP = 12;

export const recentKeyOf = (entry) => entry.pages.join('-');

const isPage = (n) => Number.isInteger(n) && n >= 1 && n <= 604;
const overlaps = (a, b) => a.pages.some((p) => b.pages.includes(p));

// Whatever is in storage, made safe: well-formed entries only, newest first, no
// two sharing a page, at most the cap. A hand-edited or older value can't break
// the reader.
const sanitize = (raw) => {
  if (!Array.isArray(raw)) return [];
  const valid = [];
  for (const e of raw) {
    if (!e || !Array.isArray(e.pages)) continue;
    const pages = e.pages.slice(0, 2);
    if (!pages.length || !pages.every(isPage)) continue;
    if (pages.length === 2 && pages[1] !== pages[0] + 1) continue;
    const at = Number(e.at);
    if (!Number.isFinite(at)) continue;
    valid.push({ pages, page: pages.includes(e.page) ? e.page : pages[0], at });
  }
  // Newest first (a stable sort keeps the given order for equal times), then
  // drop any older entry that shares a page with a newer one.
  valid.sort((a, b) => b.at - a.at);
  const out = [];
  for (const entry of valid) {
    if (out.length === RECENT_CAP) break;
    if (!out.some((o) => overlaps(o, entry))) out.push(entry);
  }
  return out;
};

const read = () => {
  try { return sanitize(JSON.parse(localStorage.getItem(RECENT_KEY))); }
  catch { return []; }
};

let snapshot = read();
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const write = (list) => {
  snapshot = list;
  try {
    if (list.length) localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    else localStorage.removeItem(RECENT_KEY);
  } catch { /* storage full or blocked: the list still works for this tab */ }
  emit();
};

// Another tab changed the list (or cleared all storage: key null).
const onStorage = (e) => {
  if (e.key !== RECENT_KEY && e.key !== null) return;
  snapshot = read();
  emit();
};

export const subscribeRecentPages = (fn) => {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
};

export const getRecentPages = () => snapshot;

// Every change starts from what is in storage NOW, not this tab's copy, so two
// tabs reading at the same time don't undo each other's entries.
export const recordRecentPage = (pages, page, at = Date.now()) => {
  const entry = { pages: [...pages], page, at };
  write(sanitize([entry, ...read().filter((e) => !overlaps(e, entry))]));
};

export const removeRecentPage = (key) => {
  write(read().filter((e) => recentKeyOf(e) !== key));
};

// Returns what was cleared, so the caller can offer to put it back.
export const clearRecentPages = () => {
  const before = read();
  write([]);
  return before;
};

// Undo of a clear: the old entries come back, with anything read since kept and
// winning where they share a page (sanitize keeps the newest).
export const restoreRecentPages = (entries) => {
  write(sanitize([...read(), ...entries]));
};
