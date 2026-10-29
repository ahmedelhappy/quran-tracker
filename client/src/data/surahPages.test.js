// @vitest-environment node
// (it reads the structure file from disk: under jsdom import.meta.url is not a file: URL)
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SURAH_PAGES } from './surahPages';
import { surahOrdRange, pageOrdRange, coverageOf, mergeOrdRanges } from '../utils/unitRanges';
import { keyOfOrd } from '../utils/verseIndex';

// The committed mushaf structure the backend seeds from is the source of truth
// for where every verse sits. Read it from disk rather than importing it, so the
// 1.3 MB of JSON never becomes part of a client bundle by accident.
const STRUCTURE = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../server/seed/data/quranStructure.json', import.meta.url)),
  'utf8',
));

// surah number → { first, last } page holding any of its verses, and its verse count.
const truth = new Map();
for (const page of STRUCTURE) {
  for (const key of page.verseKeys) {
    const [surah, ayah] = key.split(':').map(Number);
    const t = truth.get(surah) ?? { first: page.pageNumber, last: page.pageNumber, ayahs: 0 };
    t.last = Math.max(t.last, page.pageNumber);
    t.first = Math.min(t.first, page.pageNumber);
    t.ayahs = Math.max(t.ayahs, ayah);
    truth.set(surah, t);
  }
}

describe('SURAH_PAGES against server/seed/data/quranStructure.json (M-13)', () => {
  it('covers all 114 surahs in order', () => {
    expect(SURAH_PAGES.map((s) => s.number)).toEqual(Array.from({ length: 114 }, (_, i) => i + 1));
    expect(truth.size).toBe(114);
  });

  it('starts every surah on the page its first verse is on', () => {
    const wrong = SURAH_PAGES.filter((s) => s.start !== truth.get(s.number).first)
      .map((s) => `${s.number}: ${s.start} vs ${truth.get(s.number).first}`);
    expect(wrong).toEqual([]);
  });

  it('ends every surah on the page its last verse is on', () => {
    const wrong = SURAH_PAGES.filter((s) => s.end !== truth.get(s.number).last)
      .map((s) => `${s.number}: ${s.end} vs ${truth.get(s.number).last}`);
    expect(wrong).toEqual([]);
    // The case the audit reproduced: An-Nisa's last verse shares page 106 with Al-Ma'idah.
    expect(SURAH_PAGES[3]).toMatchObject({ name: 'An-Nisa', start: 77, end: 106 });
    expect(SURAH_PAGES[4]).toMatchObject({ start: 106 });
  });

  it('has the verse count the structure data has', () => {
    const wrong = SURAH_PAGES.filter((s) => s.ayahs !== truth.get(s.number).ayahs).map((s) => s.number);
    expect(wrong).toEqual([]);
  });
});

describe('surahOrdRange — selecting a surah by its verses', () => {
  it('spans exactly the surah, from its first verse to its last', () => {
    for (const s of SURAH_PAGES) {
      const r = surahOrdRange(s.number);
      expect(keyOfOrd(r.from)).toBe(`${s.number}:1`);
      expect(keyOfOrd(r.to)).toBe(`${s.number}:${s.ayahs}`);
    }
    expect(surahOrdRange(0)).toBeNull();
    expect(surahOrdRange(115)).toBeNull();
  });

  it('marks the last verse on a shared page without claiming the neighbour', () => {
    const nisa = mergeOrdRanges([surahOrdRange(4)]);
    // Page 106 holds 4:176, 5:1 and 5:2: An-Nisa covers part of it, not all.
    expect(coverageOf(nisa, pageOrdRange(106))).toBe('partial');
    expect(coverageOf(nisa, surahOrdRange(5))).toBe('none');
    expect(coverageOf(nisa, surahOrdRange(4))).toBe('full');
  });
});
