const mongoose = require('mongoose');
const Bookmark = require('../models/Bookmark');
const { serverError } = require('../utils/errorResponse');

// A generous ceiling so the list stays manageable (and can't be abused).
const MAX_BOOKMARKS = 100;

// GET /api/bookmarks — the signed-in user's bookmarks, ordered by page number.
const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id }).sort({ pageNumber: 1 });
    res.status(200).json({ success: true, data: bookmarks });
  } catch (error) {
    console.error('GetBookmarks error:', error);
    serverError(res, 'Error fetching bookmarks', error);
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
    console.error('AddBookmark error:', error);
    serverError(res, 'Error adding bookmark', error);
  }
};

// PUT /api/bookmarks/:id { label?, pageNumber?, replace? } — rename and/or move
// one of the user's own bookmarks. Everything is validated before anything is
// written, so a request that carries both fields applies both or neither.
// Moving onto a page another bookmark holds is a 409 that names that bookmark;
// with replace: true the other one is removed and this one moved in the same
// request, so the client never has to race two calls.
const updateBookmark = async (req, res) => {
  try {
    // Unknown and foreign ids look the same (404), so ids can't be probed.
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }
    const bookmark = await Bookmark.findOne({ _id: req.params.id, userId: req.user._id });
    if (!bookmark) {
      return res.status(404).json({ success: false, message: 'Bookmark not found' });
    }

    const updates = {};

    let pageNumber = bookmark.pageNumber;
    if (req.body.pageNumber !== undefined) {
      pageNumber = Number(req.body.pageNumber);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 604) {
        return res.status(400).json({ success: false, message: 'pageNumber must be an integer between 1 and 604' });
      }
      if (pageNumber !== bookmark.pageNumber) updates.pageNumber = pageNumber;
    }

    let label = bookmark.label;
    if (req.body.label !== undefined) {
      label = req.body.label.trim();
      if (label.length > 50) {
        return res.status(400).json({ success: false, message: 'Label cannot exceed 50 characters' });
      }
      if (label !== bookmark.label) updates.label = label;
    }

    // The bookmark already sitting on the destination page, if any.
    let occupant = null;
    if (updates.pageNumber !== undefined) {
      occupant = await Bookmark.findOne({ userId: req.user._id, pageNumber, _id: { $ne: bookmark._id } });
      if (occupant && req.body.replace !== true && req.body.replace !== 'true') {
        return res.status(409).json({
          success: false,
          message: `Page ${pageNumber} is already bookmarked`,
          conflict: { _id: occupant._id, pageNumber: occupant.pageNumber, label: occupant.label },
        });
      }
    }

    // Label uniqueness, excluding this bookmark (renaming to its own label in
    // another case is fine) and the occupant about to be replaced.
    if (updates.label) {
      const exclude = [bookmark._id, ...(occupant ? [occupant._id] : [])];
      const dupLabel = await Bookmark.findOne({ userId: req.user._id, label: updates.label, _id: { $nin: exclude } })
        .collation({ locale: 'en', strength: 2 });
      if (dupLabel) {
        return res.status(409).json({ success: false, message: 'You already have a bookmark with this name' });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ success: true, data: bookmark });
    }

    // Free the page first so the unique { userId, pageNumber } index holds
    // throughout. If the move then fails, put the removed bookmark back.
    if (occupant) await Bookmark.deleteOne({ _id: occupant._id });
    let updated;
    try {
      updated = await Bookmark.findOneAndUpdate(
        { _id: bookmark._id, userId: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      );
    } catch (error) {
      if (occupant) await Bookmark.collection.insertOne(occupant.toObject()).catch(() => {});
      throw error;
    }

    res.status(200).json({
      success: true,
      data: updated,
      ...(occupant ? { replaced: { _id: occupant._id, pageNumber: occupant.pageNumber, label: occupant.label } } : {}),
    });
  } catch (error) {
    // A concurrent add/move took the page between the check and the write.
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'This page is already bookmarked' });
    }
    console.error('UpdateBookmark error:', error);
    serverError(res, 'Error updating bookmark', error);
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
    console.error('DeleteBookmark error:', error);
    serverError(res, 'Error removing bookmark', error);
  }
};

module.exports = { getBookmarks, addBookmark, updateBookmark, deleteBookmark };
