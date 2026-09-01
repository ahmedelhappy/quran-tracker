const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { serverError } = require('../utils/errorResponse');
const { pageFraction } = require('../utils/segments');
const leaderboardCache = require('../utils/leaderboardCache');

const MS_PER_DAY = 86400000;

// Test hook — the test process is reused across cases, so clear the cache in
// beforeEach or a stale board leaks into the next test.
exports._clearCache = () => leaderboardCache.clear();

// Sum an array of progress docs into a page count, counting partial pages by
// their memorized fraction (segments) and whole pages as 1.
const sumFraction = (docs) =>
  docs.reduce((acc, d) => acc + pageFraction(d.pageNumber, d.segments), 0);

// Build (and cache) the ranked board for a period. Only opted-in users are
// considered; only users with > 0 memorized pages in that period are ranked.
const buildBoard = async (period) => {
  const cached = leaderboardCache.get(period);
  if (cached) return cached;

  const optedIn = await User.find(
    { leaderboardOptIn: true },
    { displayName: 1, currentStreak: 1 }
  );

  let board = [];
  if (optedIn.length) {
    const ids = optedIn.map((u) => u._id);
    const filter = { userId: { $in: ids }, status: 'memorized' };
    if (period === 'week') {
      // The last 7 UTC days (today + the 6 days before it).
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() - 6);
      filter.memorizedDate = { $gte: start };
    }

    const docs = await UserProgress.find(filter, { userId: 1, pageNumber: 1, segments: 1 });
    const byUser = new Map();
    for (const d of docs) {
      const key = String(d.userId);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(d);
    }

    board = optedIn
      .map((u) => ({
        userId: String(u._id),
        displayName: u.displayName || 'Anonymous',
        pages: parseFloat(sumFraction(byUser.get(String(u._id)) || []).toFixed(2)),
        streak: u.currentStreak || 0,
      }))
      .filter((row) => row.pages > 0)
      .sort((a, b) => b.pages - a.pages || b.streak - a.streak)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  leaderboardCache.set(period, board);
  return board;
};

// @desc    Opt-in leaderboard (weekly pages or all-time pages + streak)
// @route   GET /api/leaderboard?period=week|all
// @access  Private
exports.getLeaderboard = async (req, res) => {
  try {
    const period = req.query.period === 'week' ? 'week' : 'all';
    const board = await buildBoard(period);

    const meId = String(req.user._id || req.user.id);
    const myIndex = board.findIndex((r) => r.userId === meId);

    res.status(200).json({
      success: true,
      data: {
        period,
        entries: board.slice(0, 50),
        // The requesting user's own row + rank, even when outside the top 50.
        // null when they aren't opted in or have no pages in this period.
        me: myIndex >= 0 ? board[myIndex] : null,
        meInTop: myIndex >= 0 && myIndex < 50,
        totalRanked: board.length,
      },
    });
  } catch (error) {
    console.error('GetLeaderboard error:', error);
    serverError(res, 'Error building leaderboard', error);
  }
};

// exported for reuse/testing
exports._buildBoard = buildBoard;
