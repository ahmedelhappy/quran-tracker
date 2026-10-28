import { describe, it, expect } from 'vitest';
import { round1, toArabicDigits, formatPageList } from './formatNumber';

describe('round1', () => {
  it('keeps one decimal place and drops a trailing .0', () => {
    expect(round1(75.57142857142857)).toBe(75.6);
    expect(round1(76)).toBe(76);
    expect(String(round1(76))).toBe('76');
    expect(round1(0.5)).toBe(0.5);
    expect(round1(12.04)).toBe(12);
  });

  it('reads numeric strings and treats anything else as 0', () => {
    expect(round1('3.25')).toBe(3.3);
    for (const bad of [null, undefined, NaN, 'abc', {}]) expect(round1(bad)).toBe(0);
  });
});

describe('toArabicDigits', () => {
  it('turns every Western digit into its Arabic-Indic form', () => {
    expect(toArabicDigits(1234567890)).toBe('١٢٣٤٥٦٧٨٩٠');
    expect(toArabicDigits(604)).toBe('٦٠٤');
  });

  it('keeps everything that is not a digit', () => {
    expect(toArabicDigits('75.5')).toBe('٧٥.٥');
    expect(toArabicDigits('2:255')).toBe('٢:٢٥٥');
    expect(toArabicDigits('page')).toBe('page');
  });
});

describe('formatPageList', () => {
  it('joins with an English comma, or the Arabic comma and digits', () => {
    expect(formatPageList([3, 12, 40], false)).toBe('3, 12, 40');
    expect(formatPageList([3, 12, 40], true)).toBe('٣، ١٢، ٤٠');
  });

  it('sums up whatever is past the limit', () => {
    const pages = Array.from({ length: 11 }, (_, i) => i + 1);
    expect(formatPageList(pages, false)).toBe('1, 2, 3, 4, 5, 6, 7, 8 (+3)');
    expect(formatPageList(pages, true)).toBe('١، ٢، ٣، ٤، ٥، ٦، ٧، ٨ (+٣)');
    expect(formatPageList(pages, false, 2)).toBe('1, 2 (+9)');
  });

  it('prints nothing for no pages', () => {
    expect(formatPageList([], false)).toBe('');
  });
});
