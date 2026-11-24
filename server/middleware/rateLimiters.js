const { rateLimit } = require('express-rate-limit');
const { EMAIL_MAX_LENGTH, normalizeEmail } = require('../models/User');

// Rate limiting is a no-op under test: the integration suite fires many requests
// from a single IP in quick succession and must not be throttled. In every other
// environment the limiters below protect the public auth endpoints and the API
// surface as a whole. Follows the same shape/style as chatRateLimit.js.
const isTest = process.env.NODE_ENV === 'test';
const passThrough = (req, res, next) => next();

// Shared 429 handler factory — mirrors chatLimiter's JSON error shape.
const tooMany = (message) => (req, res) => {
  res.status(429).json({ success: false, code: 'RATE_LIMITED', message });
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

// Password reset (H-06). Built by a function so the tests can make real ones —
// everything above is a pass-through under test — and check the limits hold.
//
//   forgotIp     5 requests / 15 min per IP: one person mistyping an address a
//                few times, not a script mailing a list of addresses.
//   forgotEmail  3 requests / hour per ADDRESS, from any IP: caps how many
//                emails one inbox can be sent, so the endpoint cannot be used to
//                flood someone. Every address counts the same whether or not it
//                has an account, and the 429 is identical, so the limit says
//                nothing about which addresses are registered.
//   reset        10 attempts / 15 min per IP. A token is 256 bits, so this is
//                not what stops guessing; it keeps a script from spending the
//                server's bcrypt time on made-up tokens.
//
// Counted in this process's memory, like the login throttle: reset by a
// restart, and per instance if the API is ever scaled out.
const buildPasswordResetLimiters = () => {
  const limiter = (windowMs, limit, extra = {}) => rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooMany('Too many password reset requests. Please wait a while and try again.'),
    ...extra,
  });
  return {
    forgotIp: limiter(15 * 60 * 1000, 5),
    forgotEmail: limiter(60 * 60 * 1000, 3, {
      // The address as the controller will read it (trimmed, lower-cased), so
      // "A@x.com " and "a@x.com" share one budget. A missing or absurdly long
      // address is not counted here: the controller refuses it with a 400.
      keyGenerator: (req) => `email:${normalizeEmail(req.body?.email)}`,
      skip: (req) => {
        const email = normalizeEmail(req.body?.email);
        return !email || email.length > EMAIL_MAX_LENGTH;
      },
    }),
    reset: limiter(15 * 60 * 1000, 10),
  };
};

const passwordResetLimiters = isTest
  ? { forgotIp: passThrough, forgotEmail: passThrough, reset: passThrough }
  : buildPasswordResetLimiters();

module.exports = { authLimiter, apiLimiter, buildPasswordResetLimiters, passwordResetLimiters };
