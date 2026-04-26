const express = require('express');
const router = express.Router();
const {
  completeOnboarding,
  updateMemorized,
  resetProgress,
  getTodayTasks,
  markPageComplete,
  unmarkPageComplete,
  getAllProgress,
  getJuzProgress,
  getEstimate,
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

// All routes are protected (require login)
router.use(protect);

// Onboarding
router.post('/onboarding', completeOnboarding);

// Edit memorized pages (Settings)
router.put('/memorized', updateMemorized);

// Reset all progress
router.delete('/reset', resetProgress);

// Daily tasks
router.get('/today', getTodayTasks);

// Mark complete
router.post('/complete', markPageComplete);

// Undo completion
router.post('/uncomplete', unmarkPageComplete);

// Get all progress
router.get('/all', getAllProgress);

// Get Juz progress (for onboarding selection)
router.get('/juz', getJuzProgress);

// Estimated completion time (accepts ?dailyPages=X)
router.get('/estimate', getEstimate);

module.exports = router;