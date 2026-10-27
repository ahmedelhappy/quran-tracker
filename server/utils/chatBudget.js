// A per-user DAILY cap on assistant messages, on top of the short-window
// chatLimiter (20 per 5 minutes). The short window stops bursts; this stops one
// account from running up the Groq bill by chatting all day.
//
// The count lives in this process's memory, keyed by user id and reset when the
// UTC day changes. That is enough for the single Render instance this app runs
// on, with two known gaps the owner accepts by keeping it in memory: a restart or
// redeploy resets everyone's count, and a second instance would give each user
// a separate budget per instance. Move it to MongoDB (or Redis) before scaling out.
let day = null;          // 'YYYY-MM-DD' (UTC) the counts below belong to
const used = new Map();  // userId → messages sent today

const utcDay = (now) => now.toISOString().slice(0, 10);

// Counts one message against the user's budget for today. Returns false — and
// counts nothing — when the budget is already spent. A message is counted when it
// is sent to the model, whether or not an answer comes back: a call that times
// out may still be billed, so failures are not refunded.
const tryConsume = (userId, limit, now = new Date()) => {
  const today = utcDay(now);
  if (today !== day) {
    // A new day: yesterday's counts are irrelevant, so drop them all at once
    // (this is also what keeps the map from growing without bound).
    day = today;
    used.clear();
  }
  const key = String(userId);
  const count = used.get(key) || 0;
  if (count >= limit) return false;
  used.set(key, count + 1);
  return true;
};

// Drops a user's count — called when the account is deleted, so a gone account
// leaves nothing behind in this process.
const forget = (userId) => { used.delete(String(userId)); };

// The count currently held for a user (tests).
const countFor = (userId) => used.get(String(userId)) || 0;

module.exports = { tryConsume, forget, countFor };
