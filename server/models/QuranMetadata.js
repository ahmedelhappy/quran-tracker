const mongoose = require('mongoose');

const quranMetadataSchema = new mongoose.Schema({
  pageNumber: {
    type: Number,
    required: true,
    unique: true,
    min: 1,
    max: 604
  },
  juzNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 30
  },
  hizbNumber: {
    type: Number,
    min: 1,
    max: 60
  },
  surahName: {
    type: String,
    required: true
  },
  surahNameArabic: {
    type: String,
    default: ''
  },
  surahs: [{
    number: { type: Number },
    name: { type: String, required: true },
    nameArabic: { type: String, default: '' },
    _id: false,
  }],
  // Exact per-page verse span from the printed Madinah mushaf (quran.com data).
  firstVerseKey: { type: String },   // e.g. "2:187"
  lastVerseKey: { type: String },    // e.g. "2:196"
  verseKeys: { type: [String], default: [] },   // ordered "surah:ayah" keys on the page
  rubBoundaries: { type: [String], default: [] } // verse keys where a new rub el-hizb begins
});

// pageNumber is already indexed by `unique: true` above; index juzNumber for the
// per-Juz lookups.
quranMetadataSchema.index({ juzNumber: 1 });

module.exports = mongoose.model('QuranMetadata', quranMetadataSchema);
