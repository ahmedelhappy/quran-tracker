const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  connect, disconnect, clearDatabase, seedMetadata,
  createUser, tokenFor, addMemorizedPage, daysAgo,
} = require('./helpers');
const app = require('../app');
const UserProgress = require('../models/UserProgress');
const leaderboardController = require('../controllers/leaderboardController');

const auth = (userId) => `Bearer ${tokenFor(userId)}`;

// Opt a user in with a display name and n whole memorized pages (pages 1..n),
// dated `when` (defaults to today). Returns the created user.
async function makeContender(displayName, n, { streak = 0, when } = {}) {
  const user = await createUser({ leaderboardOptIn: true, displayName, currentStreak: streak });
  const date = when || new Date();
  for (let p = 1; p <= n; p++) {
    await addMemorizedPage(user._id, p, { memorizedDate: date, lastReviewedDate: date });
  }
  return user;
}

describe('Leaderboard API', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(60);
    leaderboardController._clearCache(); // board cache persists across tests otherwise
  });

  test('protected: rejects requests without a token', async () => {
    const res = await request(app).get('/api/leaderboard');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('only opted-in users appear, ranked by pages descending', async () => {
    const alpha = await makeContender('Alpha', 5);
    await makeContender('Beta', 2);
    // A user with the MOST pages but NOT opted in must never appear.
    const hidden = await createUser({ leaderboardOptIn: false });
    for (let p = 1; p <= 10; p++) await addMemorizedPage(hidden._id, p, { memorizedDate: new Date(), lastReviewedDate: new Date() });

    const res = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(alpha._id));
    assert.equal(res.status, 200);
    const { entries, me, totalRanked } = res.body.data;
    assert.equal(totalRanked, 2);
    assert.deepEqual(entries.map(e => e.displayName), ['Alpha', 'Beta']);
    assert.deepEqual(entries.map(e => e.rank), [1, 2]);
    assert.equal(entries[0].pages, 5);
    assert.equal(me.displayName, 'Alpha');
    assert.equal(me.rank, 1);
  });

  test('week board counts only the last 7 days; all-time counts everything', async () => {
    const user = await createUser({ leaderboardOptIn: true, displayName: 'Weekly' });
    // 3 pages memorized 10 days ago, 1 page memorized today.
    for (let p = 1; p <= 3; p++) await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(10) });
    await addMemorizedPage(user._id, 4, { memorizedDate: new Date(), lastReviewedDate: new Date() });

    const all = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(user._id));
    assert.equal(all.body.data.entries[0].pages, 4);

    const week = await request(app).get('/api/leaderboard?period=week').set('Authorization', auth(user._id));
    assert.equal(week.body.data.entries[0].pages, 1);
  });

  test('partial pages count fractionally', async () => {
    const user = await createUser({ leaderboardOptIn: true, displayName: 'Fractional' });
    // Page 1: verses 1:1–1:4 of 1:1–1:7 → 4/7. Page 2: whole → 1. Total ≈ 1.57.
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized',
      memorizedDate: new Date(), lastReviewedDate: new Date(),
      segments: [{ from: '1:1', to: '1:4' }],
    });
    await addMemorizedPage(user._id, 2, { memorizedDate: new Date(), lastReviewedDate: new Date() });

    const res = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(user._id));
    assert.equal(res.body.data.entries[0].pages, parseFloat((4 / 7 + 1).toFixed(2))); // 1.57
  });

  test('the requesting user gets their own rank even when outside the top 50', async () => {
    // 50 contenders each with 1 page, streaks 1..50 (streak is the tie-break).
    for (let s = 1; s <= 50; s++) await makeContender(`U${s}`, 1, { streak: s });
    // The requester is opted in with 1 page but the LOWEST streak → rank 51.
    const me = await makeContender('Me', 1, { streak: 0 });

    const res = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(me._id));
    assert.equal(res.body.data.totalRanked, 51);
    assert.equal(res.body.data.entries.length, 50);          // top 50 only
    assert.equal(res.body.data.meInTop, false);
    assert.equal(res.body.data.me.rank, 51);
    assert.equal(res.body.data.me.displayName, 'Me');
  });

  test('me is null for a viewer who has not opted in', async () => {
    const viewer = await createUser({ leaderboardOptIn: false });
    for (let p = 1; p <= 3; p++) await addMemorizedPage(viewer._id, p, { memorizedDate: new Date(), lastReviewedDate: new Date() });
    await makeContender('Someone', 4);

    const res = await request(app).get('/api/leaderboard?period=all').set('Authorization', auth(viewer._id));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.me, null);
    assert.equal(res.body.data.entries.length, 1);
    assert.equal(res.body.data.entries[0].displayName, 'Someone');
  });

  test('opting in without a display name is rejected', async () => {
    const user = await createUser({ leaderboardOptIn: false, displayName: null });
    const res = await request(app).put('/api/auth/profile')
      .set('Authorization', auth(user._id))
      .send({ leaderboardOptIn: true });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('opting in with a display name in the same request succeeds', async () => {
    const user = await createUser({});
    const res = await request(app).put('/api/auth/profile')
      .set('Authorization', auth(user._id))
      .send({ leaderboardOptIn: true, displayName: 'Ahmed' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.leaderboardOptIn, true);
    assert.equal(res.body.data.displayName, 'Ahmed');
  });

  test('a display name shorter than 3 characters is rejected', async () => {
    const user = await createUser({});
    const res = await request(app).put('/api/auth/profile')
      .set('Authorization', auth(user._id))
      .send({ displayName: 'ab' });
    assert.equal(res.status, 400);
  });
});
