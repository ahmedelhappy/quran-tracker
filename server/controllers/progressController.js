const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { getMetadataForPages } = require('../utils/quranMetadataCache');
const { serverError } = require('../utils/errorResponse');
const { PAGE_RULE, toPageNumber, parsePageList } = require('../utils/pageNumbers');
// Every write below changes how many pages this user has memorized, which is
// exactly what the leaderboard ranks — so each one drops the cached board.
// Without this the board keeps serving a stale rank for up to its whole TTL.
const leaderboardCache = require('../utils/leaderboardCache');
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

// The next `count` new-memorization items in the user's walk order, SEGMENT-AWARE.
// This is the single source of truth for "what to memorize next" and the fix for
// the half-page bugs: a PARTIALLY-memorized page is never treated as done — it
// always contributes its REMAINING segment first (completing it), before the walk
// moves on. Only then does the walk pick up fresh pages.
//   granularity 'full'  → a fresh page is a whole-page item ({ pageNumber } only)
//   granularity 'half'  → a fresh page is split at the verse midpoint (first half)
// A partial page's remainder is a segment item under BOTH granularities. So after
// switching a 0.5/day plan to 1 page/day, the half-finished page's REMAINDER is the
// next task (we chose "remainder only" — it completes the page cleanly without
// fragmenting the next page into halves under a whole-page plan; see the report).
// `fullSet`/`partialByPage` are passed in so this runs against the live state or a
// day-by-day simulated state (getWeekPlan) with identical logic.
const nextNewItems = (user, fullSet, partialByPage, count, granularity) => {
  const items = [];
  if (count <= 0) return items;
  const simFull = new Set(fullSet);
  const simPartial = new Map(partialByPage);
  while (items.length < count) {
    let picked = null;
    for (const pageNumber of memorizationWalkOrder(user)) {
      if (simFull.has(pageNumber)) continue;
      const meta = PAGE_BY_NUMBER.get(pageNumber);
      if (!meta || !meta.verseKeys.length) continue;

      const seg = simPartial.get(pageNumber);
      if (seg && seg.length) {
        // Partial page → serve the remainder (completes it), regardless of plan.
        const remaining = remainderRanges(meta.verseKeys, seg);
        if (!remaining.length) { simFull.add(pageNumber); simPartial.delete(pageNumber); continue; }
        const [ri, rj] = remaining[0];
        picked = { pageNumber, fromVerseKey: meta.verseKeys[ri], toVerseKey: meta.verseKeys[rj], half: 2 };
        simFull.add(pageNumber); simPartial.delete(pageNumber);
        break;
      }
      if (granularity === 'half') {
        const mid = Math.ceil(meta.verseKeys.length / 2);
        picked = { pageNumber, fromVerseKey: meta.verseKeys[0], toVerseKey: meta.verseKeys[mid - 1], half: 1 };
        simPartial.set(pageNumber, [{ from: meta.verseKeys[0], to: meta.verseKeys[mid - 1] }]);
        break;
      }
      picked = { pageNumber }; // fresh whole page (no segment)
      simFull.add(pageNumber);
      break;
    }
    if (!picked) break;
    items.push(picked);
  }
  return items;
};

// The single next half-page task (getWeekPlan's day-by-day simulation uses this).
const nextHalfPageTask = (user, fullSet, partialByPage) =>
  nextNewItems(user, fullSet, partialByPage, 1, 'half')[0] || null;

// Returns QuranMetadata for an array of page numbers, served from the in-memory
// cache (the table is static and only changes on reseed + restart) instead of
// hitting Mongo on every task computation.
const getMetadataMap = (pageNumbers) => getMetadataForPages(pageNumbers);

