const UserProgress = require('../models/UserProgress');
const QuranMetadata = require('../models/QuranMetadata');
const User = require('../models/User');

// Helper function to get date string (YYYY-MM-DD) for consistent comparison
const getDateString = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

// @desc    Complete onboarding - save initial progress
// @route   POST /api/progress/onboarding
// @access  Private
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { memorizedPages, dailyNewPages } = req.body;

    // Validate dailyNewPages (allow 0.5 to 10)
    const dailyGoal = Math.min(Math.max(dailyNewPages || 1, 0.5), 10);

    // Update user settings
    await User.findByIdAndUpdate(userId, {
      dailyNewPages: dailyGoal,
      onboardingComplete: true
    });

    // If user has memorized pages, create progress records
    if (memorizedPages && memorizedPages.length > 0) {
      // Set lastReviewedDate to yesterday so pages show up for review today
      const yesterday = new Date();
      yesterday.setUTCHours(0, 0, 0, 0);
      yesterday.setDate(yesterday.getDate() - 1);

      // Set memorizedDate to yesterday (not today) so they don't count against today's goal
      const progressRecords = memorizedPages.map(pageNumber => ({
        userId,
        pageNumber,
        status: 'memorized',
        memorizedDate: yesterday,
        lastReviewedDate: yesterday,
        reviewCount: 0
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

    const todayString = getDateString(new Date());

    // Get all memorized pages for this user
    const allMemorizedPages = await UserProgress.find({
      userId,
      status: 'memorized'
    }).sort({ lastReviewedDate: 1 });

    const memorizedPageNumbers = allMemorizedPages.map(p => p.pageNumber);

    // === NEW MEMORIZATION LOGIC ===
    // Count how many pages were memorized TODAY
    const pagesMemorizedToday = allMemorizedPages.filter(p => {
      if (!p.memorizedDate) return false;
      return getDateString(p.memorizedDate) === todayString;
    });
    const newPagesCompletedToday = pagesMemorizedToday.length;

    // Calculate how many new pages to show
    const dailyNewPages = user.dailyNewPages || 1;
    const targetNewPages = dailyNewPages < 1 ? 1 : Math.ceil(dailyNewPages);
    const remainingNewPages = Math.max(0, targetNewPages - newPagesCompletedToday);

    // Find next pages to memorize (only show remaining for today)
    const newPages = [];
    for (let page = 1; page <= 604; page++) {
      if (!memorizedPageNumbers.includes(page)) {
        newPages.push(page);
        if (newPages.length >= remainingNewPages) break;
      }
    }

    // Get metadata for new pages
    const newPagesData = await Promise.all(
      newPages.map(async (pageNum) => {
        const metadata = await QuranMetadata.findOne({ pageNumber: pageNum });
        return {
          pageNumber: pageNum,
          juzNumber: metadata?.juzNumber || 1,
          surahName: metadata?.surahName || 'Unknown',
          surahNameArabic: metadata?.surahNameArabic || ''
        };
      })
    );

    // === REVIEW LOGIC ===
    // Get pages reviewed today
    const pagesReviewedToday = allMemorizedPages.filter(p => {
      if (!p.lastReviewedDate) return false;
      return getDateString(p.lastReviewedDate) === todayString;
    });
    const reviewsCompletedToday = pagesReviewedToday.length;

    // Daily review target is 3 pages
    const dailyReviewTarget = 3;
    const remainingReviews = Math.max(0, dailyReviewTarget - reviewsCompletedToday);

    // Get pages for review (not reviewed today, oldest first)
    const reviewPages = allMemorizedPages.filter(p => {
      if (!p.lastReviewedDate) return true;
      return getDateString(p.lastReviewedDate) !== todayString;
    }).slice(0, remainingReviews);

    // Get metadata for review pages
    const reviewPagesData = await Promise.all(
      reviewPages.map(async (progress) => {
        const metadata = await QuranMetadata.findOne({ pageNumber: progress.pageNumber });
        return {
          pageNumber: progress.pageNumber,
          juzNumber: metadata?.juzNumber || 1,
          surahName: metadata?.surahName || 'Unknown',
          surahNameArabic: metadata?.surahNameArabic || '',
          lastReviewedDate: progress.lastReviewedDate,
          reviewCount: progress.reviewCount || 0
        };
      })
    );

    // === EXTRA PAGES (for "Want more?" section) ===
    // Find next 3 pages after today's assigned new pages
    const extraNewPages = [];
    let foundCount = 0;
    let skipCount = remainingNewPages; // Skip the ones already assigned
    for (let page = 1; page <= 604; page++) {
      if (!memorizedPageNumbers.includes(page)) {
        if (skipCount > 0) {
          skipCount--;
          continue;
        }
        extraNewPages.push(page);
        foundCount++;
        if (foundCount >= 3) break;
      }
    }

    // Get metadata for extra pages
    const extraPagesData = await Promise.all(
      extraNewPages.map(async (pageNum) => {
        const metadata = await QuranMetadata.findOne({ pageNumber: pageNum });
        return {
          pageNumber: pageNum,
          juzNumber: metadata?.juzNumber || 1,
          surahName: metadata?.surahName || 'Unknown',
          surahNameArabic: metadata?.surahNameArabic || ''
        };
      })
    );

    // Extra review pages (next 3 not assigned today)
    const extraReviewPages = allMemorizedPages.filter(p => {
      if (!p.lastReviewedDate) return true;
      return getDateString(p.lastReviewedDate) !== todayString;
    }).slice(remainingReviews, remainingReviews + 3);

    const extraReviewData = await Promise.all(
      extraReviewPages.map(async (progress) => {
        const metadata = await QuranMetadata.findOne({ pageNumber: progress.pageNumber });
        return {
          pageNumber: progress.pageNumber,
          juzNumber: metadata?.juzNumber || 1,
          surahName: metadata?.surahName || 'Unknown',
          surahNameArabic: metadata?.surahNameArabic || '',
          reviewCount: progress.reviewCount || 0
        };
      })
    );

    // Calculate stats
    const totalMemorized = allMemorizedPages.length;
    const totalPages = 604;
    const percentage = ((totalMemorized / totalPages) * 100).toFixed(1);

    // Check completion status
    const newMemorizationComplete = remainingNewPages === 0 || totalMemorized === 604;
    const reviewComplete = remainingReviews === 0 || allMemorizedPages.length === 0;
    const todayComplete = newMemorizationComplete && reviewComplete && totalMemorized > 0;

    res.status(200).json({
      success: true,
      data: {
        newPages: newPagesData,
        reviewPages: reviewPagesData,
        extraNewPages: extraPagesData,
        extraReviewPages: extraReviewData,
        stats: {
          totalMemorized,
          totalPages,
          percentage: parseFloat(percentage),
          currentStreak: user.currentStreak || 0,
          dailyNewPages: user.dailyNewPages || 1,
          newPagesCompletedToday,
          reviewsCompletedToday,
          targetNewPages,
          dailyReviewTarget,
          newMemorizationComplete,
          reviewComplete,
          todayComplete
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
    const { pageNumber, type } = req.body;

    if (!pageNumber || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page number'
      });
    }

    const now = new Date();

    if (type === 'new') {
      await UserProgress.findOneAndUpdate(
        { userId, pageNumber },
        {
          $set: {
            status: 'memorized',
            memorizedDate: now,
            lastReviewedDate: now
          },
          $inc: { reviewCount: 1 }
        },
        { upsert: true, new: true }
      );
    } else if (type === 'review') {
      const result = await UserProgress.findOneAndUpdate(
        { userId, pageNumber, status: 'memorized' },
        {
          $set: { lastReviewedDate: now },
          $inc: { reviewCount: 1 }
        },
        { new: true }
      );

      if (!result) {
        return res.status(400).json({
          success: false,
          message: 'Page not found or not memorized yet'
        });
      }
    }

    // Update user's streak
    const user = await User.findById(userId);
    const todayString = getDateString(now);
    const lastActiveString = user.lastActiveDate ? getDateString(user.lastActiveDate) : null;

    let newStreak = user.currentStreak || 0;

    if (!lastActiveString) {
      newStreak = 1;
    } else if (lastActiveString === todayString) {
      newStreak = user.currentStreak || 1;
    } else {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = getDateString(yesterday);

      if (lastActiveString === yesterdayString) {
        newStreak = (user.currentStreak || 0) + 1;
      } else {
        newStreak = 1;
      }
    }

    await User.findByIdAndUpdate(userId, {
      lastActiveDate: now,
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

    const memorizedProgress = await UserProgress.find({
      userId,
      status: 'memorized'
    });
    const memorizedPages = memorizedProgress.map(p => p.pageNumber);

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