// L-10: GET /progress/today writes nothing; the streak tick it used to do lives
// in POST /progress/checkin, which the dashboard sends after every load.
//
// The "streak semantics" suite drives the app only through visit() — load
// today's plan, then check in — and asserts the stored streak state. It passes
// unchanged against the code from before the move (where the POST is a 404 and
// the GET did the tick), which is what shows the semantics are identical.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor, addMemorizedPage, daysAgo } = require('./helpers');
const app = require('../app');
const User = require('../models/User');

const auth = (user) => `Bearer ${tokenFor(user._id)}`;
const dow = (n) => daysAgo(n).getUTCDay(); // weekday n days ago (0 = today)
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const todayStr = () => new Date().toISOString().slice(0, 10);

// Open the dashboard: read today's plan, then check in (as the client does).
const visit = async (user, { ignoreOffDay = false } = {}) => {
  const get = await request(app).get(`/api/progress/today${ignoreOffDay ? '?ignoreOffDay=true' : ''}`).set('Authorization', auth(user));
  assert.equal(get.status, 200);
  await request(app).post('/api/progress/checkin').set('Authorization', auth(user)).send(ignoreOffDay ? { ignoreOffDay: true } : {});
};
const reload = (user) => User.findById(user._id);

// A user with nothing to do today: new memorization paused, no reviews due.
const idleUser = (overrides) => createUser({
  pauseNewMemorization: true, cycleReviewCount: 0, recentReviewCount: 0, offDays: [], ...overrides,
});
// A user with work still pending today (new pages due).
const busyUser = (overrides) => createUser({ dailyNewPages: 1, planStartDate: daysAgo(10), offDays: [], ...overrides });

describe('Streak semantics are unchanged by moving the tick (L-10)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('off day, active yesterday: the visit keeps the streak alive without raising it', async () => {
    const user = await busyUser({ offDays: [dow(0)], currentStreak: 5, lastActiveDate: daysAgo(1) });
    await visit(user);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), todayStr());
    assert.equal(u.currentStreak, 5);
    assert.equal(u.prevStreak, 5);
    assert.equal(day(u.prevActiveDate), day(daysAgo(1)));
  });

  test('off day after a missed working day: no tick, and the next completion restarts at 1', async () => {
    const user = await busyUser({ offDays: [dow(0)], currentStreak: 5, lastActiveDate: daysAgo(3) });
    await visit(user);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), day(daysAgo(3)));
    const done = await request(app).post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber: 1, type: 'new' });
    assert.equal(done.body.data.newStreak, 1);
  });

  test('a view-only-complete day, active yesterday: the visit ticks', async () => {
    const user = await idleUser({ currentStreak: 4, lastActiveDate: daysAgo(1) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });
    await visit(user);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), todayStr());
    assert.equal(u.currentStreak, 4);
    assert.equal(u.prevStreak, 4);
  });

  test('a day with work still pending does not tick on a visit', async () => {
    const user = await busyUser({ currentStreak: 4, lastActiveDate: daysAgo(1) });
    await visit(user);
    assert.equal(day((await reload(user)).lastActiveDate), day(daysAgo(1)));
  });

  test('a multi-day gap with no off days: no tick even with nothing to do, and the streak restarts', async () => {
    const user = await idleUser({ currentStreak: 9, lastActiveDate: daysAgo(3) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });
    await visit(user);
    assert.equal(day((await reload(user)).lastActiveDate), day(daysAgo(3)));
    const done = await request(app).post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber: 1, type: 'review' });
    assert.equal(done.body.data.newStreak, 1);
  });

  test('a multi-day gap made only of off days: a view-only-complete visit ticks', async () => {
    const user = await idleUser({ offDays: [dow(1), dow(2)], currentStreak: 9, lastActiveDate: daysAgo(3) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });
    await visit(user);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), todayStr());
    assert.equal(u.currentStreak, 9);
    assert.equal(day(u.prevActiveDate), day(daysAgo(3)));
  });

  test('a multi-day gap made only of off days, with work pending: no tick, and completing continues the streak', async () => {
    const user = await busyUser({ offDays: [dow(1), dow(2)], currentStreak: 9, lastActiveDate: daysAgo(3) });
    await visit(user);
    assert.equal(day((await reload(user)).lastActiveDate), day(daysAgo(3)));
    const done = await request(app).post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber: 1, type: 'new' });
    assert.equal(done.body.data.newStreak, 10);
  });

  test('undo after a tick: extra work then undo restores the pre-tick streak and date', async () => {
    const user = await idleUser({ currentStreak: 6, lastActiveDate: daysAgo(1) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });
    await visit(user);
    assert.equal(day((await reload(user)).lastActiveDate), todayStr());

    // An extra review on the already-ticked day does not raise the streak…
    const done = await request(app).post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber: 1, type: 'review' });
    assert.equal(done.body.data.newStreak, 6);
    // …and undoing it leaves no completion today, so the pre-tick pair comes back.
    const undo = await request(app).post('/api/progress/uncomplete').set('Authorization', auth(user)).send({ pageNumber: 1, type: 'review' });
    assert.equal(undo.body.data.currentStreak, 6);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), day(daysAgo(1)));
    assert.equal(u.currentStreak, 6);
  });

  test('a never-active user is never ticked, even on an off day', async () => {
    const user = await busyUser({ offDays: [dow(0)], currentStreak: 0, lastActiveDate: null });
    await visit(user);
    assert.equal((await reload(user)).lastActiveDate, null);
  });

  test('"memorize anyway" on an off day ticks only once the day is done', async () => {
    const user = await busyUser({ offDays: [dow(0)], currentStreak: 3, lastActiveDate: daysAgo(1) });
    await visit(user, { ignoreOffDay: true }); // work pending → no tick
    assert.equal(day((await reload(user)).lastActiveDate), day(daysAgo(1)));
    await visit(user); // the plain off-day view → tick
    assert.equal(day((await reload(user)).lastActiveDate), todayStr());
  });
});

