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
  getWeekPlan,
  updateUnits,
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');
const { validateBody, validateQuery } = require('../middleware/validate');

// All routes are protected (require login)
router.use(protect);

// Type gates — reject objects/arrays where scalars/number-arrays are expected,
// so a Mongo-operator payload can never reach a query. Value ranges are checked
// in the controller.
const onboardingSchema = { memorizedPages: 'numberArray', dailyNewPages: 'number' };
const memorizedSchema = { memorizedPages: 'numberArray' };
const completeSchema = { pageNumber: 'number', type: 'string', alreadyKnow: 'boolean' };
const uncompleteSchema = { pageNumber: 'number', type: 'string' };
// `ref` varies in shape by unit (a number for juz/hizb/rub/surah/page, an
// { from, to } object for verses) so it isn't type-gated here — updateUnits
// validates it itself once it knows which unit it's compiling.
const unitsSchema = { action: 'string', unit: 'string' };

// Onboarding
router.post('/onboarding', validateBody(onboardingSchema), completeOnboarding);

// Edit memorized pages (Settings)
router.put('/memorized', validateBody(memorizedSchema), updateMemorized);

// Add/remove memorization by unit (Juz, Hizb, ¼-Hizb, Surah, page, verse range)
router.put('/units', validateBody(unitsSchema), updateUnits);

// Reset all progress
router.delete('/reset', resetProgress);

// Daily tasks
router.get('/today', validateQuery({ ignoreOffDay: 'boolean' }), getTodayTasks);

// Mark complete
router.post('/complete', validateBody(completeSchema), markPageComplete);

// Undo completion
router.post('/uncomplete', validateBody(uncompleteSchema), unmarkPageComplete);

// Get all progress
router.get('/all', getAllProgress);

// Get Juz progress (for onboarding selection)
router.get('/juz', getJuzProgress);

// Estimated completion time (accepts ?dailyPages=X)
router.get('/estimate', validateQuery({ dailyPages: 'number' }), getEstimate);

// Week plan preview (next 6 days)
router.get('/week', getWeekPlan);

module.exports = router;
