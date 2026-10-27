const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const mongoose = require('mongoose');

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const { userKeyedModels } = require('../utils/userData');
const leaderboardController = require('../controllers/leaderboardController');
const chatBudget = require('../utils/chatBudget');

const auth = (userId) => `Bearer ${tokenFor(userId)}`;

describe('Account deletion removes everything the user owns (H-01)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    leaderboardController._clearCache();
  });

  test('every model file is registered, so the registry walk cannot miss one', () => {
    const files = fs.readdirSync(path.join(__dirname, '..', 'models')).filter((f) => f.endsWith('.js'));
    const registered = new Set(mongoose.modelNames());
    for (const file of files) {
      assert.ok(registered.has(path.basename(file, '.js')), `models/${file} is not registered`);
    }
  });

  test('model registry: no user-keyed collection keeps rows for a deleted user, and others keep theirs', async () => {
    const models = userKeyedModels();
    const names = models.map((m) => m.modelName);
    // Guard against a vacuous pass: the collections H-01 found missing must be in the walk.
    for (const expected of ['UserProgress', 'Todo', 'Bookmark', 'Annotation']) {
      assert.ok(names.includes(expected), `${expected} should be user-keyed`);
    }

    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com' });

    // Raw inserts: the point is ownership, not each schema's field rules, so this
    // also covers any model added later without the test knowing its shape.
    for (const model of models) {
      await model.collection.insertOne({ userId: alice._id, pageNumber: 1 });
      await model.collection.insertOne({ userId: alice._id, pageNumber: 2 });
      await model.collection.insertOne({ userId: bob._id, pageNumber: 1 });
    }

    const res = await request(app).delete('/api/auth/account').set('Authorization', auth(alice._id));
    assert.equal(res.status, 200);

    for (const model of models) {
      assert.equal(await model.collection.countDocuments({ userId: alice._id }), 0, `${model.modelName} kept the deleted user's rows`);
      assert.equal(await model.collection.countDocuments({ userId: bob._id }), 1, `${model.modelName} lost another user's row`);
    }
    assert.equal(await mongoose.model('User').countDocuments({ _id: alice._id }), 0);
    assert.equal(await mongoose.model('User').countDocuments({ _id: bob._id }), 1);
  });

  test('real notes, highlights, drawings and bookmarks go with the account (audit repro)', async () => {
    const user = await createUser();
    const a = auth(user._id);
    assert.equal((await request(app).post('/api/bookmarks').set('Authorization', a).send({ pageNumber: 5, label: 'mine' })).status, 201);
    assert.equal((await request(app).post('/api/annotations').set('Authorization', a).send({ kind: 'note', pageNumber: 5, text: 'private' })).status, 201);
    assert.equal((await request(app).post('/api/annotations').set('Authorization', a).send({ kind: 'highlight', pageNumber: 2, verseKey: '2:1', color: 'yellow' })).status, 201);
    assert.equal((await request(app).put('/api/annotations/drawing').set('Authorization', a)
      .send({ pageNumber: 5, strokes: [{ tool: 'pen', color: 'ink', width: 2, points: [[10, 10], [20, 20]] }] })).status, 200);

    const Bookmark = mongoose.model('Bookmark');
    const Annotation = mongoose.model('Annotation');
    assert.equal(await Bookmark.countDocuments({ userId: user._id }), 1);
    assert.equal(await Annotation.countDocuments({ userId: user._id }), 3);

    assert.equal((await request(app).delete('/api/auth/account').set('Authorization', a)).status, 200);
    assert.equal(await Bookmark.countDocuments({ userId: user._id }), 0);
    assert.equal(await Annotation.countDocuments({ userId: user._id }), 0);
  });

  test('a deleted user disappears from the leaderboard at once, not after the cache TTL', async () => {
    const gone = await createUser({ leaderboardOptIn: true, displayName: 'Leaving' });
    const viewer = await createUser({ leaderboardOptIn: true, displayName: 'Staying' });
    const UserProgress = mongoose.model('UserProgress');
    for (const u of [gone, viewer]) {
      await UserProgress.create({ userId: u._id, pageNumber: 1, status: 'memorized', memorizedDate: new Date(), lastReviewedDate: new Date() });
    }

    const warm = await request(app).get('/api/leaderboard').set('Authorization', auth(viewer._id));
    assert.deepEqual(warm.body.data.entries.map((e) => e.displayName).sort(), ['Leaving', 'Staying']);

    await request(app).delete('/api/auth/account').set('Authorization', auth(gone._id));
    const after = await request(app).get('/api/leaderboard').set('Authorization', auth(viewer._id));
    assert.deepEqual(after.body.data.entries.map((e) => e.displayName), ['Staying']);
  });

  test("the deleted account's chat budget is forgotten", async () => {
    const user = await createUser();
    chatBudget.tryConsume(user._id, 10);
    assert.equal(chatBudget.countFor(user._id), 1);
    await request(app).delete('/api/auth/account').set('Authorization', auth(user._id));
    assert.equal(chatBudget.countFor(user._id), 0);
  });
});
