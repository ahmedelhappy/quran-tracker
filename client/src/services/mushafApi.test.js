import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Page 76 ends Aal-Imran with a blank last line, which holds An-Nisa's plate —
// so drawing it needs page 77 too. Trimmed to what mushafApi reads.
const verse = (id, verseKey, page, line) => ({
  id, verse_key: verseKey, text_uthmani: 'x', juz_number: 4, hizb_number: 8, rub_el_hizb_number: 32, sajdah_number: null,
  words: [
    { position: 1, char_type_name: 'word', code_v1: 'a', line_number: line, page_number: page },
    { position: 2, char_type_name: 'end', code_v1: 'b', line_number: line, page_number: page },
  ],
});
const PAGES = {
  76: { verses: [verse(493, '3:200', 76, 14)], pagination: { next_page: null } },
  77: { verses: [verse(494, '4:1', 77, 2)], pagination: { next_page: null } },
};
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const pageOf = (url) => Number(String(url).match(/by_page\/(\d+)\?/)[1]);

let api;
beforeEach(async () => {
  vi.resetModules();
  api = await import('./mushafApi');
});
afterEach(() => { vi.unstubAllGlobals(); });

// What page 77's request does; page 76's always arrives.
const stubNextPage = (answer) => vi.stubGlobal('fetch', vi.fn(async (url) => (
  pageOf(url) === 77 ? answer() : json(PAGES[pageOf(url)])
)));
const plateOn15 = (shaped) => shaped.lines.find((l) => l.lineNumber === 15)?.type;

describe('fetchMushafPage when page+1 cannot be had (M-14)', () => {
  it('offline: the page is still handed over, without the plate, and not cached', async () => {
    stubNextPage(() => { throw new TypeError('Failed to fetch'); });
    const shaped = await api.fetchMushafPage(76);
    expect(shaped.verses).toHaveLength(1);
    expect(api.peekMushafPage(76)).toBeNull();
  });

  it('a 5xx: the same', async () => {
    stubNextPage(() => json({}, 503));
    await expect(api.fetchMushafPage(76)).resolves.toMatchObject({ page: 76 });
    expect(api.peekMushafPage(76)).toBeNull();
  });

  it('a payload that cannot be read is reported and fails the page', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubNextPage(() => json({ verses: 'not a list' }));
    await expect(api.fetchMushafPage(76)).rejects.toThrow('Unexpected mushaf page payload');
    expect(api.peekMushafPage(76)).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      'Reported error (mushaf):', expect.any(Error), expect.objectContaining({ page: 76 }),
    );
  });

  it('once page+1 arrives, the page is built whole, with its plate, and cached', async () => {
    let down = true;
    stubNextPage(() => {
      if (down) throw new TypeError('Failed to fetch');
      return json(PAGES[77]);
    });
    const without = await api.fetchMushafPage(76);
    down = false;
    const whole = await api.fetchMushafPage(76);
    expect(api.peekMushafPage(76)).toBe(whole);
    expect(plateOn15(without)).toBe('blank');
    expect(plateOn15(whole)).toBe('surah');
  });
});
