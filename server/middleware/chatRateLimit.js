const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Throttles the AI chat endpoint so a single user can't spam it and run up
// external (Groq) cost. Keyed per authenticated user, falling back to the
// caller's IP for safety. Must be mounted AFTER `protect` so req.user is set.
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 20, // requests per window per user
  standardHeaders: true, // expose RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "You're sending messages too fast. Please wait a moment and try again.",
    });
  },
});

module.exports = { chatLimiter };
