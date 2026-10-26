const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

// Hash password before saving
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // Record when the password changed (used to invalidate older tokens). Skip
  // brand-new accounts — their first token is issued moments later. Back-date by
  // one second because a JWT's `iat` is only second-precision; without the buffer
  // the token issued right after the change could look fractionally older than it.
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
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
