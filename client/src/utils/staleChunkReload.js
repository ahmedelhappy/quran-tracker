import { sessionStore } from './safeStorage';

// A tab opened before a deploy keeps running the old entry chunk, which asks for
// the old hashed files (a page's chunk, the Progress chart, a language's
// strings), and those are gone once the new build is live: 404. Reloading the
// page fetches the current index.html and the files that go with it.
//
// At most once a minute per tab (a sessionStorage stamp), so a file that fails
// for another reason (a blocked or flaky request) cannot reload the page in a
// loop: the failure then takes its normal course (the language toast, the
// chart's placeholder). Not when the browser knows it is offline, where a
// reload would trade the app for the browser's offline page, and not when
// storage is blocked, where there is no way to keep that stamp.
export const RELOAD_STAMP_KEY = 'staleChunkReloadAt';
export const RELOAD_GAP_MS = 60_000;

// true when it reloads.
export const reloadForStaleBuild = (win = window, now = Date.now) => {
  if (win.navigator.onLine === false) return false;
  const last = Number(sessionStore.get(RELOAD_STAMP_KEY)) || 0;
  if (now() - last < RELOAD_GAP_MS) return false;
  if (!sessionStore.set(RELOAD_STAMP_KEY, now())) return false;
  win.location.reload();
  return true;
};

// Vite reports every failed lazy import() as a `vite:preloadError` event. (The
// language files are fetched, not imported: i18n.js calls reloadForStaleBuild
// itself on a 404.)
export const installStaleChunkReload = (win = window, now = Date.now) => {
  win.addEventListener('vite:preloadError', () => { reloadForStaleBuild(win, now); });
};
