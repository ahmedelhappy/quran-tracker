const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const Bookmark = require('../models/Bookmark');

describe('Bookmarks API', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  test('protected: rejects requests without a token', async () => {
    const res = await request(app).get('/api/bookmarks');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('create → list → delete round-trips', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Create with a label
    const created = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth)
      .send({ pageNumber: 42, label: 'Ayat al-Kursi' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.pageNumber, 42);
    assert.equal(created.body.data.label, 'Ayat al-Kursi');
    const id = created.body.data._id;

    // Create without a label (defaults to empty string)
    const created2 = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth)
      .send({ pageNumber: 3 });
    assert.equal(created2.status, 201);
    assert.equal(created2.body.data.label, '');

    // List is sorted by pageNumber
    const list = await request(app).get('/api/bookmarks').set('Authorization', auth);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((b) => b.pageNumber), [3, 42]);

    // Delete the first one
    const del = await request(app).delete(`/api/bookmarks/${id}`).set('Authorization', auth);
    assert.equal(del.status, 200);
    assert.equal(del.body.success, true);

    const after = await request(app).get('/api/bookmarks').set('Authorization', auth);
    assert.deepEqual(after.body.data.map((b) => b.pageNumber), [3]);
  });

  test('label is trimmed on save', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ pageNumber: 10, label: '   spaced   ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.label, 'spaced');
  });

  test('validation: rejects out-of-range and non-numeric pages', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    for (const pageNumber of [0, 605, -1, 'x', null, undefined]) {
      const res = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber });
      assert.equal(res.status, 400, `pageNumber=${pageNumber} should be rejected`);
      assert.equal(res.body.success, false);
    }
  });

  test('uniqueness: rejects a second bookmark for an already-bookmarked page', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const first = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 20 });
    assert.equal(first.status, 201);

    const second = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 20, label: 'Different label' });
    assert.equal(second.status, 409);
    assert.equal(second.body.success, false);

    const count = await Bookmark.countDocuments({ userId: user._id, pageNumber: 20 });
    assert.equal(count, 1);
  });

  test('uniqueness: rejects a second bookmark with the same label, case-insensitively and across whitespace', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const first = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 30, label: 'Juz Amma' });
    assert.equal(first.status, 201);

    const second = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', auth)
      .send({ pageNumber: 31, label: '  JUZ amma  ' });
    assert.equal(second.status, 409);
    assert.equal(second.body.success, false);
    assert.match(second.body.message, /already have a bookmark with this name/i);

    const count = await Bookmark.countDocuments({ userId: user._id });
    assert.equal(count, 1);
  });

  test('uniqueness: empty labels may repeat freely', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const first = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 40 });
    const second = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 41 });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.data.label, '');
    assert.equal(second.body.data.label, '');
  });

  test('uniqueness: two different users can bookmark the same page and reuse the same label', async () => {
    const alice = await createUser({ email: 'alice2@example.com' });
    const bob = await createUser({ email: 'bob2@example.com' });
    const aliceRes = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${tokenFor(alice._id)}`)
      .send({ pageNumber: 50, label: 'Favourite' });
    const bobRes = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${tokenFor(bob._id)}`)
      .send({ pageNumber: 50, label: 'Favourite' });
    assert.equal(aliceRes.status, 201);
    assert.equal(bobRes.status, 201);
  });

  test('validation: rejects a label longer than 50 characters', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ pageNumber: 5, label: 'a'.repeat(51) });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('ownership: a user only sees their own bookmarks and cannot delete others', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com' });
    const aliceAuth = `Bearer ${tokenFor(alice._id)}`;
    const bobAuth = `Bearer ${tokenFor(bob._id)}`;

    const aliceBm = await request(app).post('/api/bookmarks').set('Authorization', aliceAuth).send({ pageNumber: 100 });
    const aliceId = aliceBm.body.data._id;
    await request(app).post('/api/bookmarks').set('Authorization', bobAuth).send({ pageNumber: 200 });

    // Bob's list has only his bookmark
    const bobList = await request(app).get('/api/bookmarks').set('Authorization', bobAuth);
    assert.deepEqual(bobList.body.data.map((b) => b.pageNumber), [200]);

    // Bob cannot delete Alice's bookmark
    const del = await request(app).delete(`/api/bookmarks/${aliceId}`).set('Authorization', bobAuth);
    assert.equal(del.status, 404);

    // Alice's bookmark still exists
    const aliceList = await request(app).get('/api/bookmarks').set('Authorization', aliceAuth);
    assert.deepEqual(aliceList.body.data.map((b) => b.pageNumber), [100]);
  });

  test('deleting a missing / malformed id returns 404', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const missing = await request(app).delete('/api/bookmarks/64b7f9f9f9f9f9f9f9f9f9f9').set('Authorization', auth);
    assert.equal(missing.status, 404);
    const malformed = await request(app).delete('/api/bookmarks/not-an-id').set('Authorization', auth);
    assert.equal(malformed.status, 404);
  });

  test('cap: blocks the 101st bookmark with a clear message', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;

    // Seed 100 directly for speed.
    await Bookmark.insertMany(
      Array.from({ length: 100 }, (_, i) => ({ userId: user._id, pageNumber: i + 1 }))
    );

    const res = await request(app).post('/api/bookmarks').set('Authorization', auth).send({ pageNumber: 101 });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /limit/i);

    const count = await Bookmark.countDocuments({ userId: user._id });
    assert.equal(count, 100);
  });
});