describe('GET /progress/today is a pure read (L-10)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  const rawUser = async (user) => User.collection.findOne({ _id: user._id });

  test('on an off day and on a view-only-complete day the GET leaves the user untouched', async () => {
    const offDay = await busyUser({ offDays: [dow(0)], currentStreak: 5, lastActiveDate: daysAgo(1) });
    const idle = await idleUser({ currentStreak: 4, lastActiveDate: daysAgo(1) });
    await addMemorizedPage(idle._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });

    for (const user of [offDay, idle]) {
      const beforeDoc = await rawUser(user);
      for (const q of ['', '?ignoreOffDay=true']) {
        const res = await request(app).get(`/api/progress/today${q}`).set('Authorization', auth(user));
        assert.equal(res.status, 200);
      }
      assert.deepEqual(await rawUser(user), beforeDoc);
    }
  });

  test('POST /checkin reports whether it ticked and ticks at most once a day', async () => {
    const user = await idleUser({ currentStreak: 4, lastActiveDate: daysAgo(1) });
    await addMemorizedPage(user._id, 1, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(30) });
    const first = await request(app).post('/api/progress/checkin').set('Authorization', auth(user)).send({});
    assert.equal(first.status, 200);
    assert.deepEqual(first.body.data, { ticked: true, currentStreak: 4 });
    const second = await request(app).post('/api/progress/checkin').set('Authorization', auth(user)).send({});
    assert.equal(second.body.data.ticked, false);
    assert.equal((await reload(user)).prevStreak, 4);
  });

  test('POST /checkin requires a token and a boolean flag', async () => {
    assert.equal((await request(app).post('/api/progress/checkin').send({})).status, 401);
    const user = await idleUser();
    assert.equal((await request(app).post('/api/progress/checkin').set('Authorization', auth(user)).send({ ignoreOffDay: { $ne: 1 } })).status, 400);
  });
});