// What today holds for a user who is NOT on an off day, computed from their
// memorized-page docs (sorted by lastReviewedDate, then pageNumber). Pure: no
// queries, no writes. This is the ONE place the day's plan is decided — the
// dashboard (getTodayTasks) and the assistant's summary (buildProgressSummary)
// both read it, so the assistant can never name a different next page than the
// dashboard shows. (It used to: the summary walked whole pages while the
// dashboard served a partly memorized page's remainder first.)
const planToday = (user, allMemorizedPages, now = new Date()) => {
  const todayString = getDateString(now);
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
    targetNewPages = computeNewPageTargetForDate(user.dailyNewPages || 1, planStart, now);
  }

  // Pages memorized today
  const newPagesCompletedToday = allMemorizedPages.filter(
    p => p.memorizedDate && getDateString(p.memorizedDate) === todayString
  ).length;

  const remainingNewPages = Math.max(0, targetNewPages - newPagesCompletedToday);

  // --- NEW PAGE ITEMS (segment-aware) ---
  // One generator drives both plans: a half-page plan splits fresh pages into
  // halves, a whole-page plan takes them whole — and BOTH always finish a
  // partially-memorized page's remainder first (so switching 0.5 → 1 page/day
  // never skips the leftover half). Extras ("Want more?") are the next items
  // beyond today's due batch — segment-aware too, so a 0.5/day plan offers the
  // next new half rather than falling back to review-only.
  const granularity = isHalfPagePlan ? 'half' : 'full';
  const fullPageSet = new Set(allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).map(p => p.pageNumber));
  const partialByPage = new Map(allMemorizedPages.filter(p => p.segments && p.segments.length > 0).map(p => [p.pageNumber, p.segments]));
  const newItems = nextNewItems(user, fullPageSet, partialByPage, remainingNewPages, granularity);
  const extraItems = nextNewItems(user, fullPageSet, partialByPage, newItems.length + 3, granularity)
    .slice(newItems.length);

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

  return {
    totalPagesWithProgress, fullPages, totalMemorized, isHafiz,
    dailyReviewTarget, targetNewPages, newPagesCompletedToday,
    newItems, extraItems,
    recentPool, pagesForReview, reviewsCompletedToday,
    reviewPages, extraReviewPages, cappedRecentPages,
    continuationPageNum,
  };
};

// Whether a (non-off) day's plan is done, from planToday's result. Shared by the
// dashboard's stats and the streak check-in so the two can never disagree about
// what "nothing left to do today" means. viewOnlyComplete adds the hafiz whose
// review target is 0: no work at all, which counts as a finished day.
const dayCompletion = (plan) => {
  const newMemorizationComplete = plan.isHafiz || plan.newPagesCompletedToday >= plan.targetNewPages;
  const reviewComplete = plan.reviewsCompletedToday >= plan.dailyReviewTarget || plan.pagesForReview.length === 0;
  const todayComplete = plan.totalMemorized > 0 && newMemorizationComplete && reviewComplete;
  const viewOnlyComplete = todayComplete || (plan.isHafiz && plan.dailyReviewTarget === 0);
  return { newMemorizationComplete, reviewComplete, todayComplete, viewOnlyComplete };
};

// Builds a compact, read-only snapshot of a user's plan & progress for the AI
// assistant's context: counts plus the exact items today holds, small enough to
// inject into a prompt. The plan itself comes from planToday, exactly as the
// dashboard's does. Runs a single lightweight query and performs no writes.
const buildProgressSummary = async (user) => {
  const userId = user._id;
  const offDays = user.offDays || [];
  const isOffDay = offDays.includes(new Date().getUTCDay());

  const allMemorizedPages = await UserProgress.find(
    { userId, status: 'memorized' },
    { pageNumber: 1, memorizedDate: 1, lastReviewedDate: 1, segments: 1 }
  ).sort({ lastReviewedDate: 1, pageNumber: 1 });

  const plan = planToday(user, allMemorizedPages);
  const { totalMemorized, isHafiz } = plan;
  const percentage = parseFloat(((totalMemorized / 604) * 100).toFixed(1));

  // An off day holds nothing — the same answer getTodayTasks gives.
  const newItems = isOffDay ? [] : plan.newItems.map((it) => (it.fromVerseKey
    ? { pageNumber: it.pageNumber, fromVerseKey: it.fromVerseKey, toVerseKey: it.toVerseKey, half: it.half }
    : { pageNumber: it.pageNumber }));
  const reviewPageNumbers = isOffDay ? [] : plan.reviewPages.map((p) => p.pageNumber);
  const recentReviewPageNumbers = isOffDay ? [] : plan.cappedRecentPages.map((p) => p.pageNumber);

  return {
    name: user.name,
    dailyNewPages: user.dailyNewPages || 1,
    isOffDay,
    isHafiz,
    pauseNewMemorization: !!user.pauseNewMemorization,
    currentStreak: user.currentStreak || 0,
    totalMemorized,
    totalPages: 604,
    pagesLeft: 604 - totalMemorized,
    percentage,
    newPagesDueToday: newItems.length,
    newPageNumbers: newItems.map((it) => it.pageNumber),
    newItems,
    reviewsDueToday: reviewPageNumbers.length + recentReviewPageNumbers.length,
    reviewPageNumbers,
    recentReviewPageNumbers,
    continuationPage: isOffDay ? null : plan.continuationPageNum,
  };
};

