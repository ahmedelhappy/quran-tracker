const UserProgress = require('../models/UserProgress');
const QuranMetadata = require('../models/QuranMetadata');
const User = require('../models/User');

const getDateString = (date) => new Date(date).toISOString().split('T')[0];

const MS_PER_DAY = 86400000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Returns the number of daily review pages based on intensity and memorized count.
const computeDailyReviewTarget = (totalMemorized, reviewIntensity) => {
  if (totalMemorized === 0) return 0;
  if (totalMemorized === 604) {
    const hafizSchedule = { light: 40, standard: 60, strong: Math.ceil(604 / 7) };
    return hafizSchedule[reviewIntensity] || hafizSchedule.standard;
  }
  if (totalMemorized < 3) return totalMemorized;
  const cycleDays = { light: 14, standard: 10, strong: 7 }[reviewIntensity] || 10;
  return Math.min(Math.ceil(totalMemorized / cycleDays), 40);
};

// Returns how many new pages are allocated for a given date based on planStartDate.
const computeNewPageTargetForDate = (dailyNewPages, planStartDate, targetDate) => {
  const start = new Date(planStartDate).getTime();
  const target = new Date(targetDate).getTime();
  const daysPassed = Math.floor((target - start) / MS_PER_DAY);
  const assignedToday     = Math.ceil(dailyNewPages * (daysPassed + 1));
  const assignedYesterday = Math.ceil(dailyNewPages * daysPassed);
  return Math.max(0, assignedToday - assignedYesterday);
};

// Returns true if the streak should continue, accounting for off days in the gap.
const isStreakContinued = (lastActiveDate, offDays) => {
  if (!lastActiveDate) return false;
  const lastUTC = new Date(lastActiveDate);
  lastUTC.setUTCHours(0, 0, 0, 0);
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  const daysDiff = Math.round((todayUTC - lastUTC) / MS_PER_DAY);
  if (daysDiff <= 1) return true;
  for (let d = 1; d < daysDiff; d++) {
    const checkDay = new Date(lastUTC.getTime() + d * MS_PER_DAY).getUTCDay();
    if (!offDays.includes(checkDay)) return false;
  }
  return true;
};

// After an undo, restore the streak if the user has no completions left today.
// Marking a page then undoing it must net to zero effect on the streak —
// otherwise streaks are farmable. Only restores when lastActiveDate is still
// today (i.e. today's tick came from the completion just undone, whether
// directly or transitively via an off-day/view-only tick); prevStreak/
// prevActiveDate are always kept as a matched pair from the same moment, so
// restoring both together can never leave the fields incoherent.
const reconcileStreakAfterUndo = async (userId) => {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

  const remainingToday = await UserProgress.findOne({
    userId,
    $or: [
      { memorizedDate: { $gte: todayStart, $lt: tomorrowStart } },
      { lastReviewedDate: { $gte: todayStart, $lt: tomorrowStart } },
    ],
  });

  const user = await User.findById(userId);
  const todayString = getDateString(new Date());
  const lastActiveIsToday = user.lastActiveDate && getDateString(user.lastActiveDate) === todayString;

  if (!remainingToday && lastActiveIsToday) {
    const restoredStreak = user.prevStreak ?? 0;
    const restoredDate = user.prevActiveDate ?? null;
    await User.findByIdAndUpdate(userId, { currentStreak: restoredStreak, lastActiveDate: restoredDate });
    return restoredStreak;
  }
  return user.currentStreak || 0;
};

// Fetches QuranMetadata for an array of page numbers in one query
const getMetadataMap = async (pageNumbers) => {
  if (!pageNumbers.length) return {};
  const records = await QuranMetadata.find({ pageNumber: { $in: pageNumbers } });
  return Object.fromEntries(records.map(r => [r.pageNumber, r]));
};

