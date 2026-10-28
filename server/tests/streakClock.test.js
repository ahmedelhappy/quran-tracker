// Streak and off-day rules at the exact edges of the UTC day, on a pinned clock.
//
// The other streak suites build their cases by back-dating documents against the
// real "now", so they cannot place a request at 23:59:59.999Z, and a run that
// straddles midnight sees "today" move under it. Here every request runs at a
// time the test sets (utils/clock), so each boundary is hit on purpose and the
// result never depends on when the suite runs.
//
// The week used throughout: Mon 2026-03-02 … Sun 2026-03-08 (Friday = 03-06).
const { test, before, after, beforeEach, afterEach, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const clock = require('../utils/clock');
const { isStreakContinued, effectiveStreak } = require('../utils/streak');

const FRIDAY = 5;
const at = (iso) => new Date(iso);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// The time every controller reads while a test runs. A fresh Date per call:
// callers mutate what they get (setUTCHours) and must not share one object.
let current;
const setNow = (iso) => { current = at(iso); };

const auth = (user) => `Bearer ${tokenFor(user._id)}`;
const complete = (user, pageNumber, type = 'new') => request(app)
  .post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber, type });
const uncomplete = (user, pageNumber, type = 'new') => request(app)
  .post('/api/progress/uncomplete').set('Authorization', auth(user)).send({ pageNumber, type });
const today = (user) => request(app).get('/api/progress/today').set('Authorization', auth(user));
const checkIn = (user) => request(app).post('/api/progress/checkin').set('Authorization', auth(user)).send({});
const reload = (user) => User.findById(user._id);

// Completes a fresh page at `iso` and returns the streak the server reports.
let nextPage;
const completeAt = async (user, iso) => {
  setNow(iso);
  const res = await complete(user, nextPage++);
  assert.equal(res.status, 200, `complete at ${iso}: ${JSON.stringify(res.body)}`);
  return res.body.data.newStreak;
};

