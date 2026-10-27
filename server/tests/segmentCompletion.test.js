// H-03 (server part): a half-page plan's completion records the half it was
// given, never the whole page by accident.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor, daysAgo } = require('./helpers');
const app = require('../app');
const UserProgress = require('../models/UserProgress');

const complete = (auth, body) => request(app).post('/api/progress/complete').set('Authorization', auth).send(body);

describe('Segment-aware completion (H-03)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  const halfPlanUser = async (overrides = {}) => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date(), ...overrides });
    return { user, auth: `Bearer ${tokenFor(user._id)}` };
  };

  test('the audit repro: "Mark All" (no segment) on today\'s half task is refused, not recorded as the whole page', async () => {
    const { user, auth } = await halfPlanUser();
    const today = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.deepEqual(today.body.data.newPages[0].segment, { fromVerseKey: '1:1', toVerseKey: '1:4', half: 1 });

    const res = await complete(auth, { pageNumber: 1, type: 'new' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SEGMENT_REQUIRED');
    assert.deepEqual(res.body.data.segment, { fromVerseKey: '1:1', toVerseKey: '1:4', half: 1 });
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);

    // Sending the segment it names records exactly that half.
    const ok = await complete(auth, { pageNumber: 1, type: 'new', segment: res.body.data.segment });
    assert.equal(ok.status, 200);
    const doc = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(doc.toObject().segments.map((s) => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);
  });

  test('"Want more?" extras on a half plan are refused without their segment too', async () => {
    const { user, auth } = await halfPlanUser();
    const today = await request(app).get('/api/progress/today').set('Authorization', auth);
    const extraHalf = today.body.data.extraNewPages.find((p) => p.pageNumber === 2);
    assert.equal(extraHalf.segment.half, 1);
    const res = await complete(auth, { pageNumber: 2, type: 'new' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'SEGMENT_REQUIRED');
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  test('a malformed segment is a 400, never a silent whole-page completion', async () => {
    // A whole-page plan: before the fix every one of these recorded page 1 whole.
    const user = await createUser({ dailyNewPages: 1, planStartDate: new Date() });
    const auth = `Bearer ${tokenFor(user._id)}`;
    const bad = [
      { fromVerseKey: 1, toVerseKey: '1:4' },
      { fromVerseKey: '1:1' },
      {},
      { from: '1:1', to: '1:4' },
      { fromVerseKey: '1:1', toVerseKey: '2:1' }, // 2:1 is not on page 1
      'first half',
      ['1:1', '1:4'],
      { fromVerseKey: { $gt: '' }, toVerseKey: '1:4' },
    ];
    for (const segment of bad) {
      const res = await complete(auth, { pageNumber: 1, type: 'new', segment });
      assert.equal(res.status, 400, JSON.stringify(segment));
    }
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  test('wholePage: true and alreadyKnow are explicit whole-page completions', async () => {
    const { user, auth } = await halfPlanUser();
    const whole = await complete(auth, { pageNumber: 1, type: 'new', wholePage: true });
    assert.equal(whole.status, 200);
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!p1.segments || p1.segments.length === 0);

    // Page 2's first half is now today's extra; "I already know this" takes the page.
    const known = await complete(auth, { pageNumber: 2, type: 'new', alreadyKnow: true });
    assert.equal(known.status, 200);
    const p2 = await UserProgress.findOne({ userId: user._id, pageNumber: 2 });
    assert.ok(!p2.segments || p2.segments.length === 0);
    assert.equal(p2.memorizedDate.toISOString(), daysAgo(1).toISOString());
  });

  test('a remainder that finishes the page may be completed without its segment', async () => {
    const { user, auth } = await halfPlanUser({ planStartDate: daysAgo(3) });
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized',
      memorizedDate: daysAgo(1), lastReviewedDate: daysAgo(1), segments: [{ from: '1:1', to: '1:4' }],
    });
    const today = await request(app).get('/api/progress/today').set('Authorization', auth);
    assert.deepEqual(today.body.data.newPages[0].segment, { fromVerseKey: '1:5', toVerseKey: '1:7', half: 2 });

    const res = await complete(auth, { pageNumber: 1, type: 'new' });
    assert.equal(res.status, 200);
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!p1.segments || p1.segments.length === 0, 'the page is whole, exactly as with the segment');
  });

  test('whole-page plans and pages the half plan does not serve today are unaffected', async () => {
    const whole = await createUser({ dailyNewPages: 1, planStartDate: new Date() });
    assert.equal((await complete(`Bearer ${tokenFor(whole._id)}`, { pageNumber: 1, type: 'new', segment: null })).status, 200);

    const { auth } = await halfPlanUser();
    // Page 20 is nowhere in today's half-page plan.
    assert.equal((await complete(auth, { pageNumber: 20, type: 'new' })).status, 200);
  });
});
