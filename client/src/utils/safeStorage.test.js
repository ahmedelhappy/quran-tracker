import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage, sessionStore, TOKEN_KEY, USER_SCOPED_KEYS, clearUserScopedStorage } from './safeStorage';

// Make reading window.localStorage itself throw, as a browser that blocks site
// data does (SecurityError on the property access, before any getItem).
const blockLocalStorage = () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });
};

describe('safeStorage with working storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('round-trips strings, stores other values as strings, and reports the write', () => {
    expect(storage.set('theme', 'dark')).toBe(true);
    expect(storage.get('theme')).toBe('dark');
    storage.set('mushafZoom', 1.25);
    expect(storage.get('mushafZoom')).toBe('1.25');
    expect(storage.get('missing')).toBeNull();
    storage.remove('theme');
    expect(storage.get('theme')).toBeNull();
  });

  it('parses JSON, and falls back on a missing or malformed value', () => {
    storage.setJSON('recentPages', [{ page: 50 }]);
    expect(storage.getJSON('recentPages')).toEqual([{ page: 50 }]);
    window.localStorage.setItem('broken', '{not json');
    expect(storage.getJSON('broken', [])).toEqual([]);
    expect(storage.getJSON('missing', 'fallback')).toBe('fallback');
  });

  it('refuses a value JSON cannot encode instead of throwing', () => {
    const loop = {};
    loop.self = loop;
    expect(storage.setJSON('loop', loop)).toBe(false);
    expect(storage.get('loop')).toBeNull();
  });

  it('lists the keys of its own area only', () => {
    storage.set('a', '1');
    storage.set('b', '2');
    sessionStore.set('s', '3');
    expect(storage.keys().sort()).toEqual(['a', 'b']);
    expect(sessionStore.keys()).toEqual(['s']);
    expect(storage.area()).toBe(window.localStorage);
  });
});

describe('safeStorage when the browser blocks storage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads return the fallback, writes return false, and nothing throws', () => {
    blockLocalStorage();
    expect(() => storage.get(TOKEN_KEY)).not.toThrow();
    expect(storage.get(TOKEN_KEY)).toBeNull();
    expect(storage.getJSON('recentPages', [])).toEqual([]);
    expect(storage.set('theme', 'dark')).toBe(false);
    expect(storage.setJSON('x', { a: 1 })).toBe(false);
    expect(() => storage.remove('theme')).not.toThrow();
    expect(storage.keys()).toEqual([]);
    expect(storage.area()).toBeNull();
    expect(() => clearUserScopedStorage()).not.toThrow();
  });

  it('a full origin (QuotaExceededError on write) is a false, not a crash', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(storage.set('theme', 'dark')).toBe(false);
    expect(sessionStore.set('x', '1')).toBe(false);
  });

  it('a getItem that throws reads as missing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(storage.get('theme')).toBeNull();
    expect(storage.getJSON('theme', 'light')).toBe('light');
  });
});

describe('clearUserScopedStorage (sign-out)', () => {
  beforeEach(() => window.localStorage.clear());

  it("clears the person's keys and keeps the device's settings", () => {
    const device = {
      theme: 'dark', lang: 'ar', reciter: 'alafasy', mushafZoom: '1.2', seenLibraryTour: '1',
      timerSettings: '{}', guestTodos: '[]', 'dailyVerse:2026-10-28:ar': '{}',
    };
    for (const key of USER_SCOPED_KEYS) window.localStorage.setItem(key, 'x');
    for (const [k, v] of Object.entries(device)) window.localStorage.setItem(k, v);

    clearUserScopedStorage();

    for (const key of USER_SCOPED_KEYS) expect(window.localStorage.getItem(key), key).toBeNull();
    for (const [k, v] of Object.entries(device)) expect(window.localStorage.getItem(k), k).toBe(v);
  });

  it('covers the session token and the reading trail', () => {
    expect(USER_SCOPED_KEYS).toEqual(expect.arrayContaining([TOKEN_KEY, 'lastMushafPage', 'recentPages']));
    expect(TOKEN_KEY).toBe('token');
  });
});
