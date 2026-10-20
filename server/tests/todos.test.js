const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const Todo = require('../models/Todo');
const { MAX_TODOS } = require('../controllers/todoController');

describe('To-do list API', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  const authFor = async (overrides) => `Bearer ${tokenFor((await createUser(overrides))._id)}`;
  const add = async (auth, text) => {
    const res = await request(app).post('/api/todos').set('Authorization', auth).send({ text });
    assert.equal(res.status, 201, res.body.message);
    return res.body.data;
  };
  const list = async (auth) => {
    const res = await request(app).get('/api/todos').set('Authorization', auth);
    assert.equal(res.status, 200);
    return res.body.data;
  };
  const texts = async (auth) => (await list(auth)).map((t) => t.text);
  const reorder = (auth, ids) => request(app).put('/api/todos/reorder').set('Authorization', auth).send({ ids });

  test('protected: every route rejects requests without a token', async () => {
    const id = '507f1f77bcf86cd799439011';
    const calls = [
      request(app).get('/api/todos'),
      request(app).post('/api/todos').send({ text: 'x' }),
      request(app).put(`/api/todos/${id}`).send({ done: true }),
      request(app).delete(`/api/todos/${id}`),
      request(app).put('/api/todos/reorder').send({ ids: [] }),
      request(app).delete('/api/todos/completed'),
      request(app).post('/api/todos/restore').send({ items: [] }),
    ];
    for (const res of await Promise.all(calls)) assert.equal(res.status, 401);
  });

  test('create → list → edit → tick → delete round-trips, in order', async () => {
    const auth = await authFor();
    const a = await add(auth, '  Revise juz 30  ');
    assert.equal(a.text, 'Revise juz 30'); // trimmed
    assert.equal(a.done, false);
    const b = await add(auth, 'Listen to Surah Al-Mulk');
    const c = await add(auth, 'قراءة تفسير الفاتحة');
    assert.ok(a.order < b.order && b.order < c.order);
    assert.deepEqual(await texts(auth), ['Revise juz 30', 'Listen to Surah Al-Mulk', 'قراءة تفسير الفاتحة']);

    const edited = await request(app).put(`/api/todos/${b._id}`).set('Authorization', auth).send({ text: 'Listen to Al-Mulk' });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.text, 'Listen to Al-Mulk');
    assert.equal(edited.body.data.done, false);

    const ticked = await request(app).put(`/api/todos/${b._id}`).set('Authorization', auth).send({ done: true });
    assert.equal(ticked.status, 200);
    assert.equal(ticked.body.data.done, true);
    assert.equal(ticked.body.data.text, 'Listen to Al-Mulk');
    const unticked = await request(app).put(`/api/todos/${b._id}`).set('Authorization', auth).send({ done: false });
    assert.equal(unticked.body.data.done, false);

    const del = await request(app).delete(`/api/todos/${a._id}`).set('Authorization', auth);
    assert.equal(del.status, 200);
    assert.deepEqual(await texts(auth), ['Listen to Al-Mulk', 'قراءة تفسير الفاتحة']);

    const again = await request(app).delete(`/api/todos/${a._id}`).set('Authorization', auth);
    assert.equal(again.status, 404);
  });

  test('validation: text must be a 1–200 character string', async () => {
    const auth = await authFor();
    const post = (body) => request(app).post('/api/todos').set('Authorization', auth).send(body);
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ text: '' })).status, 400);
    assert.equal((await post({ text: '   ' })).status, 400);
    assert.equal((await post({ text: 'x'.repeat(201) })).status, 400);
    assert.equal((await post({ text: 42 })).status, 400);
    assert.equal((await post({ text: ['a'] })).status, 400);
    assert.equal((await post({ text: 'x'.repeat(200) })).status, 201);
    // Whitespace around 200 characters is trimmed before the length check.
    assert.equal((await post({ text: `  ${'y'.repeat(200)}  ` })).status, 201);
    assert.equal(await Todo.countDocuments(), 2);
  });

  test('validation: operator objects are rejected where scalars are expected', async () => {
    const auth = await authFor();
    const item = await add(auth, 'Keep me');

    const create = await request(app).post('/api/todos').set('Authorization', auth).send({ text: { $gt: '' } });
    assert.equal(create.status, 400);

    const put = (body) => request(app).put(`/api/todos/${item._id}`).set('Authorization', auth).send(body);
    assert.equal((await put({ text: { $gt: '' } })).status, 400);
    assert.equal((await put({ done: { $ne: false } })).status, 400);
    assert.equal((await put({ text: '' })).status, 400);
    assert.equal((await put({})).status, 400); // nothing to update

    assert.equal((await reorder(auth, { $in: [item._id] })).status, 400);
    assert.equal((await reorder(auth, [{ $gt: '' }])).status, 400);
    assert.equal((await reorder(auth, 'not-an-array')).status, 400);

    const restore = (items) => request(app).post('/api/todos/restore').set('Authorization', auth).send({ items });
    assert.equal((await restore({ $gt: '' })).status, 400);
    assert.equal((await restore([{ text: { $gt: '' }, index: 0 }])).status, 400);
    assert.equal((await restore([{ text: 'ok', index: { $gt: 0 } }])).status, 400);
    assert.equal((await restore([{ text: 'ok', index: 0, done: 'yes' }])).status, 400);
    assert.equal((await restore([])).status, 400);

    const stored = await Todo.findById(item._id);
    assert.equal(stored.text, 'Keep me');
    assert.equal(stored.done, false);
    assert.equal(await Todo.countDocuments(), 1);
  });

  test('ownership: another user\'s ids are 404 everywhere and never touched', async () => {
    const alice = await authFor({ email: 'alice-todo@example.com' });
    const bob = await authFor({ email: 'bob-todo@example.com' });
    const mine = await add(alice, 'Alice only');
    const bobs = await add(bob, 'Bob only');

    assert.deepEqual(await texts(bob), ['Bob only']);

    const edit = await request(app).put(`/api/todos/${mine._id}`).set('Authorization', bob).send({ text: 'Stolen', done: true });
    assert.equal(edit.status, 404);
    const del = await request(app).delete(`/api/todos/${mine._id}`).set('Authorization', bob);
    assert.equal(del.status, 404);
    const malformed = await request(app).delete('/api/todos/not-an-id').set('Authorization', bob);
    assert.equal(malformed.status, 404);

    // Bob's reorder may not name Alice's item, even alongside his own.
    const foreign = await reorder(bob, [bobs._id, mine._id]);
    assert.equal(foreign.status, 404);

    // Bob clearing his completed items never reaches Alice's.
    await request(app).put(`/api/todos/${mine._id}`).set('Authorization', alice).send({ done: true });
    const cleared = await request(app).delete('/api/todos/completed').set('Authorization', bob);
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.removed.length, 0);

    const stored = await Todo.findById(mine._id);
    assert.equal(stored.text, 'Alice only');
    assert.equal(stored.done, true);
  });

  test('reorder: a full permutation is saved; missing, repeated and unknown ids are refused', async () => {
    const auth = await authFor();
    const a = await add(auth, 'A');
    const b = await add(auth, 'B');
    const c = await add(auth, 'C');

    const ok = await reorder(auth, [c._id, a._id, b._id]);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body.data.map((t) => t.text), ['C', 'A', 'B']);
    assert.deepEqual(ok.body.data.map((t) => t.order), [0, 1, 2]);
    assert.deepEqual(await texts(auth), ['C', 'A', 'B']);

    const missing = await reorder(auth, [a._id, b._id]);
    assert.equal(missing.status, 400);
    const repeated = await reorder(auth, [a._id, a._id, b._id]);
    assert.equal(repeated.status, 400);
    const unknown = await reorder(auth, [a._id, b._id, c._id, '507f1f77bcf86cd799439011']);
    assert.equal(unknown.status, 404);
    const malformed = await reorder(auth, [a._id, b._id, 'zzz']);
    assert.equal(malformed.status, 404);

    // None of the refused calls changed anything.
    assert.deepEqual(await texts(auth), ['C', 'A', 'B']);

    // A new item after a reorder still lands at the end.
    await add(auth, 'D');
    assert.deepEqual(await texts(auth), ['C', 'A', 'B', 'D']);
  });

  test('clear completed removes only ticked items and reports where each stood', async () => {
    const auth = await authFor();
    const items = [];
    for (const text of ['A', 'B', 'C', 'D', 'E']) items.push(await add(auth, text));
    for (const i of [1, 3, 4]) {
      await request(app).put(`/api/todos/${items[i]._id}`).set('Authorization', auth).send({ done: true });
    }

    const res = await request(app).delete('/api/todos/completed').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((t) => t.text), ['A', 'C']);
    assert.deepEqual(res.body.removed.map((r) => [r.text, r.index, r.done]), [['B', 1, true], ['D', 3, true], ['E', 4, true]]);
    assert.deepEqual(await texts(auth), ['A', 'C']);
  });

  test('restore puts removed items back where they stood (the Undo)', async () => {
    const auth = await authFor();
    const items = [];
    for (const text of ['A', 'B', 'C', 'D', 'E']) items.push(await add(auth, text));
    for (const i of [0, 2, 4]) {
      await request(app).put(`/api/todos/${items[i]._id}`).set('Authorization', auth).send({ done: true });
    }
    const cleared = await request(app).delete('/api/todos/completed').set('Authorization', auth);
    assert.deepEqual(await texts(auth), ['B', 'D']);

    // Sent out of order on purpose: the server inserts by ascending index.
    const removed = cleared.body.removed.map(({ text, done, index }) => ({ text, done, index })).reverse();
    const res = await request(app).post('/api/todos/restore').set('Authorization', auth).send({ items: removed });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data.map((t) => t.text), ['A', 'B', 'C', 'D', 'E']);
    assert.deepEqual(res.body.data.map((t) => t.done), [true, false, true, false, true]);
    // `created` follows the request's order, so the client can map its ids.
    assert.deepEqual(res.body.created.map((t) => t.text), ['E', 'C', 'A']);
    assert.deepEqual(await texts(auth), ['A', 'B', 'C', 'D', 'E']);

    // A single delete's Undo: back to its old spot; an index past the end appends.
    const b = (await list(auth))[1];
    await request(app).delete(`/api/todos/${b._id}`).set('Authorization', auth);
    await request(app).post('/api/todos/restore').set('Authorization', auth).send({ items: [{ text: 'B', index: 1 }] });
    await request(app).post('/api/todos/restore').set('Authorization', auth).send({ items: [{ text: 'Z', index: 99 }] });
    assert.deepEqual(await texts(auth), ['A', 'B', 'C', 'D', 'E', 'Z']);
  });

  test(`cap: at most ${MAX_TODOS} items per user, for adds and restores`, async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    await Todo.insertMany(
      Array.from({ length: MAX_TODOS - 1 }, (_, i) => ({ userId: user._id, text: `Item ${i}`, order: i }))
    );
    await add(auth, 'The last one that fits');

    const over = await request(app).post('/api/todos').set('Authorization', auth).send({ text: 'One too many' });
    assert.equal(over.status, 400);
    const restore = await request(app).post('/api/todos/restore').set('Authorization', auth)
      .send({ items: [{ text: 'Restored', index: 0 }] });
    assert.equal(restore.status, 400);
    assert.equal(await Todo.countDocuments({ userId: user._id }), MAX_TODOS);

    // Another user is unaffected.
    const other = await authFor({ email: 'roomy@example.com' });
    await add(other, 'Plenty of room');
  });

  test('deleting the account deletes its to-do list', async () => {
    const user = await createUser();
    const auth = `Bearer ${tokenFor(user._id)}`;
    await add(auth, 'Gone with the account');
    const res = await request(app).delete('/api/auth/account').set('Authorization', auth);
    assert.equal(res.status, 200);
    assert.equal(await Todo.countDocuments({ userId: user._id }), 0);
  });
});
