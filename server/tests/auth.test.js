const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

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
});
