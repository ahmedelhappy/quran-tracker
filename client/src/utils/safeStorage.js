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
