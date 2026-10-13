const mongoose = require('mongoose');

// A saved page bookmark. Users can keep several (optionally labelled) so they can
// jump back to spots in the mushaf. Distinct from UserProgress — bookmarks are
// personal navigation shortcuts, not memorization state.
const bookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pageNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 604,
    },
    label: {
      type: String,
      trim: true,
      maxlength: [50, 'Label cannot exceed 50 characters'],
      default: '',
    },
  },
  { timestamps: true }
);

// A page may hold several bookmarks as long as their names differ. Non-empty
// labels are unique per user (case-insensitive, checked in the controller); an
// unnamed bookmark displays as "Page N", so a page holds at most ONE of those —
// enforced here by a partial unique index, which also catches races.
bookmarkSchema.index({ userId: 1, pageNumber: 1 });
bookmarkSchema.index(
  { userId: 1, pageNumber: 1, label: 1 },
  { unique: true, partialFilterExpression: { label: { $eq: '' } }, name: 'one_unnamed_per_page' }
);

module.exports = mongoose.model('Bookmark', bookmarkSchema);
