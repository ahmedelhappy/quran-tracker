const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  connect, disconnect, clearDatabase, seedMetadata,
  createUser, tokenFor,
} = require('./helpers');
const app = require('../app');
const UserProgress = require('../models/UserProgress');
const segments = require('../utils/segments');

// --- Pure unit-compile tests (no DB — server/utils/segments.js reads straight
// from the committed quranStructure.json, same as FROM_END_ORDER elsewhere). ---
describe('segments.js — unit compilation', () => {
  test('juz/hizb/rub ranges match known mushaf boundaries', () => {
    assert.deepEqual(segments.compileUnitRange('juz', 1), { from: '1:1', to: '2:141' });
    assert.deepEqual(segments.compileUnitRange('juz', 2), { from: '2:142', to: '2:252' });
    assert.deepEqual(segments.compileUnitRange('hizb', 1), { from: '1:1', to: '2:74' });
    assert.deepEqual(segments.compileUnitRange('hizb', 2), { from: '2:75', to: '2:141' });
    assert.deepEqual(segments.compileUnitRange('surah', 1), { from: '1:1', to: '1:7' });
  });

  test('a rub el-hizb starting mid-page produces a partial first page, a full middle page, and a partial last page', () => {
    // Rub 2 (2:26–2:43) starts partway through page 5, fully covers page 6, and
    // ends partway through page 7.
    const range = segments.compileUnitRange('rub', 2);
    assert.deepEqual(range, { from: '2:26', to: '2:43' });

    const pages = segments.rangeToPages(range.from, range.to);
    assert.deepEqual(pages.map(p => p.pageNumber), [5, 6, 7]);

    assert.equal(pages[0].coversWholePage, false);
    assert.deepEqual(pages[0], { pageNumber: 5, fromVerseKey: '2:26', toVerseKey: '2:29', coversWholePage: false });

    assert.equal(pages[1].coversWholePage, true);
    assert.deepEqual(pages[1], { pageNumber: 6, fromVerseKey: '2:30', toVerseKey: '2:37', coversWholePage: true });

    assert.equal(pages[2].coversWholePage, false);
    assert.deepEqual(pages[2], { pageNumber: 7, fromVerseKey: '2:38', toVerseKey: '2:43', coversWholePage: false });
  });

  test('compileUnitRange rejects out-of-range numbers and non-scalar refs', () => {
    assert.throws(() => segments.compileUnitRange('juz', 0), /juz must be an integer/);
    assert.throws(() => segments.compileUnitRange('juz', 31), /juz must be an integer/);
    assert.throws(() => segments.compileUnitRange('juz', { $gt: 0 }), /juz must be an integer/);
    assert.throws(() => segments.compileUnitRange('rub', 241), /rub must be an integer/);
    assert.throws(() => segments.compileUnitRange('verses', { from: '999:1', to: '2:2' }), /Unknown verse key/);
    assert.throws(() => segments.compileUnitRange('bogus', 1), /unit must be one of/);
  });

  test('verses ref normalizes a reversed from/to pair', () => {
    assert.deepEqual(segments.compileUnitRange('verses', { from: '2:5', to: '2:2' }), { from: '2:2', to: '2:5' });
  });

  test('addRangeToPage merges into full coverage and pageFraction reports it correctly', () => {
    const meta = segments.PAGE_BY_NUMBER.get(1); // 1:1..1:7, 7 verses
    const firstHalf = segments.addRangeToPage(undefined, '1:1', '1:4', meta);
    assert.equal(firstHalf.full, false);
    assert.equal(segments.pageFraction(1, firstHalf.segments), 4 / 7);

    const completed = segments.addRangeToPage(firstHalf.segments, '1:5', '1:7', meta);
    assert.equal(completed.full, true);
    assert.deepEqual(completed.segments, []);
    assert.equal(segments.pageFraction(1, completed.segments), 1);
  });

  test('removeRangeFromPage: a full page minus a range becomes segments; removing everything deletes it', () => {
    const meta = segments.PAGE_BY_NUMBER.get(1);
    const afterRemovingMiddle = segments.removeRangeFromPage(undefined, '1:3', '1:5', meta);
    assert.equal(afterRemovingMiddle.deleted, false);
    assert.deepEqual(afterRemovingMiddle.segments, [{ from: '1:1', to: '1:2' }, { from: '1:6', to: '1:7' }]);

    const removedAll = segments.removeRangeFromPage(undefined, '1:1', '1:7', meta);
    assert.deepEqual(removedAll, { deleted: true });
  });
});

