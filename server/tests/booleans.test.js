// L-01: the validator lets the strings 'true' / 'false' through for boolean
// fields, and the controllers then read them with Boolean(value) or `if (value)`
// — so 'false' meant true. The app's own client sends real booleans; these pin
// the API contract for anything else that calls it.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

const putProfile = (user, body) => request(app)
  .put('/api/auth/profile')
  .set('Authorization', `Bearer ${tokenFor(user._id)}`)
  .send(body);

describe('boolean fields sent as strings', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(10);
  });

  test("leaderboardOptIn: 'false' opts the user OUT (the audit's repro)", async () => {
    const user = await createUser({ displayName: 'Reader', leaderboardOptIn: false });
    const res = await putProfile(user, { leaderboardOptIn: 'false' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.leaderboardOptIn, false);
    assert.equal((await User.findById(user._id)).leaderboardOptIn, false);

    // …and an opted-in user leaves with the string too.
    const member = await createUser({ displayName: 'Member', leaderboardOptIn: true });
    const out = await putProfile(member, { leaderboardOptIn: 'false' });
    assert.equal(out.body.data.leaderboardOptIn, false);

    // 'true' still opts in.
    const join = await putProfile(user, { leaderboardOptIn: 'true' });
    assert.equal(join.body.data.leaderboardOptIn, true);
  });

  test("pauseNewMemorization and pausedFromOnboarding read 'false' as false", async () => {
    const user = await createUser({ pauseNewMemorization: true, pausedFromOnboarding: true });
    const res = await putProfile(user, { pauseNewMemorization: 'false', pausedFromOnboarding: 'false' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pauseNewMemorization, false);
    assert.equal(res.body.data.pausedFromOnboarding, false);

    const back = await putProfile(user, { pauseNewMemorization: 'true', pausedFromOnboarding: true });
    assert.equal(back.body.data.pauseNewMemorization, true);
    assert.equal(back.body.data.pausedFromOnboarding, true);
  });

  test("alreadyKnow: 'false' on a completion does NOT back-date it to yesterday", async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/progress/complete')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ pageNumber: 1, type: 'new', alreadyKnow: 'false' });
    assert.equal(res.status, 200);
    const row = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(row.memorizedDate.toISOString().slice(0, 10), today, 'counted as memorized today');
  });

  test('anything else is still refused by the type gate', async () => {
    const user = await createUser();
    for (const bad of ['no', 'False', 1, { $ne: false }]) {
      const res = await putProfile(user, { pauseNewMemorization: bad });
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  });
});
