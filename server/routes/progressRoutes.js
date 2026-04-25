const express = require('express');
const router = express.Router();
const {
  completeOnboarding,
  getTodayTasks,
  markPageComplete,
  getAllProgress,
  getJuzProgress,
  getEstimate,
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// All routes are protected (require login)
router.use(protect);

// Onboarding
router.post('/onboarding', completeOnboarding);

// Daily tasks
router.get('/today', getTodayTasks);

// Mark complete
router.post('/complete', markPageComplete);

// Get all progress
router.get('/all', getAllProgress);

// Get Juz progress (for onboarding selection)
router.get('/juz', getJuzProgress);

// Estimated completion time (accepts ?dailyPages=X)
router.get('/estimate', getEstimate);

module.exports = router;