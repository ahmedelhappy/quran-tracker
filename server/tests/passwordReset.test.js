// Password reset (H-06): built, and OFF unless configured on. These tests turn
// it on through the same three settings production would use, stand in for the
// email transport with a capture (mailer.sendPasswordReset is called through the
// module object, so mock.method can replace it), and check the properties the
// flow promises: no answer reveals whether an account exists, only a hash is
// stored, a link works once and only until it expires, the newest link replaces
// the older one, the password policy holds, every older session ends, and the
// link is built from the configured origin whatever headers the request forges.
const { test, before, after, beforeEach, afterEach, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { connect, disconnect, clearDatabase, createUser } = require('./helpers');
const app = require('../app');
const User = require('../models/User');
const mailer = require('../utils/mailer');
const { loginThrottle } = require('../utils/loginThrottle');
const { buildPasswordResetLimiters } = require('../middleware/rateLimiters');
const {
  RESET_TOKEN_TTL_MS, hashResetToken, passwordResetConfig, describePasswordReset, logPasswordReset, resetLink,
} = require('../utils/passwordReset');

const ORIGIN = 'https://app.example.com';
const ENV_KEYS = ['PASSWORD_RESET_ENABLED', 'EMAIL_TRANSPORT', 'CLIENT_URL', 'NODE_ENV'];

// Sets (or, with undefined, removes) env vars for one test; restoreEnv puts the
// originals back.
let savedEnv;
const setEnv = (values) => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};
const saveEnv = () => { savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]])); };
const restoreEnv = () => setEnv(savedEnv);
const enableReset = () => setEnv({ PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'console', CLIENT_URL: ORIGIN });

// Every message the capture "sent", newest last.
let sent;
const captureMail = () => {
  sent = [];
  mock.method(mailer, 'sendPasswordReset', async (message) => { sent.push(message); });
};
// Delivery runs on setImmediate after the reply has gone; give it a moment.
const delivered = async (count = 1) => {
  for (let i = 0; i < 50 && sent.length < count; i++) await new Promise((r) => setTimeout(r, 5));
  return sent;
};
const tokenOf = (message) => message.link.split('#token=')[1];

const forgot = (email, headers = {}) => request(app).post('/api/auth/forgot-password').set(headers).send({ email });
const reset = (token, password) => request(app).post('/api/auth/reset-password').send({ token, password });
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

// Asks for a link for `email` and returns its token.
const requestToken = async (email) => {
  const before = sent.length;
  const res = await forgot(email);
  assert.equal(res.status, 200);
  await delivered(before + 1);
  assert.equal(sent.length, before + 1, 'one email per request');
  return tokenOf(sent[sent.length - 1]);
};

