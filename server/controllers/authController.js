const User = require('../models/User');
const { EMAIL_MAX_LENGTH, EMAIL_PATTERN, normalizeEmail } = User;
const UserProgress = require('../models/UserProgress');
const jwt = require('jsonwebtoken');
const { serverError } = require('../utils/errorResponse');
const leaderboardCache = require('../utils/leaderboardCache');
const { newPasswordProblem } = require('../utils/passwordPolicy');
const { loginThrottle } = require('../utils/loginThrottle');
const { deleteUserData } = require('../utils/userData');
const chatBudget = require('../utils/chatBudget');
const { PAGE_RULE, toPageNumber } = require('../utils/pageNumbers');
const { parsePlanSettings } = require('../utils/planSettings');
const mailer = require('../utils/mailer');
const {
  RESET_TOKEN_PATTERN, RESET_TOKEN_TTL_MS, RESET_TOKEN_TTL_MINUTES,
  hashResetToken, newResetToken, passwordResetConfig, resetLink,
} = require('../utils/passwordReset');

// Generate JWT Token. `iatMs` is when it was issued, to the millisecond: the
// standard `iat` is whole seconds, too coarse to tell a session opened just
// before a password change or reset from one opened just after it (see
// middleware/auth.js).
const generateToken = (id) => {
  return jwt.sign({ id, iatMs: Date.now() }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// The validate middleware already turns 'true' / 'false' into real booleans;
// this keeps the controller right on its own too. Boolean('false') is true.
const toBool = (v) => v === true || v === 'true';

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, password } = req.body;

    // Normalise and vet the address here, before any query or model validation:
    // a length cap first (so no pattern ever runs on a megabyte string), then the
    // same linear pattern the model enforces. The model keeps both rules as the
    // backstop for every other write path.
    const email = normalizeEmail(req.body.email);
    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Please provide a valid email' });
    }

    const passwordProblem = newPasswordProblem(password);
    if (passwordProblem) {
      return res.status(400).json({ success: false, ...passwordProblem });
    }

    // Check if user already exists. A conflict, not a malformed request — and the
    // same 409 the duplicate-key error gives if two sign-ups race past this check.
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_TAKEN',
        message: 'User already exists with this email'
      });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password
    });

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        onboardingComplete: user.onboardingComplete,
        language: user.language,
        token
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    serverError(res, 'Server error during registration', error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    // Validate input. An over-long address cannot belong to any account, so it is
    // refused here rather than carried into a query.
    if (!email || !password || email.length > EMAIL_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        code: 'CREDENTIALS_REQUIRED',
        message: 'Please provide email and password'
      });
    }

    // Too many recent failures for this address: refuse before looking the
    // account up or checking the password, with the same answer whether or not
    // the account exists (see utils/loginThrottle.js).
    const waitMs = loginThrottle.lockedFor(email);
    if (waitMs > 0) {
      res.set('Retry-After', String(Math.ceil(waitMs / 1000)));
      return res.status(429).json({
        success: false,
        code: 'LOGIN_LOCKED',
        message: 'Too many failed sign-in attempts. Please wait a few minutes and try again.',
      });
    }

    // Count this attempt as a failure NOW, in the same tick as the check above,
    // and take it back below if the password turns out right. Recorded after the
    // lookup and bcrypt instead, a burst of concurrent guesses (spread over many
    // IPs) would all pass the check before the first failure landed, and every
    // one of them would be tested. A request that errors part-way stays counted.
    loginThrottle.recordFailure(email);

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    // Check if password matches. An unknown email counts as a failure too, so
    // the lock-out behaves the same for addresses that have no account.
    const isMatch = user ? await user.matchPassword(password) : false;

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    loginThrottle.reset(email);

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        onboardingComplete: user.onboardingComplete,
        dailyNewPages: user.dailyNewPages,
        reviewIntensity: user.reviewIntensity,
        offDays: user.offDays,
        currentStreak: user.currentStreak,
        recentReviewCount: user.recentReviewCount ?? null,
        cycleReviewCount: user.cycleReviewCount ?? null,
        pauseNewMemorization: user.pauseNewMemorization || false,
        pausedFromOnboarding: user.pausedFromOnboarding || false,
        cycleReviewStartPage: user.cycleReviewStartPage ?? null,
        memorizationDirection: user.memorizationDirection || 'fromStart',
        newMemorizationStartPage: user.newMemorizationStartPage ?? null,
        leaderboardOptIn: user.leaderboardOptIn || false,
        displayName: user.displayName ?? null,
        language: user.language,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    serverError(res, 'Server error during login', error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        onboardingComplete: user.onboardingComplete,
        dailyNewPages: user.dailyNewPages,
        reviewIntensity: user.reviewIntensity,
        offDays: user.offDays,
        currentStreak: user.currentStreak,
        recentReviewCount: user.recentReviewCount ?? null,
        cycleReviewCount: user.cycleReviewCount ?? null,
        pauseNewMemorization: user.pauseNewMemorization || false,
        pausedFromOnboarding: user.pausedFromOnboarding || false,
        cycleReviewStartPage: user.cycleReviewStartPage ?? null,
        memorizationDirection: user.memorizationDirection || 'fromStart',
        newMemorizationStartPage: user.newMemorizationStartPage ?? null,
        leaderboardOptIn: user.leaderboardOptIn || false,
        displayName: user.displayName ?? null,
        lastActiveDate: user.lastActiveDate,
        createdAt: user.createdAt,
        language: user.language,
      }
    });

  } catch (error) {
    console.error('GetMe error:', error);
    serverError(res, 'Server error', error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, dailyNewPages } = req.body;

    // Build update object (only include fields that were sent)
    const updateData = {};

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          code: 'NAME_REQUIRED',
          message: 'Name cannot be empty'
        });
      }
      if (name.length > 50) {
        return res.status(400).json({
          success: false,
          code: 'NAME_TOO_LONG',
          message: 'Name cannot exceed 50 characters'
        });
      }
      updateData.name = name.trim();
    }

    if (dailyNewPages !== undefined) {
      const pages = parseFloat(dailyNewPages);
      if (isNaN(pages) || pages < 0.5 || pages > 10) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_DAILY_GOAL',
          message: 'Daily pages must be between 0.5 and 10'
        });
      }
      updateData.dailyNewPages = pages;
    }

    // The plan fields (rest days, review intensity / counts, where new work
    // starts) share their rules with onboarding, which saves them too.
    const plan = parsePlanSettings(req.body);
    if (plan.status) return res.status(plan.status).json({ success: false, code: plan.code, message: plan.message });
    Object.assign(updateData, plan.update);

    const { language } = req.body;

    if (language !== undefined) {
      if (!['en', 'ar'].includes(language)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LANGUAGE',
          message: 'language must be "en" or "ar"'
        });
      }
      updateData.language = language;
    }

    if (req.body.pauseNewMemorization !== undefined) {
      updateData.pauseNewMemorization = toBool(req.body.pauseNewMemorization);
    }

    if (req.body.pausedFromOnboarding !== undefined) {
      updateData.pausedFromOnboarding = toBool(req.body.pausedFromOnboarding);
    }

    if (req.body.cycleReviewStartPage !== undefined) {
      const v = req.body.cycleReviewStartPage;
      if (v === null) {
        updateData.cycleReviewStartPage = null;
      } else {
        // parseInt would store 1.5 as page 1 and "4.5" as page 4 (M-01).
        const n = toPageNumber(v);
        if (n === null) return res.status(400).json({ success: false, code: 'INVALID_PAGE', message: `cycleReviewStartPage ${PAGE_RULE}` });
        updateData.cycleReviewStartPage = n;
      }
    }

    // Leaderboard identity. An empty/null displayName clears it; otherwise it must
    // be 3–30 characters. The public leaderboard shows ONLY this name.
    if (req.body.displayName !== undefined) {
      const dn = req.body.displayName;
      if (dn === null || (typeof dn === 'string' && dn.trim() === '')) {
        updateData.displayName = null;
      } else {
        const trimmed = String(dn).trim();
        if (trimmed.length < 3 || trimmed.length > 30) {
          return res.status(400).json({ success: false, code: 'DISPLAY_NAME_LENGTH', message: 'Display name must be 3 to 30 characters' });
        }
        updateData.displayName = trimmed;
      }
    }

    if (req.body.leaderboardOptIn !== undefined) {
      const optIn = toBool(req.body.leaderboardOptIn);
      // Opting in requires a display name — supplied in this request or already saved.
      if (optIn) {
        const effectiveName = updateData.displayName !== undefined
          ? updateData.displayName
          : (await User.findById(userId).select('displayName'))?.displayName;
        if (!effectiveName) {
          return res.status(400).json({ success: false, code: 'DISPLAY_NAME_REQUIRED', message: 'A display name is required to join the leaderboard' });
        }
      }
      updateData.leaderboardOptIn = optIn;
    }

    // Picking a NEW custom review-cycle start point resets the review recency so
    // the cycle does a clean sweep from that point forward — covering every page
    // in order — instead of skipping pages that happen to have been reviewed
    // recently. Only fires when the start point actually changes to a new page.
    let resetReviewCycle = false;
    if (updateData.cycleReviewStartPage) {
      const current = await User.findById(userId).select('cycleReviewStartPage');
      if (!current || current.cycleReviewStartPage !== updateData.cycleReviewStartPage) {
        resetReviewCycle = true;
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (resetReviewCycle) {
      await UserProgress.updateMany(
        { userId, status: 'memorized' },
        { $set: { lastReviewedDate: null } }
      );
    }

    // Changing leaderboard membership/name invalidates the cached board so the
    // user sees the effect immediately instead of after the 5-minute TTL.
    if (updateData.leaderboardOptIn !== undefined || updateData.displayName !== undefined) {
      leaderboardCache.clear();
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        dailyNewPages: updatedUser.dailyNewPages,
        reviewIntensity: updatedUser.reviewIntensity,
        offDays: updatedUser.offDays,
        recentReviewCount: updatedUser.recentReviewCount ?? null,
        cycleReviewCount: updatedUser.cycleReviewCount ?? null,
        pauseNewMemorization: updatedUser.pauseNewMemorization || false,
        pausedFromOnboarding: updatedUser.pausedFromOnboarding || false,
        cycleReviewStartPage: updatedUser.cycleReviewStartPage ?? null,
        memorizationDirection: updatedUser.memorizationDirection || 'fromStart',
        newMemorizationStartPage: updatedUser.newMemorizationStartPage ?? null,
        leaderboardOptIn: updatedUser.leaderboardOptIn || false,
        displayName: updatedUser.displayName ?? null,
        onboardingComplete: updatedUser.onboardingComplete,
        currentStreak: updatedUser.currentStreak,
        createdAt: updatedUser.createdAt,
        language: updatedUser.language,
      }
    });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    serverError(res, 'Error updating profile', error);
  }
};

