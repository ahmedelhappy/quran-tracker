import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import en from './locales/en.json';
import ar from './locales/ar.json';

// The language files are fetched (i18n.js). `failing` makes every request for
// that language fail, the way a dropped connection or a stale deploy's 404 does.
const failing = new Set();
const requests = [];
const fakeFetch = vi.fn(async (url) => {
  const lng = /ar\.json|\/ar-/.test(url) ? 'ar' : 'en';
  requests.push(lng);
  if (failing.has(lng)) return { ok: false, status: 503, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => (lng === 'ar' ? ar : en) };
});

let i18n;
let switchLanguage;
let onLanguageUnavailable;
let consoleError;

beforeAll(async () => {
  vi.stubGlobal('fetch', fakeFetch);
  ({ default: i18n, switchLanguage, onLanguageUnavailable } = await import('./i18n'));
  const { i18nReady } = await import('./i18n');
  await i18nReady;
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  failing.clear();
  requests.length = 0;
  localStorage.clear();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('switchLanguage', () => {
  it('switches once the strings have loaded, and remembers the choice', async () => {
    expect(i18n.language).toBe('en');
    expect(await switchLanguage('ar')).toBe(true);
    expect(i18n.language).toBe('ar');
    expect(i18n.t('common.close')).toBe(ar.common.close);
    expect(localStorage.getItem('lang')).toBe('ar');
    expect(await switchLanguage('en')).toBe(true);
    expect(localStorage.getItem('lang')).toBe('en');
  });

  it('stays in the current language when the strings cannot be fetched, after a bounded retry', async () => {
    i18n.removeResourceBundle('ar', 'translation');
    failing.add('ar');
    const announced = [];
    const stop = onLanguageUnavailable((lng) => announced.push(lng));

    expect(await switchLanguage('ar')).toBe(false);

    expect(requests).toEqual(['ar', 'ar', 'ar']); // the first try and two retries
    expect(i18n.language).toBe('en');
    expect(i18n.t('common.close')).toBe(en.common.close); // no raw keys
    expect(localStorage.getItem('lang')).toBeNull(); // nothing remembered
    expect(announced).toEqual(['ar']);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"ar"'), expect.any(Error));
    stop();
  });

  it('tries a failed language again on the next switch', async () => {
    i18n.removeResourceBundle('ar', 'translation');
    failing.add('ar');
    const stop = onLanguageUnavailable(() => {});
    expect(await switchLanguage('ar')).toBe(false);
    stop();

    failing.clear();
    requests.length = 0;
    expect(await switchLanguage('ar')).toBe(true);
    expect(requests).toEqual(['ar']);
    expect(i18n.language).toBe('ar');
    await switchLanguage('en');
  });

  it('holds a failure until the notice is listening', async () => {
    i18n.removeResourceBundle('ar', 'translation');
    failing.add('ar');
    expect(await switchLanguage('ar')).toBe(false);
    const announced = [];
    const stop = onLanguageUnavailable((lng) => announced.push(lng));
    expect(announced).toEqual(['ar']);
    stop();
  });
});
