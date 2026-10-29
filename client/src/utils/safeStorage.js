// One door to localStorage / sessionStorage that never throws.
//
// Web storage can throw on ANY access: reading `window.localStorage` itself is a
// SecurityError when the browser blocks site data (some private modes, strict
// cookie settings, sandboxed frames), and a write throws QuotaExceededError when
// the origin is full. Called during render — the theme and auth providers read
// storage at the root — one such throw took the whole app down to the error
// boundary. Everything that touches storage goes through here instead: a read
// that cannot happen returns the fallback, a write that cannot happen returns
// false, and the app carries on with in-memory state for that tab.

const areaOf = (kind) => {
  try {
    const area = kind === 'session' ? window.sessionStorage : window.localStorage;
    return area ?? null;
  } catch {
    return null;
  }
};

const makeStore = (kind) => ({
  // The raw Storage object (or null) — only for comparing a 'storage' event's
  // storageArea; never call it directly.
  area: () => areaOf(kind),
  get(key) {
    try { return areaOf(kind)?.getItem(key) ?? null; } catch { return null; }
  },
  // true when the value was stored.
  set(key, value) {
    try {
      const area = areaOf(kind);
      if (!area) return false;
      area.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try { areaOf(kind)?.removeItem(key); } catch { /* blocked: nothing stored to remove */ }
  },
  // Every key currently stored (empty when storage is unavailable).
  keys() {
    try {
      const area = areaOf(kind);
      if (!area) return [];
      const out = [];
      for (let i = 0; i < area.length; i++) out.push(area.key(i));
      return out.filter((k) => k != null);
    } catch {
      return [];
    }
  },
  // Parsed JSON, or `fallback` when the key is missing, unreadable or malformed.
  getJSON(key, fallback = null) {
    const raw = this.get(key);
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  setJSON(key, value) {
    let text;
    try { text = JSON.stringify(value); } catch { return false; }
    return this.set(key, text);
  },
});

export const storage = makeStore('local');
export const sessionStore = makeStore('session');

export const TOKEN_KEY = 'token';

// ── What signing out clears (L-06) ───────────────────────────────────────────
// Every key the client keeps, sorted into data about the PERSON who was signed
// in — cleared on sign-out and account deletion, so the next person at this
// browser doesn't inherit it — and settings of this DEVICE, which are kept:
// they say how this browser reads, not what anyone did, and wiping them on
// every sign-out would only make the reader set them up again.
//
// Cleared (the person's):
//   token              the session itself (api.js / AuthContext)
//   lastMushafPage     where they last were in the mushaf (Library)
//   recentPages        the pages they recently read (services/recentPages.js)
// Kept (the device's):
//   theme, lang, langExplicit                        appearance and language
//   reciter, recentReciters, playbackRate, versePause,
//   tafsirEdition, tafsirPanelWidth, mushafView, mushafSidebar,
//   mushafAnnoVisible, mushafZoom, readerTools, readerToolsTab,
//   chatbotPosY                                      reader and layout settings
//   seenLibraryTour, seenVerseActionsHint, seenVerseTapCue,
//   seenDashboardTour, seenMemorizeGuide             first-run hints shown here
//   timerState, timerSettings                        the timer — a device tool
//                                                    that never touches an account
//   guestTodos                                       the SIGNED-OUT to-do list:
//                                                    not the account's (that one is
//                                                    on the server) and its only copy
//   dailyVerse:<day>:<lang>                          the same verse for everyone (a cache);
//                                                    only the current day's are kept —
//                                                    services/dailyVerse.js removes the
//                                                    older days' when it stores a new one
// Nothing is kept in sessionStorage, and the chat history lives only in the
// chat component, which remounts with the account (AccountScope in App.jsx).
export const USER_SCOPED_KEYS = [TOKEN_KEY, 'lastMushafPage', 'recentPages'];

export const clearUserScopedStorage = () => {
  for (const key of USER_SCOPED_KEYS) storage.remove(key);
};
