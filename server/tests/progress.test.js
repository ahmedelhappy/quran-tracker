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

  test('a fromEnd user is assigned page 604 first and the week plan continues downward', async () => {
    const user = await createUser({
      dailyNewPages: 2,
      planStartDate: new Date(),
      memorizationDirection: 'fromEnd',
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    // The walk starts at the last surah of the mushaf and moves backward surah by
    // surah; through the single-page short surahs this coincides with 604, 603, 602…
    assert.deepEqual(res.body.data.newPages.map(p => p.pageNumber), [604, 603]);
    assert.deepEqual(res.body.data.extraNewPages.map(p => p.pageNumber), [602, 601, 600]);

    // Future days project the same direction: tomorrow picks up after today's batch.
    const week = await request(app).get('/api/progress/week').set('Authorization', auth);
    assert.equal(week.status, 200);
    const firstActiveDay = week.body.data.find(d => !d.isOffDay);
    assert.deepEqual(firstActiveDay.newPagesForDay, [602, 601]);
  });

  test('fromEnd memorizes a multi-page surah forward: 562 then 563, not 563 then 562', async () => {
    const user = await createUser({
      dailyNewPages: 2,
      planStartDate: new Date(),
      memorizationDirection: 'fromEnd',
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Memorize everything from Al-Qalam (page 564) to the end of the mushaf, so the
    // next surah due backward is Al-Mulk, which spans pages 562–563. Surah-by-surah
    // backward but pages WITHIN a surah forward means Al-Mulk is picked up from its
    // first page: 562 then 563 — walking raw pages 604→1 would give 563 then 562.
    for (let p = 564; p <= 604; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(2), lastReviewedDate: daysAgo(2) });
    }

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.newPages.map(p => p.pageNumber), [562, 563]);

    // The week projection advances in the same surah-forward order: the next surah
    // back (At-Tahrim, pages 560–561) is also picked up from its first page.
    const week = await request(app).get('/api/progress/week').set('Authorization', auth);
    assert.equal(week.status, 200);
    const firstActiveDay = week.body.data.find(d => !d.isOffDay);
    assert.deepEqual(firstActiveDay.newPagesForDay, [560, 561]);
  });

  test('a custom start anchor walks forward from it and wraps to cover skipped pages last', async () => {
    // Anchor at Juz 29 (page 562): new pages run 562 → 604 first, then wrap to 1.
    const user = await createUser({
      dailyNewPages: 3,
      planStartDate: new Date(),
      newMemorizationStartPage: 562,
    });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const fresh = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(fresh.status, 200);
    assert.deepEqual(fresh.body.data.newPages.map(p => p.pageNumber), [562, 563, 564]);

    // Once the anchor-to-end stretch is memorized, the walk wraps around so the
    // skipped early pages (1–561) are scheduled last.
    for (let p = 562; p <= 604; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(2), lastReviewedDate: daysAgo(2) });
    }
    const wrapped = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(wrapped.status, 200);
    assert.deepEqual(wrapped.body.data.newPages.map(p => p.pageNumber), [1, 2, 3]);
  });

  test('switching direction mid-plan picks the correct next page without touching progress', async () => {
    const user = await createUser({ dailyNewPages: 1, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    for (let p = 1; p <= 3; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(4 - p), lastReviewedDate: daysAgo(4 - p) });
    }

    // Default direction continues from the front: next unmemorized page is 4.
    const before = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.deepEqual(before.body.data.newPages.map(p => p.pageNumber), [4]);

    const put = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', auth)
      .send({ memorizationDirection: 'fromEnd' });
    assert.equal(put.status, 200);
    assert.equal(put.body.data.memorizationDirection, 'fromEnd');

    // The very next task now comes from the back of the mushaf...
    const after = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.deepEqual(after.body.data.newPages.map(p => p.pageNumber), [604]);
    assert.equal(after.body.data.stats.totalMemorized, 3);

    // ...and the already-memorized pages were left untouched.
    const memorized = await UserProgress.find({ userId: user._id, status: 'memorized' }).sort({ pageNumber: 1 });
    assert.deepEqual(memorized.map(p => p.pageNumber), [1, 2, 3]);
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

  test('undo restores the streak: fresh user nets to zero after mark then undo', async () => {
    const user = await createUser({ currentStreak: 0, lastActiveDate: null });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const markRes = await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    assert.equal(markRes.body.data.newStreak, 1);

    const undoRes = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    assert.equal(undoRes.status, 200);
    assert.equal(undoRes.body.data.currentStreak, 0);

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.currentStreak, 0);
    assert.equal(refreshed.lastActiveDate, null);
  });

  test('undo restores the streak: continuing user reverts to the prior streak and date', async () => {
    const yesterday = daysAgo(1);
    const user = await createUser({ currentStreak: 5, lastActiveDate: yesterday });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const markRes = await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    assert.equal(markRes.body.data.newStreak, 6);

    const undoRes = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    assert.equal(undoRes.body.data.currentStreak, 5);

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.currentStreak, 5);
    assert.equal(refreshed.lastActiveDate.getTime(), yesterday.getTime());
  });

  test('undo only restores the streak once every completion today is undone', async () => {
    const yesterday = daysAgo(1);
    const user = await createUser({ currentStreak: 5, lastActiveDate: yesterday });
    const auth = `Bearer ${tokenFor(user._id)}`;

    await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    const secondMark = await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 2, type: 'new' });
    // Same-day second completion doesn't double-increment.
    assert.equal(secondMark.body.data.newStreak, 6);

    const firstUndo = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    // Page 2 is still completed today, so the streak bump survives.
    assert.equal(firstUndo.body.data.currentStreak, 6);

    const secondUndo = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 2, type: 'new' });
    // No completions left today — now it restores.
    assert.equal(secondUndo.body.data.currentStreak, 5);

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.currentStreak, 5);
    assert.equal(refreshed.lastActiveDate.getTime(), yesterday.getTime());
  });

  test('re-marking after a full undo increments the streak again', async () => {
    const yesterday = daysAgo(1);
    const user = await createUser({ currentStreak: 5, lastActiveDate: yesterday });
    const auth = `Bearer ${tokenFor(user._id)}`;

    await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });

    const afterUndo = await User.findById(user._id);
    assert.equal(afterUndo.currentStreak, 5);
    assert.equal(afterUndo.lastActiveDate.getTime(), yesterday.getTime());

    const remarkRes = await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new' });
    assert.equal(remarkRes.body.data.newStreak, 6);

    const afterRemark = await User.findById(user._id);
    assert.equal(afterRemark.currentStreak, 6);
  });

  test('undo restores the streak after undoing a review-type completion', async () => {
    const yesterday = daysAgo(1);
    const user = await createUser({ currentStreak: 5, lastActiveDate: yesterday, planStartDate: daysAgo(30) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10), reviewCount: 1 });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const markRes = await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'review' });
    assert.equal(markRes.body.data.newStreak, 6);

    const undoRes = await request(app).post('/api/progress/uncomplete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'review' });
    assert.equal(undoRes.body.data.currentStreak, 5);

    const refreshed = await User.findById(user._id);
    assert.equal(refreshed.currentStreak, 5);
    assert.equal(refreshed.lastActiveDate.getTime(), yesterday.getTime());
  });

  test('a half-page plan (0.5/day) assigns the first half of the next page on the first active day', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.newPages.length, 1);

    const task = res.body.data.newPages[0];
    assert.equal(task.pageNumber, 1);
    // Page 1 (Al-Fatiha) has 7 verses — the first half is verses 1–4.
    assert.deepEqual(task.segment, { fromVerseKey: '1:1', toVerseKey: '1:4', half: 1 });
    assert.equal(res.body.data.stats.targetNewPages, 1);
  });

  test('a half-page plan gets the remainder on the next active day, completing the page', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const day1 = await request(app).get('/api/progress/today').set('Authorization', auth);
    const task1 = day1.body.data.newPages[0];

    const complete1 = await request(app).post('/api/progress/complete').set('Authorization', auth).send({
      pageNumber: task1.pageNumber, type: 'new', segment: { fromVerseKey: task1.segment.fromVerseKey, toVerseKey: task1.segment.toVerseKey },
    });
    assert.equal(complete1.status, 200);

    const partial = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(partial.toObject().segments.map(s => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);

    // Simulate the next active day: back-date so today's completion count resets.
    await UserProgress.updateOne(
      { userId: user._id, pageNumber: 1 },
      { $set: { memorizedDate: daysAgo(1), lastReviewedDate: daysAgo(1) } }
    );

    const day2 = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(day2.body.data.newPages.length, 1);
    const task2 = day2.body.data.newPages[0];
    assert.equal(task2.pageNumber, 1);
    assert.deepEqual(task2.segment, { fromVerseKey: '1:5', toVerseKey: '1:7', half: 2 });

    const complete2 = await request(app).post('/api/progress/complete').set('Authorization', auth).send({
      pageNumber: task2.pageNumber, type: 'new', segment: { fromVerseKey: task2.segment.fromVerseKey, toVerseKey: task2.segment.toVerseKey },
    });
    assert.equal(complete2.status, 200);

    const full = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!full.segments || full.segments.length === 0);
  });

  test('"Want more?" on a 0.5/day plan offers the next new HALF, not review-only', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    // Today's task is page 1's first half (1:1–1:4).
    assert.deepEqual(res.body.data.newPages[0].segment, { fromVerseKey: '1:1', toVerseKey: '1:4', half: 1 });
    // The first extra-new item is the REMAINING half of page 1 (segment-aware), not the next page.
    const extras = res.body.data.extraNewPages;
    assert.ok(extras.length >= 1, 'extraNewPages should not be empty on a half-page plan');
    assert.equal(extras[0].pageNumber, 1);
    assert.deepEqual(extras[0].segment, { fromVerseKey: '1:5', toVerseKey: '1:7', half: 2 });
    // The next extra after that is page 2's first half.
    assert.equal(extras[1].pageNumber, 2);
    assert.equal(extras[1].segment.half, 1);
  });

  test('switching 0.5/day → 1 page/day serves the half-finished page\'s REMAINDER first (no skip)', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Do the first half of page 1 on the half-page plan.
    const day1 = await request(app).get('/api/progress/today').set('Authorization', auth);
    const t1 = day1.body.data.newPages[0];
    await request(app).post('/api/progress/complete').set('Authorization', auth)
      .send({ pageNumber: 1, type: 'new', segment: { fromVerseKey: t1.segment.fromVerseKey, toVerseKey: t1.segment.toVerseKey } });

    // The page is stored as half-memorized (segments), not fully memorized.
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(p1.toObject().segments.map(s => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);

    // Switch to a whole-page plan; back-date so today's count resets.
    await User.updateOne({ _id: user._id }, { $set: { dailyNewPages: 1 } });
    await UserProgress.updateOne({ userId: user._id, pageNumber: 1 }, { $set: { memorizedDate: daysAgo(1), lastReviewedDate: daysAgo(1) } });

    const day2 = await request(app).get('/api/progress/today').set('Authorization', auth);
    const t2 = day2.body.data.newPages[0];
    // The next task is page 1's REMAINDER (1:5–1:7), NOT page 2.
    assert.equal(t2.pageNumber, 1);
    assert.deepEqual(t2.segment, { fromVerseKey: '1:5', toVerseKey: '1:7', half: 2 });

    // The all-progress payload exposes the per-page fraction for the map (4/7 of page 1).
    const all = await request(app).get('/api/progress/all').set('Authorization', auth);
    assert.deepEqual(all.body.data.partialPages, [{ pageNumber: 1, fraction: 4 / 7 }]);
    assert.equal(all.body.data.fullPages, 0);
    assert.ok(all.body.data.memorizedPages.includes(1)); // still listed (has progress)
  });

  test('direction interplay: a fromEnd half-page-plan user gets page 604\'s first half first', async () => {
    const user = await createUser({ dailyNewPages: 0.5, memorizationDirection: 'fromEnd', planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    const task = res.body.data.newPages[0];
    assert.equal(task.pageNumber, 604);
    assert.equal(task.segment.half, 1);
  });

  test('isHafiz requires every page to be FULLY memorized, not just touched', async () => {
    const user = await createUser({ planStartDate: daysAgo(30) });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // 603 full pages plus one partial page = 604 pages "touched" but not a hafiz.
    for (let p = 2; p <= 604; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10) });
    }
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized',
      memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10),
      segments: [{ from: '1:1', to: '1:4' }],
    });

    const res = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.isHafiz, false);
    assert.equal(res.body.data.stats.fullPages, 603);
    assert.ok(Math.abs(res.body.data.stats.totalMemorized - (603 + 4 / 7)) < 1e-9);
  });

  test('updateMemorized preserves a partial page it keeps, adds new pages full, drops removed ones', async () => {
    const user = await createUser({ planStartDate: daysAgo(30) });
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Page 1 is HALF memorized (verses 1:1–1:4 of 1:1–1:7); page 5 is a full page;
    // page 9 is a full page we're about to drop from the set.
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized',
      memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10),
      segments: [{ from: '1:1', to: '1:4' }],
    });
    await addMemorizedPage(user._id, 5, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10) });
    await addMemorizedPage(user._id, 9, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10) });

    // The whole-page editor sends the full desired set: keep 1 and 5, drop 9, add 10.
    const res = await request(app).put('/api/progress/memorized')
      .set('Authorization', auth)
      .send({ memorizedPages: [1, 5, 10] });
    assert.equal(res.status, 200);

    // Page 1's partial segment survives — NOT silently promoted to a full page.
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(p1.toObject().segments.map(s => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);
    // Page 5 stays a full page.
    const p5 = await UserProgress.findOne({ userId: user._id, pageNumber: 5 });
    assert.ok(!p5.segments || p5.segments.length === 0);
    // Page 10 is newly added as a full page.
    const p10 = await UserProgress.findOne({ userId: user._id, pageNumber: 10 });
    assert.ok(p10 && (!p10.segments || p10.segments.length === 0));
    // Page 9 was removed.
    const p9 = await UserProgress.findOne({ userId: user._id, pageNumber: 9 });
    assert.equal(p9, null);

    // The all-progress fraction still reports page 1 as 4/7, confirming no flatten.
    const all = await request(app).get('/api/progress/all').set('Authorization', auth);
    assert.deepEqual(all.body.data.partialPages, [{ pageNumber: 1, fraction: 4 / 7 }]);
    assert.equal(all.body.data.fullPages, 2);
  });
});
