// L-11: smaller scheduler inconsistencies.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor, addMemorizedPage, daysAgo } = require('./helpers');
const app = require('../app');
const UserProgress = require('../models/UserProgress');

describe('Scheduler fixes (L-11)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('getEstimate counts a partial page by its fraction, like the other stats', async () => {
    const user = await createUser({ dailyNewPages: 1, offDays: [] });
    const auth = `Bearer ${tokenFor(user._id)}`;
    // Page 1 is 4 of 7 verses; page 2 is whole.
    await UserProgress.create({ userId: user._id, pageNumber: 1, status: 'memorized', memorizedDate: daysAgo(2), lastReviewedDate: daysAgo(2), segments: [{ from: '1:1', to: '1:4' }] });
    await addMemorizedPage(user._id, 2, { memorizedDate: daysAgo(2), lastReviewedDate: daysAgo(2) });

    const res = await request(app).get('/api/progress/estimate').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.totalMemorized, 1.57);
    assert.equal(res.body.data.remainingPages, 602.43);
    assert.equal(res.body.data.estimatedDays, 603);

    const all = await request(app).get('/api/progress/all').set('Authorization', auth);
    assert.equal(res.body.data.totalMemorized, parseFloat(all.body.data.totalMemorized.toFixed(2)), 'agrees with /progress/all');
  });

  const auth = (user) => `Bearer ${tokenFor(user._id)}`;
  const complete = (user, body) => request(app).post('/api/progress/complete').set('Authorization', auth(user)).send(body);
  const uncomplete = (user, body) => request(app).post('/api/progress/uncomplete').set('Authorization', auth(user)).send(body);
  const iso = (d) => (d ? new Date(d).toISOString() : null);

  test('undoing a review restores the previous lastReviewedDate and count, not "yesterday"', async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 3, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(5), reviewCount: 6 });
    assert.equal((await complete(user, { pageNumber: 3, type: 'review' })).status, 200);
    assert.equal((await uncomplete(user, { pageNumber: 3, type: 'review' })).status, 200);
    const p3 = await UserProgress.findOne({ userId: user._id, pageNumber: 3 });
    assert.equal(iso(p3.lastReviewedDate), iso(daysAgo(5)));
    assert.equal(p3.reviewCount, 6);
  });

  test('undoing the first review of a never-reviewed page puts it back to never reviewed', async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 3, { memorizedDate: daysAgo(30), lastReviewedDate: null, reviewCount: 0 });
    await complete(user, { pageNumber: 3, type: 'review' });
    await uncomplete(user, { pageNumber: 3, type: 'review' });
    const p3 = await UserProgress.findOne({ userId: user._id, pageNumber: 3 });
    assert.equal(p3.lastReviewedDate, null);
    assert.equal(p3.reviewCount, 0);
  });

  test('undoing a review that was not made today is refused and changes nothing', async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 3, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(5), reviewCount: 6 });
    const res = await uncomplete(user, { pageNumber: 3, type: 'review' });
    assert.equal(res.status, 400);
    const p3 = await UserProgress.findOne({ userId: user._id, pageNumber: 3 });
    assert.equal(iso(p3.lastReviewedDate), iso(daysAgo(5)));
    assert.equal(p3.reviewCount, 6);
  });

  test("'new' on a page that is already fully memorized is refused, and its history survives a later undo", async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 3, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(2), reviewCount: 9 });
    const res = await complete(user, { pageNumber: 3, type: 'new' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'ALREADY_MEMORIZED');
    // A segment must not shrink the full page back to a part either.
    assert.equal((await complete(user, { pageNumber: 3, type: 'new', segment: { fromVerseKey: '2:6', toVerseKey: '2:7' } })).status, 409);
    // The audit's sequence ended with an undo that deleted the page.
    assert.equal((await uncomplete(user, { pageNumber: 3, type: 'new' })).status, 400);
    const p3 = await UserProgress.findOne({ userId: user._id, pageNumber: 3 });
    assert.equal(iso(p3.memorizedDate), iso(daysAgo(30)));
    assert.equal(p3.reviewCount, 9);
    assert.ok(!p3.segments || p3.segments.length === 0);
  });

  test("undoing today's second half restores the first half memorized on an earlier day", async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: daysAgo(3) });
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized', reviewCount: 1,
      memorizedDate: daysAgo(1), lastReviewedDate: daysAgo(1), segments: [{ from: '1:1', to: '1:4' }],
    });
    assert.equal((await complete(user, { pageNumber: 1, type: 'new', segment: { fromVerseKey: '1:5', toVerseKey: '1:7' } })).status, 200);
    const full = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!full.segments || full.segments.length === 0);

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'new' })).status, 200);
    const back = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(back, 'the page is not deleted');
    assert.deepEqual(back.toObject().segments.map((s) => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);
    assert.equal(iso(back.memorizedDate), iso(daysAgo(1)));
    assert.equal(back.reviewCount, 1);
  });

  test('two halves done the same day undo one at a time, then the page is gone', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: new Date() });
    await complete(user, { pageNumber: 1, type: 'new', segment: { fromVerseKey: '1:1', toVerseKey: '1:4' } });
    await complete(user, { pageNumber: 1, type: 'new', segment: { fromVerseKey: '1:5', toVerseKey: '1:7' } });

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'new' })).status, 200);
    const half = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(half.toObject().segments.map((s) => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'new' })).status, 200);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  test('a fresh page memorized and undone today is removed, as before', async () => {
    const user = await createUser();
    await complete(user, { pageNumber: 4, type: 'new' });
    assert.equal((await uncomplete(user, { pageNumber: 4, type: 'new' })).status, 200);
    assert.equal(await UserProgress.countDocuments({ userId: user._id }), 0);
  });

  // Day 2 of a half-page plan: page 1's first half (memorized yesterday) is due
  // for review while its second half is today's new task, so the dashboard
  // shows page 1 twice. A review used to overwrite the 'new' snapshot, and the
  // undo of the 'new' then deleted the page, yesterday's half with it.
  const halfDayTwo = async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: daysAgo(1) });
    await UserProgress.create({
      userId: user._id, pageNumber: 1, status: 'memorized', reviewCount: 1,
      memorizedDate: daysAgo(1), lastReviewedDate: daysAgo(1), segments: [{ from: '1:1', to: '1:4' }],
    });
    const today = await request(app).get('/api/progress/today').set('Authorization', auth(user));
    assert.deepEqual(today.body.data.newPages[0].segment, { fromVerseKey: '1:5', toVerseKey: '1:7', half: 2 });
    assert.ok(today.body.data.recentReviewPages.some((p) => p.pageNumber === 1), 'page 1 is also a review task');
    return user;
  };
  const segs = (doc) => (doc.toObject().segments || []).map((s) => ({ from: s.from, to: s.to }));
  const todayIso = () => new Date().toISOString().slice(0, 10);

  test('new, then review, then undo new: the first half survives and the review stands', async () => {
    const user = await halfDayTwo();
    assert.equal((await complete(user, { pageNumber: 1, type: 'new', segment: { fromVerseKey: '1:5', toVerseKey: '1:7' } })).status, 200);
    assert.equal((await complete(user, { pageNumber: 1, type: 'review' })).status, 200);

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'new' })).status, 200);
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(p1, 'the page is not deleted');
    assert.deepEqual(segs(p1), [{ from: '1:1', to: '1:4' }]);
    assert.equal(iso(p1.memorizedDate), iso(daysAgo(1)));
    assert.equal(p1.reviewCount, 2, "only the 'new' increment is taken back");
    assert.equal(iso(p1.lastReviewedDate).slice(0, 10), todayIso(), "today's review still stands");

    // Undoing the review afterwards lands on yesterday's state exactly.
    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'review' })).status, 200);
    const back = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.equal(iso(back.lastReviewedDate), iso(daysAgo(1)));
    assert.equal(back.reviewCount, 1);
    assert.deepEqual(segs(back), [{ from: '1:1', to: '1:4' }]);
  });

  test('review, then new, then undo review, then undo new: back to yesterday exactly', async () => {
    const user = await halfDayTwo();
    assert.equal((await complete(user, { pageNumber: 1, type: 'review' })).status, 200);
    assert.equal((await complete(user, { pageNumber: 1, type: 'new', segment: { fromVerseKey: '1:5', toVerseKey: '1:7' } })).status, 200);

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'review' })).status, 200);
    const mid = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(segs(mid), [], 'the second half is still memorized');
    assert.equal(mid.reviewCount, 2);

    assert.equal((await uncomplete(user, { pageNumber: 1, type: 'new' })).status, 200);
    const back = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(segs(back), [{ from: '1:1', to: '1:4' }]);
    assert.equal(iso(back.memorizedDate), iso(daysAgo(1)));
    assert.equal(iso(back.lastReviewedDate), iso(daysAgo(1)));
    assert.equal(back.reviewCount, 1);
  });

  test("undoing a 'new' with no snapshot never deletes a page that existed before today", async () => {
    const user = await createUser({ dailyNewPages: 0.5 });
    // A completion recorded before snapshots existed: memorizedDate is today,
    // but the document (and its earlier history) is older.
    await UserProgress.collection.insertOne({
      userId: user._id, pageNumber: 1, status: 'memorized', reviewCount: 4,
      memorizedDate: new Date(), lastReviewedDate: new Date(), segments: [],
      createdAt: daysAgo(10), updatedAt: new Date(),
    });
    const res = await uncomplete(user, { pageNumber: 1, type: 'new' });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'UNDO_UNAVAILABLE');
    assert.equal(await UserProgress.countDocuments({ userId: user._id, pageNumber: 1 }), 1);
  });

  test('undoing a review on a page that was only memorized today is refused, not guessed', async () => {
    const user = await createUser();
    await complete(user, { pageNumber: 4, type: 'new' });
    const res = await uncomplete(user, { pageNumber: 4, type: 'review' });
    assert.equal(res.status, 400);
    const p4 = await UserProgress.findOne({ userId: user._id, pageNumber: 4 });
    assert.equal(p4.reviewCount, 1);
  });

  test('the undo snapshot never leaks into responses', async () => {
    const user = await createUser();
    await complete(user, { pageNumber: 4, type: 'new' });
    const doc = await UserProgress.findOne({ userId: user._id, pageNumber: 4 });
    assert.equal(doc.undoNew, undefined);
    const raw = await UserProgress.collection.findOne({ userId: user._id, pageNumber: 4 });
    assert.equal(raw.undoNew.existed, false);
    const all = await request(app).get('/api/progress/all').set('Authorization', auth(user));
    assert.ok(!JSON.stringify(all.body).includes('undo'));
  });
});
