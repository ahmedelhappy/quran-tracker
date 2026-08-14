const mongoose = require('mongoose');

const userProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  pageNumber: {
    type: Number,
    required: true,
    min: 1,
    max: 604
  },
  status: {
    type: String,
    enum: ['not_started', 'memorized'],
    default: 'not_started'
  },
  memorizedDate: {
    type: Date,
    default: null
  },
  lastReviewedDate: {
    type: Date,
    default: null
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Sub-page memorization. Absent/empty ⇒ the whole page is memorized (every
  // pre-Stage-5 document is still valid with no migration). Present ⇒ only these
  // verse ranges of the page are memorized; server/utils/segments.js computes the
  // memorized fraction and merges/subtracts ranges when units are added/removed.
  segments: {
    type: [{
      from: { type: String, required: true }, // verse key, e.g. "2:187"
      to: { type: String, required: true },
      _id: false,
    }],
    default: undefined,
  },
}, {
  timestamps: true
});

// Compound index: each user can only have one record per page
userProgressSchema.index({ userId: 1, pageNumber: 1 }, { unique: true });

// Index for efficient queries
userProgressSchema.index({ userId: 1, status: 1 });
userProgressSchema.index({ userId: 1, lastReviewedDate: 1 });
// The leaderboard's weekly board filters memorized rows by memorizedDate across
// many users at once, so index it independently of userId.
userProgressSchema.index({ memorizedDate: 1 });

module.exports = mongoose.model('UserProgress', userProgressSchema);