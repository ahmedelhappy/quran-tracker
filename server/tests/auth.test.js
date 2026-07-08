const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { connect, disconnect, clearDatabase, createUser } = require('./helpers');
const app = require('../app');

describe('Auth API', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  test('registration rejects a too-short password', async () => {
    // This path intentionally trips the model's minlength validator, which the
    // controller logs via console.error — silence it so test output stays clean.
    const originalError = console.error;
    console.error = () => {};
    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Ali', email: 'ali@example.com', password: '123' });

      // The model enforces minlength: 6, so registration must not succeed.
      assert.notEqual(res.status, 201);
      assert.equal(res.body.success, false);
      assert.ok(!res.body.data, 'no user/token should be returned for an invalid password');
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