describe('Streak day boundaries on a pinned clock (M-15)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    nextPage = 1;
    setNow('2026-03-02T12:00:00.000Z');
    mock.method(clock, 'now', () => new Date(current));
  });
  afterEach(() => mock.restoreAll());

  test('the clock really is pinned: the server dates a completion at the pinned instant', async () => {
    const user = await createUser({ offDays: [] });
    await completeAt(user, '2026-03-04T08:30:00.000Z');
    const u = await reload(user);
    assert.equal(u.lastActiveDate.toISOString(), '2026-03-04T08:30:00.000Z');
  });

  test('23:59:59.999Z then 00:00:00.000Z are two days: the streak goes 1 → 2', async () => {
    const user = await createUser({ offDays: [] });
    assert.equal(await completeAt(user, '2026-03-03T23:59:59.999Z'), 1);
    assert.equal(await completeAt(user, '2026-03-04T00:00:00.000Z'), 2);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), '2026-03-04');
    assert.equal(u.prevStreak, 1);
    assert.equal(day(u.prevActiveDate), '2026-03-03');
  });

  test('00:00:00.000Z and 23:59:59.999Z of one day are the same day: counted once', async () => {
    const user = await createUser({ offDays: [] });
    assert.equal(await completeAt(user, '2026-03-04T00:00:00.000Z'), 1);
    assert.equal(await completeAt(user, '2026-03-04T23:59:59.999Z'), 1);
    // The snapshot is the one from the day's first action, not overwritten.
    const u = await reload(user);
    assert.equal(u.prevStreak, 0);
    assert.equal(u.prevActiveDate, null);
  });

  // [last active, next completion, rest days, expected streak after it]. The
  // first completion always makes the streak 1, so 2 means "continued".
  const GAPS = [
    ['a gap of exactly one day continues', '2026-03-02T22:00:00Z', '2026-03-03T01:00:00Z', [], 2],
    ['a gap of two days with no rest day resets', '2026-03-02T22:00:00Z', '2026-03-04T01:00:00Z', [], 1],
    ['a two-day gap whose skipped day is a rest day continues', '2026-03-05T12:00:00Z', '2026-03-07T12:00:00Z', [FRIDAY], 2],
    ['a gap across two rest days in a row continues', '2026-03-05T12:00:00Z', '2026-03-08T12:00:00Z', [FRIDAY, 6], 2],
    ['a gap with one rest day and one missed working day resets', '2026-03-05T12:00:00Z', '2026-03-08T12:00:00Z', [FRIDAY], 1],
    ['a rest day on the last-active day itself does not bridge a later miss', '2026-03-06T12:00:00Z', '2026-03-08T12:00:00Z', [FRIDAY], 1],
    ['a week away is a reset even with most days off', '2026-03-02T12:00:00Z', '2026-03-09T12:00:00Z', [2, 3, 4, 5, 6], 1],
    ['the same week away with every skipped day off continues', '2026-03-02T12:00:00Z', '2026-03-09T12:00:00Z', [0, 2, 3, 4, 5, 6], 2],
  ];
  for (const [name, first, second, offDays, expected] of GAPS) {
    test(name, async () => {
      const user = await createUser({ offDays });
      assert.equal(await completeAt(user, first), 1);
      assert.equal(await completeAt(user, second), expected);
    });
  }

  test('a Friday rest day starts at 00:00:00.000Z and ends at 23:59:59.999Z', async () => {
    const user = await createUser({ offDays: [FRIDAY], dailyNewPages: 1, planStartDate: at('2026-02-20T00:00:00Z') });
    const cases = [
      ['2026-03-05T23:59:59.999Z', false],
      ['2026-03-06T00:00:00.000Z', true],
      ['2026-03-06T23:59:59.999Z', true],
      ['2026-03-07T00:00:00.000Z', false],
    ];
    for (const [iso, isOffDay] of cases) {
      setNow(iso);
      const res = await today(user);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.isOffDay, isOffDay, iso);
      if (isOffDay) assert.deepEqual(res.body.data.newPages, [], `${iso}: a rest day holds no work`);
      else assert.ok(res.body.data.newPages.length > 0, `${iso}: a working day has today's new page`);
    }
  });

  test('every weekday at noon: only Friday is the rest day', async () => {
    const user = await createUser({ offDays: [FRIDAY] });
    for (let d = 2; d <= 8; d++) {
      const iso = `2026-03-0${d}T12:00:00.000Z`;
      setNow(iso);
      const res = await today(user);
      assert.equal(res.body.data.isOffDay, at(iso).getUTCDay() === FRIDAY, iso);
    }
  });

  test('a rest-day check-in in its last millisecond keeps the streak, and Saturday 00:00 continues it', async () => {
    const user = await createUser({ offDays: [FRIDAY] });
    await completeAt(user, '2026-03-04T12:00:00Z');
    assert.equal(await completeAt(user, '2026-03-05T23:59:59.999Z'), 2);

    setNow('2026-03-06T23:59:59.999Z');
    const res = await checkIn(user);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ticked, true);
    let u = await reload(user);
    assert.equal(u.currentStreak, 2, 'a rest day keeps the streak but does not raise it');
    assert.equal(day(u.lastActiveDate), '2026-03-06');

    assert.equal(await completeAt(user, '2026-03-07T00:00:00.000Z'), 3);
    u = await reload(user);
    assert.equal(day(u.prevActiveDate), '2026-03-06');
  });

  test('a check-in one millisecond after the rest day is a working day, and does not tick', async () => {
    // Active Thursday, rest Friday, nothing done Saturday yet: Saturday has work
    // pending, so opening the app must not tick.
    const user = await createUser({ offDays: [FRIDAY], dailyNewPages: 1, planStartDate: at('2026-02-20T00:00:00Z') });
    await completeAt(user, '2026-03-05T12:00:00Z');
    setNow('2026-03-07T00:00:00.000Z');
    const res = await checkIn(user);
    assert.equal(res.body.data.ticked, false);
    const u = await reload(user);
    assert.equal(day(u.lastActiveDate), '2026-03-05');
  });

  test('undo works until 23:59:59.999Z and is refused from 00:00:00.000Z', async () => {
    const user = await createUser({ offDays: [] });
    await completeAt(user, '2026-03-03T12:00:00Z'); // page 1, streak 1

    // Page 2 at the very end of Wednesday, undone in the same millisecond's day.
    assert.equal(await completeAt(user, '2026-03-04T23:59:59.000Z'), 2);
    setNow('2026-03-04T23:59:59.999Z');
    let res = await uncomplete(user, 2);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.currentStreak, 1, 'the undo nets the day out');
    let u = await reload(user);
    assert.equal(day(u.lastActiveDate), '2026-03-03');

    // Page 3 at the same moment, but the undo lands one millisecond into Thursday.
    assert.equal(await completeAt(user, '2026-03-04T23:59:59.999Z'), 2);
    setNow('2026-03-05T00:00:00.000Z');
    res = await uncomplete(user, 3);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Page was not memorized today');
    u = await reload(user);
    assert.equal(u.currentStreak, 2, "yesterday's completion stands");
    assert.equal(day(u.lastActiveDate), '2026-03-04');
  });

  test('a review undone after midnight is refused and keeps its date', async () => {
    const user = await createUser({ offDays: [] });
    await completeAt(user, '2026-03-02T12:00:00Z'); // page 1 memorized
    setNow('2026-03-03T23:59:59.999Z');
    assert.equal((await complete(user, 1, 'review')).status, 200);
    setNow('2026-03-04T00:00:00.000Z');
    const res = await uncomplete(user, 1, 'review');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Page was not reviewed today');
  });

  test("documents are stamped by the pinned clock, so a snapshot-less undo of today's page deletes it", async () => {
    // Far from the real date on purpose: a createdAt from the wall clock could
    // never match it, and the legacy undo branch compares exactly that.
    setNow('2031-07-09T10:00:00.000Z');
    const user = await createUser({ offDays: [] });
    assert.equal(user.createdAt.toISOString(), '2031-07-09T10:00:00.000Z');
    // A completion recorded before undo snapshots existed: no undoNew.
    const legacy = await UserProgress.create({
      userId: user._id, pageNumber: 4, status: 'memorized', memorizedDate: clock.now(),
    });
    assert.equal(legacy.createdAt.toISOString(), '2031-07-09T10:00:00.000Z');

    setNow('2031-07-09T18:00:00.000Z');
    const res = await uncomplete(user, 4);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(await UserProgress.countDocuments({ userId: user._id, pageNumber: 4 }), 0);
  });
});

