import { describe, it, expect } from 'vitest';
import { ordOf, ordOfKey, keyOfOrd, verseOfOrd, pageOfOrd, ayahCount, clampOrd, TOTAL_AYAHS, TOTAL_PAGES } from './verseIndex';
import {
  rubOrdRange, hizbOrdRange, unitOrdRange, pageOrdRange, mergeOrdRanges, coverageOf,
  toVerseKeyRanges, subtractOrdRanges, fullyCoveredPages, splitCoverageForSave, coverageFromProgress,
} from './unitRanges';

describe('verseIndex — one number per verse', () => {
  it('maps verse keys to global ayah numbers and back', () => {
    expect(ordOfKey('1:1')).toBe(1);
    expect(ordOfKey('2:1')).toBe(8);
    expect(ordOfKey('2:255')).toBe(262);
    expect(ordOfKey('114:6')).toBe(TOTAL_AYAHS);
    expect(keyOfOrd(262)).toBe('2:255');
    expect(verseOfOrd(6236)).toEqual({ surahNumber: 114, ayahNumber: 6 });
    for (const ord of [1, 7, 8, 293, 294, 3000, 6236]) expect(ordOfKey(keyOfOrd(ord))).toBe(ord);
  });

  it('refuses verses that do not exist', () => {
    for (const key of ['2:287', '0:1', '115:1', '1:0', 'abc', '2', '']) expect(ordOfKey(key), key).toBeNull();
    expect(ordOf(2, 286)).toBe(293);
    expect(keyOfOrd(0)).toBeNull();
    expect(keyOfOrd(6237)).toBeNull();
    expect(ayahCount(2)).toBe(286);
    expect(ayahCount(115)).toBe(0);
  });

  it('finds the page a verse starts on', () => {
    expect(pageOfOrd(1)).toBe(1);
    expect(pageOfOrd(ordOfKey('2:1'))).toBe(2);
    expect(pageOfOrd(ordOfKey('2:255'))).toBe(42);
    expect(pageOfOrd(TOTAL_AYAHS)).toBe(TOTAL_PAGES);
    expect(pageOfOrd(0)).toBeNull();
  });

  it('clamps to a real verse', () => {
    expect(clampOrd(-5)).toBe(1);
    expect(clampOrd(99999)).toBe(TOTAL_AYAHS);
    expect(clampOrd(NaN)).toBe(1);
    expect(clampOrd(10.4)).toBe(10);
  });
});

describe('unit spans', () => {
  it('the 240 rubs tile the whole Quran with no gap or overlap', () => {
    expect(rubOrdRange(1).from).toBe(1);
    expect(rubOrdRange(240).to).toBe(TOTAL_AYAHS);
    for (let n = 1; n < 240; n++) expect(rubOrdRange(n + 1).from).toBe(rubOrdRange(n).to + 1);
    expect(rubOrdRange(0)).toBeNull();
    expect(rubOrdRange(241)).toBeNull();
  });

  it('a hizb is its four rubs', () => {
    expect(hizbOrdRange(1)).toEqual({ from: rubOrdRange(1).from, to: rubOrdRange(4).to });
    expect(hizbOrdRange(60).to).toBe(TOTAL_AYAHS);
    expect(hizbOrdRange(61)).toBeNull();
    expect(unitOrdRange('hizb', 2)).toEqual(hizbOrdRange(2));
    expect(unitOrdRange('rub', 2)).toEqual(rubOrdRange(2));
    expect(unitOrdRange('juz', 2)).toBeNull();
  });

  it('the 604 pages tile the whole Quran too', () => {
    expect(pageOrdRange(1)).toEqual({ from: 1, to: 7 });
    expect(pageOrdRange(TOTAL_PAGES).to).toBe(TOTAL_AYAHS);
    for (let p = 1; p < TOTAL_PAGES; p++) expect(pageOrdRange(p + 1).from).toBe(pageOrdRange(p).to + 1);
    expect(pageOrdRange(605)).toBeNull();
  });
});