// --- PUT /api/progress/units — add/remove round trips against the real endpoint. ---
describe('PUT /api/progress/units', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('protected: rejects requests without a token', async () => {
    const res = await request(app).put('/api/progress/units').send({ action: 'add', unit: 'page', ref: 1 });
    assert.equal(res.status, 401);
  });

  test('adding a rub el-hizb creates a partial first page, a full middle page, and leaves untouched pages alone', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    const res = await request(app)
      .put('/api/progress/units')
      .set('Authorization', auth)
      .send({ action: 'add', unit: 'rub', ref: 2 });

    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.affectedPages.map(p => p.pageNumber).sort((a, b) => a - b),
      [5, 6, 7]
    );

    const page5 = await UserProgress.findOne({ userId: user._id, pageNumber: 5 });
    assert.equal(page5.status, 'memorized');
    assert.deepEqual(page5.toObject().segments.map(s => ({ from: s.from, to: s.to })), [{ from: '2:26', to: '2:29' }]);

    const page6 = await UserProgress.findOne({ userId: user._id, pageNumber: 6 });
    assert.equal(page6.status, 'memorized');
    assert.ok(!page6.segments || page6.segments.length === 0); // full page

    const page4 = await UserProgress.findOne({ userId: user._id, pageNumber: 4 });
    assert.equal(page4, null); // untouched
  });

  test('add then remove the same unit round-trips back to no progress', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'add', unit: 'rub', ref: 2 });
    const removeRes = await request(app)
      .put('/api/progress/units')
      .set('Authorization', auth)
      .send({ action: 'remove', unit: 'rub', ref: 2 });

    assert.equal(removeRes.status, 200);
    const remaining = await UserProgress.find({ userId: user._id });
    assert.equal(remaining.length, 0);
    assert.equal(removeRes.body.data.totalMemorized, 0);
  });

  test('removing part of a full page leaves it with segments for the remainder', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'add', unit: 'page', ref: 1 });
    const res = await request(app)
      .put('/api/progress/units')
      .set('Authorization', auth)
      .send({ action: 'remove', unit: 'verses', ref: { from: '1:5', to: '1:7' } });

    assert.equal(res.status, 200);
    const doc = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.deepEqual(doc.toObject().segments.map(s => ({ from: s.from, to: s.to })), [{ from: '1:1', to: '1:4' }]);
  });

  test('fractional stats: totalMemorized and fullPages reflect a partial page correctly', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Page 1 has 7 verses; adding verses 1:1-1:4 covers 4/7 of it.
    const res = await request(app)
      .put('/api/progress/units')
      .set('Authorization', auth)
      .send({ action: 'add', unit: 'verses', ref: { from: '1:1', to: '1:4' } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.fullPages, 0);
    assert.ok(Math.abs(res.body.data.totalMemorized - 4 / 7) < 1e-9);

    const allProgress = await request(app).get('/api/progress/all').set('Authorization', auth);
    assert.equal(allProgress.status, 200);
    assert.equal(allProgress.body.data.fullPages, 0);
    assert.ok(Math.abs(allProgress.body.data.totalMemorized - 4 / 7) < 1e-9);
    assert.deepEqual(allProgress.body.data.partialPages, [{ pageNumber: 1, fraction: 4 / 7 }]);
    // memorizedPages still lists the page — it has SOME progress.
    assert.deepEqual(allProgress.body.data.memorizedPages, [1]);

    const juzProgress = await request(app).get('/api/progress/juz').set('Authorization', auth);
    assert.equal(juzProgress.status, 200);
    const juz1 = juzProgress.body.data.find(j => j.juzNumber === 1);
    assert.ok(Math.abs(juz1.memorizedPages - 4 / 7) < 1e-9);
    assert.equal(juz1.fullPages, 0);
    assert.equal(juz1.isComplete, false);
  });

  test('rejects an invalid unit or out-of-range ref with 400', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    const badUnit = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'add', unit: 'bogus', ref: 1 });
    assert.equal(badUnit.status, 400);

    const badRef = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'add', unit: 'juz', ref: 99 });
    assert.equal(badRef.status, 400);

    const badAction = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'toggle', unit: 'juz', ref: 1 });
    assert.equal(badAction.status, 400);
  });
});
