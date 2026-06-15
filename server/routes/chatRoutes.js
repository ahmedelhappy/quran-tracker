const express = require('express');
const router = express.Router();
const { sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/chatRateLimit');

// `protect` runs first so the limiter can key on the authenticated user.
router.post('/', protect, chatLimiter, sendMessage);

module.exports = router;
