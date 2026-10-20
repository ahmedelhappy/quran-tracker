const mongoose = require('mongoose');

// One line of a user's personal to-do list ("My to-do" in the UI) — free text
// they tick off. Deliberately unrelated to the daily memorization plan the
// Dashboard calls "tasks": nothing here is scheduled or counted toward progress.
//
// `order` is the item's place in the list. Reordering rewrites every item's
// order to 0..n-1 (PUT /api/todos/reorder sends the whole list), new items take
// max + 1, and deletes just leave a gap — so only the relative order matters.
const todoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: [200, 'A to-do cannot exceed 200 characters'],
    },
    done: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// The list is always read as one user's items in order.
todoSchema.index({ userId: 1, order: 1 });

module.exports = mongoose.model('Todo', todoSchema);
