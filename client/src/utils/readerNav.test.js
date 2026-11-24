import { describe, it, expect } from 'vitest';
import { clampPage, pageFromInput, adjacentAnnotatedPage } from './readerNav';

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

describe('adjacentAnnotatedPage (L-17)', () => {
  it('in the spread, steps past the LEFT page instead of landing on it again', () => {
    // Spread 5-6, annotations on 6 and 20: "next" used to pick 6 for ever.
    expect(adjacentAnnotatedPage([6, 20], [5, 6], 1)).toBe(20);
    expect(adjacentAnnotatedPage([5, 20], [19, 20], -1)).toBe(5);
  });

  it('steps from a single page and wraps at both ends', () => {
    expect(adjacentAnnotatedPage([3, 9, 40], [9], 1)).toBe(40);
    expect(adjacentAnnotatedPage([3, 9, 40], [9], -1)).toBe(3);
    expect(adjacentAnnotatedPage([3, 9, 40], [40], 1)).toBe(3);
    expect(adjacentAnnotatedPage([3, 9, 40], [3], -1)).toBe(40);
    expect(adjacentAnnotatedPage([40, 3, 9], [10, 11], 1)).toBe(40); // order of the list does not matter
  });

  it('has nowhere to go without annotations', () => {
    expect(adjacentAnnotatedPage([], [1], 1)).toBeNull();
  });
});
