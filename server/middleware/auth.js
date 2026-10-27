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
        message: 'User not found'
      });
    }

    // Reject tokens minted before the user last changed their password, so a
    // password change invalidates every session issued beforehand. `iat` is in
    // seconds; passwordChangedAt is already back-dated a second when set.
    if (req.user.passwordChangedAt) {
      const changedAtSec = Math.floor(req.user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedAtSec) {
        return res.status(401).json({
          success: false,
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