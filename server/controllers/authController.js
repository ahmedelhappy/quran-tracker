const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
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
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

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
        language: user.language,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
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
        lastActiveDate: user.lastActiveDate,
        createdAt: user.createdAt,
        language: user.language,
      }
    });

  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
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
          message: 'Name cannot be empty'
        });
      }
      if (name.length > 50) {
        return res.status(400).json({
          success: false,
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
          message: 'Daily pages must be between 0.5 and 10'
        });
      }
      updateData.dailyNewPages = pages;
    }

    const { reviewIntensity, offDays } = req.body;

    if (reviewIntensity !== undefined) {
      if (!['light', 'standard', 'strong'].includes(reviewIntensity)) {
        return res.status(400).json({
          success: false,
          message: 'reviewIntensity must be "light", "standard", or "strong"'
        });
      }
      updateData.reviewIntensity = reviewIntensity;
    }

    if (offDays !== undefined) {
      if (!Array.isArray(offDays) || offDays.length > 2 || !offDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return res.status(400).json({
          success: false,
          message: 'offDays must be an array of at most 2 integers (0=Sun through 6=Sat)'
        });
      }
      updateData.offDays = offDays;
    }

    const { language } = req.body;

    if (language !== undefined) {
      if (!['en', 'ar'].includes(language)) {
        return res.status(400).json({
          success: false,
          message: 'language must be "en" or "ar"'
        });
      }
      updateData.language = language;
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
        onboardingComplete: updatedUser.onboardingComplete,
        currentStreak: updatedUser.currentStreak,
        createdAt: updatedUser.createdAt,
        language: updatedUser.language,
      }
    });

  } catch (error) {
    console.error('UpdateProfile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// @desc    Delete current user account and all associated data
// @route   DELETE /api/auth/account
// @access  Private
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    await UserProgress.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('DeleteAccount error:', error);
    res.status(500).json({ success: false, message: 'Error deleting account', error: error.message });
  }
};