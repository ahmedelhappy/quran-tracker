const mongoose = require('mongoose');

// The page's state just before its latest dashboard completion, so undoing that
// completion puts back exactly what was there (L-11) instead of guessing: an
// undone review used to set lastReviewedDate to "yesterday" whatever it had
// been, and an undone 'new' deleted the whole document — taking with it the
// half of a page memorized on an earlier day. One slot: undo reverses the most
// recent completion, of the matching kind, made today.
const undoSnapshotSchema = new mongoose.Schema({
  kind: { type: String, enum: ['new', 'review'], required: true },
  at: { type: Date, required: true },
  // False when the completion created the document (undo then deletes it).
  existed: { type: Boolean, default: false },
  status: String,
  memorizedDate: Date,
  lastReviewedDate: Date,
  reviewCount: Number,
  segments: { type: [{ from: String, to: String, _id: false }], default: undefined },
}, { _id: false });

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
    max: 604,
    // min/max alone let 1.5 through. The controllers validate before every
    // write (utils/pageNumbers.js); this is the backstop for document saves.
    validate: { validator: Number.isInteger, message: 'pageNumber must be an integer' },
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
  // Internal: only the undo endpoint reads it (select: false keeps it out of
  // every other query and response).
  undo: { type: undoSnapshotSchema, default: undefined, select: false },
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