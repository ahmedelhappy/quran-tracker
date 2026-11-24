// Error responses carry a stable machine `code` beside the English `message`, so
// the client can show the error in the reader's language (L-08). The Arabic
// login form used to show the server's "Invalid email or password" in English.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const { codeForStatus } = require('../middleware/errorCode');

describe('Error codes (L-08)', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  const auth = (user) => `Bearer ${tokenFor(user._id)}`;

  test('the errors a person can act on have their own code, and keep their message', async () => {
    const user = await createUser({ email: 'taken@example.com', password: 'secret123' });
    const cases = [
      [request(app).post('/api/auth/login').send({ email: 'taken@example.com', password: 'wrong-password' }), 401, 'INVALID_CREDENTIALS', 'Invalid email or password'],
      [request(app).post('/api/auth/login').send({ email: 'taken@example.com' }), 400, 'CREDENTIALS_REQUIRED'],
      [request(app).post('/api/auth/register').send({ name: 'A', email: 'taken@example.com', password: 'long-enough-1' }), 409, 'EMAIL_TAKEN'],
      [request(app).post('/api/auth/register').send({ name: 'A', email: 'not-an-email', password: 'long-enough-1' }), 400, 'INVALID_EMAIL'],
      [request(app).post('/api/auth/register').send({ name: 'A', email: 'new@example.com', password: 'short' }), 400, 'PASSWORD_TOO_SHORT'],
      [request(app).put('/api/auth/password').set('Authorization', auth(user)).send({ currentPassword: 'nope-nope-1', newPassword: 'another-pass1' }), 400, 'WRONG_PASSWORD'],
      [request(app).put('/api/auth/password').set('Authorization', auth(user)).send({ currentPassword: 'secret123', newPassword: 'secret123' }), 400, 'PASSWORD_UNCHANGED'],
      [request(app).put('/api/auth/profile').set('Authorization', auth(user)).send({ displayName: 'ab' }), 400, 'DISPLAY_NAME_LENGTH'],
      [request(app).put('/api/auth/profile').set('Authorization', auth(user)).send({ offDays: [8] }), 400, 'INVALID_OFF_DAYS'],
      [request(app).post('/api/bookmarks').set('Authorization', auth(user)).send({ pageNumber: 3, label: 'x'.repeat(51) }), 400, 'BOOKMARK_LABEL_TOO_LONG'],
      [request(app).get('/api/progress/today'), 401, 'NOT_AUTHORIZED'],
    ];
    for (const [req, status, code, message] of cases) {
      const res = await req;
      assert.equal(res.status, status, code);
      assert.equal(res.body.code, code);
      assert.equal(typeof res.body.message, 'string', `${code} keeps its message`);
      if (message) assert.equal(res.body.message, message);
    }
  });

  test('every other error gets a code from its status', async () => {
    const user = await createUser();
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.code, 'MALFORMED_JSON');

    const missing = await request(app).get('/api/no-such-route');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.code, 'NOT_FOUND');

    // A request-shape refusal with no code of its own.
    const shape = await request(app).post('/api/progress/complete').set('Authorization', auth(user)).send({ pageNumber: 3 });
    assert.equal(shape.status, 400);
    assert.equal(shape.body.code, 'INVALID_REQUEST');
    assert.equal(shape.body.message, 'type must be "new" or "review"');

    // A success is left alone.
    const ok = await request(app).get('/api/auth/me').set('Authorization', auth(user));
    assert.equal(ok.status, 200);
    assert.equal(ok.body.code, undefined);
  });

  test('status codes map to stable names', () => {
    assert.equal(codeForStatus(400), 'INVALID_REQUEST');
    assert.equal(codeForStatus(409), 'CONFLICT');
    assert.equal(codeForStatus(429), 'RATE_LIMITED');
    assert.equal(codeForStatus(503), 'SERVER_ERROR');
    assert.equal(codeForStatus(418), 'REQUEST_FAILED');
  });
});
