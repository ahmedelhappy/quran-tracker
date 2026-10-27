// M-01: every page number the progress API accepts is an integer 1..604.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const leaderboardController = require('../controllers/leaderboardController');
const { pageFraction } = require('../utils/segments');

const auth = (userId) => `Bearer ${tokenFor(userId)}`;

describe('Page numbers are validated everywhere (M-01)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    leaderboardController._clearCache();
  });

  test('onboarding with out-of-range or fractional pages is a 400 and writes nothing', async () => {
    const user = await createUser({ onboardingComplete: false });
    const res = await request(app).post('/api/progress/onboarding').set('Authorization', auth(user._id))
      .send({ memorizedPages: [99999, -5, 0, 1.5, 700, 2.25], dailyNewPages: 1 });
    assert.equal(res.status, 400);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
    assert.equal((await User.findById(user._id)).onboardingComplete, false, 'the account is left as it was');
  });

  test('onboarding rejects a list longer than the mushaf (the 2,000-entry repro)', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/progress/onboarding').set('Authorization', auth(user._id))
      .send({ memorizedPages: Array.from({ length: 2000 }, (_, i) => (i % 604) + 1), dailyNewPages: 1 });
    assert.equal(res.status, 400);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  test('onboarding dedupes repeated pages', async () => {
    const user = await createUser();
    const res = await request(app).post('/api/progress/onboarding').set('Authorization', auth(user._id))
      .send({ memorizedPages: [1, 1, 2, 2, 2], dailyNewPages: 1 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.memorizedCount, 2);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 2);
  });

  test('complete and uncomplete reject fractional, string-fractional and out-of-range pages', async () => {
    const user = await createUser();
    const a = auth(user._id);
    for (const pageNumber of [1.5, 2.5, '4.5', 0, 605, -1, '']) {
      const res = await request(app).post('/api/progress/complete').set('Authorization', a).send({ pageNumber, type: 'new' });
      assert.equal(res.status, 400, `complete ${JSON.stringify(pageNumber)}`);
    }
    for (const pageNumber of [1.5, '4.5', 700]) {
      const res = await request(app).post('/api/progress/uncomplete').set('Authorization', a).send({ pageNumber, type: 'new' });
      assert.equal(res.status, 400, `uncomplete ${JSON.stringify(pageNumber)}`);
    }
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);

    // A whole page sent as a numeric string is still that page.
    const ok = await request(app).post('/api/progress/complete').set('Authorization', a).send({ pageNumber: '4', type: 'new' });
    assert.equal(ok.status, 200);
    assert.deepEqual((await UserProgress.find({ userId: user._id })).map((d) => d.pageNumber), [4]);
  });

  test('PUT /memorized rejects invalid entries instead of silently dropping them', async () => {
    const user = await createUser();
    const a = auth(user._id);
    const frac = await request(app).put('/api/progress/memorized').set('Authorization', a).send({ memorizedPages: [10.1, 10.2, 10.3, 10.4] });
    assert.equal(frac.status, 400);
    const big = await request(app).put('/api/progress/memorized').set('Authorization', a).send({ memorizedPages: Array.from({ length: 605 }, () => 1) });
    assert.equal(big.status, 400);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  test('units refs must be whole pages', async () => {
    const user = await createUser();
    for (const ref of [4.5, '4.5', 0, 605]) {
      const res = await request(app).put('/api/progress/units').set('Authorization', auth(user._id)).send({ action: 'add', unit: 'page', ref });
      assert.equal(res.status, 400, `units ref ${JSON.stringify(ref)}`);
    }
  });

  test('the schema refuses a fractional page as a backstop', async () => {
    const user = await createUser();
    await assert.rejects(UserProgress.create({ userId: user._id, pageNumber: 1.5, status: 'memorized' }), /integer/);
  });

  test('pageFraction counts a page the mushaf does not have as nothing', () => {
    assert.equal(pageFraction(700, []), 0);
    assert.equal(pageFraction(1.5, undefined), 0);
    assert.equal(pageFraction(0, []), 0);
    assert.equal(pageFraction(1, []), 1);
  });

  test('rows stored before validation cannot inflate totals or the leaderboard', async () => {
    const user = await createUser({ leaderboardOptIn: true, displayName: 'Legacy' });
    const when = new Date();
    // Bypass the model, as the old upserts effectively did.
    await UserProgress.collection.insertMany([1, 99999, -5, 0, 1.5, 700, 2.25].map((pageNumber) => ({
      userId: user._id, pageNumber, status: 'memorized', memorizedDate: when, lastReviewedDate: when, reviewCount: 0,
    })));

    const all = await request(app).get('/api/progress/all').set('Authorization', auth(user._id));
    assert.equal(all.body.data.totalMemorized, 1);

    const board = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(user._id));
    assert.equal(board.body.data.entries[0].pages, 1);
  });

  test('profile start pages reject fractions instead of truncating them', async () => {
    const user = await createUser();
    const a = auth(user._id);
    for (const field of ['cycleReviewStartPage', 'newMemorizationStartPage']) {
      for (const bad of [1.5, '4.5', 0, 605, '12abc']) {
        const res = await request(app).put('/api/auth/profile').set('Authorization', a).send({ [field]: bad });
        assert.equal(res.status, 400, `${field} ${JSON.stringify(bad)}`);
      }
      assert.equal((await User.findById(user._id))[field] ?? null, null, `${field} was never written`);
      for (const [good, stored] of [[12, 12], ['30', 30], [null, null]]) {
        const res = await request(app).put('/api/auth/profile').set('Authorization', a).send({ [field]: good });
        assert.equal(res.status, 200, `${field} ${JSON.stringify(good)}`);
        assert.equal((await User.findById(user._id))[field] ?? null, stored);
      }
    }
  });

  // Until cleanupInvalidPages.js runs, such rows are still stored. The editors
  // save back what GET /all returned, so returning them locked the account out
  // of PUT /memorized: sent back they were a 400, left out they were a 409.
  test('legacy invalid rows do not lock an account out of the memorized-pages editors', async () => {
    const user = await createUser();
    const when = new Date(Date.now() - 2 * 86400000);
    await UserProgress.collection.insertMany([3, 99999, 1.5, 0].map((pageNumber) => ({
      userId: user._id, pageNumber, status: 'memorized', memorizedDate: when, lastReviewedDate: when, reviewCount: 0,
    })));

    const all = await request(app).get('/api/progress/all').set('Authorization', auth(user._id));
    assert.deepEqual(all.body.data.memorizedPages, [3]);
    assert.equal(all.body.data.fullPages, 1);

    // The editor's round trip: what it loaded, plus a page the user added.
    const put = await request(app).put('/api/progress/memorized').set('Authorization', auth(user._id))
      .send({ memorizedPages: [...all.body.data.memorizedPages, 4] });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.data.removed, []);

    const today = await request(app).get('/api/progress/today').set('Authorization', auth(user._id));
    assert.equal(today.body.data.stats.fullPages, 2);
    const reviewed = [...today.body.data.reviewPages, ...today.body.data.recentReviewPages].map((p) => p.pageNumber);
    assert.ok(reviewed.every((n) => n === 3 || n === 4), `only real pages are scheduled (got ${reviewed})`);
  });
});