describe('isStreakContinued / effectiveStreak against a pinned clock', () => {
  afterEach(() => mock.restoreAll());
  const pin = (iso) => mock.method(clock, 'now', () => at(iso));

  test('active Monday: alive through Tuesday 23:59:59.999Z, broken at Wednesday 00:00:00.000Z', () => {
    const monday = at('2026-03-02T00:00:00.000Z');
    pin('2026-03-03T23:59:59.999Z');
    assert.equal(isStreakContinued(monday, []), true);
    mock.restoreAll();
    pin('2026-03-04T00:00:00.000Z');
    assert.equal(isStreakContinued(monday, []), false);
  });

  test('the time of day of the last activity does not matter, only its UTC date', () => {
    pin('2026-03-03T00:00:00.000Z');
    assert.equal(isStreakContinued(at('2026-03-02T23:59:59.999Z'), []), true);
    assert.equal(isStreakContinued(at('2026-03-01T23:59:59.999Z'), []), false);
  });

  test('never active is never a streak', () => {
    pin('2026-03-03T12:00:00Z');
    assert.equal(isStreakContinued(null, []), false);
  });

  test('the leaderboard streak decays to 0 the moment a working day is missed', () => {
    const user = { currentStreak: 9, lastActiveDate: at('2026-03-05T18:00:00Z'), offDays: [FRIDAY] };
    pin('2026-03-07T23:59:59.999Z'); // Friday was a rest day: still alive on Saturday
    assert.equal(effectiveStreak(user), 9);
    mock.restoreAll();
    pin('2026-03-08T00:00:00.000Z'); // Saturday was missed
    assert.equal(effectiveStreak(user), 0);
  });
});
