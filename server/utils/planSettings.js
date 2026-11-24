// The memorization-plan fields a person picks during onboarding and can change
// later in Settings: rest days, review intensity or fixed review counts, and
// where new memorization starts. One parser for both routes, so onboarding —
// which now saves them in the same request as the pages (L-18) — accepts and
// rejects exactly what PUT /api/auth/profile does.

const { PAGE_RULE, toPageNumber } = require('./pageNumbers');

const INTENSITIES = ['light', 'standard', 'strong'];
const DIRECTIONS = ['fromStart', 'fromEnd'];

// A review count: null clears it; an out-of-range or non-numeric value is
// ignored rather than refused, which is what the profile route always did.
const reviewCount = (v, max) => {
  if (v === null) return { value: null };
  const n = parseInt(v, 10);
  return !isNaN(n) && n >= 0 && n <= max ? { value: n } : {};
};

// Reads the plan fields present in `body`. Returns { update } with the fields to
// $set, or { status: 400, code, message } for the first one that is invalid.
// Fields that are absent are left out, so a partial update stays partial.
const parsePlanSettings = (body) => {
  const update = {};
  const bad = (code, message) => ({ status: 400, code, message });

  if (body.reviewIntensity !== undefined) {
    if (!INTENSITIES.includes(body.reviewIntensity)) {
      return bad('INVALID_REVIEW_INTENSITY', 'reviewIntensity must be "light", "standard", or "strong"');
    }
    update.reviewIntensity = body.reviewIntensity;
  }

  if (body.offDays !== undefined) {
    const { offDays } = body;
    if (!Array.isArray(offDays) || !offDays.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return bad('INVALID_OFF_DAYS', 'offDays must be an array of integers between 0 (Sun) and 6 (Sat)');
    }
    update.offDays = offDays;
  }

  if (body.recentReviewCount !== undefined) {
    const r = reviewCount(body.recentReviewCount, 20);
    if ('value' in r) update.recentReviewCount = r.value;
  }

  if (body.cycleReviewCount !== undefined) {
    const r = reviewCount(body.cycleReviewCount, 40);
    if ('value' in r) update.cycleReviewCount = r.value;
  }

  if (body.memorizationDirection !== undefined) {
    if (!DIRECTIONS.includes(body.memorizationDirection)) {
      return bad('INVALID_DIRECTION', 'memorizationDirection must be "fromStart" or "fromEnd"');
    }
    update.memorizationDirection = body.memorizationDirection;
  }

  if (body.newMemorizationStartPage !== undefined) {
    const v = body.newMemorizationStartPage;
    if (v === null) {
      update.newMemorizationStartPage = null;
    } else {
      // parseInt would store 1.5 as page 1 and "4.5" as page 4 (M-01).
      const n = toPageNumber(v);
      if (n === null) return bad('INVALID_PAGE', `newMemorizationStartPage ${PAGE_RULE}`);
      update.newMemorizationStartPage = n;
    }
  }

  return { update };
};

module.exports = { parsePlanSettings };