describe('password reset (H-06)', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    saveEnv();
    enableReset();
    captureMail();
    loginThrottle.reset('reset@example.com');
  });
  afterEach(() => {
    mock.restoreAll();
    restoreEnv();
  });

  describe('off unless configured on', () => {
    test('with none of the settings, both endpoints are 404 RESET_DISABLED and the config says off', async () => {
      setEnv({ PASSWORD_RESET_ENABLED: undefined, EMAIL_TRANSPORT: undefined, CLIENT_URL: undefined });
      await createUser({ email: 'reset@example.com' });
      const config = await request(app).get('/api/auth/config');
      assert.equal(config.status, 200);
      assert.deepEqual(config.body.data, { passwordReset: false });

      const f = await forgot('reset@example.com');
      const r = await reset('A'.repeat(43), 'newpassword1');
      for (const res of [f, r]) {
        assert.equal(res.status, 404);
        assert.equal(res.body.code, 'RESET_DISABLED');
      }
      await new Promise((r2) => setTimeout(r2, 20));
      assert.equal(sent.length, 0, 'nothing is sent while reset is off');
    });

    test('in production with no provider it stays off — even switched on, and even with the console transport', async () => {
      for (const transport of [undefined, 'none', 'console', 'smtp-typo']) {
        setEnv({ NODE_ENV: 'production', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: transport, CLIENT_URL: ORIGIN });
        const config = await request(app).get('/api/auth/config');
        assert.equal(config.body.data.passwordReset, false, `transport ${transport}`);
        const f = await forgot('someone@example.com');
        assert.equal(f.status, 404, `transport ${transport}`);
        assert.equal(f.body.code, 'RESET_DISABLED');
        const r = await reset('A'.repeat(43), 'newpassword1');
        assert.equal(r.status, 404);
        assert.equal(r.body.code, 'RESET_DISABLED');
      }
    });

    test('the switch alone is not enough, and neither is a transport alone', () => {
      const dev = { NODE_ENV: 'development' };
      assert.equal(passwordResetConfig({ ...dev }).enabled, false);
      assert.equal(passwordResetConfig({ ...dev, PASSWORD_RESET_ENABLED: 'true' }).enabled, false, 'none delivers nothing');
      assert.equal(passwordResetConfig({ ...dev, EMAIL_TRANSPORT: 'console' }).enabled, false, 'not switched on');
      assert.equal(passwordResetConfig({ ...dev, PASSWORD_RESET_ENABLED: 'yes', EMAIL_TRANSPORT: 'console' }).enabled, false, 'only "true" switches it on');
      const on = passwordResetConfig({ ...dev, PASSWORD_RESET_ENABLED: ' TRUE ', EMAIL_TRANSPORT: 'Console' });
      assert.equal(on.enabled, true);
      assert.equal(on.origin, 'http://localhost:5173', 'outside production the dev server is the default origin');
      // Production needs an https CLIENT_URL even once a provider exists.
      const prod = { NODE_ENV: 'production', PASSWORD_RESET_ENABLED: 'true' };
      assert.match(passwordResetConfig(prod).problems.join(';'), /CLIENT_URL is not set/);
      assert.match(passwordResetConfig({ ...prod, CLIENT_URL: 'http://app.example.com' }).problems.join(';'), /https/);
      assert.match(passwordResetConfig({ ...prod, CLIENT_URL: 'not a url' }).problems.join(';'), /not a URL/);
    });

    test('the startup line names the state and the reasons, never the origin', () => {
      const off = describePasswordReset(passwordResetConfig({ NODE_ENV: 'production', CLIENT_URL: 'https://secret-host.example' }));
      assert.match(off, /^Password reset: OFF \(/);
      assert.match(off, /PASSWORD_RESET_ENABLED is not "true"/);
      assert.doesNotMatch(off, /secret-host/);
      const on = describePasswordReset(passwordResetConfig({ NODE_ENV: 'development', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'console', CLIENT_URL: 'https://secret-host.example' }));
      assert.equal(on, 'Password reset: ON (email transport: console)');
      // A missing environment altogether describes, it does not throw.
      assert.doesNotThrow(() => describePasswordReset(passwordResetConfig({})));
      // …and server.js prints it at start-up, outside anything that can exit.
      const serverJs = require('fs').readFileSync(require('path').join(__dirname, '..', 'server.js'), 'utf8');
      assert.match(serverJs, /^logPasswordReset\(\);$/m);
    });

    test('switched on but off anyway is an error that says so; a deliberate off is an ordinary line', () => {
      const printed = { log: [], error: [] };
      const log = { log: (line) => printed.log.push(line), error: (line) => printed.error.push(line) };
      const cases = [
        ['an unknown transport', { NODE_ENV: 'development', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'smtp-typo' }, /not a known transport/],
        ['console in production', { NODE_ENV: 'production', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'console', CLIENT_URL: ORIGIN }, /development only/],
        ['a bad CLIENT_URL', { NODE_ENV: 'development', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'console', CLIENT_URL: 'not a url' }, /CLIENT_URL is not a URL/],
      ];
      for (const [label, env, reason] of cases) {
        printed.log.length = 0;
        printed.error.length = 0;
        const config = passwordResetConfig(env);
        assert.equal(config.switchedOn, true, label);
        assert.equal(config.enabled, false, label);
        logPasswordReset(config, log);
        assert.deepEqual(printed.log, [], label);
        assert.equal(printed.error.length, 1, label);
        assert.match(printed.error[0], /PASSWORD_RESET_ENABLED is true but password reset is OFF because: /, label);
        assert.match(printed.error[0], reason, label);
      }

      for (const env of [{}, { PASSWORD_RESET_ENABLED: 'false', EMAIL_TRANSPORT: 'console' }]) {
        printed.log.length = 0;
        printed.error.length = 0;
        const config = passwordResetConfig(env);
        assert.equal(config.switchedOn, false);
        logPasswordReset(config, log);
        assert.deepEqual(printed.error, []);
        assert.match(printed.log[0], /^🔑 Password reset: OFF \(PASSWORD_RESET_ENABLED is not "true"/);
      }

      printed.log.length = 0;
      logPasswordReset(passwordResetConfig({ NODE_ENV: 'development', PASSWORD_RESET_ENABLED: 'true', EMAIL_TRANSPORT: 'console' }), log);
      assert.deepEqual(printed.log, ['🔑 Password reset: ON (email transport: console)']);
    });

    test('the link carries the token in its fragment, on the reset page of the origin', () => {
      assert.equal(resetLink(ORIGIN, 'abc'), `${ORIGIN}/reset-password#token=abc`);
    });

    test('the public config says on when it is on', async () => {
      const res = await request(app).get('/api/auth/config');
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { success: true, data: { passwordReset: true } });
    });
  });

  describe('asking for a link', () => {
    test('an address with an account and one without get the same status and body', async () => {
      await createUser({ email: 'reset@example.com' });
      const known = await forgot('reset@example.com');
      const unknown = await forgot('nobody@example.com');
      assert.equal(known.status, 200);
      assert.equal(unknown.status, known.status);
      assert.deepEqual(unknown.body, known.body);
      assert.equal(unknown.headers['content-length'], known.headers['content-length']);
      await delivered(1);
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(sent.length, 1, 'only the real account is emailed');
      assert.equal(sent[0].to, 'reset@example.com');
    });

    test('the reply does not wait for the email: a transport that never finishes still gets an immediate 200', async () => {
      mock.restoreAll();
      mock.method(mailer, 'sendPasswordReset', () => new Promise(() => {}));
      await createUser({ email: 'reset@example.com' });
      const t0 = performance.now();
      const res = await forgot('reset@example.com');
      assert.equal(res.status, 200);
      assert.ok(performance.now() - t0 < 2000, 'answered without waiting for delivery');
    });

    test('a failing transport is logged without the link and the reply is unchanged', async () => {
      mock.restoreAll();
      const logged = [];
      mock.method(console, 'error', (...args) => logged.push(args.join(' ')));
      let link;
      mock.method(mailer, 'sendPasswordReset', async (m) => { link = m.link; throw new Error('provider down'); });
      await createUser({ email: 'reset@example.com' });
      const res = await forgot('reset@example.com');
      assert.equal(res.status, 200);
      for (let i = 0; i < 50 && !logged.length; i++) await new Promise((r) => setTimeout(r, 5));
      assert.match(logged.join('\n'), /failed to send: provider down/);
      assert.ok(!logged.join('\n').includes(tokenOf({ link })), 'the token is never logged');
    });

    test('a malformed address is a 400 for what it is, account or not', async () => {
      for (const email of ['', 'not-an-email', 'a'.repeat(300) + '@x.com']) {
        const res = await forgot(email);
        assert.equal(res.status, 400, JSON.stringify(email));
        assert.equal(res.body.code, 'INVALID_EMAIL');
      }
      const injected = await request(app).post('/api/auth/forgot-password').send({ email: { $gt: '' } });
      assert.equal(injected.status, 400, 'an operator object never reaches the query');
    });

    test('only the SHA-256 of the token is stored, never the token, and it is hidden from queries', async () => {
      const user = await createUser({ email: 'Reset@Example.com' });
      const token = await requestToken('  RESET@example.COM ');
      assert.match(token, /^[A-Za-z0-9_-]{43}$/, '32 random bytes, base64url');
      assert.equal(Buffer.from(token, 'base64url').length, 32);

      const raw = await mongoose.connection.collection('users').findOne({ _id: user._id });
      assert.equal(raw.passwordResetTokenHash, crypto.createHash('sha256').update(token).digest('hex'));
      assert.equal(raw.passwordResetTokenHash, hashResetToken(token));
      assert.ok(!JSON.stringify(raw).includes(token), 'the token itself is nowhere in the document');
      const ttl = raw.passwordResetExpires.getTime() - Date.now();
      assert.ok(ttl > RESET_TOKEN_TTL_MS - 60_000 && ttl <= RESET_TOKEN_TTL_MS, `expires in ~30 min (${ttl} ms)`);

      // select: false — an ordinary read, and the API's own user payloads, never carry them.
      const plain = await User.findById(user._id).lean();
      assert.equal(plain.passwordResetTokenHash, undefined);
      assert.equal(plain.passwordResetExpires, undefined);
      const signIn = await login('reset@example.com', 'secret123');
      assert.ok(!JSON.stringify(signIn.body).includes('passwordReset'));
    });

    test('the link uses the configured origin, whatever Host or forwarding headers the request forges', async () => {
      await createUser({ email: 'reset@example.com' });
      const res = await forgot('reset@example.com', {
        Host: 'evil.example',
        Origin: 'https://evil.example',
        Referer: 'https://evil.example/login',
        'X-Forwarded-Host': 'evil.example',
        'X-Forwarded-Proto': 'http',
      });
      assert.equal(res.status, 200);
      const [message] = await delivered(1);
      assert.ok(message.link.startsWith(`${ORIGIN}/reset-password#token=`), message.link);
      assert.ok(!message.link.includes('evil'));
      // The token travels in the fragment, which browsers send to no server.
      assert.equal(new URL(message.link).search, '');
      assert.equal(message.language, 'en');
      assert.equal(message.minutes, 30);
    });

    test('the email follows the account language', async () => {
      await createUser({ email: 'reset@example.com', language: 'ar' });
      await requestToken('reset@example.com');
      assert.equal(sent[0].language, 'ar');
    });

    test('a new link replaces the older one', async () => {
      await createUser({ email: 'reset@example.com' });
      const first = await requestToken('reset@example.com');
      const second = await requestToken('reset@example.com');
      assert.notEqual(first, second);
      const old = await reset(first, 'newpassword1');
      assert.equal(old.status, 400);
      assert.equal(old.body.code, 'RESET_TOKEN_INVALID');
      const fresh = await reset(second, 'newpassword1');
      assert.equal(fresh.status, 200);
    });
  });

  describe('setting the new password', () => {
    test('works once: signs in with the new password only, ends older sessions, and the link is then dead', async () => {
      const user = await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      // A session from a minute ago (its iat predates the reset).
      const oldSession = jwt.sign({ id: user._id, iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
      assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`)).status, 200);

      const token = await requestToken('reset@example.com');
      const res = await reset(token, 'brandnewpass1');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data, undefined, 'no session is handed out: the person signs in');

      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${oldSession}`);
      assert.equal(me.status, 401);
      assert.equal(me.body.code, 'SESSION_EXPIRED');
      assert.equal((await login('reset@example.com', 'oldpassword1')).status, 401);
      const fresh = await login('reset@example.com', 'brandnewpass1');
      assert.equal(fresh.status, 200);
      assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${fresh.body.data.token}`)).status, 200);

      // Reuse: the same link again, even with yet another password.
      const again = await reset(token, 'thirdpassword1');
      assert.equal(again.status, 400);
      assert.equal(again.body.code, 'RESET_TOKEN_INVALID');
      assert.equal((await login('reset@example.com', 'brandnewpass1')).status, 200, 'the reuse changed nothing');

      const raw = await mongoose.connection.collection('users').findOne({ _id: user._id });
      assert.equal(raw.passwordResetTokenHash, undefined, 'consumed');
      assert.equal(raw.passwordResetExpires, undefined);
    });

    test('a session opened a moment before the reset ends too, and one opened after it works', async () => {
      // Real sign-ins, so the tokens are the server's own, in the same second
      // as the reset (the harness found these surviving when the check only
      // had whole seconds and a back-dated stamp).
      await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      const token = await requestToken('reset@example.com');
      const justBefore = (await login('reset@example.com', 'oldpassword1')).body.data.token;
      assert.ok(jwt.decode(justBefore).iatMs, 'issued with a millisecond time');
      assert.equal((await reset(token, 'brandnewpass1')).status, 200);
      const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${justBefore}`);
      assert.equal(me.status, 401);
      assert.equal(me.body.code, 'SESSION_EXPIRED');
      const after = (await login('reset@example.com', 'brandnewpass1')).body.data.token;
      assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${after}`)).status, 200);
    });

    test('two resets racing with one link: exactly one wins, and its password is the one that works', async () => {
      await createUser({ email: 'reset@example.com' });
      const token = await requestToken('reset@example.com');
      const passwords = ['racerpassword1', 'racerpassword2', 'racerpassword3', 'racerpassword4', 'racerpassword5'];
      const results = await Promise.all(passwords.map((p) => reset(token, p)));
      const winners = results.map((r, i) => (r.status === 200 ? passwords[i] : null)).filter(Boolean);
      assert.equal(winners.length, 1, `statuses: ${results.map((r) => r.status).join(',')}`);
      for (const r of results.filter((x) => x.status !== 200)) {
        assert.equal(r.status, 400);
        assert.equal(r.body.code, 'RESET_TOKEN_INVALID');
      }
      for (const p of passwords) {
        assert.equal((await login('reset@example.com', p)).status, p === winners[0] ? 200 : 401, p);
      }
    });

    test('an expired link is refused with the same code as any other bad link', async () => {
      const user = await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      const token = await requestToken('reset@example.com');
      await User.updateOne({ _id: user._id }, { $set: { passwordResetExpires: new Date(Date.now() - 1000) } });
      const res = await reset(token, 'brandnewpass1');
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'RESET_TOKEN_INVALID');
      assert.equal((await login('reset@example.com', 'oldpassword1')).status, 200, 'the password is unchanged');
    });

    test('forged and malformed tokens are refused alike, and never match an account with no reset pending', async () => {
      await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      const forged = [
        crypto.randomBytes(32).toString('base64url'), // the right shape, never issued
        'A'.repeat(43),
        'short',
        'A'.repeat(44),
        `${'A'.repeat(42)}=`,
        '',
      ];
      for (const token of forged) {
        const res = await reset(token, 'brandnewpass1');
        assert.equal(res.status, 400, JSON.stringify(token));
        assert.equal(res.body.code, 'RESET_TOKEN_INVALID');
      }
      // Operator objects stop at the type gate; null/absent are just bad tokens.
      const op = await request(app).post('/api/auth/reset-password').send({ token: { $ne: null }, password: 'brandnewpass1' });
      assert.equal(op.status, 400);
      const none = await request(app).post('/api/auth/reset-password').send({ password: 'brandnewpass1' });
      assert.equal(none.status, 400);
      assert.equal(none.body.code, 'RESET_TOKEN_INVALID');
      // The hash of the empty token, or of nothing, matches no account either.
      const raw = await mongoose.connection.collection('users').findOne({ email: 'reset@example.com' });
      assert.equal(raw.passwordResetTokenHash, undefined);
      assert.equal((await login('reset@example.com', 'oldpassword1')).status, 200);
    });

    test('the new password must meet the policy, and a refused one does not use up the link', async () => {
      await createUser({ email: 'reset@example.com' });
      const token = await requestToken('reset@example.com');
      const short = await reset(token, 'short');
      assert.equal(short.status, 400);
      assert.equal(short.body.code, 'PASSWORD_TOO_SHORT');
      const long = await reset(token, 'ب'.repeat(37)); // 74 UTF-8 bytes
      assert.equal(long.status, 400);
      assert.equal(long.body.code, 'PASSWORD_TOO_LONG');
      const missing = await request(app).post('/api/auth/reset-password').send({ token });
      assert.equal(missing.status, 400);
      assert.equal(missing.body.code, 'PASSWORD_TOO_SHORT');
      assert.equal((await reset(token, 'goodpassword1')).status, 200, 'the link still worked after the refusals');
    });

    test('a reset lifts a sign-in lock on the address', async () => {
      await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      for (let i = 0; i < 6; i++) await login('reset@example.com', 'wrong-guess');
      assert.equal((await login('reset@example.com', 'oldpassword1')).status, 429, 'locked');
      const token = await requestToken('reset@example.com');
      assert.equal((await reset(token, 'brandnewpass1')).status, 200);
      assert.equal((await login('reset@example.com', 'brandnewpass1')).status, 200);
    });

    test('changing the password in Settings kills a pending reset link', async () => {
      const user = await createUser({ email: 'reset@example.com', password: 'oldpassword1' });
      const token = await requestToken('reset@example.com');
      const session = jwt.sign({ id: user._id, iat: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
      const change = await request(app).put('/api/auth/password').set('Authorization', `Bearer ${session}`)
        .send({ currentPassword: 'oldpassword1', newPassword: 'changedpass1' });
      assert.equal(change.status, 200);
      const res = await reset(token, 'brandnewpass1');
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'RESET_TOKEN_INVALID');
      assert.equal((await login('reset@example.com', 'changedpass1')).status, 200);
    });
  });
});

describe('password reset rate limits (H-06)', () => {
  // The app's own limiters are pass-throughs under test (the suite sends many
  // requests from one address), so the real ones are built here and put in
  // front of a stand-in handler, the way the routes stack them.
  const limitedApp = () => {
    const limiters = buildPasswordResetLimiters();
    const a = express();
    a.set('trust proxy', 1); // one hop: each request's X-Forwarded-For is its IP
    a.use(express.json());
    const ok = (req, res) => res.json({ success: true });
    a.post('/forgot', limiters.forgotIp, limiters.forgotEmail, ok);
    a.post('/reset', limiters.reset, ok);
    return a;
  };
  const from = (ip) => ({ 'X-Forwarded-For': ip });

  test('one address gets at most 3 links an hour, from however many IPs, in any spelling', async () => {
    const a = limitedApp();
    const spellings = ['victim@example.com', 'VICTIM@example.com', ' victim@Example.com ', 'victim@example.com'];
    const statuses = [];
    for (const [i, email] of spellings.entries()) {
      statuses.push((await request(a).post('/forgot').set(from(`10.0.0.${i + 1}`)).send({ email })).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429]);
    // Another address is unaffected.
    assert.equal((await request(a).post('/forgot').set(from('10.0.0.9')).send({ email: 'other@example.com' })).status, 200);
  });

  test('one IP gets at most 5 requests in 15 minutes, across addresses', async () => {
    const a = limitedApp();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await request(a).post('/forgot').set(from('10.1.1.1')).send({ email: `person${i}@example.com` })).status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
    const limited = await request(a).post('/forgot').set(from('10.1.1.1')).send({ email: 'x@example.com' });
    assert.equal(limited.body.code, 'RATE_LIMITED');
  });

  test('the 429 is the same for every address, so a limit reveals nothing', async () => {
    const a = limitedApp();
    const last = {};
    for (const email of ['registered@example.com', 'unknown@example.com']) {
      for (let i = 0; i < 4; i++) {
        last[email] = await request(a).post('/forgot').set(from(`10.2.${email.length}.${i}`)).send({ email });
      }
    }
    assert.equal(last['registered@example.com'].status, 429);
    assert.equal(last['unknown@example.com'].status, 429);
    assert.deepEqual(last['registered@example.com'].body, last['unknown@example.com'].body);
  });

  test('reset attempts are capped at 10 per IP per 15 minutes', async () => {
    const a = limitedApp();
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await request(a).post('/reset').set(from('10.3.3.3')).send({})).status);
    assert.deepEqual(statuses, [...Array(10).fill(200), 429]);
  });
});
