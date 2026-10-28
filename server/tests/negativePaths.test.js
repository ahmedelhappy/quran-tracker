// The refusal branches of the main write endpoints. The happy paths are covered
// elsewhere; these are the 400s each controller returns for input it must not
// act on, and every case also checks that nothing was written — a refusal that
// still changed the account would pass a status-only assertion.
const { test, before, after, beforeEach, afterEach, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor, addMemorizedPage, daysAgo } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const clock = require('../utils/clock');

const auth = (user) => `Bearer ${tokenFor(user._id)}`;
const post = (user, path, body) => request(app).post(`/api/progress/${path}`).set('Authorization', auth(user)).send(body);
const reload = (user) => User.findById(user._id).lean();
const rows = (user) => UserProgress.find({ userId: user._id }).sort({ pageNumber: 1 }).lean();

describe('Negative paths of the progress writes (M-15)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('complete: a missing or unknown type is a 400 and records nothing', async () => {
    const user = await createUser();
    for (const body of [{ pageNumber: 3 }, { pageNumber: 3, type: 'memorize' }, { pageNumber: 3, type: '' }]) {
      const res = await post(user, 'complete', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.message, 'type must be "new" or "review"');
    }
    assert.deepEqual(await rows(user), []);
    assert.equal((await reload(user)).lastActiveDate, null, 'no streak for a refused completion');
  });

  test('complete: reviewing a page that was never memorized is a 400, not an upsert', async () => {
    const user = await createUser();
    const res = await post(user, 'complete', { pageNumber: 7, type: 'review' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Page not found or not memorized yet');
    assert.deepEqual(await rows(user), []);
    assert.equal((await reload(user)).currentStreak, 0);
  });

  test('complete: a non-object or half-filled segment is a 400 for the type gate or the controller', async () => {
    const user = await createUser();
    const gate = await post(user, 'complete', { pageNumber: 2, type: 'new', segment: 'all' });
    assert.equal(gate.status, 400);
    const partial = await post(user, 'complete', { pageNumber: 2, type: 'new', segment: { fromVerseKey: '2:6' } });
    assert.equal(partial.status, 400);
    assert.deepEqual(await rows(user), []);
  });

  test('uncomplete: an unknown type is a 400', async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 4, { memorizedDate: daysAgo(0), lastReviewedDate: daysAgo(0) });
    const res = await post(user, 'uncomplete', { pageNumber: 4, type: 'all' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'type must be "new" or "review"');
    assert.equal((await rows(user)).length, 1, 'the page is untouched');
  });

  test('uncomplete: undoing a page that has no progress at all is a 400 for either type', async () => {
    const user = await createUser();
    const asNew = await post(user, 'uncomplete', { pageNumber: 9, type: 'new' });
    assert.equal(asNew.status, 400);
    assert.equal(asNew.body.message, 'Page was not memorized today');
    const asReview = await post(user, 'uncomplete', { pageNumber: 9, type: 'review' });
    assert.equal(asReview.status, 400);
    assert.equal(asReview.body.message, 'Page not found or not memorized');
  });

  test('uncomplete new: a page memorized on an earlier day is refused and keeps its history', async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 5, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(2), reviewCount: 6 });
    const res = await post(user, 'uncomplete', { pageNumber: 5, type: 'new' });
    assert.equal(res.status, 400);
    const [row] = await rows(user);
    assert.equal(row.memorizedDate.toISOString(), daysAgo(20).toISOString());
    assert.equal(row.reviewCount, 6);
  });

  test('estimate: a dailyPages outside 0.5..10 or not a number is a 400; 0 falls back to the goal', async () => {
    const user = await createUser({ dailyNewPages: 2 });
    for (const q of ['0.4', '10.5', '-3']) {
      const res = await request(app).get(`/api/progress/estimate?dailyPages=${q}`).set('Authorization', auth(user));
      assert.equal(res.status, 400, q);
      assert.equal(res.body.message, 'dailyPages must be between 0.5 and 10');
    }
    const word = await request(app).get('/api/progress/estimate?dailyPages=abc').set('Authorization', auth(user));
    assert.equal(word.status, 400, 'the query type gate');
    const fallback = await request(app).get('/api/progress/estimate?dailyPages=0').set('Authorization', auth(user));
    assert.equal(fallback.status, 200);
    const goal = await request(app).get('/api/progress/estimate').set('Authorization', auth(user));
    assert.deepEqual(fallback.body.data, goal.body.data, 'same answer as no dailyPages at all');
  });

  test('estimate: both ends of the range are accepted and a full mushaf has nothing left', async () => {
    const user = await createUser({ offDays: [] });
    for (const q of ['0.5', '10']) {
      const res = await request(app).get(`/api/progress/estimate?dailyPages=${q}`).set('Authorization', auth(user));
      assert.equal(res.status, 200, q);
    }
    const slow = await request(app).get('/api/progress/estimate?dailyPages=0.5').set('Authorization', auth(user));
    assert.equal(slow.body.data.remainingPages, 604);
    assert.equal(slow.body.data.estimatedDays, 1208, '604 pages at half a page a day, no rest days');
  });

  test('PATCH /memorized: an empty change and a page both added and removed are named 400s', async () => {
    const user = await createUser();
    const patch = (body) => request(app).patch('/api/progress/memorized').set('Authorization', auth(user)).send(body);
    const empty = await patch({ add: [], remove: [] });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.message, 'Nothing to change: send add and/or remove');
    const both = await patch({ add: [3, 4], remove: [4] });
    assert.equal(both.status, 400);
    assert.match(both.body.message, /cannot be both added and removed \(4\)/);
    assert.deepEqual(await rows(user), []);
  });

  test('PUT /units: an unknown action is a 400 and writes nothing', async () => {
    const user = await createUser();
    const res = await request(app).put('/api/progress/units').set('Authorization', auth(user))
      .send({ action: 'toggle', unit: 'page', ref: 3 });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "action must be 'add' or 'remove'");
    assert.deepEqual(await rows(user), []);
  });
});

