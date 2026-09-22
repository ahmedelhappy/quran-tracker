// The assistant must see the SAME plan the dashboard shows, and its system prompt
// must carry both the app guide and the user's live summary.
//
// The Groq SDK is replaced BEFORE the app (and so chatController) is loaded, so no
// test here can reach the real service. `node --test` runs each file in its own
// process, which keeps the swap local to this file.
const groqPath = require.resolve('groq-sdk');
const groqCalls = [];
class FakeGroq {
  constructor(options) {
    this.options = options;
    this.chat = {
      completions: {
        create: async (params) => {
          groqCalls.push(params);
          return { choices: [{ message: { content: 'Mocked reply' } }] };
        },
      },
    };
  }
}
require.cache[groqPath] = { id: groqPath, filename: groqPath, loaded: true, exports: FakeGroq };

const fs = require('fs');
const path = require('path');
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const {
  connect, disconnect, clearDatabase, seedMetadata,
  createUser, tokenFor, addMemorizedPage, daysAgo,
} = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');
const { buildProgressSummary } = require('../controllers/progressController');
const { PAGE_BY_NUMBER } = require('../utils/segments');

const GUIDE = fs.readFileSync(path.join(__dirname, '..', 'chat', 'appGuide.md'), 'utf8');

// The dashboard's new-page cards, reduced to what identifies each item.
const dashboardItems = (data) => data.newPages.map((p) => (p.segment
  ? { pageNumber: p.pageNumber, fromVerseKey: p.segment.fromVerseKey, toVerseKey: p.segment.toVerseKey, half: p.segment.half }
  : { pageNumber: p.pageNumber }));

async function todayAndSummary(user) {
  const res = await request(app)
    .get('/api/progress/today')
    .set('Authorization', `Bearer ${tokenFor(user._id)}`);
  assert.equal(res.status, 200);
  const summary = await buildProgressSummary(await User.findById(user._id));
  return { data: res.body.data, summary };
}

// First `n` verses of a page as one memorized segment.
async function addPartialPage(userId, pageNumber, n, memorizedDate) {
  const keys = PAGE_BY_NUMBER.get(pageNumber).verseKeys;
  return UserProgress.create({
    userId, pageNumber, status: 'memorized', memorizedDate, lastReviewedDate: memorizedDate,
    segments: [{ from: keys[0], to: keys[n - 1] }],
  });
}

describe('assistant summary vs GET /api/progress/today', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
  });

  test('a half-page plan: the summary names the same half page, verse for verse', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: daysAgo(3) });
    for (const p of [1, 2, 3]) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(20) });
    }
    const { data, summary } = await todayAndSummary(user);

    const dash = dashboardItems(data);
    assert.equal(dash.length, 1);
    assert.equal(dash[0].pageNumber, 4);
    assert.equal(dash[0].half, 1, 'a half-page plan serves a first half, not a whole page');
    assert.deepEqual(summary.newItems, dash);
    assert.deepEqual(summary.newPageNumbers, [4]);
    assert.deepEqual(summary.reviewPageNumbers, data.reviewPages.map((p) => p.pageNumber));
    assert.deepEqual(summary.recentReviewPageNumbers, data.recentReviewPages.map((p) => p.pageNumber));
    assert.equal(summary.reviewsDueToday, data.reviewPages.length + data.recentReviewPages.length);
  });

  test('a partly memorized page: both serve its REMAINING verses first, not the next page', async () => {
    const user = await createUser({ dailyNewPages: 1, planStartDate: daysAgo(10) });
    for (const p of [1, 2, 3, 4]) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(20) });
    }
    await addPartialPage(user._id, 5, 3, daysAgo(1));
    const { data, summary } = await todayAndSummary(user);

    const dash = dashboardItems(data);
    const keys = PAGE_BY_NUMBER.get(5).verseKeys;
    assert.deepEqual(dash, [{ pageNumber: 5, fromVerseKey: keys[3], toVerseKey: keys[keys.length - 1], half: 2 }]);
    // The whole-page walker this replaced treated page 5 as done and named page 6.
    assert.deepEqual(summary.newItems, dash);
    assert.deepEqual(summary.newPageNumbers, [5]);
    assert.deepEqual(summary.reviewPageNumbers, data.reviewPages.map((p) => p.pageNumber));
    assert.deepEqual(summary.recentReviewPageNumbers, data.recentReviewPages.map((p) => p.pageNumber));
  });

  test('a half-page plan on the day after a first half: both serve the second half', async () => {
    const user = await createUser({ dailyNewPages: 0.5, planStartDate: daysAgo(5) });
    for (const p of [1, 2, 3]) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(20) });
    }
    const half = Math.ceil(PAGE_BY_NUMBER.get(4).verseKeys.length / 2);
    await addPartialPage(user._id, 4, half, daysAgo(1));
    const { data, summary } = await todayAndSummary(user);

    const dash = dashboardItems(data);
    assert.equal(dash.length, 1);
    assert.equal(dash[0].pageNumber, 4);
    assert.equal(dash[0].half, 2);
    assert.deepEqual(summary.newItems, dash);
  });
});

describe('POST /api/chat — the system prompt', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(30);
    groqCalls.length = 0;
  });

  test('carries BOTH the app guide and the user\'s progress summary, before the conversation', async () => {
    const user = await createUser({ name: 'Maryam', dailyNewPages: 0.5, planStartDate: daysAgo(3) });
    for (const p of [1, 2, 3]) {
      await addMemorizedPage(user._id, p, { memorizedDate: daysAgo(20), lastReviewedDate: daysAgo(20) });
    }
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ messages: [{ role: 'user', content: 'What should I do today?' }] });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.reply, 'Mocked reply');
    assert.equal(groqCalls.length, 1, 'exactly one (mocked) model call');

    const sent = groqCalls[0].messages;
    const system = sent.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    // The guide — verbatim, as loaded at boot.
    assert.ok(system.includes(GUIDE.trim()), 'the whole app guide is in the system prompt');
    assert.ok(system.includes('/settings?tab=memorization&edit=1'));
    // The summary — this user's own numbers and today's exact half page.
    const p4 = PAGE_BY_NUMBER.get(4).verseKeys;
    const firstHalf = `${p4[0]}–${p4[Math.ceil(p4.length / 2) - 1]}`;
    assert.ok(system.includes("THE USER'S CURRENT DATA"));
    assert.ok(system.includes('- Name: Maryam'));
    assert.ok(system.includes('Total memorized: 3 of 604 pages'));
    assert.ok(system.includes(`page 4 — verses ${firstHalf} (first half)`), system);
    // Guardrails travel with it.
    assert.match(system, /decline politely/);
    assert.match(system, /language of the user's latest message/);
    assert.match(system, /Never include external links/);
    // …and the conversation comes after the system messages, untouched.
    assert.deepEqual(sent[sent.length - 1], { role: 'user', content: 'What should I do today?' });
    assert.ok(sent.findIndex((m) => m.role !== 'system') > 0);
  });

  test('the guide stays small enough for a prompt (under ~1,500 tokens)', () => {
    // ~4 characters per token for English prose; 6,000 chars ≈ 1,500 tokens.
    assert.ok(GUIDE.length < 6000, `guide is ${GUIDE.length} chars`);
  });

  test('is protected: no token, no model call', async () => {
    const res = await request(app).post('/api/chat').send({ messages: [{ role: 'user', content: 'hi' }] });
    assert.equal(res.status, 401);
    assert.equal(groqCalls.length, 0);
  });
});