// Builds a compact, read-only snapshot of a user's plan & progress. Reuses the
// same helpers and new-page/review rules as getTodayTasks but returns only counts
// plus a handful of page numbers — small enough to inject into the AI assistant's
// context. Runs a single lightweight query and performs no writes.
const buildProgressSummary = async (user) => {
  const userId = user._id;
  const todayString = getDateString(new Date());
  const offDays = user.offDays || [];
  const isOffDay = offDays.includes(new Date().getUTCDay());

  const allMemorizedPages = await UserProgress.find(
    { userId, status: 'memorized' },
    { pageNumber: 1, memorizedDate: 1, lastReviewedDate: 1 }
  ).sort({ lastReviewedDate: 1, pageNumber: 1 });

  const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
  const totalMemorized = allMemorizedPages.length;
  const isHafiz = totalMemorized === 604;
  const percentage = parseFloat(((totalMemorized / 604) * 100).toFixed(1));

  // --- NEW PAGES DUE TODAY (mirrors getTodayTasks) ---
  let targetNewPages = 0;
  if (!isHafiz && !user.pauseNewMemorization && !isOffDay) {
    const planStart = user.planStartDate || user.createdAt;
    targetNewPages = computeNewPageTargetForDate(user.dailyNewPages || 1, planStart, new Date());
  }
  const newPagesCompletedToday = allMemorizedPages.filter(
    p => p.memorizedDate && getDateString(p.memorizedDate) === todayString
  ).length;
  const remainingNewPages = Math.max(0, targetNewPages - newPagesCompletedToday);

  const newPageNumbers = [];
  for (let page = 1; page <= 604 && newPageNumbers.length < remainingNewPages; page++) {
    if (!memorizedPageNumbers.has(page)) newPageNumbers.push(page);
  }

  // --- REVIEWS DUE TODAY (cycle + recent buckets, mirrors getTodayTasks) ---
  let reviewsDueToday = 0;
  if (!isOffDay) {
    const dailyReviewTarget = user.cycleReviewCount !== null && user.cycleReviewCount !== undefined
      ? user.cycleReviewCount
      : computeDailyReviewTarget(totalMemorized, user.reviewIntensity || 'standard');

    const planStartDateString = getDateString(user.planStartDate || user.createdAt);
    const maxRecent = user.recentReviewCount !== null && user.recentReviewCount !== undefined
      ? user.recentReviewCount
      : Math.max(3, Math.min(Math.ceil((user.dailyNewPages || 1) * 3), 6));
    const recentPool = allMemorizedPages
      .filter(p => p.memorizedDate
        && getDateString(p.memorizedDate) !== todayString
        && getDateString(p.memorizedDate) >= planStartDateString)
      .sort((a, b) => new Date(b.memorizedDate) - new Date(a.memorizedDate))
      .slice(0, maxRecent);
    const recentEligibleNums = new Set(recentPool.map(p => p.pageNumber));

    // Cycle bucket: memorized pages not memorized today and not owned by recent pool.
    const pagesForReview = allMemorizedPages.filter(
      p => (!p.memorizedDate || getDateString(p.memorizedDate) !== todayString)
        && !recentEligibleNums.has(p.pageNumber)
    );
    const cycleCompletedToday = pagesForReview.filter(
      p => p.lastReviewedDate && getDateString(p.lastReviewedDate) === todayString
    ).length;
    const cyclePending = pagesForReview.filter(
      p => !p.lastReviewedDate || getDateString(p.lastReviewedDate) !== todayString
    ).length;
    const cycleDue = Math.min(Math.max(0, dailyReviewTarget - cycleCompletedToday), cyclePending);

    // Recent bucket: the recent pool, minus any already reviewed today.
    const recentDue = recentPool.filter(p =>
      !(p.lastReviewedDate && getDateString(p.lastReviewedDate) === todayString)
    ).length;

    reviewsDueToday = cycleDue + recentDue;
  }

  return {
    name: user.name,
    dailyNewPages: user.dailyNewPages || 1,
    isOffDay,
    isHafiz,
    currentStreak: user.currentStreak || 0,
    totalMemorized,
    totalPages: 604,
    pagesLeft: 604 - totalMemorized,
    percentage,
    newPagesDueToday: newPageNumbers.length,
    newPageNumbers,
    reviewsDueToday,
  };
};

exports.buildProgressSummary = buildProgressSummary;

// @desc    Complete onboarding - save initial progress
// @route   POST /api/progress/onboarding
// @access  Private
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { memorizedPages, dailyNewPages } = req.body;

    const dailyGoal = Math.min(Math.max(parseFloat(dailyNewPages) || 1, 0.5), 10);

    await User.findByIdAndUpdate(userId, {
      dailyNewPages: dailyGoal,
      onboardingComplete: true,
      planStartDate: new Date(),
    });

    if (memorizedPages && memorizedPages.length > 0) {
      const yesterday = new Date();
      yesterday.setUTCHours(0, 0, 0, 0);
      yesterday.setDate(yesterday.getDate() - 1);

      const bulkOps = memorizedPages.map(pageNumber => ({
        updateOne: {
          filter: { userId, pageNumber },
          update: {
            $set: {
              userId,
              pageNumber,
              status: 'memorized',
              memorizedDate: yesterday,
              lastReviewedDate: yesterday,
              reviewCount: 0,
            },
          },
          upsert: true,
        },
      }));

      await UserProgress.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        dailyNewPages: dailyGoal,
        memorizedCount: memorizedPages?.length || 0,
      },
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ success: false, message: 'Error completing onboarding', error: error.message });
  }
};

