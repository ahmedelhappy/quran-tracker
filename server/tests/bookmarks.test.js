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

  // ── PUT /api/bookmarks/:id — rename and move ──────────────

  // Creates a bookmark over the API and returns its id.
  const addBm = async (auth, body) => {
    const res = await request(app).post('/api/bookmarks').set('Authorization', auth).send(body);
    assert.equal(res.status, 201);
    return res.body.data._id;
  };
  const put = (auth, id, body) => request(app).put(`/api/bookmarks/${id}`).set('Authorization', auth).send(body);

  test('rename: sets a trimmed label, and an empty label clears it', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 12 });

    const renamed = await put(auth, id, { label: '  Morning review  ' });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.data.label, 'Morning review');
    assert.equal(renamed.body.data.pageNumber, 12);

    const cleared = await put(auth, id, { label: '   ' });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.data.label, '');
    assert.equal((await Bookmark.findById(id)).label, '');
  });

  test('rename: a label another bookmark already has is a 409, case-insensitively', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    await addBm(auth, { pageNumber: 1, label: 'Al-Fatiha' });
    const id = await addBm(auth, { pageNumber: 2, label: 'Start of Baqarah' });

    const res = await put(auth, id, { label: 'AL-FATIHA' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /already have a bookmark with this name/i);
    assert.equal((await Bookmark.findById(id)).label, 'Start of Baqarah');
  });

  test('rename: re-saving its own label in a different case succeeds', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 7, label: 'juz amma' });

    const res = await put(auth, id, { label: 'Juz Amma' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.label, 'Juz Amma');
  });

  test('rename: rejects a label longer than 50 characters', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 7, label: 'keep' });
    const res = await put(auth, id, { label: 'a'.repeat(51) });
    assert.equal(res.status, 400);
    assert.equal((await Bookmark.findById(id)).label, 'keep');
  });

  test('move: to a free page', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 50, label: 'Here' });

    const res = await put(auth, id, { pageNumber: 77 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pageNumber, 77);
    assert.equal(res.body.data.label, 'Here');
    assert.equal(res.body.replaced, undefined);
    assert.equal(await Bookmark.countDocuments({ userId: user._id, pageNumber: 50 }), 0);
  });

  test('move: to its own page is a no-op success', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 60, label: 'Same' });

    const res = await put(auth, id, { pageNumber: 60 });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.pageNumber, 60);
    assert.equal(await Bookmark.countDocuments({ userId: user._id }), 1);
  });

  test('move: onto an occupied page is a 409 naming the other bookmark, and nothing changes', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 10, label: 'Mover' });
    const otherId = await addBm(auth, { pageNumber: 20, label: 'Sitting here' });

    const res = await put(auth, id, { pageNumber: 20, label: 'Renamed too' });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Page 20 is already bookmarked/);
    assert.equal(res.body.conflict._id, otherId);
    assert.equal(res.body.conflict.pageNumber, 20);
    assert.equal(res.body.conflict.label, 'Sitting here');

    // Neither the move nor the rename was applied.
    const mover = await Bookmark.findById(id);
    assert.equal(mover.pageNumber, 10);
    assert.equal(mover.label, 'Mover');
    assert.ok(await Bookmark.findById(otherId));
  });

  test('move: replace:true removes the other bookmark and moves this one in one request', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 10, label: 'Mover' });
    const otherId = await addBm(auth, { pageNumber: 20, label: 'Sitting here' });

    const res = await put(auth, id, { pageNumber: 20, replace: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data._id, id);
    assert.equal(res.body.data.pageNumber, 20);
    assert.equal(res.body.replaced._id, otherId);

    assert.equal(await Bookmark.findById(otherId), null);
    const onPage = await Bookmark.find({ userId: user._id, pageNumber: 20 });
    assert.equal(onPage.length, 1);
    assert.equal(String(onPage[0]._id), id);
    assert.equal(await Bookmark.countDocuments({ userId: user._id }), 1);
  });

  test('move: replace:true may take over the replaced bookmark\'s label', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 10 });
    await addBm(auth, { pageNumber: 20, label: 'Sitting here' });

    const res = await put(auth, id, { pageNumber: 20, label: 'sitting HERE', replace: true });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.label, 'sitting HERE');
    assert.equal(await Bookmark.countDocuments({ userId: user._id }), 1);
  });

  test('move + rename: a duplicate label blocks the whole request, even with replace', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 10, label: 'Mover' });
    const otherId = await addBm(auth, { pageNumber: 20 });
    await addBm(auth, { pageNumber: 30, label: 'Taken' });

    const res = await put(auth, id, { pageNumber: 20, label: 'taken', replace: true });
    assert.equal(res.status, 409);
    // The occupant was NOT removed and the mover did not move.
    assert.ok(await Bookmark.findById(otherId));
    assert.equal((await Bookmark.findById(id)).pageNumber, 10);
  });

  test('ownership: a user cannot rename or move another user\'s bookmark', async () => {
    const alice = await createUser({ email: 'alice3@example.com' });
    const bob = await createUser({ email: 'bob3@example.com' });
    const aliceAuth = `Bearer ${tokenFor(alice._id)}`;
    const bobAuth = `Bearer ${tokenFor(bob._id)}`;
    const aliceId = await addBm(aliceAuth, { pageNumber: 100, label: 'Mine' });

    const rename = await put(bobAuth, aliceId, { label: 'Stolen' });
    assert.equal(rename.status, 404);
    const move = await put(bobAuth, aliceId, { pageNumber: 5, replace: true });
    assert.equal(move.status, 404);

    const stored = await Bookmark.findById(aliceId);
    assert.equal(stored.label, 'Mine');
    assert.equal(stored.pageNumber, 100);
  });

  test('update: missing / malformed id returns 404, and no token returns 401', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    assert.equal((await put(auth, '64b7f9f9f9f9f9f9f9f9f9f9', { label: 'x' })).status, 404);
    assert.equal((await put(auth, 'not-an-id', { label: 'x' })).status, 404);
    const anon = await request(app).put('/api/bookmarks/64b7f9f9f9f9f9f9f9f9f9f9').send({ label: 'x' });
    assert.equal(anon.status, 401);
  });

  test('update validation: out-of-range pages and non-scalar bodies are rejected with 400', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    const id = await addBm(auth, { pageNumber: 9, label: 'Stay' });

    for (const pageNumber of [0, 605, -3, 2.5, 'x']) {
      const res = await put(auth, id, { pageNumber });
      assert.equal(res.status, 400, `pageNumber=${pageNumber} should be rejected`);
    }
    for (const body of [
      { pageNumber: { $gt: 0 } },
      { label: { $ne: '' } },
      { label: ['a'] },
      { pageNumber: 20, replace: { $exists: true } },
      { pageNumber: 20, replace: 'yes' },
    ]) {
      const res = await put(auth, id, body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} should be rejected`);
      assert.equal(res.body.success, false);
    }

    const stored = await Bookmark.findById(id);
    assert.equal(stored.pageNumber, 9);
    assert.equal(stored.label, 'Stay');
  });
});
