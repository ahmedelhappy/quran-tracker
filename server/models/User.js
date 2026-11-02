const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const clock = require("../utils/clock");

// RFC 5321 caps a forward path at 254 characters; nothing longer is a real address.
const EMAIL_MAX_LENGTH = 254;
// Deliberately loose (something@label.label) and, above all, LINEAR. The pattern
// this replaced nested an optional separator inside a repeated group, so a
// non-matching string like "aaaa…a!" had exponentially many ways to split — 33
// characters froze the single-process API for ~4.5 s and every 2 more quadrupled
// it. Here a domain label cannot contain a dot, so every character has exactly one
// place it can match and a failure is found in one pass. It also accepts what the
// old one wrongly refused: "+tags" and TLDs longer than three letters (.info).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// Emails are stored trimmed and lower-cased (the setters below), so every
// lookup — and every limit keyed on an address — must compare the same form.
// Non-strings never get that far (the routes' type gates refuse them), but an
// absent field arrives as undefined.
const normalizeEmail = (raw) => (typeof raw === "string" ? raw.trim().toLowerCase() : "");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide your name"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      // Setters run when the value is cast, i.e. before any validator sees it.
      trim: true,
      lowercase: true,
      maxlength: [EMAIL_MAX_LENGTH, "Please provide a valid email"],
      match: [EMAIL_PATTERN, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      // A floor only: the rules for a NEW password (8+ characters, at most 72
      // bytes) live in utils/passwordPolicy.js and run in the controllers. This
      // stays at the old minimum because accounts made under it still exist.
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password in queries by default
    },
    dailyNewPages: {
      type: Number,
      default: 1,
      min: 0.5, 
      max: 10,
    },
    currentStreak: {
      type: Number,
      default: 0,
    },
    lastActiveDate: {
      type: Date,
      default: null,
    },
    // Snapshot of currentStreak/lastActiveDate from just before the first
    // streak-affecting action of the current active day, so an undo that
    // removes the day's only completion can restore the streak exactly —
    // otherwise marking then undoing a page would keep the streak bump,
    // making streaks farmable. Null is a valid restored value for prevActiveDate.
    prevStreak: {
      type: Number,
      default: null,
    },
    prevActiveDate: {
      type: Date,
      default: null,
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
    planStartDate: {
      type: Date,
      default: null,
    },
    reviewIntensity: {
      type: String,
      enum: ['light', 'standard', 'strong'],
      default: 'standard',
    },
    offDays: {
      type: [Number],
      default: [],
      validate: {
        validator: (days) => days.every(d => d >= 0 && d <= 6),
        message: 'offDays values must be between 0 (Sun) and 6 (Sat)',
      },
    },
    pauseNewMemorization: {
      type: Boolean,
      default: false,
    },
    recentReviewCount: {
      type: Number,
      default: null,
      min: 0,
      max: 20,
    },
    cycleReviewCount: {
      type: Number,
      default: null,
      min: 0,
      max: 40,
    },
    language: { type: String, enum: ['en', 'ar'], default: 'en' },
    pausedFromOnboarding: { type: Boolean, default: false },
    cycleReviewStartPage: { type: Number, default: null, min: 1, max: 604 },
    memorizationDirection: {
      type: String,
      enum: ['fromStart', 'fromEnd'],
      default: 'fromStart',
    },
    newMemorizationStartPage: { type: Number, default: null, min: 1, max: 604 },
    // When the password was last changed. Tokens minted before this instant are
    // rejected by the auth middleware, so a password change ends every prior
    // session. Null for accounts that have never changed their password.
    passwordChangedAt: { type: Date, default: null },
    // A pending password reset (H-06): the SHA-256 of the emailed token — never
    // the token itself — and when it stops working. Both absent when no reset
    // is pending; a new request overwrites them, so only the latest link works.
    // Never selected by default, so no query that returns a user can leak them.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    // Leaderboard (opt-in). displayName is the ONLY identity shown publicly on the
    // leaderboard — never the email or real name. Opting in requires a displayName
    // (enforced in updateProfile); the 3-char minimum is a controller check.
    leaderboardOptIn: { type: Boolean, default: false },
    displayName: {
      type: String,
      trim: true,
      maxlength: [30, "Display name cannot exceed 30 characters"],
      default: null,
    },
  },
  {
    // createdAt is the plan's start when planStartDate is unset, so it comes
    // from the clock the scheduler reads (utils/clock), pinnable in tests.
    timestamps: { currentTime: () => clock.now() },
  },
);

// The leaderboard reads every opted-in user; without an index that is a scan of
// the whole users collection (M-22). Partial, so it only holds the opted-in few.
userSchema.index({ leaderboardOptIn: 1 }, { partialFilterExpression: { leaderboardOptIn: true } });
// A reset looks its account up by the token's hash. Sparse, so it holds only
// the few accounts with a reset pending. Not a TTL index: that would delete the
// whole USER once the expiry passed; an expired hash is simply refused (the
// lookup requires an unexpired one) and overwritten by the next request.
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

// One bcrypt cost for every way a password is stored: the save hook below, and
// a reset, which writes the hash in one atomic update instead of a save.
const BCRYPT_ROUNDS = 10;
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
// The passwordChangedAt to record for a change happening now. Exact: tokens
// carry a millisecond issue time, and the one a password change hands back is
// signed after this stamp, so it is never older than it. (It used to be
// back-dated a second, which let every session opened in the ~2 s before a
// change or reset survive it.)
userSchema.statics.passwordChangedStamp = () => new Date();

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  this.password = await this.constructor.hashPassword(this.password);

  // Record when the password changed (used to invalidate older tokens). Skip
  // brand-new accounts — their first token is issued moments later. A reset
  // link still pending dies with the old password too: it was asked for to
  // replace a password that has now been replaced.
  if (!this.isNew) {
    this.passwordChangedAt = this.constructor.passwordChangedStamp();
    this.passwordResetTokenHash = undefined;
    this.passwordResetExpires = undefined;
  }
});

// Method to check if password matches
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
module.exports.EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
module.exports.EMAIL_PATTERN = EMAIL_PATTERN;
module.exports.normalizeEmail = normalizeEmail;