describe('Onboarding (M-15: it had no happy-path test)', () => {
  const NOW = '2026-03-04T10:00:00.000Z';
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    mock.method(clock, 'now', () => new Date(NOW));
  });
  afterEach(() => mock.restoreAll());

  const onboard = (user, body) => post(user, 'onboarding', body);

  test('marks the chosen pages memorized yesterday, so they are reviews and new work starts after them', async () => {
    const user = await createUser({ onboardingComplete: false });
    const res = await onboard(user, { memorizedPages: [1, 2, 3], dailyNewPages: 2 });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { dailyNewPages: 2, memorizedCount: 3 });

    const u = await reload(user);
    assert.equal(u.onboardingComplete, true);
    assert.equal(u.dailyNewPages, 2);
    assert.equal(u.planStartDate.toISOString(), NOW);

    const saved = await rows(user);
    assert.deepEqual(saved.map((r) => r.pageNumber), [1, 2, 3]);
    for (const r of saved) {
      assert.equal(r.status, 'memorized');
      assert.equal(r.memorizedDate.toISOString(), '2026-03-03T00:00:00.000Z');
      assert.equal(r.lastReviewedDate.toISOString(), '2026-03-03T00:00:00.000Z');
      assert.equal(r.reviewCount, 0);
    }

    const today = await request(app).get('/api/progress/today').set('Authorization', auth(user));
    assert.equal(today.status, 200);
    assert.deepEqual(today.body.data.newPages.map((p) => p.pageNumber), [4, 5], 'two new pages, after the known ones');
    assert.equal(today.body.data.stats.totalMemorized, 3);
  });

  test('with no pages it only finishes onboarding', async () => {
    const user = await createUser({ onboardingComplete: false });
    const res = await onboard(user, { dailyNewPages: 1 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.memorizedCount, 0);
    assert.equal((await reload(user)).onboardingComplete, true);
    assert.deepEqual(await rows(user), []);
  });

  test('the daily goal is clamped to 0.5..10 and defaults to 1', async () => {
    const cases = [[50, 10], [0.1, 0.5], [0, 1], [undefined, 1], [1.5, 1.5]];
    for (const [sent, kept] of cases) {
      const user = await createUser({ onboardingComplete: false });
      const res = await onboard(user, sent === undefined ? {} : { dailyNewPages: sent });
      assert.equal(res.status, 200, String(sent));
      assert.equal(res.body.data.dailyNewPages, kept, `sent ${sent}`);
      assert.equal((await reload(user)).dailyNewPages, kept);
    }
  });

  test('a goal or a page list of the wrong type is a 400 from the type gate, and writes nothing', async () => {
    const user = await createUser({ onboardingComplete: false });
    for (const body of [{ dailyNewPages: 'lots' }, { memorizedPages: '1,2' }, { memorizedPages: [1, '2'] }, { memorizedPages: { $gt: 0 } }]) {
      const res = await onboard(user, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal((await reload(user)).onboardingComplete, false);
    assert.deepEqual(await rows(user), []);
  });

  test('running it again does not duplicate pages', async () => {
    const user = await createUser({ onboardingComplete: false });
    await onboard(user, { memorizedPages: [1, 2], dailyNewPages: 1 });
    const again = await onboard(user, { memorizedPages: [2, 3], dailyNewPages: 1 });
    assert.equal(again.status, 200);
    assert.deepEqual((await rows(user)).map((r) => r.pageNumber), [1, 2, 3]);
  });
});

describe('Negative paths of the account writes (M-15)', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  const changePassword = (user, body) => request(app).put('/api/auth/password').set('Authorization', auth(user)).send(body);
  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

  test('password: a missing field, the same password, or a wrong current one is a 400 and changes nothing', async () => {
    const user = await createUser({ email: 'pw@example.com', password: 'secret123' });
    const cases = [
      [{ currentPassword: 'secret123' }, 'Both current and new password are required'],
      [{ newPassword: 'another-pass1' }, 'Both current and new password are required'],
      [{ currentPassword: 'secret123', newPassword: 'secret123' }, 'New password must be different from current password'],
      [{ currentPassword: 'not-it-at-all', newPassword: 'another-pass1' }, 'Current password is incorrect'],
    ];
    for (const [body, message] of cases) {
      const res = await changePassword(user, body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.message, message);
    }
    assert.ok(!(await reload(user)).passwordChangedAt, 'no change was stamped');
    assert.equal((await login('pw@example.com', 'secret123')).status, 200, 'the old password still signs in');
    assert.equal((await login('pw@example.com', 'another-pass1')).status, 401);
  });

  test('password: a non-string is refused by the type gate', async () => {
    const user = await createUser();
    const res = await changePassword(user, { currentPassword: { $ne: '' }, newPassword: 'another-pass1' });
    assert.equal(res.status, 400);
  });

  test('profile: each out-of-range field is a 400 and none of the request is applied', async () => {
    const user = await createUser({ name: 'Before', dailyNewPages: 2, reviewIntensity: 'standard', offDays: [5], language: 'en' });
    const cases = [
      [{ name: '   ' }, 'Name cannot be empty'],
      [{ name: 'x'.repeat(51) }, 'Name cannot exceed 50 characters'],
      [{ dailyNewPages: 0.4 }, 'Daily pages must be between 0.5 and 10'],
      [{ dailyNewPages: 10.5 }, 'Daily pages must be between 0.5 and 10'],
      [{ reviewIntensity: 'extreme' }, 'reviewIntensity must be "light", "standard", or "strong"'],
      [{ offDays: [7] }, 'offDays must be an array of integers between 0 (Sun) and 6 (Sat)'],
      [{ offDays: [1.5] }, 'offDays must be an array of integers between 0 (Sun) and 6 (Sat)'],
      [{ language: 'fr' }, 'language must be "en" or "ar"'],
      [{ displayName: 'ab' }, 'Display name must be 3 to 30 characters'],
      // A valid field next to an invalid one: the valid one must not land either.
      [{ name: 'After', offDays: [-1] }, 'offDays must be an array of integers between 0 (Sun) and 6 (Sat)'],
    ];
    for (const [body, message] of cases) {
      const res = await request(app).put('/api/auth/profile').set('Authorization', auth(user)).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.body.message, message, JSON.stringify(body));
    }
    const u = await reload(user);
    assert.equal(u.name, 'Before');
    assert.equal(u.dailyNewPages, 2);
    assert.equal(u.reviewIntensity, 'standard');
    assert.deepEqual(u.offDays, [5]);
    assert.equal(u.language, 'en');
    assert.equal(u.displayName ?? null, null);
  });

  test('profile: a token for an account that no longer exists is a 401, not a write', async () => {
    const user = await createUser();
    await User.deleteOne({ _id: user._id });
    const res = await request(app).put('/api/auth/profile').set('Authorization', auth(user)).send({ name: 'Ghost' });
    assert.equal(res.status, 401);
    assert.equal(await User.countDocuments(), 0, 'no account was created by the update');
  });
});
