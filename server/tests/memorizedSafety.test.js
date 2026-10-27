// H-02 (server part): a stale or empty client view can no longer wipe progress
// through the whole-set replace, and the delta endpoints touch only named pages.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor, addMemorizedPage, daysAgo } = require('./helpers');
const app = require('../app');
const UserProgress = require('../models/UserProgress');

const pagesOf = async (userId) => (await UserProgress.find({ userId, status: 'memorized' }).sort({ pageNumber: 1 })).map((d) => d.pageNumber);

describe('PUT /api/progress/memorized needs removals confirmed', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(60);
  });

  // 40 memorized pages with real history, as in the audit's repro.
  const userWith40 = async () => {
    const user = await createUser();
    for (let p = 1; p <= 40; p++) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(30), lastReviewedDate: daysAgo(3), reviewCount: 7 });
    }
    return { user, auth: `Bearer ${tokenFor(user._id)}` };
  };

  test('the audit repro: a client whose load failed (empty view) unticks one page — 409, nothing deleted', async () => {
    const { user, auth } = await userWith40();
    // The Library's failed load left its set empty; it ticked page 100 then
    // unticked it, sending the empty set with the one page it meant to remove.
    const res = await request(app).put('/api/progress/memorized').set('Authorization', auth)
      .send({ memorizedPages: [], confirmRemoval: [100] });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CONFIRM_REMOVAL');
    assert.equal(res.body.data.wouldRemove.length, 40);
    assert.deepEqual(res.body.data.unconfirmed, Array.from({ length: 40 }, (_, i) => i + 1));
    assert.equal((await pagesOf(user._id)).length, 40, 'every page and its history is kept');
  });

  test('an old client that sends no confirmRemoval cannot delete anything', async () => {
    const { user, auth } = await userWith40();
    const res = await request(app).put('/api/progress/memorized').set('Authorization', auth)
      .send({ memorizedPages: Array.from({ length: 39 }, (_, i) => i + 1) });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.data.wouldRemove, [40]);
    assert.equal((await pagesOf(user._id)).length, 40);
  });

  test('a stale tab: a page marked elsewhere after it loaded is not deleted by its save', async () => {
    const { user, auth } = await userWith40();
    // The tab loaded pages 1..40; meanwhile the dashboard memorized page 41.
    await addMemorizedPage(user._id, 41, { memorizedDate: new Date(), lastReviewedDate: new Date() });
    // The tab removes page 40 and confirms exactly that.
    const res = await request(app).put('/api/progress/memorized').set('Authorization', auth)
      .send({ memorizedPages: Array.from({ length: 39 }, (_, i) => i + 1), confirmRemoval: [40] });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body.data.unconfirmed, [41]);
    assert.equal((await pagesOf(user._id)).length, 41);
  });

  test('a confirmed removal goes through and keeps the other pages\' history', async () => {
    const { user, auth } = await userWith40();
    const res = await request(app).put('/api/progress/memorized').set('Authorization', auth)
      .send({ memorizedPages: Array.from({ length: 38 }, (_, i) => i + 1), confirmRemoval: [39, 40] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.removed, [39, 40]);
    assert.equal((await pagesOf(user._id)).length, 38);
    const kept = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.equal(kept.reviewCount, 7);
  });

  test('adding pages needs no confirmation; extra confirmed pages that would not be removed are harmless', async () => {
    const { user, auth } = await userWith40();
    const res = await request(app).put('/api/progress/memorized').set('Authorization', auth)
      .send({ memorizedPages: Array.from({ length: 42 }, (_, i) => i + 1), confirmRemoval: [55] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.removed, []);
    assert.equal((await pagesOf(user._id)).length, 42);
  });

  test('confirmRemoval is validated like any page list', async () => {
    const { auth } = await userWith40();
    for (const confirmRemoval of [[1.5], [0], 'all']) {
      const res = await request(app).put('/api/progress/memorized').set('Authorization', auth).send({ memorizedPages: [], confirmRemoval });
      assert.equal(res.status, 400, JSON.stringify(confirmRemoval));
    }
  });
});

describe('Delta endpoints for single pages', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(60);
  });

  const setup = async () => {
    const user = await createUser();
    await addMemorizedPage(user._id, 5, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(2), reviewCount: 4 });
    await addMemorizedPage(user._id, 6, { memorizedDate: daysAgo(10), lastReviewedDate: daysAgo(2), reviewCount: 4 });
    await UserProgress.create({ userId: user._id, pageNumber: 1, status: 'memorized', memorizedDate: daysAgo(5), lastReviewedDate: daysAgo(5), segments: [{ from: '1:1', to: '1:4' }] });
    return { user, auth: `Bearer ${tokenFor(user._id)}` };
  };

  test('PUT /units remove page: a whole page and a partial page are both deleted, nothing else is', async () => {
    const { user, auth } = await setup();
    const whole = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'remove', unit: 'page', ref: 5 });
    assert.equal(whole.status, 200);
    assert.deepEqual(whole.body.data.affectedPages, [{ pageNumber: 5, fraction: 0, full: false, removed: true }]);
    const partial = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'remove', unit: 'page', ref: 1 });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.data.affectedPages[0].removed, true);
    assert.deepEqual(await pagesOf(user._id), [6]);

    // Removing a page that is not memorized is a no-op, not an error.
    const none = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'remove', unit: 'page', ref: 30 });
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.data.affectedPages, []);
    assert.deepEqual(await pagesOf(user._id), [6]);
  });

  test('PUT /units add page completes a partial page and keeps its dates', async () => {
    const { user, auth } = await setup();
    const res = await request(app).put('/api/progress/units').set('Authorization', auth).send({ action: 'add', unit: 'page', ref: 1 });
    assert.equal(res.status, 200);
    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!p1.segments || p1.segments.length === 0);
    assert.equal(p1.memorizedDate.toISOString(), daysAgo(5).toISOString());
  });

  test('PATCH /memorized adds and removes only the named pages', async () => {
    const { user, auth } = await setup();
    const res = await request(app).patch('/api/progress/memorized').set('Authorization', auth)
      .send({ add: [1, 7], remove: [5] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.added, [1, 7]);
    assert.deepEqual(res.body.data.removed, [5]);
    assert.equal(res.body.data.fullPages, 3);
    assert.deepEqual(await pagesOf(user._id), [1, 6, 7]);

    const p1 = await UserProgress.findOne({ userId: user._id, pageNumber: 1 });
    assert.ok(!p1.segments || p1.segments.length === 0, 'the partial page is now whole');
    const p6 = await UserProgress.findOne({ userId: user._id, pageNumber: 6 });
    assert.equal(p6.reviewCount, 4, 'an untouched page keeps its history');
    const p7 = await UserProgress.findOne({ userId: user._id, pageNumber: 7 });
    assert.equal(p7.memorizedDate.toISOString(), daysAgo(1).toISOString(), 'a new page is dated yesterday, like the editor');
  });

  test('PATCH /memorized rejects bad input', async () => {
    const { auth } = await setup();
    const cases = [{}, { add: [1], remove: [1] }, { add: [1.5] }, { remove: [700] }, { add: 'x' }];
    for (const body of cases) {
      const res = await request(app).patch('/api/progress/memorized').set('Authorization', auth).send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });
});
