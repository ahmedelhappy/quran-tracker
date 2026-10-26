// Per-ACCOUNT failed-login backoff, on top of the per-IP authLimiter. The IP
// limit alone lets a password-guesser spread attempts over many addresses; this
// counts failures per email address no matter where they come from.
//
// The rule: 5 failures for one email within 15 minutes lock that email for a
// minute; each further failure after a lock doubles the lock (2, 4, 8 … minutes),
// up to an hour. A successful sign-in clears the record. While locked, the
// password is not even checked, so a correct guess during the lock reveals
// nothing.
//
// It must not reveal whether an account exists, so it counts EVERY email that
// fails to sign in — registered or not — and the locked response is identical
// either way.
//
// The price is a targeted lock-out: anyone who knows an email can keep it
// locked (5 bad guesses, then one per lock period) and the owner's correct
// password is refused meanwhile, with no unlock route until password reset
// exists (H-06). The public demo account (M-07) is the obvious target. How far
// to soften this — key on email + IP, let a device that signed in before
// through, a lower cap, a demo exemption — is an owner decision.
//
// State lives in this process's memory: right for the single Render instance,
// reset by a restart, and per-instance if the app is ever scaled out (move it to
// MongoDB or Redis then). The map is bounded so a flood of made-up emails cannot
// grow it without limit.
const DEFAULTS = {
  maxFailures: 5,
  windowMs: 15 * 60 * 1000,
  baseLockMs: 60 * 1000,
  maxLockMs: 60 * 60 * 1000,
  maxEntries: 10000,
};

const createLoginThrottle = (options = {}) => {
  const { maxFailures, windowMs, baseLockMs, maxLockMs, maxEntries } = { ...DEFAULTS, ...options };
  const now = options.now || (() => Date.now());
  const warn = options.warn || console.warn;
  // email → { failures, firstAt, lockedUntil }
  const records = new Map();

  // Before any lock, failures count for 15 minutes from the first one. Once an
  // email has been locked its history is kept until 15 minutes after the lock
  // ENDS — otherwise a long lock would outlive the window and the next round of
  // guessing would start again from a one-minute lock.
  const isLive = (rec, t) => (rec.lockedUntil > 0
    ? t < rec.lockedUntil + windowMs
    : t - rec.firstAt < windowMs);

  // Makes room for one new record, called just BEFORE it is added (so the
  // newcomer is never its own eviction candidate). Still full after dropping
  // expired records means a flood of live ones, and something live has to go:
  // never-locked records first (oldest first — Map keeps insertion order), then
  // the locks ending soonest. Evicting by age alone would let a flood of made-up
  // emails push out a victim's active lock and its escalation, handing the
  // guesser a fresh 5 tries. The overflow is logged at most once per window.
  let lastWarnAt = -Infinity;
  const makeRoom = (t) => {
    const cap = maxEntries - 1;
    for (const [key, rec] of records) if (!isLive(rec, t)) records.delete(key);
    if (records.size <= cap) return;

    if (t - lastWarnAt >= windowMs) {
      lastWarnAt = t;
      warn(`loginThrottle: over ${maxEntries} live records — evicting live ones (a flood of failed sign-ins?)`);
    }
    for (const [key, rec] of records) {
      if (records.size <= cap) return;
      if (rec.lockedUntil === 0) records.delete(key);
    }
    const byLockEnd = [...records].sort((a, b) => a[1].lockedUntil - b[1].lockedUntil);
    for (const [key] of byLockEnd) {
      if (records.size <= cap) return;
      records.delete(key);
    }
  };

  // Milliseconds until this email may try again; 0 when it may try now.
  const lockedFor = (email) => {
    const rec = records.get(email);
    if (!rec) return 0;
    return Math.max(0, rec.lockedUntil - now());
  };

  const recordFailure = (email) => {
    const t = now();
    let rec = records.get(email);
    if (rec && !isLive(rec, t)) {
      records.delete(email);
      rec = undefined;
    }
    if (!rec) {
      rec = { failures: 0, firstAt: t, lockedUntil: 0 };
      if (records.size >= maxEntries) makeRoom(t);
      records.set(email, rec);
    }
    rec.failures += 1;
    if (rec.failures >= maxFailures) {
      const lockMs = Math.min(maxLockMs, baseLockMs * 2 ** (rec.failures - maxFailures));
      rec.lockedUntil = t + lockMs;
    }
  };

  const reset = (email) => { records.delete(email); };

  return { lockedFor, recordFailure, reset, size: () => records.size };
};

module.exports = { createLoginThrottle, loginThrottle: createLoginThrottle() };
