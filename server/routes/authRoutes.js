const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiters');
const { validateBody } = require('../middleware/validate');

// Type gates for each body — reject objects/arrays where scalars are expected
// (closes NoSQL-operator injection, e.g. email: { $gt: "" }). Range/enum checks
// stay in the controller.
const registerSchema = { name: 'string', email: 'string', password: 'string' };
const loginSchema = { email: 'string', password: 'string' };
const profileSchema = {
  name: 'string',
  dailyNewPages: 'number',
  reviewIntensity: 'string',
  offDays: 'numberArray',
  language: 'string',
  recentReviewCount: { type: 'number', nullable: true },
  cycleReviewCount: { type: 'number', nullable: true },
  pauseNewMemorization: 'boolean',
  pausedFromOnboarding: 'boolean',
  cycleReviewStartPage: { type: 'number', nullable: true },
  memorizationDirection: 'string',
  newMemorizationStartPage: { type: 'number', nullable: true },
};
const passwordSchema = { currentPassword: 'string', newPassword: 'string' };

// Public routes (anyone can access) — strictly rate-limited against brute force
router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);

// Protected routes (must be logged in)
router.get('/me', protect, getMe);
router.put('/profile', protect, validateBody(profileSchema), updateProfile);
router.put('/password', protect, validateBody(passwordSchema), changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