// @desc    Get today's tasks (new pages + review pages)
// @route   GET /api/progress/today
// @access  Private
exports.getTodayTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const todayString = getDateString(new Date());
    const offDays = user.offDays || [];
    const ignoreOffDay = req.query.ignoreOffDay === 'true';

    // --- OFF DAY ---
    if (!ignoreOffDay && offDays.includes(new Date().getUTCDay())) {
      const totalMemorized = await UserProgress.countDocuments({ userId, status: 'memorized' });

      // Preserve streak on off-days: bump lastActiveDate without incrementing the count.
      // Guard: never tick for a user who has never been active (null lastActiveDate).
      // Snapshot the pre-tick streak/date (same as markPageComplete) so a later
      // undo that leaves the user with no completions today can restore it.
      if (user.lastActiveDate && getDateString(user.lastActiveDate) !== todayString
          && isStreakContinued(user.lastActiveDate, offDays)) {
        await User.findByIdAndUpdate(userId, {
          lastActiveDate: new Date(),
          prevStreak: user.currentStreak || 0,
          prevActiveDate: user.lastActiveDate,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          isOffDay: true,
          isHafiz: totalMemorized === 604,
          newPages: [], reviewPages: [], extraNewPages: [], extraReviewPages: [],
          recentReviewPages: [], continuationPage: null,
          stats: {
            totalMemorized, totalPages: 604,
            percentage: parseFloat(((totalMemorized / 604) * 100).toFixed(1)),
            currentStreak: user.currentStreak || 0,
            dailyNewPages: user.dailyNewPages || 1,
            reviewIntensity: user.reviewIntensity || 'standard',
            recentReviewCount: user.recentReviewCount ?? null,
            cycleReviewCount: user.cycleReviewCount ?? null,
            newPagesCompletedToday: 0, reviewsCompletedToday: 0,
            targetNewPages: 0, dailyReviewTarget: 0,
            newMemorizationComplete: true, reviewComplete: true,
            todayComplete: true, isHafiz: totalMemorized === 604,
          },
        },
      });
    }

    // --- LOAD ALL MEMORIZED PAGES ---
    const allMemorizedPages = await UserProgress.find({ userId, status: 'memorized' })
      .sort({ lastReviewedDate: 1, pageNumber: 1 });

    const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
    const totalMemorized = allMemorizedPages.length;
    const isHafiz = totalMemorized === 604;

    // --- REVIEW TARGET ---
    const dailyReviewTarget = user.cycleReviewCount !== null && user.cycleReviewCount !== undefined
      ? user.cycleReviewCount
      : computeDailyReviewTarget(totalMemorized, user.reviewIntensity || 'standard');

    // --- NEW MEMORIZATION TARGET ---
    let targetNewPages = 0;
    if (!isHafiz && !user.pauseNewMemorization) {
      const planStart = user.planStartDate || user.createdAt;
      targetNewPages = computeNewPageTargetForDate(user.dailyNewPages || 1, planStart, new Date());
    }

    // Pages memorized today
    const newPagesCompletedToday = allMemorizedPages.filter(
      p => p.memorizedDate && getDateString(p.memorizedDate) === todayString
    ).length;

    const remainingNewPages = Math.max(0, targetNewPages - newPagesCompletedToday);

    // Next unmemorized pages
    const newPageNums = [];
    if (remainingNewPages > 0) {
      for (let page = 1; page <= 604; page++) {
        if (!memorizedPageNumbers.has(page)) {
          newPageNums.push(page);
          if (newPageNums.length >= remainingNewPages) break;
        }
      }
    }

    // Extra unmemorized pages (for "Want more?" section)
    const extraNewPageNums = [];
    for (let page = 1; page <= 604 && extraNewPageNums.length < 3; page++) {
      if (!memorizedPageNumbers.has(page) && !newPageNums.includes(page)) {
        extraNewPageNums.push(page);
      }
    }

    // --- RECENT REVIEW POOL (computed first — needed to exclude from cycle) ---
    // The recent bucket is the user's most recently memorized pages during active
    // plan use: memorizedDate on or after planStartDate (so onboarding pages, dated
    // before the plan started, are excluded) and not today's. We take the N newest,
    // where N is the "recent pages per day" setting — taking the N most recent rather
    // than a fixed day-window means raising the setting actually surfaces more pages.
    // Brand-new users (planStart today) have none yet → empty Recent Review.
    const planStartDateString = getDateString(user.planStartDate || user.createdAt);
    const maxRecent = user.recentReviewCount !== null && user.recentReviewCount !== undefined
      ? user.recentReviewCount
      : Math.max(3, Math.min(Math.ceil((user.dailyNewPages || 1) * 3), 6));
    const recentPool = allMemorizedPages
      .filter(p => p.memorizedDate
        && getDateString(p.memorizedDate) !== todayString
        && getDateString(p.memorizedDate) >= planStartDateString)
      .sort((a, b) => new Date(b.memorizedDate) - new Date(a.memorizedDate))
      .slice(0, maxRecent);

    // Cycle review skips the recent pool so no page appears in both sections at once.
    const recentEligibleNums = new Set(recentPool.map(p => p.pageNumber));

    // --- CYCLE REVIEW PAGES ---
    // Excludes: pages memorized today, pages owned by the recent review window.
    // Sorted by cycleReviewStartPage order when set, otherwise lastReviewedDate ASC.
    const pagesForReview = allMemorizedPages.filter(
      p => (!p.memorizedDate || getDateString(p.memorizedDate) !== todayString)
        && !recentEligibleNums.has(p.pageNumber)
    );

    if (user.cycleReviewStartPage) {
      const startPg = user.cycleReviewStartPage;
      // Staleness drives the rotation: oldest lastReviewedDate first. Reviewing a
      // batch today makes those pages the freshest, so they sink and the next-stale
      // batch surfaces tomorrow — that is what advances the cycle day to day. Pages
      // that are equally stale (e.g. a fresh lap where everything shares a review
      // date, or onboarding pages with the same date) are tie-broken by a rotated
      // page index so they follow S → highest memorized page → 1 → S-1, which also
      // makes the cycle wrap past the end back to page 1. Never-reviewed pages ('')
      // count as the most stale. lastReviewedDate stays in the sort by design.
      const rotatedIndex = (pageNumber) => ((pageNumber - startPg) % 604 + 604) % 604;
      pagesForReview.sort((a, b) => {
        const aDay = a.lastReviewedDate ? getDateString(a.lastReviewedDate) : '';
        const bDay = b.lastReviewedDate ? getDateString(b.lastReviewedDate) : '';
        if (aDay !== bDay) return aDay < bDay ? -1 : 1;
        return rotatedIndex(a.pageNumber) - rotatedIndex(b.pageNumber);
      });
    }

    const reviewsCompletedToday = pagesForReview.filter(
      p => p.lastReviewedDate && getDateString(p.lastReviewedDate) === todayString
    ).length;

    const remainingReviews = Math.max(0, dailyReviewTarget - reviewsCompletedToday);

    const pendingReviews = pagesForReview.filter(
      p => !p.lastReviewedDate || getDateString(p.lastReviewedDate) !== todayString
    );

    const reviewPages = pendingReviews.slice(0, remainingReviews);
    const extraReviewPages = pendingReviews.slice(remainingReviews, remainingReviews + 3);

    // --- RECENT REVIEW PAGES ---
    // The recent pool, minus any already reviewed today, shown in page order.
    const cappedRecentPages = recentPool
      .filter(p => !(p.lastReviewedDate && getDateString(p.lastReviewedDate) === todayString))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    // --- CONSTANT DAILY REVIEW TARGETS ---
    // How many pages the day STARTED with for each bucket, independent of how many
    // are already done — so the dashboard's "Daily Review" stat reads a stable
    // "this is your daily load" number instead of counting down to zero as the user
    // ticks pages off. Recent counts the recent-window pages due today (including any
    // already reviewed); cycle is the target capped by how many cycle pages exist.
    const cycleReviewTarget = Math.min(dailyReviewTarget, pagesForReview.length);
    const recentReviewTarget = recentPool.length;
    const dailyReviewTotal = cycleReviewTarget + recentReviewTarget;

    // --- CONTINUATION PAGE (0.5/day: no-new-pages days show the most recently memorized page) ---
    let continuationPageNum = null;
    if (targetNewPages === 0 && !isHafiz) {
      const sortedByMemDate = [...allMemorizedPages]
        .filter(p => p.memorizedDate && getDateString(p.memorizedDate) !== todayString)
        .sort((a, b) => new Date(b.memorizedDate) - new Date(a.memorizedDate));
      if (sortedByMemDate.length > 0) {
        continuationPageNum = sortedByMemDate[0].pageNumber;
      }
    }

    // --- METADATA (batched) ---
    const allPageNumsNeeded = [
      ...newPageNums, ...extraNewPageNums,
      ...reviewPages.map(p => p.pageNumber),
      ...extraReviewPages.map(p => p.pageNumber),
      ...cappedRecentPages.map(p => p.pageNumber),
      ...(continuationPageNum ? [continuationPageNum] : []),
    ];
    const metaMap = await getMetadataMap(allPageNumsNeeded);

    const toNewPageDto = (pageNum) => {
      const meta = metaMap[pageNum];
      return {
        pageNumber: pageNum,
        juzNumber: meta?.juzNumber || 1,
        surahName: meta?.surahName || 'Unknown',
        surahNameArabic: meta?.surahNameArabic || '',
        surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
      };
    };

    const toReviewPageDto = (progress) => {
      const meta = metaMap[progress.pageNumber];
      return {
        pageNumber: progress.pageNumber,
        juzNumber: meta?.juzNumber || 1,
        surahName: meta?.surahName || 'Unknown',
        surahNameArabic: meta?.surahNameArabic || '',
        surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        lastReviewedDate: progress.lastReviewedDate,
        reviewCount: progress.reviewCount || 0,
      };
    };

    // --- FIRST CYCLE COMPLETE ---
    // Fires once when user paused from onboarding and every memorized page has been
    // reviewed at least once since the plan started.
    const planStartStr = getDateString(user.planStartDate || user.createdAt);
    const firstCycleComplete = user.pausedFromOnboarding === true
      && totalMemorized > 0
      && pagesForReview.every(
          p => p.lastReviewedDate && getDateString(p.lastReviewedDate) >= planStartStr
        );

    // --- STATS ---
    const percentage = ((totalMemorized / 604) * 100).toFixed(1);
    const newMemorizationComplete = isHafiz || newPagesCompletedToday >= targetNewPages;
    const reviewComplete = reviewsCompletedToday >= dailyReviewTarget || pagesForReview.length === 0;
    const todayComplete = totalMemorized > 0 && newMemorizationComplete && reviewComplete;

    const activeDaysPerWeek = 7 - offDays.length;
    const effectiveDailyPages = (user.dailyNewPages || 1) * (activeDaysPerWeek / 7);
    const estimatedDays = !isHafiz && effectiveDailyPages > 0
      ? Math.ceil((604 - totalMemorized) / effectiveDailyPages)
      : 0;

    // Streak tick for view-only days: preserve streak when user has nothing left to do
    // today but hasn't yet triggered markPageComplete (which would bump lastActiveDate).
    // Conditions: the day is effectively complete, the user has been active before (not
    // their very first open), lastActiveDate is not already today, and the streak would
    // still be alive if counted from yesterday.
    const isViewOnlyComplete = todayComplete || (isHafiz && dailyReviewTarget === 0);
    if (isViewOnlyComplete && user.lastActiveDate
        && getDateString(user.lastActiveDate) !== todayString
        && isStreakContinued(user.lastActiveDate, offDays)) {
      // Snapshot the pre-tick streak/date (same as markPageComplete) so a later
      // undo that leaves the user with no completions today can restore it.
      await User.findByIdAndUpdate(userId, {
        lastActiveDate: new Date(),
        prevStreak: user.currentStreak || 0,
        prevActiveDate: user.lastActiveDate,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        isOffDay: false,
        isHafiz,
        firstCycleComplete,
        newPages: newPageNums.map(toNewPageDto),
        reviewPages: reviewPages.map(toReviewPageDto),
        extraNewPages: extraNewPageNums.map(toNewPageDto),
        extraReviewPages: extraReviewPages.map(toReviewPageDto),
        recentReviewPages: cappedRecentPages.map(toReviewPageDto),
        continuationPage: continuationPageNum ? toNewPageDto(continuationPageNum) : null,
        stats: {
          totalMemorized, totalPages: 604,
          percentage: parseFloat(percentage),
          currentStreak: user.currentStreak || 0,
          dailyNewPages: user.dailyNewPages || 1,
          reviewIntensity: user.reviewIntensity || 'standard',
          recentReviewCount: user.recentReviewCount ?? null,
          cycleReviewCount: user.cycleReviewCount ?? null,
          newPagesCompletedToday, reviewsCompletedToday,
          targetNewPages, dailyReviewTarget,
          cycleReviewTarget, recentReviewTarget, dailyReviewTotal,
          newMemorizationComplete, reviewComplete, todayComplete,
          isHafiz, estimatedDays,
        },
      },
    });
  } catch (error) {
    console.error('GetTodayTasks error:', error);
    res.status(500).json({ success: false, message: "Error fetching today's tasks", error: error.message });
  }
};

