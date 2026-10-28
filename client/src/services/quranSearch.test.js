// @vitest-environment node
// (pure logic over a file read from disk — no DOM needed.)
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSearchEngine } from './quranSearch';

// The committed index the Library lazy-loads (public/data/search-index.json).
const INDEX_PATH = fileURLToPath(new URL('../../public/data/search-index.json', import.meta.url));

describe('buildSearchEngine on a small index', () => {
  let engine;
  beforeAll(async () => {
    engine = await buildSearchEngine({
      verses: [
        'بِسْمِ|اللَّهِ|الرَّحْمَٰنِ|الرَّحِيمِ',
        'الْحَمْدُ|لِلَّهِ|رَبِّ|الْعَالَمِينَ',
        'الرَّحْمَٰنِ|الرَّحِيمِ',
        'يَا أَيُّهَا|النَّاسُ',
      ],
    });
  });

  it('finds a phrase typed without tashkeel, as word positions inside one verse', () => {
    expect(engine.search('الرحمن الرحيم').occurrences).toEqual([
      { ord: 1, from: 3, to: 4 },
      { ord: 3, from: 1, to: 2 },
    ]);
  });

  it('lets the last word be half typed', () => {
    expect(engine.search('الرحمن الر').occurrences).toEqual([
      { ord: 1, from: 3, to: 4 },
      { ord: 3, from: 1, to: 2 },
    ]);
    expect(engine.search('العال').occurrences).toEqual([{ ord: 2, from: 4, to: 4 }]);
  });

  it('never matches across two verses', () => {
    // 'العالمين' ends verse 2 and 'الرحمن' starts verse 3.
    expect(engine.search('العالمين الرحمن').occurrences).toEqual([]);
  });

  it('maps a token inside a two-token word back to that word', () => {
    expect(engine.search('ايها الناس').occurrences).toEqual([{ ord: 4, from: 1, to: 2 }]);
  });

  it('returns nothing for an unknown word or an empty query', () => {
    expect(engine.search('كتاب').occurrences).toEqual([]);
    expect(engine.search('').occurrences).toEqual([]);
  });

  it('hands back the voweled words of a verse for snippets', () => {
    expect(engine.words(3)).toEqual(['الرَّحْمَٰنِ', 'الرَّحِيمِ']);
    expect(engine.words(99)).toEqual([]);
  });
});

describe('buildSearchEngine on the committed index', () => {
  let engine;
  beforeAll(async () => {
    engine = await buildSearchEngine(JSON.parse(readFileSync(INDEX_PATH, 'utf8')));
  });

  it('holds every verse of the Quran', () => {
    expect(engine.size.verses).toBe(6236);
  });

  it('finds Ayat al-Kursi by its opening, typed bare', () => {
    // 2:255 is global ayah 262.
    expect(engine.search('الله لا اله الا هو الحي القيوم').occurrences).toContainEqual(
      expect.objectContaining({ ord: 262, from: 1 }),
    );
  });

  it('finds Uthmani spellings from a plain-spelling query', () => {
    const hits = engine.search('واقيموا الصلاة').occurrences;
    expect(hits.length).toBeGreaterThan(5);
    expect(hits.every((h) => h.from >= 1 && h.to >= h.from)).toBe(true);
  });
});