describe('coverage maths', () => {
  it('merges overlapping and touching ranges, and ignores holes in the input', () => {
    expect(mergeOrdRanges([{ from: 10, to: 20 }, null, { from: 1, to: 5 }, { from: 6, to: 8 }, { from: 15, to: 30 }]))
      .toEqual([{ from: 1, to: 8 }, { from: 10, to: 30 }]);
    expect(mergeOrdRanges([])).toEqual([]);
  });

  it('says full, partial or none', () => {
    const merged = mergeOrdRanges([{ from: 1, to: 10 }]);
    expect(coverageOf(merged, { from: 2, to: 9 })).toBe('full');
    expect(coverageOf(merged, { from: 8, to: 12 })).toBe('partial');
    expect(coverageOf(merged, { from: 11, to: 20 })).toBe('none');
    expect(coverageOf(merged, null)).toBe('none');
  });

  it('subtracts one coverage from another', () => {
    expect(subtractOrdRanges([{ from: 1, to: 20 }], [{ from: 5, to: 8 }, { from: 15, to: 30 }]))
      .toEqual([{ from: 1, to: 4 }, { from: 9, to: 14 }]);
    expect(subtractOrdRanges([{ from: 1, to: 5 }], [{ from: 1, to: 5 }])).toEqual([]);
  });

  it('sends merged verse-key ranges to the units endpoint', () => {
    expect(toVerseKeyRanges([rubOrdRange(1), rubOrdRange(2)])).toEqual([{ from: '1:1', to: keyOfOrd(rubOrdRange(2).to) }]);
  });

  // The audit's example: rubs 125-127 meet on pages 315 and 317, so one rub alone
  // must not claim its neighbours' shared pages.
  it('a quarter-hizb claims only the pages it covers completely', () => {
    const rub126 = mergeOrdRanges([rubOrdRange(126)]);
    expect(pageOfOrd(rubOrdRange(126).from)).toBe(315);
    expect(pageOfOrd(rubOrdRange(126).to)).toBe(317);
    expect([...fullyCoveredPages(rub126)]).toEqual([316]);
    expect(coverageOf(rub126, pageOrdRange(315))).toBe('partial');
    expect(coverageOf(rub126, pageOrdRange(317))).toBe('partial');
    expect(coverageOf(rub126, rubOrdRange(125))).toBe('none');
  });

  it('splits a coverage into whole pages plus the sub-page leftovers, losing nothing', () => {
    const merged = mergeOrdRanges([rubOrdRange(126)]);
    const { fullPages, leftovers } = splitCoverageForSave(merged);
    expect(fullPages).toEqual([316]);
    // Whole pages and leftovers together are exactly the original coverage.
    expect(mergeOrdRanges([...fullPages.map(pageOrdRange), ...leftovers])).toEqual(merged);
    expect(leftovers.every((r) => coverageOf(mergeOrdRanges(fullPages.map(pageOrdRange)), r) === 'none')).toBe(true);
  });

  it('rebuilds a coverage from the server: whole pages plus the segments of partial pages', () => {
    const page3 = pageOrdRange(3);
    const coverage = coverageFromProgress([1, 2, 3], [{ pageNumber: 3, segments: [{ from: keyOfOrd(page3.from), to: keyOfOrd(page3.from + 2) }] }]);
    expect(coverage).toEqual([{ from: 1, to: page3.from + 2 }]);
    expect([...fullyCoveredPages(coverage)]).toEqual([1, 2]);
    // A reversed or unknown segment is read safely.
    expect(coverageFromProgress([5], [{ pageNumber: 5, segments: [{ from: '2:40', to: '2:38' }, { from: 'x', to: '2:1' }] }]))
      .toEqual([{ from: ordOfKey('2:38'), to: ordOfKey('2:40') }]);
  });
});
