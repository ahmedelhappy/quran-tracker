// M-06: per-account failed-login backoff. The per-IP limiter is a no-op under
// test, so everything here is the account rule alone.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { connect, disconnect, clearDatabase, createUser } = require('./helpers');
const app = require('../app');
const { createLoginThrottle } = require('../utils/loginThrottle');

const MIN = 60 * 1000;

describe('loginThrottle (fake clock)', () => {
  const make = (opts = {}) => {
    let t = 1_000_000;
    const clock = { advance: (ms) => { t += ms; } };
    const throttle = createLoginThrottle({ now: () => t, ...opts });
    return { throttle, clock };
  };

  test('5 failures within 15 minutes lock for a minute, then the lock doubles per failure', () => {
    const { throttle, clock } = make();
    for (let i = 0; i < 4; i++) throttle.recordFailure('a@x.com');
    assert.equal(throttle.lockedFor('a@x.com'), 0, 'four failures: still allowed');
    throttle.recordFailure('a@x.com');
    assert.equal(throttle.lockedFor('a@x.com'), 1 * MIN);

    clock.advance(1 * MIN);
    assert.equal(throttle.lockedFor('a@x.com'), 0, 'the lock ends');
    throttle.recordFailure('a@x.com');
    assert.equal(throttle.lockedFor('a@x.com'), 2 * MIN);
    clock.advance(2 * MIN);
    throttle.recordFailure('a@x.com');
    assert.equal(throttle.lockedFor('a@x.com'), 4 * MIN);
  });

  test('the lock is capped at an hour, and a long lock does not reset the escalation', () => {
    const { throttle, clock } = make();
    for (let i = 0; i < 5; i++) throttle.recordFailure('b@x.com');
    for (let i = 0; i < 10; i++) {
      clock.advance(throttle.lockedFor('b@x.com'));
      throttle.recordFailure('b@x.com');
    }
    assert.equal(throttle.lockedFor('b@x.com'), 60 * MIN);
    // Well past the 15-minute window, but only just after the lock ended.
    clock.advance(60 * MIN + 1);
    throttle.recordFailure('b@x.com');
    assert.equal(throttle.lockedFor('b@x.com'), 60 * MIN, 'still escalated, not back to one minute');
  });

  test('failures spread beyond the window never lock', () => {
    const { throttle, clock } = make();
    for (let i = 0; i < 4; i++) throttle.recordFailure('c@x.com');
    clock.advance(16 * MIN);
    throttle.recordFailure('c@x.com');
    assert.equal(throttle.lockedFor('c@x.com'), 0);
  });

  test('a success (reset) clears the record', () => {
    const { throttle } = make();
    for (let i = 0; i < 4; i++) throttle.recordFailure('d@x.com');
    throttle.reset('d@x.com');
    throttle.recordFailure('d@x.com');
    assert.equal(throttle.lockedFor('d@x.com'), 0);
  });

  test('memory stays bounded under a flood of made-up emails', () => {
    const { throttle } = make({ maxEntries: 100 });
    for (let i = 0; i < 1000; i++) throttle.recordFailure(`flood${i}@x.com`);
    assert.ok(throttle.size() <= 100, `size ${throttle.size()}`);
  });
});

describe('POST /api/auth/login — account backoff', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

  test('after 5 wrong passwords even the right one is refused with a 429 JSON', async () => {
    await createUser({ email: 'victim@example.com', password: 'secret123' });
    for (let i = 0; i < 5; i++) {
      assert.equal((await login('victim@example.com', `wrong${i}`)).status, 401);
    }
    const locked = await login('victim@example.com', 'secret123');
    assert.equal(locked.status, 429);
    assert.equal(locked.body.code, 'LOGIN_LOCKED');
    assert.ok(Number(locked.headers['retry-after']) > 0);
    assert.ok(!locked.body.data, 'no token while locked');

    // The case or spacing of the address does not dodge it.
    assert.equal((await login('  VICTIM@example.com ', 'secret123')).status, 429);
    // Another account is unaffected.
    await createUser({ email: 'bystander@example.com', password: 'secret123' });
    assert.equal((await login('bystander@example.com', 'secret123')).status, 200);
  });

  // A burst fired all at once (as a guesser spread over many IPs would) must not
  // slip past the check while the first guesses are still in bcrypt.
  test('concurrent wrong passwords: at most 5 are tested, the rest are refused', async () => {
    await createUser({ email: 'burst@example.com', password: 'secret123' });
    const statuses = (await Promise.all(
      Array.from({ length: 12 }, (_, i) => login('burst@example.com', `guess${i}`)),
    )).map((r) => r.status);
    assert.equal(statuses.filter((s) => s === 401).length, 5, statuses.join(','));
    assert.equal(statuses.filter((s) => s === 429).length, 7, statuses.join(','));
    // …and the lock holds for the right password too.
    assert.equal((await login('burst@example.com', 'secret123')).status, 429);
  });

  test('the right password still signs in and clears the attempt it reserved', async () => {
    await createUser({ email: 'fifth@example.com', password: 'secret123' });
    for (let i = 0; i < 4; i++) await login('fifth@example.com', 'oops');
    // The fifth attempt is counted up front (reaching the limit), then taken back.
    assert.equal((await login('fifth@example.com', 'secret123')).status, 200);
    assert.equal((await login('fifth@example.com', 'oops')).status, 401, 'not locked');
  });

  test('the lock answer does not reveal whether the account exists', async () => {
    await createUser({ email: 'real@example.com', password: 'secret123' });
    for (let i = 0; i < 5; i++) {
      await login('real@example.com', 'nope');
      await login('ghost@example.com', 'nope');
    }
    const real = await login('real@example.com', 'nope');
    const ghost = await login('ghost@example.com', 'nope');
    assert.equal(real.status, 429);
    assert.equal(ghost.status, 429);
    assert.deepEqual(real.body, ghost.body);
  });

  test('a successful sign-in resets the count', async () => {
    await createUser({ email: 'typo@example.com', password: 'secret123' });
    for (let i = 0; i < 4; i++) await login('typo@example.com', 'oops');
    assert.equal((await login('typo@example.com', 'secret123')).status, 200);
    for (let i = 0; i < 4; i++) {
      assert.equal((await login('typo@example.com', 'oops')).status, 401, 'counting from zero again');
    }
    assert.equal((await login('typo@example.com', 'secret123')).status, 200);
  });
});
