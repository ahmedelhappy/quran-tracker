const express = require('express');
const router = express.Router();
const {
  register, login, getMe, updateProfile, changePassword, deleteAccount,
  authConfig, requireResetEnabled, forgotPassword, resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter, passwordResetLimiters } = require('../middleware/rateLimiters');
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
  leaderboardOptIn: 'boolean',
  displayName: { type: 'string', nullable: true },
};
const passwordSchema = { currentPassword: 'string', newPassword: 'string' };
const forgotPasswordSchema = { email: 'string' };
const resetPasswordSchema = { token: 'string', password: 'string' };

// Public routes (anyone can access) — strictly rate-limited against brute force
router.post('/register', authLimiter, validateBody(registerSchema), register);
router.post('/login', authLimiter, validateBody(loginSchema), login);
router.get('/config', authConfig);

// Password reset (H-06): 404 RESET_DISABLED until it is configured on. The
// per-address limit runs after the type gate, so it only ever keys on a string.
router.post('/forgot-password', requireResetEnabled, passwordResetLimiters.forgotIp,
  validateBody(forgotPasswordSchema), passwordResetLimiters.forgotEmail, forgotPassword);
router.post('/reset-password', requireResetEnabled, passwordResetLimiters.reset,
  validateBody(resetPasswordSchema), resetPassword);

// Protected routes (must be logged in)
router.get('/me', protect, getMe);
router.put('/profile', protect, validateBody(profileSchema), updateProfile);
router.put('/password', protect, validateBody(passwordSchema), changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;
