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
});
