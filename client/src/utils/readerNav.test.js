import { describe, it, expect } from 'vitest';
import { clampPage, pageFromInput } from './readerNav';

describe('clampPage (L-17)', () => {
  it('keeps a page number whole, so ?page=12.5 is page 12, not a fetch of page 12.5', () => {
    expect(clampPage('12.5')).toBe(12);
    expect(clampPage(12.9)).toBe(12);
    expect(Number.isInteger(clampPage('300.25'))).toBe(true);
  });

  it('stays inside the mushaf and falls back to page 1', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-4)).toBe(1);
    expect(clampPage(999)).toBe(604);
    expect(clampPage('abc')).toBe(1);
    expect(clampPage(null)).toBe(1);
    expect(clampPage('50')).toBe(50);
  });
});

describe('pageFromInput — the go-to-page box (L-17)', () => {
  it('reads a whole page number', () => {
    expect(pageFromInput('50')).toBe(50);
    expect(pageFromInput(' 604 ')).toBe(604);
    expect(pageFromInput('1')).toBe(1);
  });

  it('refuses what is not a page, so Enter puts the current page back instead of jumping', () => {
    for (const text of ['', '   ', '0', '605', '12.5', '1e2', '-3', 'abc', null, undefined]) {
      expect(pageFromInput(text), String(text)).toBeNull();
    }
  });
});
