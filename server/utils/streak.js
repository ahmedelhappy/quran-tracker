// Streak rules shared by the progress controller (which moves the streak) and
// the leaderboard (which only shows it).

const MS_PER_DAY = 86400000;

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

// The streak as it stands today. currentStreak is only rewritten on the user's
// next completion, so an account that stopped weeks ago still stores its old
// number; anyone else looking at it should see 0 once a missed working day has
// broken it.
const effectiveStreak = (user) => (isStreakContinued(user.lastActiveDate, user.offDays || [])
  ? user.currentStreak || 0
  : 0);

module.exports = { isStreakContinued, effectiveStreak };
