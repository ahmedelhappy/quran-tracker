const { rateLimit } = require('express-rate-limit');

// Rate limiting is a no-op under test: the integration suite fires many requests
// from a single IP in quick succession and must not be throttled. In every other
// environment the limiters below protect the public auth endpoints and the API
// surface as a whole. Follows the same shape/style as chatRateLimit.js.
const isTest = process.env.NODE_ENV === 'test';
const passThrough = (req, res, next) => next();

// Shared 429 handler factory — mirrors chatLimiter's JSON error shape.
const tooMany = (message) => (req, res) => {
  res.status(429).json({ success: false, message });
};

// Strict limiter for the unauthenticated auth endpoints (login/register), where
// credential brute-forcing is the risk. Keyed on client IP (the library default,
// which handles IPv6 correctly).
const authLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 10,                // attempts per window per IP
      standardHeaders: true,    // expose RateLimit-* headers
      legacyHeaders: false,
      handler: tooMany('Too many attempts. Please wait 15 minutes and try again.'),
    });

// General safety-net limiter for the whole API, guarding against a single client
// hammering any endpoint. Generous enough that normal use never trips it; the
// stricter authLimiter and chatLimiter stack on top of it per route.
const apiLimiter = isTest
  ? passThrough
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: 300,               // requests per window per IP
      standardHeaders: true,
      legacyHeaders: false,
      handler: tooMany('Too many requests. Please slow down and try again shortly.'),
    });

module.exports = { authLimiter, apiLimiter };
