const mongoose = require('mongoose');
const QuranMetadata = require('../models/QuranMetadata');
const quranStructure = require('./data/quranStructure.json');
const { parseTargetArgs } = require('../scripts/lib/target');

// Build the 604 QuranMetadata documents straight from the committed structure
// file (seed/data/quranStructure.json), which is generated once from the
// quran.com API by seed/fetchQuranStructure.js. No guessing, no runtime API calls.
//
// Throws unless it built exactly 604 pages, so every caller — this seed, the
// end-to-end API, tests — fails on a truncated or damaged structure file
// instead of loading part of the mushaf and failing later as missing pages.
function buildQuranPages(structure = quranStructure) {
  if (!Array.isArray(structure)) throw new Error('The Quran structure file is not a list of pages');
  const pages = structure.map((page) => ({
    pageNumber: page.pageNumber,
    juzNumber: page.juzNumber,
    hizbNumber: page.hizbNumber,
    surahName: page.surahs[0]?.name ?? 'Unknown',
    surahNameArabic: page.surahs[0]?.nameArabic ?? '',
    surahs: page.surahs.map((s) => ({ number: s.number, name: s.name, nameArabic: s.nameArabic })),
    firstVerseKey: page.firstVerseKey,
    lastVerseKey: page.lastVerseKey,
    verseKeys: page.verseKeys,
    rubBoundaries: page.rubBoundaries,
  }));
  if (pages.length !== 604) throw new Error(`Expected 604 pages, built ${pages.length}`);
  return pages;
}

// Seed — always replaces existing data. The target must be named on the command
// line (see scripts/lib/target.js): this deletes the whole collection, and the
// MONGODB_URI in a local .env points at production (L-13).
//
//   node seed/quranData.js --uri <mongodb-uri>
async function seedQuranData(uri, log = console.log) {
  // Build (and sanity-check) the pages before touching the database, so a bad
  // structure file can never leave the collection empty.
  const pages = buildQuranPages();

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    log('Connected to MongoDB');

    await QuranMetadata.deleteMany({});
    log('Cleared existing QuranMetadata');

    await QuranMetadata.insertMany(pages);

    const multiSurahCount = pages.filter(p => p.surahs.length > 1).length;
    log(`Seeded ${pages.length} pages, ${multiSurahCount} have multiple surahs`);
  } finally {
    await mongoose.disconnect();
  }
}

const USAGE = 'Usage: node seed/quranData.js --uri <mongodb-uri>';

async function main(argv, log = console.log) {
  const args = parseTargetArgs(argv);
  if (args.help) { log(USAGE); return 0; }
  if (args.error) { log(args.error); log(USAGE); return 1; }
  log(`Target: ${args.masked}`);
  await seedQuranData(args.uri, log);
  return 0;
}

// Run only when invoked directly, so tests (and the test helpers) can import
// buildQuranPages without seeding anything.
if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => { console.error('Seed error:', error); process.exit(1); });
}

module.exports = { buildQuranPages, seedQuranData, main };
