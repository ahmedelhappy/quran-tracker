const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { getMetadataForPages } = require('../utils/quranMetadataCache');
const { serverError } = require('../utils/errorResponse');
const {
  UNIT_TYPES,
  PAGE_BY_NUMBER,
  compileUnitRange,
  rangeToPages,
  addRangeToPage,
  removeRangeFromPage,
  remainderRanges,
  pageFraction,
  totalMemorizedFraction,
} = require('../utils/segments');

const getDateString = (date) => new Date(date).toISOString().split('T')[0];

const MS_PER_DAY = 86400000;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Returns the number of daily review pages based on intensity and how many pages
// have SOME progress (full or partial — a partial page is still one reviewable
// item, per the segments design). isHafiz must be passed explicitly: with
// segments, "604 pages touched" no longer implies "604 pages fully memorized".
const computeDailyReviewTarget = (totalPagesWithProgress, reviewIntensity, isHafiz) => {
  if (totalPagesWithProgress === 0) return 0;
  if (isHafiz) {
    const hafizSchedule = { light: 40, standard: 60, strong: Math.ceil(604 / 7) };
    return hafizSchedule[reviewIntensity] || hafizSchedule.standard;
  }
  if (totalPagesWithProgress < 3) return totalPagesWithProgress;
  const cycleDays = { light: 14, standard: 10, strong: 7 }[reviewIntensity] || 10;
  return Math.min(Math.ceil(totalPagesWithProgress / cycleDays), 40);
};