// @desc    Change current user password
// @route   PUT /api/auth/password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, code: 'PASSWORD_FIELDS_REQUIRED', message: 'Both current and new password are required' });
    }
    // Only the NEW password meets the current rules; the current one is whatever
    // the account was created with, possibly under the old 6-character minimum.
    const passwordProblem = newPasswordProblem(newPassword);
    if (passwordProblem) {
      return res.status(400).json({ success: false, ...passwordProblem });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, code: 'PASSWORD_UNCHANGED', message: 'New password must be different from current password' });
    }

    const user = await User.findById(userId).select('+password');
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, code: 'WRONG_PASSWORD', message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    // The save stamped passwordChangedAt, which revokes every token minted before
    // it — including the one this request came in with, however recent. Hand back a fresh one so
    // THIS session carries on; every other device still has to sign in again.
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: { token: generateToken(user._id) },
    });
  } catch (error) {
    console.error('ChangePassword error:', error);
    serverError(res, 'Error changing password', error);
  }
};

// @desc    Delete current user account and all associated data
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email } = req.user;

    // Every collection keyed by userId, then the account itself — the UI promises
    // "your account and all associated data" (H-01).
    await deleteUserData(userId);

    // The account may have been on the leaderboard; without this its name and
    // rank keep being served from the cache for up to five minutes.
    leaderboardCache.clear();
    // Forget the small in-memory state still keyed to this account, so nothing
    // about it lingers in the process once the account is gone.
    chatBudget.forget(userId);
    if (email) loginThrottle.reset(email);

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('DeleteAccount error:', error);
    serverError(res, 'Error deleting account', error);
  }
};

