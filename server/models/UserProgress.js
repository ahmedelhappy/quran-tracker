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
    default: 0
  }
}, {
  timestamps: true
});

// Compound index: each user can only have one record per page
userProgressSchema.index({ userId: 1, pageNumber: 1 }, { unique: true });

// Index for efficient queries
userProgressSchema.index({ userId: 1, status: 1 });
userProgressSchema.index({ userId: 1, lastReviewedDate: 1 });

module.exports = mongoose.model('UserProgress', userProgressSchema);