// Returns how many new-page TASKS are allocated for a given date based on
// planStartDate. A half-page plan (dailyNewPages < 1, i.e. 0.5) always targets
// exactly one task per active day — that task is half a page's worth of verses
// (see nextHalfPageTask), so two active days assign one whole page.
const computeNewPageTargetForDate = (dailyNewPages, planStartDate, targetDate) => {
  if (dailyNewPages < 1) return 1;
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

// FROM THE END memorization order, precomputed once at module load from the
// committed mushaf structure (no DB dependency). "From the end" means surah by
// surah backward (114 → 1) but the pages WITHIN each surah go forward, so a
// multi-page surah is still memorized from its beginning — walking raw pages
// 604→1 would force a surah's last page first and break recitation. A page
// shared by several surahs is claimed by the latest surah to reach it (that
// surah's run comes first), which keeps the top of the sequence 604, 603, 602…
// and only reorders inside multi-page surahs (e.g. Al-Mulk emits 562 then 563).
const FROM_END_ORDER = (() => {
  const structure = require('../seed/data/quranStructure.json');
  const pagesBySurah = new Map();
  for (const page of structure) {
    for (const s of page.surahs) {
      if (!pagesBySurah.has(s.number)) pagesBySurah.set(s.number, []);
      pagesBySurah.get(s.number).push(page.pageNumber);
    }
  }
  for (const pages of pagesBySurah.values()) pages.sort((a, b) => a - b);
  const order = [];
  const seen = new Set();
  for (let surah = 114; surah >= 1; surah--) {
    for (const pg of pagesBySurah.get(surah) || []) {
      if (!seen.has(pg)) { seen.add(pg); order.push(pg); }
    }
  }
  return order;
})();
const FROM_END_INDEX = new Map(FROM_END_ORDER.map((pg, i) => [pg, i]));

// The full 604-page walk order for a user. fromStart walks 1→604; a custom
// newMemorizationStartPage anchors the walk there and wraps past the mushaf edge
// so the skipped pages come last. fromEnd uses the surah-backward order above
// (no custom anchor — the UI only offers custom under fromStart).
const memorizationWalkOrder = (user) => {
  if (user.memorizationDirection === 'fromEnd') return FROM_END_ORDER;
  const anchor = user.newMemorizationStartPage || 1;
  const order = new Array(604);
  for (let i = 0; i < 604; i++) order[i] = ((anchor - 1 + i) % 604) + 1;
  return order;
};

// Position of a page along the user's new-memorization walk: 0 for the page the
// walk starts at, increasing in the direction of travel. Lower index = scheduled
// sooner. Used to tie-break same-date pages when picking the continuation page.
const memorizationWalkIndex = (user, pageNumber) => {
  if (user.memorizationDirection === 'fromEnd') return FROM_END_INDEX.get(pageNumber) ?? 0;
  const anchor = user.newMemorizationStartPage || 1;
  return ((pageNumber - anchor) % 604 + 604) % 604;
};

// The next `count` unmemorized pages in the user's memorization order. A page
// with ANY progress (full or partial) counts as memorized here — once started,
// a page leaves the "new" pool and only advances via the half-page flow below
// or a manual edit (Library "mark verses", Settings).
const nextUnmemorizedPages = (user, memorizedSet, count) => {
  const pages = [];
  if (count <= 0) return pages;
  for (const page of memorizationWalkOrder(user)) {
    if (pages.length >= count) break;
    if (!memorizedSet.has(page)) pages.push(page);
  }
  return pages;
};

// Finds the next half-page task: the first page (in the user's memorization
// order) that isn't FULLY memorized yet. A page with no progress gets its first
// half (split at the verse midpoint); a page already holding a first-half
// segment gets the remainder, completing it. `fullSet`/`partialByPage` are
// passed in explicitly (rather than re-derived from a DB query) so this can run
// against the live UserProgress state (getTodayTasks) or a day-by-day simulated
// state (getWeekPlan) with the same logic.
const nextHalfPageTask = (user, fullSet, partialByPage) => {
  for (const pageNumber of memorizationWalkOrder(user)) {
    if (fullSet.has(pageNumber)) continue;
    const meta = PAGE_BY_NUMBER.get(pageNumber);
    if (!meta || !meta.verseKeys.length) continue;

    const existingSegments = partialByPage.get(pageNumber) || [];
    if (existingSegments.length === 0) {
      const mid = Math.ceil(meta.verseKeys.length / 2);
      return { pageNumber, fromVerseKey: meta.verseKeys[0], toVerseKey: meta.verseKeys[mid - 1], half: 1 };
    }

    const remaining = remainderRanges(meta.verseKeys, existingSegments);
    if (!remaining.length) continue; // already full — shouldn't happen, but stay safe
    const [ri, rj] = remaining[0];
    return { pageNumber, fromVerseKey: meta.verseKeys[ri], toVerseKey: meta.verseKeys[rj], half: 2 };
  }
  return null;
};

// Returns QuranMetadata for an array of page numbers, served from the in-memory
// cache (the table is static and only changes on reseed + restart) instead of
// hitting Mongo on every task computation.
const getMetadataMap = (pageNumbers) => getMetadataForPages(pageNumbers);

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
    { pageNumber: 1, memorizedDate: 1, lastReviewedDate: 1, segments: 1 }
  ).sort({ lastReviewedDate: 1, pageNumber: 1 });

  const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
  const totalPagesWithProgress = allMemorizedPages.length;
  const totalMemorized = totalMemorizedFraction(allMemorizedPages);
  const isHafiz = allMemorizedPages.every(p => !p.segments || p.segments.length === 0) && totalPagesWithProgress === 604;
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

  const newPageNumbers = nextUnmemorizedPages(user, memorizedPageNumbers, remainingNewPages);

  // --- REVIEWS DUE TODAY (cycle + recent buckets, mirrors getTodayTasks) ---
  let reviewsDueToday = 0;
  if (!isOffDay) {
    const dailyReviewTarget = user.cycleReviewCount !== null && user.cycleReviewCount !== undefined
      ? user.cycleReviewCount
      : computeDailyReviewTarget(totalPagesWithProgress, user.reviewIntensity || 'standard', isHafiz);

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
    serverError(res, 'Error completing onboarding', error);
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
      const offDayProgress = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, segments: 1 });
      const totalMemorized = totalMemorizedFraction(offDayProgress);
      const fullPages = offDayProgress.filter(p => !p.segments || p.segments.length === 0).length;
      const isHafiz = fullPages === 604;

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
          isHafiz,
          newPages: [], reviewPages: [], extraNewPages: [], extraReviewPages: [],
          recentReviewPages: [], continuationPage: null,
          stats: {
            totalMemorized, fullPages, totalPages: 604,
            percentage: parseFloat(((totalMemorized / 604) * 100).toFixed(1)),
            currentStreak: user.currentStreak || 0,
            dailyNewPages: user.dailyNewPages || 1,
            reviewIntensity: user.reviewIntensity || 'standard',
            recentReviewCount: user.recentReviewCount ?? null,
            cycleReviewCount: user.cycleReviewCount ?? null,
            newPagesCompletedToday: 0, reviewsCompletedToday: 0,
            targetNewPages: 0, dailyReviewTarget: 0,
            newMemorizationComplete: true, reviewComplete: true,
            todayComplete: true, isHafiz,
          },
        },
      });
    }

    // --- LOAD ALL MEMORIZED PAGES ---
    const allMemorizedPages = await UserProgress.find({ userId, status: 'memorized' })
      .sort({ lastReviewedDate: 1, pageNumber: 1 });

    const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
    const totalPagesWithProgress = allMemorizedPages.length;
    const fullPages = allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).length;
    const totalMemorized = totalMemorizedFraction(allMemorizedPages);
    const isHafiz = fullPages === 604;
    const isHalfPagePlan = (user.dailyNewPages || 1) < 1;

    // --- REVIEW TARGET ---
    const dailyReviewTarget = user.cycleReviewCount !== null && user.cycleReviewCount !== undefined
      ? user.cycleReviewCount
      : computeDailyReviewTarget(totalPagesWithProgress, user.reviewIntensity || 'standard', isHafiz);

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

    // --- NEW PAGE / HALF-PAGE TASK ---
    // A half-page plan replaces the whole-page walk with one segment task a day
    // (see nextHalfPageTask); a normal plan keeps walking whole unmemorized pages.
    let newPageNums = [];
    let halfPageTask = null;
    let extraNewPageNums = [];
    if (isHalfPagePlan) {
      if (remainingNewPages > 0) {
        const fullPageSet = new Set(allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).map(p => p.pageNumber));
        const partialByPage = new Map(allMemorizedPages.filter(p => p.segments && p.segments.length > 0).map(p => [p.pageNumber, p.segments]));
        halfPageTask = nextHalfPageTask(user, fullPageSet, partialByPage);
      }
    } else {
      newPageNums = nextUnmemorizedPages(user, memorizedPageNumbers, remainingNewPages);
      // Extra unmemorized pages (for "Want more?" section): the walk's next 3 pages
      // after today's batch — today's batch is a prefix of the same walk, so slice it off.
      extraNewPageNums = nextUnmemorizedPages(user, memorizedPageNumbers, newPageNums.length + 3)
        .slice(newPageNums.length);
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

    // --- CONTINUATION PAGE (paused users: show the most recently memorized page for
    // extra practice). Half-page plans no longer hit targetNewPages === 0 — every
    // active day now gets a half-page task from nextHalfPageTask instead.
    let continuationPageNum = null;
    if (targetNewPages === 0 && !isHafiz) {
      const sortedByMemDate = [...allMemorizedPages]
        .filter(p => p.memorizedDate && getDateString(p.memorizedDate) !== todayString)
        .sort((a, b) => {
          const dateDiff = new Date(b.memorizedDate) - new Date(a.memorizedDate);
          if (dateDiff !== 0) return dateDiff;
          // Same-date pages (e.g. an onboarding batch): the one furthest along the
          // memorization walk is the one the user reached most recently.
          return memorizationWalkIndex(user, b.pageNumber) - memorizationWalkIndex(user, a.pageNumber);
        });
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
      ...(halfPageTask ? [halfPageTask.pageNumber] : []),
    ];
    const metaMap = await getMetadataMap(allPageNumsNeeded);

    // `segmentInfo` attaches a { fromVerseKey, toVerseKey, half } label for
    // half-page tasks, so the dashboard can render "first half (2:1–2:10)".
    const toNewPageDto = (pageNum, segmentInfo = null) => {
      const meta = metaMap[pageNum];
      const dto = {
        pageNumber: pageNum,
        juzNumber: meta?.juzNumber || 1,
        surahName: meta?.surahName || 'Unknown',
        surahNameArabic: meta?.surahNameArabic || '',
        surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        firstVerseKey: meta?.firstVerseKey ?? null,
        lastVerseKey: meta?.lastVerseKey ?? null,
      };
      if (segmentInfo) {
        dto.segment = { fromVerseKey: segmentInfo.fromVerseKey, toVerseKey: segmentInfo.toVerseKey, half: segmentInfo.half };
      }
      return dto;
    };

    const newPageDtos = isHalfPagePlan
      ? (halfPageTask ? [toNewPageDto(halfPageTask.pageNumber, halfPageTask)] : [])
      : newPageNums.map(pg => toNewPageDto(pg));

    const toReviewPageDto = (progress) => {
      const meta = metaMap[progress.pageNumber];
      return {
        pageNumber: progress.pageNumber,
        juzNumber: meta?.juzNumber || 1,
        surahName: meta?.surahName || 'Unknown',
        surahNameArabic: meta?.surahNameArabic || '',
        surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        firstVerseKey: meta?.firstVerseKey ?? null,
        lastVerseKey: meta?.lastVerseKey ?? null,
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
        newPages: newPageDtos,
        reviewPages: reviewPages.map(toReviewPageDto),
        extraNewPages: extraNewPageNums.map(toNewPageDto),
        extraReviewPages: extraReviewPages.map(toReviewPageDto),
        recentReviewPages: cappedRecentPages.map(toReviewPageDto),
        continuationPage: continuationPageNum ? toNewPageDto(continuationPageNum) : null,
        stats: {
          totalMemorized, fullPages, totalPages: 604,
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
    serverError(res, "Error fetching today's tasks", error);
  }
};

// @desc    Mark a page as complete (memorized or reviewed)
// @route   POST /api/progress/complete
// @access  Private
exports.markPageComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pageNumber, type, alreadyKnow, segment } = req.body;

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

      if (segment && typeof segment.fromVerseKey === 'string' && typeof segment.toVerseKey === 'string') {
        // Half-page plans (and any other segment-bearing completion): merge the
        // verse range into whatever progress the page already has instead of
        // overwriting the whole page. Clears segments (becomes a full page) once
        // the merged coverage reaches the page's full verse span.
        const meta = PAGE_BY_NUMBER.get(pageNumber);
        if (!meta) return res.status(400).json({ success: false, message: 'Unknown page' });
        const existing = await UserProgress.findOne({ userId, pageNumber });
        let merged;
        try {
          merged = addRangeToPage(existing?.segments, segment.fromVerseKey, segment.toVerseKey, meta);
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        await UserProgress.findOneAndUpdate(
          { userId, pageNumber },
          {
            $set: { status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate, segments: merged.segments },
            $inc: { reviewCount: 1 },
          },
          { upsert: true, new: true }
        );
      } else {
        await UserProgress.findOneAndUpdate(
          { userId, pageNumber },
          { $set: { status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate, segments: [] }, $inc: { reviewCount: 1 } },
          { upsert: true, new: true }
        );
      }
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
    serverError(res, 'Error marking page complete', error);
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
      // Deletes the whole doc if it was touched today — including any segments.
      // For a half-page plan this means undoing day 2's completion also discards
      // day 1's segment if both happen on the same "today" (same-day undo, the
      // realistic use of this button, is unaffected: there's nothing from a prior
      // day to lose yet).
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
    serverError(res, 'Error undoing completion', error);
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
    serverError(res, 'Error calculating estimate', error);
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
    const totalPagesWithProgress = allMemorizedPages.length;
    const fullPagesCount = allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).length;
    const memorizedPageNumbers = new Set(allMemorizedPages.map(p => p.pageNumber));
    const isHafiz = fullPagesCount === 604;
    const isHalfPagePlan = (user.dailyNewPages || 1) < 1;

    const offDays = user.offDays || [];
    const planStart = user.planStartDate || user.createdAt;
    const dailyNewPages = user.dailyNewPages || 1;
    const reviewIntensity = user.reviewIntensity || 'standard';

    // Build the full list of unmemorized pages in the user's memorization order,
    // so projected days advance in the same direction today's tasks do. Half-page
    // plans instead walk day-by-day below via a simulated full/partial state.
    const unmemorizedPages = (isHafiz || isHalfPagePlan) ? [] : nextUnmemorizedPages(user, memorizedPageNumbers, 604);

    // Simulated progress state for half-page plans: starts from the real DB state
    // and "completes" one segment task per active day as the loop advances, so
    // day 2 correctly shows the remainder of whatever page day 1 started.
    const simFullSet = new Set(allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).map(p => p.pageNumber));
    const simPartialByPage = new Map(allMemorizedPages.filter(p => p.segments && p.segments.length > 0).map(p => [p.pageNumber, p.segments]));
    const applySimTask = (task) => {
      if (!task) return;
      const meta = PAGE_BY_NUMBER.get(task.pageNumber);
      const merged = addRangeToPage(simPartialByPage.get(task.pageNumber), task.fromVerseKey, task.toVerseKey, meta);
      if (merged.full) {
        simFullSet.add(task.pageNumber);
        simPartialByPage.delete(task.pageNumber);
      } else {
        simPartialByPage.set(task.pageNumber, merged.segments);
      }
    };

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
    const segmentByDayIndex = new Map(); // plan array index -> segment task, for half-page days

    // If today's half-page task is still pending, "complete" it in the simulation
    // so tomorrow's preview starts from the remainder/next page, matching how
    // cumulativeNew already skips today's whole-page pick above.
    if (isHalfPagePlan && cumulativeNew > 0) {
      applySimTask(nextHalfPageTask(user, simFullSet, simPartialByPage));
    }

    // Estimate the "recently memorized" review pages each projected day will also
    // carry (pages memorized over the last up to 3 active days), so the week tab's
    // total matches today's cycle-plus-recent figure instead of showing cycle only.
    const maxRecent = user.recentReviewCount !== null && user.recentReviewCount !== undefined
      ? user.recentReviewCount
      : Math.max(3, Math.min(Math.ceil(dailyNewPages * 3), 6));
    const recentNewWindow = [];
    if (!isHafiz && !user.pauseNewMemorization && !isTodayOffDay && todayNewTarget > 0) {
      recentNewWindow.push(isHalfPagePlan ? 0.5 : todayNewTarget);
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
        if (isHalfPagePlan) {
          const task = nextHalfPageTask(user, simFullSet, simPartialByPage);
          if (task) {
            newPagesForDay.push(task.pageNumber);
            pageNumsForMeta.push(task.pageNumber);
            segmentByDayIndex.set(plan.length, task);
            applySimTask(task);
          }
        } else {
          for (let j = 0; j < newTarget && (cumulativeNew + j) < unmemorizedPages.length; j++) {
            const pg = unmemorizedPages[cumulativeNew + j];
            newPagesForDay.push(pg);
            pageNumsForMeta.push(pg);
          }
        }
      }

      // Half-page plans project review load off the CURRENT page count — each
      // task only partially advances a page, so it isn't a reliable "pages added"
      // signal the way a whole-page cumulativeNew is.
      const projectedPagesWithProgress = isHalfPagePlan
        ? totalPagesWithProgress
        : Math.min(604, totalPagesWithProgress + cumulativeNew);
      // Honor a fixed daily review count the same way getTodayTasks does, so the
      // week projection matches today's number instead of falling back to the
      // intensity formula (which made future days show the old intensity).
      const cycleTarget = (user.cycleReviewCount !== null && user.cycleReviewCount !== undefined)
        ? user.cycleReviewCount
        : computeDailyReviewTarget(projectedPagesWithProgress, reviewIntensity, isHafiz);
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
      recentNewWindow.push(isHalfPagePlan ? (newTarget > 0 ? 0.5 : 0) : newTarget);
      while (recentNewWindow.length > 3) recentNewWindow.shift();
    }

    // Fetch metadata for new pages in the plan
    const metaMap = await getMetadataMap(pageNumsForMeta);

    const buildPageInfo = (pg, segmentTask) => {
      const meta = metaMap[pg];
      const info = {
        pageNumber: pg,
        juzNumber: meta?.juzNumber || 1,
        surahName: meta?.surahName || 'Unknown',
        surahNameArabic: meta?.surahNameArabic || '',
        surahs: meta?.surahs ?? [{ name: meta?.surahName ?? 'Unknown', nameArabic: meta?.surahNameArabic ?? '' }],
        firstVerseKey: meta?.firstVerseKey ?? null,
        lastVerseKey: meta?.lastVerseKey ?? null,
      };
      if (segmentTask) {
        info.segment = { fromVerseKey: segmentTask.fromVerseKey, toVerseKey: segmentTask.toVerseKey, half: segmentTask.half };
      }
      return info;
    };

    const enrichedPlan = plan.map((day, idx) => {
      const segmentTask = segmentByDayIndex.get(idx) || null;
      return {
        ...day,
        newPageInfo: day.newPagesForDay?.[0] ? buildPageInfo(day.newPagesForDay[0], segmentTask) : null,
        newPagesInfo: (day.newPagesForDay || []).map(pg => buildPageInfo(pg, segmentTask)),
      };
    });

    res.status(200).json({ success: true, data: enrichedPlan });
  } catch (error) {
    console.error('GetWeekPlan error:', error);
    serverError(res, 'Error fetching week plan', error);
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
    const totalMemorized = totalMemorizedFraction(progress);
    const fullPages = progress.filter(p => !p.segments || p.segments.length === 0).length;
    // Fraction of each partially-memorized page — the client uses this for a
    // "½ memorized" footer-tick state distinct from the plain memorized tick.
    const partialPages = progress
      .filter(p => p.segments && p.segments.length > 0)
      .map(p => ({ pageNumber: p.pageNumber, fraction: pageFraction(p.pageNumber, p.segments) }));

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
        totalMemorized,
        fullPages,
        partialPages,
        percentage: ((totalMemorized / 604) * 100).toFixed(1),
        memorizedByDate,
      },
    });
  } catch (error) {
    console.error('GetAllProgress error:', error);
    serverError(res, 'Error fetching progress', error);
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
            // This editor works in whole pages only — clear any partial segments
            // a page might already carry (Library "mark verses" is where partial
            // coverage is edited verse-exactly).
            $set: { status: 'memorized', segments: [] },
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
    serverError(res, 'Error updating memorized pages', error);
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
    serverError(res, 'Error resetting progress', error);
  }
};

