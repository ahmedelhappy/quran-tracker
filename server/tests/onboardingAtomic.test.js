// Onboarding saves the selection, the partial pages and the plan in ONE request,
// and is all or nothing (L-18). It used to be four requests with
// onboardingComplete set by the first, so a failure part-way left an account
// that counted as onboarded with only some of its pages and the default plan.
// These tests break the writes part-way on purpose and check what is left.
const { test, before, after, beforeEach, afterEach, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const clock = require('../utils/clock');

const NOW = '2026-03-04T10:00:00.000Z';
const YESTERDAY = '2026-03-03T00:00:00.000Z';

const onboard = (user, body) => request(app).post('/api/progress/onboarding')
  .set('Authorization', `Bearer ${tokenFor(user._id)}`).send(body);
const reload = (user) => User.findById(user._id).lean();
// The rows as the scheduler sees them, without the bookkeeping fields.
const rows = async (user) => (await UserProgress.find({ userId: user._id }).sort({ pageNumber: 1 }).lean())
  .map(({ pageNumber, status, segments, memorizedDate, lastReviewedDate, reviewCount }) => ({
    pageNumber, status, reviewCount,
    segments: (segments ?? []).map(({ from, to }) => ({ from, to })),
    memorizedDate: memorizedDate?.toISOString() ?? null,
    lastReviewedDate: lastReviewedDate?.toISOString() ?? null,
  }));

// Pages 1 and 3 whole, the first three verses of page 2 (2:1-2:5), and a plan.
const SELECTION = {
  memorizedPages: [1, 3],
  verseRanges: [{ from: '2:1', to: '2:3' }],
  dailyNewPages: 2,
  offDays: [5],
  memorizationDirection: 'fromEnd',
  newMemorizationStartPage: null,
  reviewIntensity: 'strong',
  cycleReviewCount: null,
  recentReviewCount: null,
};

const full = (pageNumber) => ({
  pageNumber, status: 'memorized', reviewCount: 0, segments: [],
  memorizedDate: YESTERDAY, lastReviewedDate: YESTERDAY,
});
const SAVED = [
  full(1),
  { ...full(2), segments: [{ from: '2:1', to: '2:3' }] },
  full(3),
];

describe('Onboarding in one request, all or nothing (L-18)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    mock.method(clock, 'now', () => new Date(NOW));
  });
  afterEach(() => mock.restoreAll());

  test('saves the pages, the partial page and the plan together', async () => {
    const user = await createUser({ onboardingComplete: false });
    const res = await onboard(user, SELECTION);
    assert.equal(res.status, 200);
    assert.deepEqual(await rows(user), SAVED);
    const u = await reload(user);
    assert.equal(u.onboardingComplete, true);
    assert.equal(u.dailyNewPages, 2);
    assert.deepEqual(u.offDays, [5]);
    assert.equal(u.memorizationDirection, 'fromEnd');
    assert.equal(u.reviewIntensity, 'strong');
    assert.equal(u.planStartDate.toISOString(), NOW);
  });

  test('a bad plan field or verse range is a 400 with a code, and writes nothing', async () => {
    const user = await createUser({ onboardingComplete: false });
    const cases = [
      [{ offDays: [9] }, 'INVALID_OFF_DAYS'],
      [{ memorizationDirection: 'sideways' }, 'INVALID_DIRECTION'],
      [{ reviewIntensity: 'max' }, 'INVALID_REVIEW_INTENSITY'],
      [{ newMemorizationStartPage: 4.5 }, 'INVALID_PAGE'],
      [{ verseRanges: [{ from: '2:1' }] }, 'INVALID_VERSE_RANGES'],
      [{ verseRanges: [{ from: '2:1', to: '2:300' }] }, 'INVALID_VERSE_RANGES'],
      [{ verseRanges: [{ from: '999:1', to: '2:1' }] }, 'INVALID_VERSE_RANGES'],
      [{ memorizedPages: [1, 700] }, 'INVALID_PAGE'],
    ];
    for (const [patch, code] of cases) {
      const res = await onboard(user, { ...SELECTION, ...patch });
      assert.equal(res.status, 400, JSON.stringify(patch));
      assert.equal(res.body.code, code, JSON.stringify(patch));
    }
    // The type gate refuses a verse range list that is not a list of objects.
    assert.equal((await onboard(user, { ...SELECTION, verseRanges: ['2:1-2:3'] })).status, 400);
    assert.deepEqual(await rows(user), []);
    const u = await reload(user);
    assert.equal(u.onboardingComplete, false);
    assert.deepEqual(u.offDays, []);
  });

  test('a write that fails part-way puts every row back, and a retry then succeeds', async () => {
    const user = await createUser({ onboardingComplete: false });
    // A page the account already had (reviewed five times) that the selection
    // includes: the failed request must hand it back exactly as it was.
    await UserProgress.create({
      userId: user._id, pageNumber: 3, status: 'memorized',
      memorizedDate: new Date('2026-01-10T00:00:00Z'), lastReviewedDate: new Date('2026-02-01T00:00:00Z'), reviewCount: 5,
    });
    const beforeRows = await rows(user);

    // The bulk write gets its first two operations in — page 1 created, page 3
    // overwritten (its five reviews reset to none) — then the connection "drops".
    const realBulkWrite = UserProgress.bulkWrite.bind(UserProgress);
    let midway = null;
    mock.method(UserProgress, 'bulkWrite', async (ops, options) => {
      await realBulkWrite(ops.slice(0, 2), options);
      midway = await rows(user);
      throw Object.assign(new Error('connection reset (simulated)'), { name: 'MongoNetworkError' });
    }, { times: 1 });

    const failed = await onboard(user, SELECTION);
    assert.equal(failed.status, 500);
    assert.deepEqual(midway.map((r) => [r.pageNumber, r.reviewCount]), [[1, 0], [3, 0]],
      'the failure really came after a row was created and the old one changed');
    assert.deepEqual(await rows(user), beforeRows, 'the rows are as they were before the request');
    const u = await reload(user);
    assert.equal(u.onboardingComplete, false, 'not onboarded with part of the selection');
    assert.deepEqual(u.offDays, [], 'and the plan is untouched');

    const retry = await onboard(user, SELECTION);
    assert.equal(retry.status, 200);
    assert.deepEqual(await rows(user), SAVED);
    assert.equal((await reload(user)).onboardingComplete, true);
  });

  test('when even putting the rows back fails, it says so and logs what to repair', async () => {
    const user = await createUser({ onboardingComplete: false });
    const realBulkWrite = UserProgress.bulkWrite.bind(UserProgress);
    let calls = 0;
    mock.method(UserProgress, 'bulkWrite', async (ops, options) => {
      calls += 1;
      if (calls === 1) {
        await realBulkWrite(ops.slice(0, 2), options);
        throw Object.assign(new Error('connection reset (simulated)'), { name: 'MongoNetworkError' });
      }
      throw new Error('still down (simulated)'); // the restore
    });
    // An account page the write changes, so the restore has a row to put back.
    await UserProgress.create({ userId: user._id, pageNumber: 3, status: 'memorized', reviewCount: 5 });
    const logged = [];
    mock.method(console, 'error', (...args) => { logged.push(args); });

    const res = await onboard(user, SELECTION);
    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'ONBOARDING_PARTIAL', 'not a plain error that promises nothing was saved');
    const [, details] = logged.find(([msg]) => /could not put the progress rows back/.test(msg)) ?? [];
    assert.ok(details, 'the failed restore is logged');
    assert.equal(details.userId, String(user._id));
    assert.deepEqual(details.touched, [1, 3, 2]);
    assert.match(details.writeError.message, /connection reset/);
    assert.match(details.restoreError.message, /still down/);
    assert.equal((await reload(user)).onboardingComplete, false);
  });

  test('if the final account update fails, the flag stays off and a retry finishes the job', async () => {
    const user = await createUser({ onboardingComplete: false });
    mock.method(User, 'updateOne', async () => { throw new Error('write concern timeout (simulated)'); }, { times: 1 });

    const failed = await onboard(user, SELECTION);
    assert.equal(failed.status, 500);
    const u = await reload(user);
    assert.equal(u.onboardingComplete, false, 'never "onboarded" without its plan');
    assert.deepEqual(u.offDays, []);
    assert.equal(u.dailyNewPages, 1);

    const retry = await onboard(user, SELECTION);
    assert.equal(retry.status, 200);
    assert.deepEqual(await rows(user), SAVED, 'the retry rewrites the same rows: nothing doubled');
    assert.equal((await reload(user)).onboardingComplete, true);
  });

  test('a failed account update takes the rows back too, so a smaller retry keeps only its own pages', async () => {
    const user = await createUser({ onboardingComplete: false });
    mock.method(User, 'updateOne', async () => { throw new Error('write concern timeout (simulated)'); }, { times: 1 });
    assert.equal((await onboard(user, SELECTION)).status, 500);
    assert.deepEqual(await rows(user), [], 'nothing of the failed selection is left');

    // Back to the (now empty) selection, a smaller choice this time: pages 2 and
    // 3 must not stay memorized from the attempt that failed.
    const retry = await onboard(user, { ...SELECTION, memorizedPages: [1], verseRanges: [] });
    assert.equal(retry.status, 200);
    assert.deepEqual(await rows(user), [full(1)]);
  });

  test('an account update that went in before its error keeps the rows it belongs with', async () => {
    const user = await createUser({ onboardingComplete: false });
    // A write-concern timeout: the update is applied, the reply still an error.
    const realUpdateOne = User.updateOne.bind(User);
    mock.method(User, 'updateOne', async (...args) => {
      await realUpdateOne(...args);
      throw new Error('write concern timeout (simulated)');
    }, { times: 1 });
    assert.equal((await onboard(user, SELECTION)).status, 500);
    assert.equal((await reload(user)).onboardingComplete, true);
    assert.deepEqual(await rows(user), SAVED, 'an onboarded account is not left without its pages');
  });

  test('sending it twice (a response lost after the server finished) changes nothing more', async () => {
    const user = await createUser({ onboardingComplete: false });
    assert.equal((await onboard(user, SELECTION)).status, 200);
    const first = await rows(user);
    assert.equal((await onboard(user, SELECTION)).status, 200);
    assert.deepEqual(await rows(user), first);
  });

  test('a verse range on a page the account already has whole leaves it whole', async () => {
    const user = await createUser({ onboardingComplete: false });
    await UserProgress.create({ userId: user._id, pageNumber: 2, status: 'memorized', reviewCount: 2 });
    const res = await onboard(user, { verseRanges: [{ from: '2:1', to: '2:3' }] });
    assert.equal(res.status, 200);
    const [page2] = await rows(user);
    assert.deepEqual(page2.segments, [], 'still the whole page');
    assert.equal(page2.reviewCount, 2, 'with its history');
  });
});
