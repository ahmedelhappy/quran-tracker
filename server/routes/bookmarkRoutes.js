const express = require('express');
const router = express.Router();
const {
  getBookmarks,
  addBookmark,
  deleteBookmark,
} = require('../controllers/bookmarkController');
const { protect } = require('../middleware/auth');

// All routes are protected (require login)
router.use(protect);

// List the user's bookmarks
router.get('/', getBookmarks);

// Add a bookmark
router.post('/', addBookmark);

// Remove a bookmark (ownership-checked)
router.delete('/:id', deleteBookmark);

module.exports = router;
