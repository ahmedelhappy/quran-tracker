const UserProgress = require('../models/UserProgress');
const QuranMetadata = require('../models/QuranMetadata');
const User = require('../models/User');

// @desc    Complete onboarding - save initial progress
// @route   POST /api/progress/onboarding
// @access  Private
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { memorizedPages, dailyNewPages } = req.body;

    // Validate dailyNewPages
    const dailyGoal = Math.min(Math.max(dailyNewPages || 1, 1), 10);

    // Update user settings
    await User.findByIdAndUpdate(userId, {
      dailyNewPages: dailyGoal,
      onboardingComplete: true
    });

    // If user has memorized pages, create progress records
    if (memorizedPages && memorizedPages.length > 0) {
      const today = new Date();
      
      // Create progress records for memorized pages
      const progressRecords = memorizedPages.map(pageNumber => ({
        userId,
        pageNumber,
        status: 'memorized',
        memorizedDate: today,
        lastReviewedDate: today,
        reviewCount: 1
      }));

      // Use bulkWrite to insert/update efficiently
      const bulkOps = progressRecords.map(record => ({
        updateOne: {
          filter: { userId: record.userId, pageNumber: record.pageNumber },
          update: { $set: record },
          upsert: true
        }
      }));

      await UserProgress.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        dailyNewPages: dailyGoal,
        memorizedCount: memorizedPages?.length || 0
      }
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Error completing onboarding',
      error: error.message
    });
  }
};

// @desc    Get today's tasks (new page + review pages)
// @route   GET /api/progress/today
// @access  Private
exports.getTodayTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // Get all memorized pages for this user
    const memorizedPages = await UserProgress.find({
      userId,
      status: 'memorized'
    }).sort({ lastReviewedDate: 1 });

    // Find the next page to memorize (first non-memorized page)
    const memorizedPageNumbers = memorizedPages.map(p => p.pageNumber);
    let nextNewPage = null;

    for (let page = 1; page <= 604; page++) {
      if (!memorizedPageNumbers.includes(page)) {
        nextNewPage = page;
        break;
      }
    }

    // Get metadata for the new page
    let newPageData = null;
    if (nextNewPage) {
      const metadata = await QuranMetadata.findOne({ pageNumber: nextNewPage });
      newPageData = {
        pageNumber: nextNewPage,
        juzNumber: metadata?.juzNumber,
        surahName: metadata?.surahName,
        surahNameArabic: metadata?.surahNameArabic
      };
    }

    // Get 3 oldest reviewed pages for review (simple fixed review)
    const reviewPages = memorizedPages.slice(0, 3);
    
    // Get metadata for review pages
    const reviewPagesData = await Promise.all(
      reviewPages.map(async (progress) => {
        const metadata = await QuranMetadata.findOne({ pageNumber: progress.pageNumber });
        return {
          pageNumber: progress.pageNumber,
          juzNumber: metadata?.juzNumber,
          surahName: metadata?.surahName,
          surahNameArabic: metadata?.surahNameArabic,
          lastReviewedDate: progress.lastReviewedDate,
          reviewCount: progress.reviewCount
        };
      })
    );

    // Calculate stats
    const totalMemorized = memorizedPages.length;
    const totalPages = 604;
    const percentage = ((totalMemorized / totalPages) * 100).toFixed(1);

    res.status(200).json({
      success: true,
      data: {
        newPage: newPageData,
        reviewPages: reviewPagesData,
        stats: {
          totalMemorized,
          totalPages,
          percentage: parseFloat(percentage),
          currentStreak: user.currentStreak,
          dailyNewPages: user.dailyNewPages
        }
      }
    });

  } catch (error) {
    console.error('GetTodayTasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s tasks',
      error: error.message
    });
  }
};

