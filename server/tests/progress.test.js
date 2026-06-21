const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  connect, disconnect, clearDatabase, seedMetadata,
  createUser, tokenFor, addMemorizedPage, daysAgo,
} = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

describe('Progress API — spaced repetition', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('protected progress route returns 401 without a token', async () => {
    const res = await request(app).get('/api/progress/today');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("new pages fill up to the user's dailyNewPages goal", async () => {
    // planStartDate = now → day 0 of the plan → target = ceil(dailyNewPages).
    const user = await createUser({ dailyNewPages: 3, planStartDate: new Date() });

    const res = await request(app)
      .get('/api/progress/today')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.stats.targetNewPages, 3);
    assert.equal(res.body.data.newPages.length, 3);
    // First three unmemorized pages, in order.
    assert.deepEqual(res.body.data.newPages.map(p => p.pageNumber), [1, 2, 3]);
  });

  test('review pages are pulled oldest-reviewed first', async () => {
    const user = await createUser({
      planStartDate: new Date(),
      pauseNewMemorization: true, // isolate the review queue from new pages
      cycleReviewCount: 3,        // fixed daily review target
      recentReviewCount: 0,       // ignore the recent-memorization bucket
    });

    // Five pages memorized in the past (before planStart, so they're cycle reviews),
    // each last reviewed a different number of days ago. Page 1 is the most stale.
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(9) });
    await addMemorizedPage(user._id, 2, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(8) });
    await addMemorizedPage(user._id, 3, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(7) });
    await addMemorizedPage(user._id, 4, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(6) });
    await addMemorizedPage(user._id, 5, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(5) });

    const res = await request(app)
      .get('/api/progress/today')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.newPages.length, 0); // paused
    // The three most stale (oldest lastReviewedDate) come first.
    assert.deepEqual(res.body.data.reviewPages.map(p => p.pageNumber), [1, 2, 3]);
  });

  test('a custom cycle start page rotates to the last page then wraps to page 1', async () => {
    const user = await createUser({
      planStartDate: new Date(),
      pauseNewMemorization: true, // isolate the review queue from new pages
      cycleReviewCount: 3,        // fixed batch of 3 per day
      recentReviewCount: 0,       // ignore the recent-memorization bucket
      cycleReviewStartPage: 8,    // start near the end of the 1..10 range
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Ten cycle pages, all memorized and last reviewed long ago (before planStart),
    // so they share a review date and the rotation — not the date — sets the order.
    for (let p = 1; p <= 10; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(50), lastReviewedDate: daysAgo(40) });
    }

    // Simulate consecutive days: take each day's batch, then "age" it by writing a
    // progressively more recent (but still past) lastReviewedDate so the next call
    // surfaces the next-stale batch — exactly how real day-to-day use advances.
    const batchPerDay = [];
    for (let day = 1; day <= 4; day++) {
      const res = await request(app).get('/api/progress/today').set('Authorization', auth);
      assert.equal(res.status, 200);
      const batch = res.body.data.reviewPages.map(p => p.pageNumber);
      batchPerDay.push(batch);
      await UserProgress.updateMany(
        { userId: user._id, pageNumber: { $in: batch } },
        { $set: { lastReviewedDate: daysAgo(40 - day) } }
      );
    }

    // Day 1 begins at the custom start page and reaches the last memorized page (10) —
    // NOT page 1, which is where the default oldest-first order would have started.
    assert.deepEqual(batchPerDay[0], [8, 9, 10]);
    // After the end of the range the cycle wraps around to page 1 and keeps going.
    assert.deepEqual(batchPerDay[1], [1, 2, 3]);
    assert.deepEqual(batchPerDay[2], [4, 5, 6]);
    // The lap finishes on page 7, then immediately restarts at the start page (8).
    assert.deepEqual(batchPerDay[3], [7, 8, 9]);
  });

  test('setting a custom cycle start page forgets old review recency and sweeps from there', async () => {
    const user = await createUser({
      planStartDate: new Date(),
      pauseNewMemorization: true, // isolate the review queue from new pages
      cycleReviewCount: 3,        // fixed batch of 3 per day
      recentReviewCount: 0,       // ignore the recent-memorization bucket
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Pages 1..10 memorized long ago. Pages 1..7 were reviewed just yesterday
    // (fresh), pages 8..10 long ago (stale). With no start point the cycle would
    // begin at the stale end and skip the freshly-reviewed 5, 6, 7.
    for (let p = 1; p <= 10; p++) {
      const lastReviewedDate = p <= 7 ? daysAgo(1) : daysAgo(40);
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(50), lastReviewedDate });
    }

    // Pick a custom start point at page 5.
    const put = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', auth)
      .send({ cycleReviewStartPage: 5 });
    assert.equal(put.status, 200);

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    // A clean forward sweep from the start point — the recently reviewed 5, 6, 7
    // are NOT skipped, proving the old review recency was forgotten.
    assert.deepEqual(res.body.data.reviewPages.map(p => p.pageNumber), [5, 6, 7]);

    // The recency really was cleared in the database.
    const stillReviewed = await UserProgress.countDocuments({
      userId: user._id, status: 'memorized', lastReviewedDate: { $ne: null },
    });
    assert.equal(stillReviewed, 0);
  });

  test('the daily review total stays constant as pages are completed', async () => {
    const user = await createUser({
      planStartDate: new Date(),
      pauseNewMemorization: true,
      cycleReviewCount: 3,
      recentReviewCount: 0,
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    for (let p = 1; p <= 5; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(10 - p) });
    }

    const before = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(before.status, 200);
    assert.equal(before.body.data.stats.cycleReviewTarget, 3);
    assert.equal(before.body.data.stats.recentReviewTarget, 0);
    assert.equal(before.body.data.stats.dailyReviewTotal, 3);
    const firstPage = before.body.data.reviewPages[0].pageNumber;

    // Complete one review — the live list shrinks but the daily target must not.
    await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: firstPage, type: 'review' });

    const after = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(after.status, 200);
    assert.equal(after.body.data.reviewPages.length, 2);     // live list went down
    assert.equal(after.body.data.stats.dailyReviewTotal, 3); // daily target stayed put
  });

  test('the recent-review bucket honors a custom count beyond the old day window', async () => {
    const user = await createUser({
      planStartDate: daysAgo(15),
      pauseNewMemorization: true, // isolate from new pages
      cycleReviewCount: 0,        // silence the cycle bucket
      recentReviewCount: 8,       // want up to 8 recently memorized pages
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // 10 pages each memorized on a different day of active plan use (after planStart).
    // Page 10 is the most recent, page 1 the oldest.
    for (let p = 1; p <= 10; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(11 - p), lastReviewedDate: null });
    }

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    // The 8 most recently memorized pages show — not just the last few days' worth.
    assert.equal(res.body.data.recentReviewPages.length, 8);
    assert.deepEqual(res.body.data.recentReviewPages.map(p => p.pageNumber), [3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('an off-day returns empty task arrays unless ignoreOffDay is set', async () => {
    const todayUtcDay = new Date().getUTCDay();
    const user = await createUser({
      dailyNewPages: 3,
      planStartDate: new Date(),
      offDays: [todayUtcDay],
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const offRes = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(offRes.status, 200);
    assert.equal(offRes.body.data.isOffDay, true);
    assert.equal(offRes.body.data.newPages.length, 0);
    assert.equal(offRes.body.data.reviewPages.length, 0);

    const onRes = await request(app)
      .get('/api/progress/today?ignoreOffDay=true')
      .set('Authorization', auth);
    assert.equal(onRes.status, 200);
    assert.equal(onRes.body.data.isOffDay, false);
    assert.equal(onRes.body.data.newPages.length, 3);
  });

  test('completing a new page marks it memorized and starts the streak', async () => {
    const user = await createUser({ currentStreak: 0, lastActiveDate: null });

    const res = await request(app)
      .post('/api/progress/complete')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ pageNumber: 1, type: 'new' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.newStreak, 1);

    const progress = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.equal(progress.status, 'memorized');

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.currentStreak, 1);
  });

  test('completing a review updates lastReviewedDate and review count', async () => {
    const user = await createUser({ planStartDate: new Date() });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(2), lastReviewedDate: daysAgo(2), reviewCount: 0 });

    const res = await request(app)
      .post('/api/progress/complete')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ pageNumber: 1, type: 'review' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const progress = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.equal(progress.reviewCount, 1);
    const today = new Date().toISOString().split('T')[0];
    assert.equal(progress.lastReviewedDate.toISOString().split('T')[0], today);
  });

  test('uncomplete reverses a new page memorized the same day', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    // Sanity: it was created.
    assert.ok(await UserProgress.findOne({ userId: user._id, pageNumber: 1 }));

    const res = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Same-day new completion is deleted entirely.
    assert.equal(await UserProgress.findOne({ userId: user._id, pageNumber: 1 }), null);
  });
});