// @desc    Mark a page as complete (memorized or reviewed)
// @route   POST /api/progress/complete
// @access  Private
exports.markPageComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pageNumber, type, alreadyKnow } = req.body;

    if (!pageNumber || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({ success: false, message: 'Invalid page number' });
    }

    const now = new Date();

    if (type === 'new') {
      // alreadyKnow: true → back-date memorizedDate to yesterday so the page doesn't
      // count against today's new-page quota, freeing today's slot for the next page.
      const memorizedDate = alreadyKnow
        ? (() => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - 1); d.setUTCHours(0, 0, 0, 0); return d; })()
        : now;
      await UserProgress.findOneAndUpdate(
        { userId, pageNumber },
        { $set: { status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate }, $inc: { reviewCount: 1 } },
        { upsert: true, new: true }
      );
    } else if (type === 'review') {
      const result = await UserProgress.findOneAndUpdate(
        { userId, pageNumber, status: 'memorized' },
        { $set: { lastReviewedDate: now }, $inc: { reviewCount: 1 } },
        { new: true }
      );
      if (!result) {
        return res.status(400).json({ success: false, message: 'Page not found or not memorized yet' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'type must be "new" or "review"' });
    }

    // --- STREAK UPDATE ---
    const user = await User.findById(userId);
    const todayString = getDateString(now);
    const offDays = user.offDays || [];

    // The first streak-affecting action of the day — snapshot the pre-update
    // streak/date so an undo later today (that leaves no completions left) can
    // restore exactly this, rather than the streak bump surviving the undo.
    const isFirstActionToday = !user.lastActiveDate || getDateString(user.lastActiveDate) !== todayString;

    let newStreak = user.currentStreak || 0;
    if (!user.lastActiveDate) {
      newStreak = 1;
    } else if (getDateString(user.lastActiveDate) === todayString) {
      newStreak = user.currentStreak || 1;
    } else if (isStreakContinued(user.lastActiveDate, offDays)) {
      newStreak = (user.currentStreak || 0) + 1;
    } else {
      newStreak = 1;
    }

    const streakUpdate = { lastActiveDate: now, currentStreak: newStreak };
    if (isFirstActionToday) {
      streakUpdate.prevStreak = user.currentStreak || 0;
      streakUpdate.prevActiveDate = user.lastActiveDate || null;
    }
    await User.findByIdAndUpdate(userId, streakUpdate);

    res.status(200).json({
      success: true,
      message: `Page ${pageNumber} marked as ${type === 'new' ? 'memorized' : 'reviewed'}`,
      data: { pageNumber, type, newStreak },
    });
  } catch (error) {
    console.error('MarkPageComplete error:', error);
    res.status(500).json({ success: false, message: 'Error marking page complete', error: error.message });
  }
};