exports.buildProgressSummary = buildProgressSummary;

// @desc    Complete onboarding - save initial progress
// @route   POST /api/progress/onboarding
// @access  Private
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dailyNewPages } = req.body;

    // Checked before anything is written, so a bad list leaves the account as it was.
    let memorizedPages = [];
    if (req.body.memorizedPages !== undefined) {
      const parsed = parsePageList(req.body.memorizedPages, 'memorizedPages');
      if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
      memorizedPages = parsed.pages;
    }

    const dailyGoal = Math.min(Math.max(parseFloat(dailyNewPages) || 1, 0.5), 10);

    await User.findByIdAndUpdate(userId, {
      dailyNewPages: dailyGoal,
      onboardingComplete: true,
      planStartDate: new Date(),
    });

    if (memorizedPages.length > 0) {
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

    leaderboardCache.clear();

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        dailyNewPages: dailyGoal,
        memorizedCount: memorizedPages.length,
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

    const offDays = user.offDays || [];
    const ignoreOffDay = req.query.ignoreOffDay === 'true';

    // --- OFF DAY ---
    if (!ignoreOffDay && offDays.includes(new Date().getUTCDay())) {
      const offDayProgress = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, segments: 1 });
      const totalMemorized = totalMemorizedFraction(offDayProgress);
      const fullPages = offDayProgress.filter(p => !p.segments || p.segments.length === 0).length;
      const isHafiz = fullPages === 604;

      // No streak tick here any more: reading the plan writes nothing (L-10).
      // The dashboard's POST /progress/checkin keeps a rest day's streak alive.
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

    // The day's plan — decided in one place, shared with the assistant's summary.
    const plan = planToday(user, allMemorizedPages);
    const {
      fullPages, totalMemorized, isHafiz,
      dailyReviewTarget, targetNewPages, newPagesCompletedToday,
      newItems, extraItems,
      recentPool, pagesForReview, reviewsCompletedToday,
      reviewPages, extraReviewPages, cappedRecentPages,
      continuationPageNum,
    } = plan;

    // --- CONSTANT DAILY REVIEW TARGETS ---
    // How many pages the day STARTED with for each bucket, independent of how many
    // are already done — so the dashboard's "Daily Review" stat reads a stable
    // "this is your daily load" number instead of counting down to zero as the user
    // ticks pages off. Recent counts the recent-window pages due today (including any
    // already reviewed); cycle is the target capped by how many cycle pages exist.
    const cycleReviewTarget = Math.min(dailyReviewTarget, pagesForReview.length);
    const recentReviewTarget = recentPool.length;
    const dailyReviewTotal = cycleReviewTarget + recentReviewTarget;

    // --- METADATA (batched) ---
    const allPageNumsNeeded = [
      ...newItems.map(it => it.pageNumber), ...extraItems.map(it => it.pageNumber),
      ...reviewPages.map(p => p.pageNumber),
      ...extraReviewPages.map(p => p.pageNumber),
      ...cappedRecentPages.map(p => p.pageNumber),
      ...(continuationPageNum ? [continuationPageNum] : []),
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

    // A segment item (fromVerseKey present) carries its verse range; a fresh
    // whole-page item ({ pageNumber } only) becomes a plain whole-page DTO.
    const itemToDto = (it) => toNewPageDto(it.pageNumber, it.fromVerseKey ? it : null);
    const newPageDtos = newItems.map(itemToDto);
    const extraNewPageDtos = extraItems.map(itemToDto);

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
    const { newMemorizationComplete, reviewComplete, todayComplete } = dayCompletion(plan);

    const activeDaysPerWeek = 7 - offDays.length;
    const effectiveDailyPages = (user.dailyNewPages || 1) * (activeDaysPerWeek / 7);
    const estimatedDays = !isHafiz && effectiveDailyPages > 0
      ? Math.ceil((604 - totalMemorized) / effectiveDailyPages)
      : 0;

    // No streak tick here any more: reading the plan writes nothing (L-10).
    // A day with nothing left to do keeps the streak through POST /progress/checkin.

    res.status(200).json({
      success: true,
      data: {
        isOffDay: false,
        isHafiz,
        firstCycleComplete,
        newPages: newPageDtos,
        reviewPages: reviewPages.map(toReviewPageDto),
        extraNewPages: extraNewPageDtos,
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

// @desc    Streak check-in after the dashboard has shown today's plan
// @route   POST /api/progress/checkin  { ignoreOffDay? }
// @access  Private
//
// A rest day, and a day with nothing left to do, keep the streak alive when the
// user opens the app: lastActiveDate moves to today without raising the count,
// so tomorrow's completion continues the streak. This used to happen inside
// GET /progress/today — a read with a side effect, which any prefetch, retry or
// second caller could trigger (L-10). The decision is unchanged, made from the
// same planToday/dayCompletion the GET uses; only the write moved here. The
// pre-tick streak and date are kept (as markPageComplete does) so a later undo
// that leaves no completions today can restore them.
exports.checkIn = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const now = new Date();
    const todayString = getDateString(now);
    const offDays = user.offDays || [];
    const ignoreOffDay = req.body.ignoreOffDay === true;

    // Never tick for a user who has never been active, or twice in a day, or
    // onto a streak that is already broken.
    let ticked = false;
    if (user.lastActiveDate && getDateString(user.lastActiveDate) !== todayString
        && isStreakContinued(user.lastActiveDate, offDays)) {
      let qualifies = !ignoreOffDay && offDays.includes(now.getUTCDay());
      if (!qualifies) {
        const allMemorizedPages = await UserProgress.find({ userId, status: 'memorized' })
          .sort({ lastReviewedDate: 1, pageNumber: 1 });
        qualifies = dayCompletion(planToday(user, allMemorizedPages, now)).viewOnlyComplete;
      }
      if (qualifies) {
        // Conditional on the date just read: a completion that lands in between
        // has already moved lastActiveDate to today and saved its own snapshot,
        // which this must not overwrite.
        const result = await User.updateOne(
          { _id: userId, lastActiveDate: user.lastActiveDate },
          { $set: { lastActiveDate: now, prevStreak: user.currentStreak || 0, prevActiveDate: user.lastActiveDate } }
        );
        ticked = result.modifiedCount === 1;
      }
    }

    res.status(200).json({ success: true, data: { ticked, currentStreak: user.currentStreak || 0 } });
  } catch (error) {
    console.error('CheckIn error:', error);
    serverError(res, 'Error checking in', error);
  }
};

// The verse range today's plan serves for this page, when recording the whole
// page instead would credit more than the plan assigned — a half-page plan's
// fresh half. Null when the plan is whole-page or doesn't serve the page as a
// part. Uses the same planToday the dashboard reads, so it names exactly the
// segment the dashboard showed.
const scheduledPartialSegment = async (user, pageNumber, existing, meta, now) => {
  if ((user.dailyNewPages || 1) >= 1) return null;
  const allMemorizedPages = await UserProgress.find(
    { userId: user._id, status: 'memorized' },
    { pageNumber: 1, memorizedDate: 1, lastReviewedDate: 1, segments: 1 }
  ).sort({ lastReviewedDate: 1, pageNumber: 1 });
  const plan = planToday(user, allMemorizedPages, now);
  for (const item of [...plan.newItems, ...plan.extraItems]) {
    if (item.pageNumber !== pageNumber || !item.fromVerseKey) continue;
    // A remainder that finishes the page records the same thing as the whole page.
    if (addRangeToPage(existing?.segments, item.fromVerseKey, item.toVerseKey, meta).full) continue;
    return { fromVerseKey: item.fromVerseKey, toVerseKey: item.toVerseKey, half: item.half };
  }
  return null;
};

// @desc    Mark a page as complete (memorized or reviewed)
// @route   POST /api/progress/complete
// @access  Private
exports.markPageComplete = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, alreadyKnow, segment, wholePage } = req.body;

    const pageNumber = toPageNumber(req.body.pageNumber);
    if (pageNumber === null) {
      return res.status(400).json({ success: false, message: `pageNumber ${PAGE_RULE}` });
    }

    const now = new Date();

    if (type === 'new') {
      // alreadyKnow: true → back-date memorizedDate to yesterday so the page doesn't
      // count against today's new-page quota, freeing today's slot for the next page.
      const memorizedDate = alreadyKnow
        ? (() => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - 1); d.setUTCHours(0, 0, 0, 0); return d; })()
        : now;

      const meta = PAGE_BY_NUMBER.get(pageNumber);
      if (!meta) return res.status(400).json({ success: false, message: 'Unknown page' });

      // A segment that is sent must be well formed. It used to fall through to
      // the whole-page branch when it wasn't, crediting the whole page (H-03).
      const hasSegment = segment !== undefined && segment !== null;
      if (hasSegment && (typeof segment.fromVerseKey !== 'string' || typeof segment.toVerseKey !== 'string')) {
        return res.status(400).json({ success: false, message: 'segment must have string fromVerseKey and toVerseKey' });
      }

      const existing = await UserProgress.findOne({ userId, pageNumber });

      // A page that is already fully memorized cannot be memorized again: doing
      // so restamped it as new today (eating today's quota with an old page), a
      // segment would shrink it back to a part, and undoing it deleted the page's
      // whole history (L-11). The client's view was stale; nothing is written.
      if (existing && existing.status === 'memorized' && (!existing.segments || existing.segments.length === 0)) {
        return res.status(409).json({ success: false, code: 'ALREADY_MEMORIZED', message: `Page ${pageNumber} is already memorized` });
      }

      // No segment on a page today's plan serves as half a page: refuse rather
      // than credit the whole page. Recording the whole page silently skipped
      // the page's second half for good and inflated every total (H-03). A caller
      // that really means the whole page says so with wholePage (the Library's
      // "mark page memorized") or alreadyKnow ("I already know this page").
      if (!hasSegment && !wholePage && !alreadyKnow) {
        const scheduled = await scheduledPartialSegment(req.user, pageNumber, existing, meta, now);
        if (scheduled) {
          return res.status(400).json({
            success: false,
            code: 'SEGMENT_REQUIRED',
            message: `Today's plan serves page ${pageNumber} as part of a page — send its segment, or wholePage: true`,
            data: { segment: scheduled },
          });
        }
      }

      // With a segment (half-page plans): merge the verse range into whatever
      // progress the page already has instead of overwriting the whole page.
      // Clears segments (becomes a full page) once the merged coverage reaches
      // the page's full verse span. Without one: the whole page.
      let segments = [];
      if (hasSegment) {
        try {
          segments = addRangeToPage(existing?.segments, segment.fromVerseKey, segment.toVerseKey, meta).segments;
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
      }
      // What undo restores: the earlier part of a partly memorized page, or
      // nothing at all when this completion creates the document.
      const undo = existing
        ? {
          kind: 'new', at: now, existed: true,
          status: existing.status, memorizedDate: existing.memorizedDate,
          lastReviewedDate: existing.lastReviewedDate, reviewCount: existing.reviewCount,
          segments: (existing.segments || []).map(s => ({ from: s.from, to: s.to })),
        }
        : { kind: 'new', at: now, existed: false };
      await UserProgress.findOneAndUpdate(
        { userId, pageNumber },
        { $set: { status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate, segments, undo }, $inc: { reviewCount: 1 } },
        { upsert: true, runValidators: true }
      );
    } else if (type === 'review') {
      const existing = await UserProgress.findOne({ userId, pageNumber, status: 'memorized' });
      if (!existing) {
        return res.status(400).json({ success: false, message: 'Page not found or not memorized yet' });
      }
      // Keep the review it replaces, so undo restores the real previous date
      // (possibly "never reviewed") rather than inventing yesterday.
      const undo = {
        kind: 'review', at: now, existed: true,
        lastReviewedDate: existing.lastReviewedDate, reviewCount: existing.reviewCount,
      };
      await UserProgress.updateOne(
        { _id: existing._id },
        { $set: { lastReviewedDate: now, undo }, $inc: { reviewCount: 1 } }
      );
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

    leaderboardCache.clear();

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
    const { type } = req.body;

    const pageNumber = toPageNumber(req.body.pageNumber);
    if (pageNumber === null) {
      return res.status(400).json({ success: false, message: `pageNumber ${PAGE_RULE}` });
    }

    if (type !== 'new' && type !== 'review') {
      return res.status(400).json({ success: false, message: 'type must be "new" or "review"' });
    }

    const todayString = getDateString(new Date());
    const progress = await UserProgress.findOne({ userId, pageNumber }).select('+undo');
    // The snapshot markPageComplete left, if it belongs to a completion of this
    // kind made today (see the model). Without one — a completion recorded
    // before snapshots existed — fall back to the old behaviour below.
    const snap = progress?.undo;
    const snapToday = !!snap && snap.kind === type && getDateString(snap.at) === todayString;

    if (type === 'new') {
      if (!progress || !progress.memorizedDate || getDateString(progress.memorizedDate) !== todayString) {
        return res.status(400).json({ success: false, message: 'Page was not memorized today' });
      }
      if (snapToday && snap.existed) {
        // The page had progress before today's completion (e.g. its first half,
        // memorized on an earlier day): put that back instead of deleting it.
        await UserProgress.updateOne(
          { _id: progress._id },
          {
            $set: {
              status: snap.status || 'memorized',
              memorizedDate: snap.memorizedDate ?? null,
              lastReviewedDate: snap.lastReviewedDate ?? null,
              reviewCount: snap.reviewCount ?? 0,
              segments: (snap.segments || []).map(s => ({ from: s.from, to: s.to })),
            },
            $unset: { undo: 1 },
          }
        );
      } else {
        // Today's completion created the page's progress: undoing removes it.
        await UserProgress.deleteOne({ _id: progress._id });
      }
    } else {
      if (!progress || progress.status !== 'memorized') {
        return res.status(400).json({ success: false, message: 'Page not found or not memorized' });
      }
      if (!progress.lastReviewedDate || getDateString(progress.lastReviewedDate) !== todayString) {
        return res.status(400).json({ success: false, message: 'Page was not reviewed today' });
      }
      let restored;
      if (snapToday) {
        restored = { lastReviewedDate: snap.lastReviewedDate ?? null, reviewCount: snap.reviewCount ?? 0 };
      } else {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        yesterday.setUTCHours(0, 0, 0, 0);
        restored = { lastReviewedDate: yesterday, reviewCount: Math.max(0, (progress.reviewCount || 0) - 1) };
      }
      await UserProgress.updateOne({ _id: progress._id }, { $set: restored, $unset: { undo: 1 } });
    }

    const currentStreak = await reconcileStreakAfterUndo(userId);

    leaderboardCache.clear();

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

    // Partial pages count by their memorized fraction, as in every other stat —
    // counting documents made half a page look like a whole one here alone (L-11).
    // Two decimals keep float noise out of remainingPages (0 must stay exactly 0).
    const progress = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, segments: 1 });
    const totalMemorized = parseFloat(totalMemorizedFraction(progress).toFixed(2));
    const remainingPages = parseFloat((604 - totalMemorized).toFixed(2));

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

    // Simulated progress state for half-page plans: starts from the real DB state
    // and "completes" one segment task per active day as the loop advances, so
    // day 2 correctly shows the remainder of whatever page day 1 started.
    const simFullSet = new Set(allMemorizedPages.filter(p => !p.segments || p.segments.length === 0).map(p => p.pageNumber));
    const simPartialByPage = new Map(allMemorizedPages.filter(p => p.segments && p.segments.length > 0).map(p => [p.pageNumber, p.segments]));

    // The whole-page projection now walks the SAME segment-aware generator, so a
    // partial page's remainder is scheduled first (a plan switched 0.5 → 1 doesn't
    // skip it in the week view either).
    const unmemorizedPages = (isHafiz || isHalfPagePlan)
      ? []
      : nextNewItems(user, simFullSet, simPartialByPage, 604, 'full').map(it => it.pageNumber);
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
    // Each partially-memorized page: the fraction (the reader's "½ memorized"
    // footer tick) AND the exact verse ranges behind it. The ranges are what lets
    // the memorized-pages editors seed themselves EXACTLY — without them they can
    // only see "page 315 has something on it", and saving would round that back up
    // to the whole page and destroy the verse-exact selection.
    const partialPages = progress
      .filter(p => p.segments && p.segments.length > 0)
      .map(p => ({
        pageNumber: p.pageNumber,
        fraction: pageFraction(p.pageNumber, p.segments),
        segments: p.segments.map(s => ({ from: s.from, to: s.to })),
      }));

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