// @desc    Mark a page as complete (memorized or reviewed)
// @route   POST /api/progress/complete
// @access  Private
exports.markPageComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pageNumber, type } = req.body; // type: 'new' or 'review'

    if (!pageNumber || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page number'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (type === 'new') {
      // Mark as newly memorized
      await UserProgress.findOneAndUpdate(
        { userId, pageNumber },
        {
          $set: {
            status: 'memorized',
            memorizedDate: today,
            lastReviewedDate: today
          },
          $inc: { reviewCount: 1 }
        },
        { upsert: true, new: true }
      );
    } else if (type === 'review') {
      // Update review date
      await UserProgress.findOneAndUpdate(
        { userId, pageNumber },
        {
          $set: { lastReviewedDate: today },
          $inc: { reviewCount: 1 }
        }
      );
    }

    // Update user's streak
    const user = await User.findById(userId);
    const lastActive = user.lastActiveDate;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let newStreak = user.currentStreak;

    if (!lastActive) {
      // First activity
      newStreak = 1;
    } else {
      const lastActiveDate = new Date(lastActive);
      lastActiveDate.setHours(0, 0, 0, 0);

      if (lastActiveDate.getTime() === yesterday.getTime()) {
        // Consecutive day
        newStreak = user.currentStreak + 1;
      } else if (lastActiveDate.getTime() === today.getTime()) {
        // Same day, keep streak
        newStreak = user.currentStreak;
      } else {
        // Streak broken
        newStreak = 1;
      }
    }

    await User.findByIdAndUpdate(userId, {
      lastActiveDate: today,
      currentStreak: newStreak
    });

    res.status(200).json({
      success: true,
      message: `Page ${pageNumber} marked as ${type === 'new' ? 'memorized' : 'reviewed'}`,
      data: {
        pageNumber,
        type,
        newStreak
      }
    });

  } catch (error) {
    console.error('MarkPageComplete error:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking page complete',
      error: error.message
    });
  }
};

// @desc    Get user's full progress
// @route   GET /api/progress/all
// @access  Private
exports.getAllProgress = async (req, res) => {
  try {
    const userId = req.user._id;

    const progress = await UserProgress.find({ userId, status: 'memorized' })
      .sort({ pageNumber: 1 });

    const pageNumbers = progress.map(p => p.pageNumber);

    res.status(200).json({
      success: true,
      data: {
        memorizedPages: pageNumbers,
        totalMemorized: pageNumbers.length,
        percentage: ((pageNumbers.length / 604) * 100).toFixed(1)
      }
    });

  } catch (error) {
    console.error('GetAllProgress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching progress',
      error: error.message
    });
  }
};

// @desc    Get Juz list with memorization status
// @route   GET /api/progress/juz
// @access  Private
exports.getJuzProgress = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all memorized pages
    const memorizedProgress = await UserProgress.find({
      userId,
      status: 'memorized'
    });
    const memorizedPages = memorizedProgress.map(p => p.pageNumber);

    // Juz page ranges
    const juzRanges = [
      { juz: 1, start: 1, end: 21 },
      { juz: 2, start: 22, end: 41 },
      { juz: 3, start: 42, end: 61 },
      { juz: 4, start: 62, end: 81 },
      { juz: 5, start: 82, end: 101 },
      { juz: 6, start: 102, end: 121 },
      { juz: 7, start: 122, end: 141 },
      { juz: 8, start: 142, end: 161 },
      { juz: 9, start: 162, end: 181 },
      { juz: 10, start: 182, end: 201 },
      { juz: 11, start: 202, end: 221 },
      { juz: 12, start: 222, end: 241 },
      { juz: 13, start: 242, end: 261 },
      { juz: 14, start: 262, end: 281 },
      { juz: 15, start: 282, end: 301 },
      { juz: 16, start: 302, end: 321 },
      { juz: 17, start: 322, end: 341 },
      { juz: 18, start: 342, end: 361 },
      { juz: 19, start: 362, end: 381 },
      { juz: 20, start: 382, end: 401 },
      { juz: 21, start: 402, end: 421 },
      { juz: 22, start: 422, end: 441 },
      { juz: 23, start: 442, end: 461 },
      { juz: 24, start: 462, end: 481 },
      { juz: 25, start: 482, end: 501 },
      { juz: 26, start: 502, end: 521 },
      { juz: 27, start: 522, end: 541 },
      { juz: 28, start: 542, end: 561 },
      { juz: 29, start: 562, end: 581 },
      { juz: 30, start: 582, end: 604 },
    ];

    // Calculate progress for each Juz
    const juzProgress = juzRanges.map(juz => {
      const totalPages = juz.end - juz.start + 1;
      const memorizedInJuz = memorizedPages.filter(
        p => p >= juz.start && p <= juz.end
      ).length;

      return {
        juzNumber: juz.juz,
        startPage: juz.start,
        endPage: juz.end,
        totalPages,
        memorizedPages: memorizedInJuz,
        percentage: Math.round((memorizedInJuz / totalPages) * 100),
        isComplete: memorizedInJuz === totalPages
      };
    });

    res.status(200).json({
      success: true,
      data: juzProgress
    });

  } catch (error) {
    console.error('GetJuzProgress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching Juz progress',
      error: error.message
    });
  }
};