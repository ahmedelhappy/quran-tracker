const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const { serverError } = require('../utils/errorResponse');
const { pageFraction } = require('../utils/segments');
const { MIN_PAGE, MAX_PAGE } = require('../utils/pageNumbers');
const { effectiveStreak } = require('../utils/streak');
const leaderboardCache = require('../utils/leaderboardCache');

// Test hook — the test process is reused across cases, so clear the cache in
// beforeEach or a stale board leaks into the next test.
exports._clearCache = () => leaderboardCache.clear();

// Pages per opted-in user, counted in MongoDB instead of loading every progress
// document into the process (M-22). Whole pages are summed there; only partial
// pages — a handful per user — come back with their segments, because their
// fraction needs the verse counts of the mushaf structure. Only real pages count:
// an integer from 1 to 604 (rows stored before page validation, M-01, can't
// inflate the board).
const pagesByUser = async (ids, period) => {
  const match = {
    userId: { $in: ids },
    status: 'memorized',
    pageNumber: { $gte: MIN_PAGE, $lte: MAX_PAGE },
    $expr: { $cond: [{ $isNumber: '$pageNumber' }, { $eq: ['$pageNumber', { $trunc: '$pageNumber' }] }, false] },
  };
  if (period === 'week') {
    // The last 7 UTC days (today + the 6 days before it).
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 6);
    match.memorizedDate = { $gte: start };
  }

  const isPartial = { $gt: [{ $size: { $ifNull: ['$segments', []] } }, 0] };
  const rows = await UserProgress.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        fullPages: { $sum: { $cond: [isPartial, 0, 1] } },
        partial: { $push: { $cond: [isPartial, { pageNumber: '$pageNumber', segments: '$segments' }, '$$REMOVE'] } },
      },
    },
  ]);

  const pages = new Map();
  for (const row of rows) {
    const fraction = row.partial.reduce((sum, p) => sum + pageFraction(p.pageNumber, p.segments), 0);
    pages.set(String(row._id), row.fullPages + fraction);
  }
  return pages;
};

// Build (and cache) the ranked board for a period. Only opted-in users are
// considered; only users with > 0 memorized pages in that period are ranked.
// Rows keep the userId internally (to find the caller's own row); it never
// leaves this module — see publicRow.
const buildBoard = async (period) => {
  const cached = leaderboardCache.get(period);
  if (cached) return cached;

  // Served by the partial index on leaderboardOptIn (see the User model).
  const optedIn = await User.find(
    { leaderboardOptIn: true },
    { displayName: 1, currentStreak: 1, lastActiveDate: 1, offDays: 1 }
  ).lean();

  let board = [];
  if (optedIn.length) {
    const pages = await pagesByUser(optedIn.map((u) => u._id), period);
    board = optedIn
      .map((u) => ({
        userId: String(u._id),
        displayName: u.displayName || 'Anonymous',
        pages: parseFloat((pages.get(String(u._id)) || 0).toFixed(2)),
        // The streak as it stands today, not the stored number: an account that
        // stopped weeks ago would otherwise keep showing its old streak.
        streak: effectiveStreak(u),
      }))
      .filter((row) => row.pages > 0)
      .sort((a, b) => b.pages - a.pages || b.streak - a.streak)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  leaderboardCache.set(period, board);
  return board;
};

// What other users see of a row. The displayName is the only public identity
// (see the User model); the internal userId is replaced by whether the row is
// the caller's own.
const publicRow = (row, meId) => ({
  displayName: row.displayName,
  pages: row.pages,
  streak: row.streak,
  rank: row.rank,
  isMe: row.userId === meId,
});

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
        entries: board.slice(0, 50).map((row) => publicRow(row, meId)),
        // The requesting user's own row + rank, even when outside the top 50.
        // null when they aren't opted in or have no pages in this period.
        me: myIndex >= 0 ? publicRow(board[myIndex], meId) : null,
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