// Start of yesterday (UTC) — the date given to pages added through an editor, so
// they land in today's review queue rather than counting as today's new pages.
const startOfYesterdayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
};

// @desc    Update memorized pages — replace existing set (add new, delete removed)
// @route   PUT /api/progress/memorized
// @access  Private
//
// A replace deletes every page the client left out, so a client whose view is
// stale (another tab or device marked pages since it loaded) or empty (its load
// failed) would wipe real progress — dates, review counts — with one save (H-02).
// Deleting is therefore explicit: the request must list, in confirmRemoval,
// every page it expects the replace to delete. If the server would delete any
// page the client did not name, nothing is written and the answer is a 409
// carrying the pages it would have removed, for the client to show and confirm.
// A save that only adds pages needs no confirmation.
exports.updateMemorized = async (req, res) => {
  try {
    const userId = req.user._id;
    // An invalid entry is a 400, not silently dropped: dropping it would delete
    // whatever page the client meant by it.
    const parsed = parsePageList(req.body.memorizedPages, 'memorizedPages');
    if (parsed.error) return res.status(400).json({ success: false, message: parsed.error });
    const newPageSet = new Set(parsed.pages);

    const confirmed = parsePageList(req.body.confirmRemoval ?? [], 'confirmRemoval');
    if (confirmed.error) return res.status(400).json({ success: false, message: confirmed.error });
    const confirmedSet = new Set(confirmed.pages);

    const current = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1 });
    const wouldRemove = current.map(d => d.pageNumber).filter(p => !newPageSet.has(p)).sort((a, b) => a - b);
    const unconfirmed = wouldRemove.filter(p => !confirmedSet.has(p));
    if (unconfirmed.length) {
      return res.status(409).json({
        success: false,
        code: 'CONFIRM_REMOVAL',
        message: `This would remove ${wouldRemove.length} memorized page(s) the request did not confirm`,
        data: { wouldRemove, unconfirmed },
      });
    }

    // Delete exactly the confirmed pages computed above — never "everything not
    // in the list", which would also catch a page marked since the read.
    if (wouldRemove.length) {
      await UserProgress.deleteMany({ userId, status: 'memorized', pageNumber: { $in: wouldRemove } });
    }

    if (newPageSet.size > 0) {
      const yesterday = startOfYesterdayUTC();

      const bulkOps = Array.from(newPageSet).map(pageNumber => ({
        updateOne: {
          filter: { userId, pageNumber },
          update: {
            // Whole-page editor: a NEWLY added page becomes a full page (segments
            // set to [] on insert), but a page that is ALREADY memorized keeps
            // whatever segments it carries — so a ½-memorized page that stays in
            // the set is never silently promoted to a full page by an unrelated
            // save. Verse-exact coverage is edited in the Library "mark verses"
            // flow; this endpoint only adds/removes whole pages.
            $set: { status: 'memorized' },
            $setOnInsert: {
              userId,
              pageNumber,
              segments: [],
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

    leaderboardCache.clear();

    res.status(200).json({
      success: true,
      message: 'Memorized pages updated',
      data: { memorizedCount: newPageSet.size, removed: wouldRemove },
    });
  } catch (error) {
    console.error('UpdateMemorized error:', error);
    serverError(res, 'Error updating memorized pages', error);
  }
};

// @desc    Add and/or remove whole pages without replacing the set
// @route   PATCH /api/progress/memorized  { add?: [pages], remove?: [pages] }
// @access  Private
//
// The delta counterpart to the replace above, for single-page ticks and editors
// that know exactly which pages the user changed: only the named pages are
// touched, so a stale or failed load can never cost the user any other page.
// "add" makes the whole page memorized (a partly memorized page is completed, a
// page already full is left as it is, a new page is dated yesterday like the
// editor's); "remove" deletes the page's progress, full or partial.
exports.changeMemorized = async (req, res) => {
  try {
    const userId = req.user._id;
    const add = parsePageList(req.body.add ?? [], 'add');
    if (add.error) return res.status(400).json({ success: false, message: add.error });
    const remove = parsePageList(req.body.remove ?? [], 'remove');
    if (remove.error) return res.status(400).json({ success: false, message: remove.error });
    const removeSet = new Set(remove.pages);
    const both = add.pages.filter(p => removeSet.has(p));
    if (both.length) {
      return res.status(400).json({ success: false, message: `A page cannot be both added and removed (${both.join(', ')})` });
    }
    if (!add.pages.length && !remove.pages.length) {
      return res.status(400).json({ success: false, message: 'Nothing to change: send add and/or remove' });
    }

    const yesterday = startOfYesterdayUTC();
    const bulkOps = [
      ...add.pages.map(pageNumber => ({
        updateOne: {
          filter: { userId, pageNumber },
          update: {
            $set: { status: 'memorized', segments: [] },
            $setOnInsert: { userId, pageNumber, memorizedDate: yesterday, lastReviewedDate: yesterday, reviewCount: 0 },
          },
          upsert: true,
        },
      })),
      ...(remove.pages.length ? [{ deleteMany: { filter: { userId, pageNumber: { $in: remove.pages } } } }] : []),
    ];
    await UserProgress.bulkWrite(bulkOps, { ordered: true });

    leaderboardCache.clear();

    const allDocs = await UserProgress.find({ userId, status: 'memorized' }, { pageNumber: 1, segments: 1 });
    const totalMemorized = totalMemorizedFraction(allDocs);
    res.status(200).json({
      success: true,
      message: 'Memorized pages updated',
      data: {
        added: add.pages,
        removed: remove.pages,
        totalMemorized,
        fullPages: allDocs.filter(d => !d.segments || d.segments.length === 0).length,
        percentage: parseFloat(((totalMemorized / 604) * 100).toFixed(1)),
      },
    });
  } catch (error) {
    console.error('ChangeMemorized error:', error);
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

    leaderboardCache.clear();

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

    leaderboardCache.clear();

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
