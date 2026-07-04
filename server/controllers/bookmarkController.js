const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');

// A generous ceiling so the list stays manageable (and can't be abused).
const MAX_BOOKMARKS = 100;

// GET /api/bookmarks — the signed-in user's bookmarks, ordered by page number.
const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id }).sort({ pageNumber: 1 });
    res.status(200).json({ success: true, data: bookmarks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching bookmarks', error: error.message });
  }
};

// POST /api/bookmarks { pageNumber, label? } — add a bookmark for a page.
const addBookmark = async (req, res) => {
  try {
    const pageNumber = Number(req.body.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({ success: false, message: 'pageNumber must be an integer between 1 and 604' });
    }

    const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
    if (label.length > 50) {
      return res.status(400).json({ success: false, message: 'Label cannot exceed 50 characters' });
    }

    // One bookmark per page per user.
    const dupPage = await Bookmark.findOne({ userId: req.user._id, pageNumber });
    if (dupPage) {
      return res.status(409).json({ success: false, message: `Page ${pageNumber} is already bookmarked` });
    }

    // Non-empty labels are unique per user, case-insensitively (empty labels
    // display as "Page N", already unique via the page rule above).
    if (label) {
      const dupLabel = await Bookmark.findOne({ userId: req.user._id, label })
        .collation({ locale: 'en', strength: 2 });
      if (dupLabel) {
        return res.status(409).json({ success: false, message: 'You already have a bookmark with this name' });
      }
    }

    const count = await Bookmark.countDocuments({ userId: req.user._id });
    if (count >= MAX_BOOKMARKS) {
      return res.status(400).json({
        success: false,
        message: `You've reached the ${MAX_BOOKMARKS}-bookmark limit. Remove one to add another.`,
      });
    }

    const bookmark = await Bookmark.create({ userId: req.user._id, pageNumber, label });
    res.status(201).json({ success: true, data: bookmark });
  } catch (error) {
    // Race-safety net: the unique { userId, pageNumber } index catches a
    // concurrent duplicate the pre-check above missed.
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This page is already bookmarked' });
    }
    res.status(500).json({ success: false, message: 'Error adding bookmark', error: error.message });
  }
};

// DELETE /api/bookmarks/:id — remove one of the user's own bookmarks.
const deleteBookmark = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }
    // Scope the lookup to the owner so one user can never delete another's.
    const bookmark = await Bookmark.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!bookmark) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }
    res.status(200).json({ success: true, message: 'Bookmark removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing bookmark', error: error.message });
  }
};

module.exports = { getBookmarks, addBookmark, deleteBookmark };