// @desc    Undo a page completion (un-memorize or un-review)
// @route   POST /api/progress/uncomplete
// @access  Private
exports.unmarkPageComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pageNumber, type } = req.body;

    if (!pageNumber || pageNumber < 1 || pageNumber > 604) {
      return res.status(400).json({ success: false, message: 'Invalid page number' });
    }

    if (type === 'new') {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

      const deleted = await UserProgress.findOneAndDelete({
        userId,
        pageNumber,
        memorizedDate: { $gte: todayStart, $lt: tomorrowStart },
      });
      if (!deleted) {
        return res.status(400).json({ success: false, message: 'Page was not memorized today' });
      }
    } else if (type === 'review') {
      const progress = await UserProgress.findOne({ userId, pageNumber, status: 'memorized' });
      if (!progress) {
        return res.status(400).json({ success: false, message: 'Page not found or not memorized' });
      }
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      yesterday.setUTCHours(0, 0, 0, 0);
      await UserProgress.updateOne(
        { userId, pageNumber },
        {
          $set: {
            lastReviewedDate: yesterday,
            reviewCount: Math.max(0, (progress.reviewCount || 0) - 1),
          },
        }
      );
    } else {
      return res.status(400).json({ success: false, message: 'type must be "new" or "review"' });
    }

    const currentStreak = await reconcileStreakAfterUndo(userId);

    res.status(200).json({
      success: true,
      message: `Page ${pageNumber} completion undone`,
      data: { currentStreak },
    });
  } catch (error) {
    console.error('UnmarkPageComplete error:', error);
    res.status(500).json({ success: false, message: 'Error undoing completion', error: error.message });
  }
};

