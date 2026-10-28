// Every route the app registers must refuse a request that carries no valid
// session — unless it is on the short public list below.
//
// The routes are not listed by hand: they are read off the app's own router
// stack, so a route added tomorrow is swept the moment it is mounted, and one
// that forgets `protect` fails here instead of shipping open.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');

// Express 5 no longer keeps a mounted router's path on its layer (only a
// compiled matcher), so record it as each `use` lands. This has to be in place
// before the app is required; each test file runs in its own process, so
// nothing else ever sees the wrapper.
const originalUse = express.Router.prototype.use;
express.Router.prototype.use = function use(...args) {
  const before = this.stack.length;
  const result = originalUse.apply(this, args);
  const path = typeof args[0] === 'string' ? args[0] : '/';
  for (const layer of this.stack.slice(before)) layer.mountPath = path;
  return result;
};

const { connect, disconnect, clearDatabase, seedMetadata, createUser, tokenFor } = require('./helpers');
const app = require('../app');
const User = require('../models/User');

// The only routes anyone may call without signing in. Kept exact on purpose:
// a route missing from the app, or one the app has that is neither here nor
// protected, both fail.
const PUBLIC_ROUTES = [
  'GET /',
  'GET /health',
  'POST /api/auth/register',
  'POST /api/auth/login',
];

const joinPath = (prefix, path) => (prefix + (path === '/' && prefix ? '' : path)) || '/';

// [{ method: 'GET', path: '/api/progress/today' }, …] for every route in `stack`.
const collectRoutes = (stack, prefix = '') => {
  const routes = [];
  for (const layer of stack) {
    if (layer.route) {
      assert.equal(typeof layer.route.path, 'string', `a route under "${prefix}" has a non-string path; teach the sweep about it`);
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        routes.push({ method: method.toUpperCase(), path: joinPath(prefix, layer.route.path) });
      }
    } else if (Array.isArray(layer.handle?.stack)) {
      // A mounted router. Without its path the sweep would test the wrong URLs.
      assert.equal(typeof layer.mountPath, 'string', `a router mounted under "${prefix}" has no recorded path`);
      routes.push(...collectRoutes(layer.handle.stack, joinPath(prefix, layer.mountPath === '/' ? '' : layer.mountPath)));
    }
  }
  return routes;
};

const ROUTES = collectRoutes(app.router.stack);
const isPublic = (r) => PUBLIC_ROUTES.includes(`${r.method} ${r.path}`);
const PROTECTED = ROUTES.filter((r) => !isPublic(r));

// A concrete URL for a route pattern: every :param becomes a well-formed id, so
// a route can only answer 401 for want of a session, never for a malformed id.
const SAMPLE_ID = '64b7f0c2a1b2c3d4e5f60718';
const urlFor = (path) => {
  const url = path.replace(/:\w+/g, SAMPLE_ID);
  assert.ok(!/[:*{}()]/.test(url), `the sweep cannot build a URL for "${path}"; teach it about this pattern`);
  return url;
};

const send = (route, authorization) => {
  const req = request(app)[route.method.toLowerCase()](urlFor(route.path));
  if (authorization !== undefined) req.set('Authorization', authorization);
  // A body for the write routes: validation sits behind `protect`, so any shape will do.
  return ['POST', 'PUT', 'PATCH'].includes(route.method) ? req.send({}) : req;
};

describe('401 sweep over every registered route', () => {
  before(connect);
  after(disconnect);
  beforeEach(async () => {
    await clearDatabase();
    await seedMetadata(5);
  });

  test('the sweep found the app\'s routes, and the public list matches them exactly', () => {
    // Guard against a vacuous pass: a walk that found nothing would "pass" below.
    // 38 is what the app had when the sweep was written; it may only grow.
    assert.ok(PROTECTED.length >= 38, `only ${PROTECTED.length} protected routes found`);
    for (const prefix of ['/api/auth', '/api/progress', '/api/bookmarks', '/api/annotations', '/api/todos', '/api/leaderboard', '/api/chat']) {
      assert.ok(PROTECTED.some((r) => r.path.startsWith(prefix)), `no protected route found under ${prefix}`);
    }
    const found = ROUTES.filter(isPublic).map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(found, [...PUBLIC_ROUTES].sort(), 'a public route is listed here but no longer exists');
    const keys = ROUTES.map((r) => `${r.method} ${r.path}`);
    assert.equal(new Set(keys).size, keys.length, 'a route is registered twice');
  });

  test('every protected route answers 401 to a missing, garbage, expired, forged or orphaned token', async () => {
    // Every bad token names a user who still exists, so the 401 has to come
    // from the token check itself. Minted for a deleted user, a forged or
    // expired token would be refused at the "User not found" lookup anyway, and
    // the sweep would stay green if jwt.verify were swapped for jwt.decode.
    const live = await createUser({ email: 'live@example.com' });
    const ghost = await createUser({ email: 'ghost@example.com' });
    const orphanToken = tokenFor(ghost._id);
    await User.deleteOne({ _id: ghost._id });
    const now = Math.floor(Date.now() / 1000);
    const cases = {
      'no Authorization header': undefined,
      'an empty Bearer': 'Bearer ',
      'a garbage token': 'Bearer not-a-jwt-at-all',
      'a token with another scheme': `Basic ${tokenFor(live._id)}`,
      'an expired token': `Bearer ${jwt.sign({ id: live._id, iat: now - 7200, exp: now - 3600 }, process.env.JWT_SECRET)}`,
      'a token signed with another secret': `Bearer ${jwt.sign({ id: live._id }, 'not-the-server-secret')}`,
      'an unsigned (alg: none) token': `Bearer ${jwt.sign({ id: live._id }, null, { algorithm: 'none' })}`,
      "a deleted user's token": `Bearer ${orphanToken}`,
    };

    const failures = [];
    for (const route of PROTECTED) {
      for (const [label, authorization] of Object.entries(cases)) {
        const res = await send(route, authorization);
        if (res.status !== 401 || res.body?.success !== false) {
          failures.push(`${route.method} ${route.path} with ${label}: ${res.status}`);
        }
      }
    }
    assert.deepEqual(failures, [], `routes that did not refuse an unauthenticated call:\n${failures.join('\n')}`);
  });

  test('with a valid token no protected route answers 401, so the 401s above were about the session', async () => {
    const failures = [];
    for (const route of PROTECTED) {
      // A fresh account per route: DELETE /account and friends must not starve the rest.
      const user = await createUser();
      const res = await send(route, `Bearer ${tokenFor(user._id)}`);
      if (res.status === 401 || res.status === 404 && res.body?.message === 'Route not found') {
        failures.push(`${route.method} ${route.path}: ${res.status} ${res.body?.message}`);
      }
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });

  test('the public routes answer without a token', async () => {
    for (const key of PUBLIC_ROUTES) {
      const [method, path] = key.split(' ');
      const res = await send({ method, path });
      assert.notEqual(res.status, 401, key);
      assert.notEqual(res.status, 404, key);
    }
  });
});
