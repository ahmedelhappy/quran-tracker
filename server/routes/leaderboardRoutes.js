const express = require('express');
const router = express.Router();
const { getLeaderboard } = require('../controllers/leaderboardController');
const { protect } = require('../middleware/auth');
const { validateQuery } = require('../middleware/validate');

// All routes are protected (require login)
router.use(protect);

// The board itself (period defaults to all-time in the controller).
router.get('/', validateQuery({ period: 'string' }), getLeaderboard);

module.exports = router;