// @desc    Get estimated completion time based on remaining pages
// @route   GET /api/progress/estimate
// @access  Private
exports.getEstimate = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const dailyPages = parseFloat(req.query.dailyPages) || user.dailyNewPages || 1;
    if (isNaN(dailyPages) || dailyPages < 0.5 || dailyPages > 10) {
      return res.status(400).json({ success: false, message: 'dailyPages must be between 0.5 and 10' });
    }

    const totalMemorized = await UserProgress.countDocuments({ userId, status: 'memorized' });
    const remainingPages = 604 - totalMemorized;

    const offDays = user.offDays || [];
    const activeDaysPerWeek = 7 - offDays.length;
    const effectiveDailyPages = dailyPages * (activeDaysPerWeek / 7);

    const estimatedDays = effectiveDailyPages > 0 ? Math.ceil(remainingPages / effectiveDailyPages) : null;
    const estimatedWeeks = estimatedDays ? Math.round(estimatedDays / 7) : null;
    const estimatedMonths = estimatedDays ? Math.round(estimatedDays / 30) : null;
    const estimatedYears = estimatedDays ? parseFloat((estimatedDays / 365).toFixed(1)) : null;

    res.status(200).json({
      success: true,
      data: {
        totalMemorized, remainingPages,
        dailyPages, activeDaysPerWeek,
        estimatedDays, estimatedWeeks, estimatedMonths, estimatedYears,
      },
    });
  } catch (error) {
    console.error('GetEstimate error:', error);
    res.status(500).json({ success: false, message: 'Error calculating estimate', error: error.message });
  }
};

