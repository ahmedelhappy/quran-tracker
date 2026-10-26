const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { connect, disconnect, clearDatabase, createUser, tokenFor } = require('./helpers');
const app = require('../app');

describe('Auth API', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  test('registration rejects a too-short password with exactly 400', async () => {
    // Refused by the new-password policy before the model runs; console.error is
    // silenced in case a regression lets it fall through to the model's validator.
    const originalError = console.error;
    console.error = () => {};
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email: 'ali@example.com', password: '123' });

      // A model ValidationError is the client's mistake — never a 500.
      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.ok(!res.body.data, 'no user/token should be returned for an invalid password');
    } finally {
      console.error = originalError;
    }
  });

  // M-02: the old pattern refused "+tags" and any TLD longer than three letters.
  test('registration accepts real-world addresses the old pattern refused', async () => {
    for (const email of ['first+tag@gmail.com', 'me@example.info', 'x@sub.example.co.uk', '  Mixed.Case@Example.COM ']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email, password: 'secret123' });
      assert.equal(res.status, 201, email);
      assert.equal(res.body.data.email, email.trim().toLowerCase(), 'stored trimmed and lower-cased');
    }
    // …and the normalised form is what login matches.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'MIXED.case@example.com', password: 'secret123' });
    assert.equal(login.status, 200);
  });

  test('a missing field is 400 and a taken email is 409 — never 500', async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const noName = await request(app)
        .post('/api/auth/register')
        .send({ email: 'noname@example.com', password: 'secret123' });
      assert.equal(noName.status, 400);
      assert.equal(noName.body.message, 'Please provide your name');
      assert.ok(!noName.body.error, 'no raw error text on a client error');

      const noPassword = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email: 'nopw@example.com' });
      assert.equal(noPassword.status, 400);

      const noEmail = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', password: 'secret123' });
      assert.equal(noEmail.status, 400);

      await createUser({ email: 'taken@example.com' });
      const taken = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email: 'Taken@Example.com', password: 'secret123' });
      assert.equal(taken.status, 409);
      assert.equal(taken.body.success, false);
    } finally {
      console.error = originalError;
    }
  });

  test('registration succeeds with valid input and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ali', email: 'ali@example.com', password: 'secret123' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.email, 'ali@example.com');
    assert.ok(res.body.data.token, 'a JWT should be returned');
  });

  test('login returns a JWT for valid credentials', async () => {
    await createUser({ email: 'login@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'secret123' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'a JWT should be returned on successful login');
  });

  test('login rejects a wrong password with 401', async () => {
    await createUser({ email: 'login@example.com', password: 'secret123' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrongpass' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.ok(!res.body.data);
  });

  test('a protected route returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('a protected route returns the current user with a valid token', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ali', email: 'me@example.com', password: 'secret123' });
    const token = reg.body.data.token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.email, 'me@example.com');
  });

  test('a token issued before a password change is rejected afterwards', async () => {
    const user = await createUser({ email: 'rotate@example.com', password: 'secret123' });

    // A token that was minted a minute ago (its `iat` predates the change below).
    const oldToken = jwt.sign(
      { id: user._id, iat: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );

    // Before any change, the token is accepted.
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    assert.equal(before.status, 200);

    // Change the password (still authenticating with the currently-valid token).
    const change = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${oldToken}`)
      .send({ currentPassword: 'secret123', newPassword: 'newpass123' });
    assert.equal(change.status, 200);

    // The same token is now rejected — the change invalidated every prior session.
    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldToken}`);
    assert.equal(after.status, 401);

    // A freshly issued token (from logging in with the new password) still works.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rotate@example.com', password: 'newpass123' });
    assert.equal(login.status, 200);
    const fresh = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.data.token}`);
    assert.equal(fresh.status, 200);
  });

  // C-01: the old pattern backtracked exponentially — 'a'×32 + '!' held the event
  // loop for ~4.5 s and every two more characters quadrupled it.
  test('a malicious email is refused with 400 at once, not after a regex stall', async () => {
    // Warm the app up so the timing below measures validation, not first-load.
    await request(app).get('/health');
    const payloads = [
      'a'.repeat(50) + '!',                          // the audit's ReDoS shape
      'a'.repeat(32) + '!',
      'a'.repeat(300) + '@example.com',              // over the 254 cap
      `${'a'.repeat(30)}@${'b.'.repeat(100)}c d`,    // under the cap, a space in the tail
    ];
    for (const email of payloads) {
      const t0 = performance.now();
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email, password: 'secret123' });
      const ms = performance.now() - t0;
      assert.equal(res.status, 400, `${email.length}-char email`);
      assert.equal(res.body.success, false);
      assert.ok(ms < 100, `${email.length}-char email took ${ms.toFixed(0)} ms`);
    }
  });

  test('the model\'s email pattern stays linear even past the length cap', async () => {
    const User = require('../models/User');
    // 100k characters through the raw pattern, and the model's own validation
    // (the backstop for any write path that skips the controller check).
    const t0 = performance.now();
    assert.equal(User.EMAIL_PATTERN.test('a'.repeat(100000) + '!'), false);
    assert.equal(User.EMAIL_PATTERN.test(`a@${'b.'.repeat(50000)} `), false);
    const err = await new User({ name: 'X', email: 'a'.repeat(5000) + '!', password: 'secret123' })
      .validate().then(() => null, (e) => e);
    const ms = performance.now() - t0;
    assert.ok(err && err.errors.email, 'the model rejects the address');
    assert.ok(ms < 100, `took ${ms.toFixed(0)} ms`);
  });

  // M-04: the change used to revoke the very session that made it.
  test('a password change hands this session a fresh token; other sessions stay revoked', async () => {
    const user = await createUser({ email: 'keep@example.com', password: 'secret123' });
    const iat = Math.floor(Date.now() / 1000) - 60;
    // Two sessions minted a minute ago: this tab, and another device.
    const thisTab = jwt.sign({ id: user._id, iat }, process.env.JWT_SECRET);
    const otherDevice = jwt.sign({ id: user._id, iat: iat + 1 }, process.env.JWT_SECRET);

    const change = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${thisTab}`)
      .send({ currentPassword: 'secret123', newPassword: 'newpass123' });
    assert.equal(change.status, 200);
    const fresh = change.body.data?.token;
    assert.ok(fresh, 'the response carries a new token');

    // The new token works straight away…
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${fresh}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.email, 'keep@example.com');

    // …while both tokens from before the change are refused.
    for (const old of [thisTab, otherDevice]) {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${old}`);
      assert.equal(res.status, 401);
    }
  });

  test('a refused password change issues no token', async () => {
    const user = await createUser({ email: 'wrong@example.com', password: 'secret123' });
    const res = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ currentPassword: 'not-it-at-all', newPassword: 'newpass123' });
    assert.equal(res.status, 400);
    assert.ok(!res.body.data);
  });

  test('login rejects a NoSQL-operator object as email with 400', async () => {
    await createUser({ email: 'inject@example.com', password: 'secret123' });

    // Without the type gate this { $gt: '' } would match an arbitrary user.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(!res.body.data);
  });
});
