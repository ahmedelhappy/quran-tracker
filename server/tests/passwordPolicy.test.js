// L-02: new passwords need 8+ characters and at most 72 BYTES (bcrypt ignores
// everything after byte 72, so two passwords sharing their first 72 bytes were
// interchangeable). Existing accounts made under the old 6-character minimum
// must still sign in, so login applies neither rule.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const { newPasswordProblem } = require('../utils/passwordPolicy');

const register = (password, email = `p${Math.random().toString(16).slice(2)}@example.com`) =>
  request(app).post('/api/auth/register').send({ name: 'Ali', email, password });

describe('new-password policy', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  test('the rule itself: 8+ characters (code points), at most 72 UTF-8 bytes', () => {
    assert.ok(newPasswordProblem('1234567'));
    assert.equal(newPasswordProblem('12345678'), null);
    assert.equal(newPasswordProblem('a'.repeat(72)), null);
    assert.ok(newPasswordProblem('a'.repeat(73)));
    // Arabic letters are 2 bytes each: 36 fit, 37 do not.
    assert.equal(newPasswordProblem('ب'.repeat(36)), null);
    assert.ok(newPasswordProblem('ب'.repeat(37)));
    // An emoji is one character towards the minimum (and 4 bytes towards the cap).
    assert.ok(newPasswordProblem('😀'.repeat(7)));
    assert.equal(newPasswordProblem('😀'.repeat(8)), null);
    assert.ok(newPasswordProblem('😀'.repeat(19)));
    assert.ok(newPasswordProblem(undefined));
  });

  test('registration: 7 characters is 400, 8 is 201', async () => {
    assert.equal((await register('1234567')).status, 400);
    assert.equal((await register('12345678')).status, 201);
  });

  test("registration refuses 73 bytes — the audit's truncation repro can't be set up", async () => {
    // Before: 73 characters registered, and logging in with a different 73rd
    // character succeeded because bcrypt never read it.
    const base = 'a'.repeat(72);
    const res = await register(`${base}X`, 'trunc@example.com');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /72 bytes/);

    // Exactly 72 is accepted, and only the exact password signs in.
    assert.equal((await register(base, 'exact@example.com')).status, 201);
    const ok = await request(app).post('/api/auth/login').send({ email: 'exact@example.com', password: base });
    assert.equal(ok.status, 200);
    const near = await request(app).post('/api/auth/login').send({ email: 'exact@example.com', password: `${'a'.repeat(71)}b` });
    assert.equal(near.status, 401);

    // Arabic counts bytes: 37 letters = 74 bytes.
    assert.equal((await register('ب'.repeat(37))).status, 400);
    assert.equal((await register('ب'.repeat(36))).status, 201);
  });

  test('a password change applies the same rules to the NEW password', async () => {
    const user = await createUser({ password: 'secret123' });
    const change = (newPassword) => request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${tokenFor(user._id)}`)
      .send({ currentPassword: 'secret123', newPassword });
    assert.equal((await change('short12')).status, 400);
    assert.equal((await change('a'.repeat(73))).status, 400);
    assert.equal((await change('ب'.repeat(37))).status, 400);
  });

  test('an account made under the old 6-character minimum still signs in and can move up', async () => {
    await createUser({ email: 'legacy@example.com', password: 'abc123' });
    const login = await request(app).post('/api/auth/login').send({ email: 'legacy@example.com', password: 'abc123' });
    assert.equal(login.status, 200, 'login does not enforce the new minimum');

    // Its 6-character password is still accepted as the CURRENT one.
    const change = await request(app)
      .put('/api/auth/password')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ currentPassword: 'abc123', newPassword: 'longer-now-1' });
    assert.equal(change.status, 200);
  });
});