// ---------------------------------------------------------------------------
// Password reset (H-06) — built, tested, and OFF until an email provider is
// configured (utils/passwordReset.js decides; requireResetEnabled below guards
// both endpoints).
// ---------------------------------------------------------------------------

// @desc    What the client needs to know before sign-in: today only whether
//          "Forgot password?" should be offered
// @route   GET /api/auth/config
// @access  Public
exports.authConfig = (req, res) => {
  // Cacheable for a few minutes: it changes only with a redeploy.
  res.set('Cache-Control', 'public, max-age=300');
  res.status(200).json({ success: true, data: { passwordReset: passwordResetConfig().enabled } });
};

// Both reset endpoints answer as if they did not exist while reset is off —
// before any limiter counts the request or the body is looked at.
exports.requireResetEnabled = (req, res, next) => {
  if (passwordResetConfig().enabled) return next();
  return res.status(404).json({ success: false, code: 'RESET_DISABLED', message: 'Password reset is not available' });
};

// The one answer to every well-formed request, sent before any email goes out.
const FORGOT_ANSWER = {
  success: true,
  message: 'If an account exists for that address, we have sent it a link to reset the password.',
};

// @desc    Email a password-reset link
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    // A malformed address is refused for what it is — that depends only on the
    // input, so it says nothing about which accounts exist.
    const email = normalizeEmail(req.body.email);
    if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, code: 'INVALID_EMAIL', message: 'Please provide a valid email' });
    }

    // Nothing in the answer may depend on whether the address has an account:
    // not the body, not the status, not the time it takes. So the same work is
    // done either way — a token is made and hashed, and ONE conditional write
    // is sent, which stores the hash on the account if there is one and matches
    // nothing if there is not — and the reply goes out before any email does.
    // A new request overwrites the stored hash, so only the latest link works.
    const { token, hash } = newResetToken();
    const config = passwordResetConfig();
    const user = await User.findOneAndUpdate(
      { email },
      { $set: { passwordResetTokenHash: hash, passwordResetExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS) } },
      { new: true, projection: { email: 1, language: 1 } },
    );

    res.status(200).json(FORGOT_ANSWER);

    // Delivery runs after the reply, so a slow (or failing) transport cannot
    // show up in the response time or status of a real address. A failure is
    // logged without the token, the link or the address — the account id and
    // the transport are enough to follow it up; the person can ask again.
    if (user) {
      setImmediate(() => {
        mailer.sendPasswordReset({
          to: user.email,
          link: resetLink(config.origin, token),
          language: user.language,
          minutes: RESET_TOKEN_TTL_MINUTES,
        }).catch((error) => console.error(
          `Password reset email failed to send (user ${user._id}, transport ${config.transport}):`,
          error?.message ?? error,
        ));
      });
    }
  } catch (error) {
    console.error('ForgotPassword error:', error);
    serverError(res, 'Server error', error);
  }
};

