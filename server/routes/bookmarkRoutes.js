const express = require('express');
const router = express.Router();
const {
  getBookmarks,
  addBookmark,
  deleteBookmark,
} = require('../controllers/bookmarkController');
const { protect } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

// All routes are protected (require login)
router.use(protect);

// Type gate — pageNumber must be a scalar number and label a string; the
// controller still enforces the 1–604 range and label length.
const bookmarkSchema = { pageNumber: 'number', label: 'string' };

// List the user's bookmarks
router.get('/', getBookmarks);

// Add a bookmark
router.post('/', validateBody(bookmarkSchema), addBookmark);

// Remove a bookmark (ownership-checked; :id validated in the controller)
router.delete('/:id', deleteBookmark);

module.exports = router;
