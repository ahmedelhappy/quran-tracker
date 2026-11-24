import { describe, it, expect } from 'vitest';
import { toPageRanges, rangesToPages, validateRanges, countIn } from './pageRanges';

describe('page range rows', () => {
  it('collapses pages into consecutive rows, in order, whatever order they came in', () => {
    expect(toPageRanges([5, 1, 2, 3, 10, 11])).toEqual([
      { start: '1', end: '3' }, { start: '5', end: '5' }, { start: '10', end: '11' },
    ]);
    expect(toPageRanges([])).toEqual([{ start: '', end: '' }]);
    expect(toPageRanges(null)).toEqual([{ start: '', end: '' }]);
  });

  it('expands only the rows that are a real range of mushaf pages', () => {
    const pages = rangesToPages([
      { start: '1', end: '3' }, { start: '', end: '5' }, { start: '9', end: '7' }, { start: '600', end: '700' },
    ]);
    expect([...pages].sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('says what is wrong with a row: out of range, backwards, or overlapping another', () => {
    expect(validateRanges([{ start: '700', end: '' }])).toEqual([{ start: 'common.validationRange' }]);
    expect(validateRanges([{ start: '9', end: '7' }])).toEqual([{ end: 'common.validationEndGreater' }]);
    expect(validateRanges([{ start: '1', end: '10' }, { start: '5', end: '20' }])).toEqual([
      { start: 'common.validationNoOverlap' }, { start: 'common.validationNoOverlap' },
    ]);
    expect(validateRanges([{ start: '1', end: '10' }, { start: '11', end: '20' }])).toEqual([{}, {}]);
  });

  it('counts the pages of a span that are in a set', () => {
    expect(countIn(new Set([1, 2, 5]), 1, 4)).toBe(2);
    expect(countIn(new Set(), 1, 604)).toBe(0);
  });
});