const RESET_TOKEN_INVALID = {
  success: false,
  code: 'RESET_TOKEN_INVALID',
  message: 'This reset link is invalid or has expired. Please ask for a new one.',
};

// @desc    Set a new password with a reset token
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // One answer for a token that is malformed, unknown, used or expired, so
    // the reply never says which. Malformed ones are refused without a query.
    if (typeof token !== 'string' || !RESET_TOKEN_PATTERN.test(token)) {
      return res.status(400).json(RESET_TOKEN_INVALID);
    }
    // The policy first: a password it refuses must not use up the link.
    const passwordProblem = newPasswordProblem(password);
    if (passwordProblem) {
      return res.status(400).json({ success: false, ...passwordProblem });
    }

    // The token is matched by its SHA-256 in an index lookup. No comparison of
    // the secret itself happens in this process, so there is nothing to make
    // constant-time: the database compares hashes, and timing that could at
    // best reveal a prefix of a HASH, which cannot be turned back into a token.
    const hash = hashResetToken(token);
    const pending = () => ({ passwordResetTokenHash: hash, passwordResetExpires: { $gt: new Date() } });

    // A cheap check before bcrypt, so made-up tokens cost one indexed read.
    if (!(await User.exists(pending()))) {
      return res.status(400).json(RESET_TOKEN_INVALID);
    }

    // Consuming the token and setting the password are ONE atomic update,
    // conditional on the token still being there and unexpired. Two requests
    // with the same link can both pass the check above, but only one of them
    // matches here; the other finds the token gone and gets the same refusal.
    // passwordChangedAt revokes every session issued before now, exactly as a
    // password change does.
    const passwordHash = await User.hashPassword(password);
    const user = await User.findOneAndUpdate(
      pending(),
      {
        $set: { password: passwordHash, passwordChangedAt: User.passwordChangedStamp() },
        $unset: { passwordResetTokenHash: 1, passwordResetExpires: 1 },
      },
      { new: true, projection: { email: 1 } },
    );
    if (!user) {
      return res.status(400).json(RESET_TOKEN_INVALID);
    }

    // The person has just shown they read this address's mail, so a sign-in
    // lock on it (perhaps someone else's guessing) is lifted: they can sign in
    // with the new password at once.
    loginThrottle.reset(user.email);

    res.status(200).json({ success: true, message: 'Your password has been reset. Please sign in.' });
  } catch (error) {
    console.error('ResetPassword error:', error);
    serverError(res, 'Server error', error);
  }
};