const mongoose = require('mongoose');
require('dotenv').config();
const QuranMetadata = require('../models/QuranMetadata');
const quranStructure = require('./data/quranStructure.json');

// Build the 604 QuranMetadata documents straight from the committed structure
// file (seed/data/quranStructure.json), which is generated once from the
// quran.com API by seed/fetchQuranStructure.js. No guessing, no runtime API calls.
function buildQuranPages() {
  return quranStructure.map((page) => ({
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
}

// Seed function — always replaces existing data
async function seedQuranData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await QuranMetadata.deleteMany({});
    console.log('Cleared existing QuranMetadata');

    const pages = buildQuranPages();
    await QuranMetadata.insertMany(pages);

    const multiSurahCount = pages.filter(p => p.surahs.length > 1).length;
    console.log(`Seeded ${pages.length} pages, ${multiSurahCount} have multiple surahs`);

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

// Run the seed
seedQuranData();