// @desc    Get week plan preview (next 6 days)
// @route   GET /api/progress/week
// @access  Private
exports.getWeekPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const allMemorizedPages = await UserProgress.find({ userId, status: 'memorized' });
    const totalMemorized = allMemorizedPages.length;
    const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
    const isHafiz = totalMemorized === 604;

    const offDays = user.offDays || [];
    const planStart = user.planStartDate || user.createdAt;
    const dailyNewPages = user.dailyNewPages || 1;
    const reviewIntensity = user.reviewIntensity || 'standard';

    // Build ordered list of unmemorized pages
    const unmemorizedPages = [];
    if (!isHafiz) {
      for (let page = 1; page <= 604; page++) {
        if (!memorizedPageNumbers.has(page)) unmemorizedPages.push(page);
      }
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayString = getDateString(today);

    // Today already consumes its own new pages from the unmemorized list, so the
    // projection for the next days must start AFTER them — otherwise tomorrow (or the
    // next active day) repeats today's page instead of advancing to the next one.
    const isTodayOffDay = offDays.includes(today.getUTCDay());
    const todayNewTarget = (isHafiz || user.pauseNewMemorization || isTodayOffDay)
      ? 0
      : computeNewPageTargetForDate(dailyNewPages, planStart, today);
    const newPagesCompletedToday = allMemorizedPages.filter(
      p => p.memorizedDate && getDateString(p.memorizedDate) === todayString
    ).length;

    const plan = [];
    let cumulativeNew = Math.max(0, todayNewTarget - newPagesCompletedToday);
    const pageNumsForMeta = [];

    // Estimate the "recently memorized" review pages each projected day will also
    // carry (pages memorized over the last up to 3 active days), so the week tab's
    // total matches today's cycle-plus-recent figure instead of showing cycle only.
    const maxRecent = user.recentReviewCount !== null && user.recentReviewCount !== undefined
      ? user.recentReviewCount
      : Math.max(3, Math.min(Math.ceil(dailyNewPages * 3), 6));
    const recentNewWindow = [];
    if (!isHafiz && !user.pauseNewMemorization && !isTodayOffDay && todayNewTarget > 0) {
      recentNewWindow.push(todayNewTarget);
    }

    for (let i = 1; i <= 6; i++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() + i);
      const dayOfWeek = date.getUTCDay();

      if (offDays.includes(dayOfWeek)) {
        plan.push({
          date: getDateString(date),
          dayName: DAY_NAMES[dayOfWeek],
          isOffDay: true,
          newPagesCount: 0,
          reviewPagesCount: 0,
          newPage: null,
        });
        continue;
      }

      const newTarget = (isHafiz || user.pauseNewMemorization) ? 0 : computeNewPageTargetForDate(dailyNewPages, planStart, date);

      const newPagesForDay = [];
      if (newTarget > 0) {
        for (let j = 0; j < newTarget && (cumulativeNew + j) < unmemorizedPages.length; j++) {
          const pg = unmemorizedPages[cumulativeNew + j];
          newPagesForDay.push(pg);
          pageNumsForMeta.push(pg);
        }
      }

      const projectedMemorized = Math.min(604, totalMemorized + cumulativeNew);
      // Honor a fixed daily review count the same way getTodayTasks does, so the
      // week projection matches today's number instead of falling back to the
      // intensity formula (which made future days show the old intensity).
      const cycleTarget = (user.cycleReviewCount !== null && user.cycleReviewCount !== undefined)
        ? user.cycleReviewCount
        : computeDailyReviewTarget(projectedMemorized, reviewIntensity);
      // Recent reviews = pages memorized over the last up to 3 active days, capped.
      const recentTarget = isHafiz ? 0 : Math.min(maxRecent, recentNewWindow.reduce((a, b) => a + b, 0));

      plan.push({
        date: getDateString(date),
        dayName: DAY_NAMES[dayOfWeek],
        isOffDay: false,
        newPagesCount: newTarget,
        reviewPagesCount: cycleTarget + recentTarget,
        newPagesForDay,
      });

      cumulativeNew += newTarget;
      recentNewWindow.push(newTarget);
      while (recentNewWindow.length > 3) recentNewWindow.shift();
    }

    // Fetch metadata for new pages in the plan
    const metaMap = await getMetadataMap(pageNumsForMeta);

    const enrichedPlan = plan.map(day => ({
      ...day,
      newPageInfo: day.newPagesForDay?.[0] ? (() => {
        const pg = day.newPagesForDay[0];
        const meta = metaMap[pg];
        return {
          pageNumber: pg,
          juzNumber: meta?.juzNumber || 1,
          surahName: meta?.surahName || 'Unknown',
          surahNameArabic: meta?.surahNameArabic || '',
          surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        };
      })() : null,
      newPagesInfo: (day.newPagesForDay || []).map(pg => {
        const meta = metaMap[pg];
        return {
          pageNumber: pg,
          juzNumber: meta?.juzNumber || 1,
          surahName: meta?.surahName || 'Unknown',
          surahNameArabic: meta?.surahNameArabic || '',
          surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        };
      }),
    }));

    res.status(200).json({ success: true, data: enrichedPlan });
  } catch (error) {
    console.error('GetWeekPlan error:', error);
    res.status(500).json({ success: false, message: 'Error fetching week plan', error: error.message });
  }
};

// @desc    Get user's full progress
// @route   GET /api/progress/all
// @access  Private
exports.getAllProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const progress = await UserProgress.find({ userId, status: 'memorized' }).sort({ pageNumber: 1 });
    const pageNumbers = progress.map(p => p.pageNumber);

    // Build date → count map for heatmap and chart
    const memorizedByDate = {};
    for (const p of progress) {
      const dateStr = p.memorizedDate
        ? getDateString(p.memorizedDate)
        : getDateString(p.createdAt);
      memorizedByDate[dateStr] = (memorizedByDate[dateStr] || 0) + 1;
    }

    res.status(200).json({
      success: true,
      data: {
        memorizedPages: pageNumbers,
        totalMemorized: pageNumbers.length,
        percentage: ((pageNumbers.length / 604) * 100).toFixed(1),
        memorizedByDate,
      },
    });
  } catch (error) {
    console.error('GetAllProgress error:', error);
    res.status(500).json({ success: false, message: 'Error fetching progress', error: error.message });
  }
};

