const jwt = require('jsonwebtoken');
const User = require('../models/User');

// What jwt.verify throws for a bad, expired or not-yet-valid token.
const JWT_ERRORS = new Set(['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']);

const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'NOT_AUTHORIZED',
      message: 'Not authorized, no token provided'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token and attach to request
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'NOT_AUTHORIZED',
        message: 'User not found'
      });
    }

    // Reject tokens minted before the user last changed (or reset) their
    // password, so either one ends every session issued beforehand. Tokens
    // carry their issue time to the millisecond (`iatMs`), compared exactly: a
    // session opened a moment before the change is refused, and the one handed
    // out right after it is not. Tokens from before `iatMs` existed only have
    // the whole-second `iat`; for them the change's own second is given the
    // benefit of the doubt, as before, until they expire (30 days).
    if (req.user.passwordChangedAt) {
      const changedAtMs = req.user.passwordChangedAt.getTime();
      const stale = Number.isFinite(decoded.iatMs)
        ? decoded.iatMs < changedAtMs
        : decoded.iat < Math.floor(changedAtMs / 1000);
      if (stale) {
        return res.status(401).json({
          success: false,
          code: 'SESSION_EXPIRED',
          message: 'Session expired, please log in again'
        });
      }
    }

    next();

  } catch (error) {
    // Only a token that fails verification is the caller's problem. Anything
    // else — the database unreachable, a query timing out — says nothing about
    // the token, and answering 401 for it made every client drop its session
    // during an outage (the client keeps the session on anything but a 401, M-03).
    if (JWT_ERRORS.has(error.name)) {
      return res.status(401).json({
        success: false,
        code: 'NOT_AUTHORIZED',
        message: 'Not authorized, token invalid'
      });
    }
    console.error('Auth middleware error (session not checked):', req.method, req.originalUrl, error);
    return res.status(503).json({
      success: false,
      code: 'AUTH_UNAVAILABLE',
      message: 'Could not check your session right now, please try again'
    });
  }
};

module.exports = { protect };