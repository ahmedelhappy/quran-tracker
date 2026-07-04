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

// One bookmark per page per user — also the fast lookup index for a user's list.
bookmarkSchema.index({ userId: 1, pageNumber: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