// @desc    Update memorized pages — replace existing set (add new, delete removed)
// @route   PUT /api/progress/memorized
// @access  Private
exports.updateMemorized = async (req, res) => {
  try {
    const userId = req.user._id;
    const { memorizedPages } = req.body;

    if (!Array.isArray(memorizedPages)) {
      return res.status(400).json({ success: false, message: 'memorizedPages must be an array' });
    }

    const newPageSet = new Set(memorizedPages.map(Number).filter(n => n >= 1 && n <= 604));

    await UserProgress.deleteMany({
      userId,
      status: 'memorized',
      pageNumber: { $nin: Array.from(newPageSet) },
    });

    if (newPageSet.size > 0) {
      const yesterday = new Date();
      yesterday.setUTCHours(0, 0, 0, 0);
      yesterday.setDate(yesterday.getDate() - 1);

      const bulkOps = Array.from(newPageSet).map(pageNumber => ({
        updateOne: {
          filter: { userId, pageNumber },
          update: {
            $set: { status: 'memorized' },
            $setOnInsert: {
              userId,
              pageNumber,
              memorizedDate: yesterday,
              lastReviewedDate: yesterday,
              reviewCount: 0,
            },
          },
          upsert: true,
        },
      }));

      await UserProgress.bulkWrite(bulkOps);
    }

    res.status(200).json({
      success: true,
      message: 'Memorized pages updated',
      data: { memorizedCount: newPageSet.size },
    });
  } catch (error) {
    console.error('UpdateMemorized error:', error);
    res.status(500).json({ success: false, message: 'Error updating memorized pages', error: error.message });
  }
};

// @desc    Reset all progress for the user
// @route   DELETE /api/progress/reset
// @access  Private
exports.resetProgress = async (req, res) => {
  try {
    const userId = req.user._id;

    await UserProgress.deleteMany({ userId });
    await User.findByIdAndUpdate(userId, {
      currentStreak: 0,
      lastActiveDate: null,
      prevStreak: null,
      prevActiveDate: null,
      planStartDate: new Date(),
    });

    res.status(200).json({ success: true, message: 'Progress reset successfully' });
  } catch (error) {
    console.error('ResetProgress error:', error);
    res.status(500).json({ success: false, message: 'Error resetting progress', error: error.message });
  }
};

// @desc    Get Juz list with memorization status
// @route   GET /api/progress/juz
// @access  Private
exports.getJuzProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const memorizedProgress = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, lastReviewedDate: 1 });
    const memorizedPages = new Set(memorizedProgress.map(p => p.pageNumber));
    const reviewDateByPage = Object.fromEntries(memorizedProgress.map(p => [p.pageNumber, p.lastReviewedDate]));
    const now = new Date();

    const juzRanges = [
      { juz: 1,  start: 1,   end: 21  },
      { juz: 2,  start: 22,  end: 41  },
      { juz: 3,  start: 42,  end: 61  },
      { juz: 4,  start: 62,  end: 81  },
      { juz: 5,  start: 82,  end: 101 },
      { juz: 6,  start: 102, end: 121 },
      { juz: 7,  start: 122, end: 141 },
      { juz: 8,  start: 142, end: 161 },
      { juz: 9,  start: 162, end: 181 },
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

    const juzProgress = juzRanges.map(({ juz, start, end }) => {
      const totalPages = end - start + 1;
      let memorizedInJuz = 0;
      for (let p = start; p <= end; p++) {
        if (memorizedPages.has(p)) memorizedInJuz++;
      }
      // Find the oldest (most stale) review date among memorized pages in this juz
      let oldestReview = null;
      for (let p = start; p <= end; p++) {
        if (!memorizedPages.has(p)) continue;
        const rd = reviewDateByPage[p];
        if (!rd || !oldestReview || rd < oldestReview) oldestReview = rd;
      }
      const oldestReviewDaysAgo = oldestReview
        ? Math.floor((now - new Date(oldestReview)) / MS_PER_DAY)
        : null;

      return {
        juzNumber: juz, startPage: start, endPage: end,
        totalPages, memorizedPages: memorizedInJuz,
        percentage: Math.round((memorizedInJuz / totalPages) * 100),
        isComplete: memorizedInJuz === totalPages,
        oldestReviewDaysAgo,
      };
    });

    res.status(200).json({ success: true, data: juzProgress });
  } catch (error) {
    console.error('GetJuzProgress error:', error);
    res.status(500).json({ success: false, message: 'Error fetching Juz progress', error: error.message });
  }
};
