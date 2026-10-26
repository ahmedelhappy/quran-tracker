// L-03: errors that reach Express itself (the JSON body parser's above all) used
// to come back as Express's HTML error page, stack trace and file paths
// included. Every one must now be JSON.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

require('./helpers'); // sets NODE_ENV / JWT_SECRET before the app loads
const app = require('../app');
const { jsonErrorHandler } = require('../middleware/errorHandler');

const fakeRes = () => {
  const res = { statusCode: null, body: null, headersSent: false };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('final JSON error handler', () => {
  test('a malformed JSON body is a 400 JSON, not an HTML page', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    assert.equal(res.status, 400);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.deepEqual(res.body, { success: false, message: 'Malformed JSON in request body' });
    assert.ok(!res.text.includes('<pre>') && !res.text.includes('node_modules'), 'no stack or paths');
  });

  test('an oversized body is a 413 JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(200 * 1024) }));
    assert.equal(res.status, 413);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.deepEqual(res.body, { success: false, message: 'Request body is too large' });
  });

  test("another parser client error keeps its status, as JSON", async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json; charset=klingon')
      .send('{}');
    assert.equal(res.status, 415);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.equal(res.body.success, false);
  });

  test('anything unexpected is a 500 JSON — the message only outside production, never a stack', () => {
    const prev = process.env.NODE_ENV;
    const originalError = console.error;
    console.error = () => {};
    try {
      const boom = new Error('db exploded');
      process.env.NODE_ENV = 'development';
      const dev = jsonErrorHandler(boom, {}, fakeRes(), () => {});
      assert.equal(dev.statusCode, 500);
      assert.deepEqual(dev.body, { success: false, message: 'Server error', error: 'db exploded' });

      process.env.NODE_ENV = 'production';
      const prod = jsonErrorHandler(boom, {}, fakeRes(), () => {});
      assert.equal(prod.statusCode, 500);
      assert.deepEqual(prod.body, { success: false, message: 'Server error' });
    } finally {
      process.env.NODE_ENV = prev;
      console.error = originalError;
    }
  });

  test('a response already under way is handed back to Express', () => {
    const res = fakeRes();
    res.headersSent = true;
    let forwarded = null;
    jsonErrorHandler(new Error('late'), {}, res, (e) => { forwarded = e; });
    assert.equal(forwarded.message, 'late');
    assert.equal(res.statusCode, null);
  });
});
