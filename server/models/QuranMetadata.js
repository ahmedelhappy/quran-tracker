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
  surahName: {
    type: String,
    required: true
  },
  surahNameArabic: {
    type: String,
    default: ''
  },
  surahs: [{
    name: { type: String, required: true },
    nameArabic: { type: String, default: '' },
    _id: false,
  }]
});

// Index for fast lookups
quranMetadataSchema.index({ pageNumber: 1 });
quranMetadataSchema.index({ juzNumber: 1 });

module.exports = mongoose.model('QuranMetadata', quranMetadataSchema);