// Cache of the computed leaderboard, one entry per period ('week' | 'all').
//
// Building a board scans every opted-in user's progress documents, so it is
// cached for a few minutes. The cache lives here rather than inside
// leaderboardController because everything that changes a user's page count
// has to invalidate it — progress writes, onboarding, resets — and those
// controllers must not require the leaderboard controller (a cycle waiting to
// happen). They depend on this small module instead.
//
// Single-instance only: with more than one server process each would keep its
// own copy, so a multi-instance deployment moves this to a shared store.

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cache = { week: null, all: null };

// The cached board for a period, or null when absent or expired.
exports.get = (period) => {
  const entry = cache[period];
  if (!entry) return null;
  if (Date.now() - entry.at >= CACHE_TTL) {
    cache[period] = null;
    return null;
  }
  return entry.board;
};

exports.set = (period, board) => {
  cache[period] = { at: Date.now(), board };
};

// Drop every cached period. Called after anything that can change a rank:
// completing or undoing a page, editing the memorized set, marking verses,
// onboarding, resetting progress, and joining/leaving the board or renaming.
exports.clear = () => {
  cache.week = null;
  cache.all = null;
};

exports.CACHE_TTL = CACHE_TTL;