// @desc    Get Juz list with memorization status
// @route   GET /api/progress/juz
// @access  Private
exports.getJuzProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const memorizedProgress = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, lastReviewedDate: 1, segments: 1 });
    const memorizedPages = new Set(memorizedProgress.map(p => p.pageNumber));
    const fractionByPage = Object.fromEntries(memorizedProgress.map(p => [p.pageNumber, pageFraction(p.pageNumber, p.segments)]));
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
      let memorizedInJuz = 0; // fractional — partial pages count by their fraction
      let fullPagesInJuz = 0;
      for (let p = start; p <= end; p++) {
        if (!memorizedPages.has(p)) continue;
        const frac = fractionByPage[p];
        memorizedInJuz += frac;
        if (frac === 1) fullPagesInJuz++;
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
        totalPages, memorizedPages: memorizedInJuz, fullPages: fullPagesInJuz,
        percentage: Math.round((memorizedInJuz / totalPages) * 100),
        isComplete: fullPagesInJuz === totalPages,
        oldestReviewDaysAgo,
      };
    });

    res.status(200).json({ success: true, data: juzProgress });
  } catch (error) {
    console.error('GetJuzProgress error:', error);
    serverError(res, 'Error fetching Juz progress', error);
  }
};

// @desc    Add or remove memorization by unit (Juz, Hizb, ¼-Hizb, Surah, page, or
//          a raw verse range) — the verse-exact counterpart to updateMemorized.
// @route   PUT /api/progress/units
// @access  Private
exports.updateUnits = async (req, res) => {
  try {
    const userId = req.user._id;
    const { action, unit, ref } = req.body;

    if (action !== 'add' && action !== 'remove') {
      return res.status(400).json({ success: false, message: "action must be 'add' or 'remove'" });
    }
    if (!UNIT_TYPES.includes(unit)) {
      return res.status(400).json({ success: false, message: `unit must be one of ${UNIT_TYPES.join(', ')}` });
    }

    let range;
    try {
      range = compileUnitRange(unit, ref);
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    const pageRanges = rangeToPages(range.from, range.to);
    if (!pageRanges.length) {
      return res.status(400).json({ success: false, message: 'No pages found for this selection' });
    }

    const pageNumbers = pageRanges.map(p => p.pageNumber);
    const existingDocs = await UserProgress.find({ userId, pageNumber: { $in: pageNumbers } });
    const existingByPage = new Map(existingDocs.map(d => [d.pageNumber, d]));

    const yesterday = new Date();
    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);

    const bulkOps = [];
    const affectedPages = [];

    for (const pr of pageRanges) {
      const meta = PAGE_BY_NUMBER.get(pr.pageNumber);
      if (!meta) continue;
      const existingDoc = existingByPage.get(pr.pageNumber);
      const existingSegments = existingDoc?.segments;

      if (action === 'add') {
        let merged;
        try {
          merged = addRangeToPage(existingSegments, pr.fromVerseKey, pr.toVerseKey, meta);
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        bulkOps.push({
          updateOne: {
            filter: { userId, pageNumber: pr.pageNumber },
            update: {
              $set: { status: 'memorized', segments: merged.segments },
              $setOnInsert: {
                userId, pageNumber: pr.pageNumber,
                memorizedDate: yesterday, lastReviewedDate: yesterday, reviewCount: 0,
              },
            },
            upsert: true,
          },
        });
        affectedPages.push({ pageNumber: pr.pageNumber, fraction: merged.full ? 1 : pageFraction(pr.pageNumber, merged.segments), full: merged.full });
      } else {
        if (!existingDoc || existingDoc.status !== 'memorized') continue; // nothing to remove
        let result;
        try {
          result = removeRangeFromPage(existingSegments, pr.fromVerseKey, pr.toVerseKey, meta);
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
        if (result.deleted) {
          bulkOps.push({ deleteOne: { filter: { userId, pageNumber: pr.pageNumber } } });
          affectedPages.push({ pageNumber: pr.pageNumber, fraction: 0, full: false, removed: true });
        } else {
          bulkOps.push({
            updateOne: {
              filter: { userId, pageNumber: pr.pageNumber },
              update: { $set: { segments: result.segments } },
            },
          });
          affectedPages.push({ pageNumber: pr.pageNumber, fraction: result.full ? 1 : pageFraction(pr.pageNumber, result.segments), full: result.full });
        }
      }
    }

    if (bulkOps.length) await UserProgress.bulkWrite(bulkOps);

    const allDocs = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, segments: 1 });
    const totalMemorized = totalMemorizedFraction(allDocs);
    const fullPages = allDocs.filter(d => !d.segments || d.segments.length === 0).length;

    res.status(200).json({
      success: true,
      message: action === 'add' ? 'Memorization added' : 'Memorization removed',
      data: {
        affectedPages,
        totalMemorized,
        fullPages,
        percentage: parseFloat(((totalMemorized / 604) * 100).toFixed(1)),
      },
    });
  } catch (error) {
    console.error('UpdateUnits error:', error);
    serverError(res, 'Error updating memorization units', error);
  }
};
