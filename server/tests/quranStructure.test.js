// Validates the committed per-page mushaf structure (seed/data/quranStructure.json)
// that replaced the old surah-guessing heuristic. Pure data assertions — no network,
// no database. Guards the exact surah boundaries the heuristic used to get wrong.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const structure = require('../seed/data/quranStructure.json');

const byPage = Object.fromEntries(structure.map((p) => [p.pageNumber, p]));
const surahNamesOn = (page) => page.surahs.map((s) => s.name);

// A verse key "s:a" is immediately followed by "s:a+1" (same surah) or "s+1:1"
// (start of the next surah). This is the notion of "contiguous" we assert on.
const parseKey = (k) => k.split(':').map(Number);
const isImmediatelyAfter = (prev, next) => {
  const [ps, pa] = parseKey(prev);
  const [ns, na] = parseKey(next);
  return (ns === ps && na === pa + 1) || (ns === ps + 1 && na === 1);
};

describe('Quran page structure data', () => {
  test('covers all 604 pages, numbered 1..604 in order', () => {
    assert.equal(structure.length, 604);
    structure.forEach((p, i) => assert.equal(p.pageNumber, i + 1));
  });

  test('page 1 is Al-Fatiha only', () => {
    assert.deepEqual(surahNamesOn(byPage[1]), ['Al-Fatiha']);
  });

  test('page 50 lists ONLY Aal-Imran (Al-Baqarah ends on page 49)', () => {
    assert.deepEqual(surahNamesOn(byPage[50]), ['Aal-Imran']);
  });

  test('page 49 ends within Al-Baqarah', () => {
    const p49 = byPage[49];
    assert.deepEqual(surahNamesOn(p49), ['Al-Baqarah']);
    assert.equal(p49.lastVerseKey.split(':')[0], '2');
    // Al-Baqarah's final verse is 2:286 — page 49 is its last page.
    assert.equal(p49.lastVerseKey, '2:286');
  });

  test('page 604 lists Al-Ikhlas, Al-Falaq, An-Nas in order', () => {
    assert.deepEqual(surahNamesOn(byPage[604]), ['Al-Ikhlas', 'Al-Falaq', 'An-Nas']);
  });

  test('every page has non-empty verseKeys with matching first/last keys', () => {
    for (const p of structure) {
      assert.ok(p.verseKeys.length > 0, `page ${p.pageNumber} has no verseKeys`);
      assert.equal(p.firstVerseKey, p.verseKeys[0], `page ${p.pageNumber} firstVerseKey`);
      assert.equal(p.lastVerseKey, p.verseKeys[p.verseKeys.length - 1], `page ${p.pageNumber} lastVerseKey`);
    }
  });

  test("each page's verseKeys are internally contiguous", () => {
    for (const p of structure) {
      for (let i = 0; i < p.verseKeys.length - 1; i++) {
        assert.ok(
          isImmediatelyAfter(p.verseKeys[i], p.verseKeys[i + 1]),
          `page ${p.pageNumber}: ${p.verseKeys[i]} -> ${p.verseKeys[i + 1]} not contiguous`,
        );
      }
    }
  });

  test("each page's last verse is contiguous with the next page's first verse", () => {
    for (let i = 0; i < structure.length - 1; i++) {
      const prev = structure[i].lastVerseKey;
      const next = structure[i + 1].firstVerseKey;
      assert.ok(
        isImmediatelyAfter(prev, next),
        `page ${structure[i].pageNumber} -> ${structure[i + 1].pageNumber}: ${prev} -> ${next} not contiguous`,
      );
    }
  });
});
