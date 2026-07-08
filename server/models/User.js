const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

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
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
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
});

// Method to check if password matches
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
