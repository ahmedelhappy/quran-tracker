// Graceful shutdown (M-21), driven through a real HTTP server on an ephemeral
// port and a real (in-memory) MongoDB — never server.js, which would connect to
// the database in .env. `exit` is a stub, so the test process stays alive.
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { connect, disconnect } = require('./helpers');
const app = require('../app');
const { createShutdown, handleShutdownSignals } = require('../utils/shutdown');

const quiet = { log() {}, error() {} };

const listen = (handler) => new Promise((resolve) => {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1', () => resolve(server));
});
const urlOf = (server, path) => `http://127.0.0.1:${server.address().port}${path}`;

// A plain GET that resolves to { status, body } or rejects with the socket error.
const get = (url) => new Promise((resolve, reject) => {
  http.get(url, (res) => {
    let body = '';
    res.on('data', (c) => { body += c; });
    res.on('end', () => resolve({ status: res.statusCode, body }));
  }).on('error', reject);
});

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};

let cleanup = [];
afterEach(async () => {
  for (const fn of cleanup.reverse()) await fn();
  cleanup = [];
});

describe('graceful shutdown (M-21)', () => {
  test('a write in flight finishes before the database closes; new connections are refused; exits 0', async () => {
    await connect();
    cleanup.push(disconnect);
    const events = [];
    const entered = deferred();
    const release = deferred();
    const server = await listen(async (req, res) => {
      if (req.url === '/slow-write') {
        entered.resolve();
        await release.promise;
        await mongoose.connection.db.collection('shutdownprobes').insertOne({ at: new Date() });
        events.push('write done');
        res.end('saved');
        return;
      }
      app(req, res);
    });

    assert.equal((await get(urlOf(server, '/health'))).status, 200);

    const healthUrl = urlOf(server, '/health');
    const inFlight = get(urlOf(server, '/slow-write'));
    await entered.promise;

    const exits = [];
    const shutdown = createShutdown({
      server,
      log: quiet,
      exit: (code) => exits.push(code),
      disconnect: async () => { events.push('disconnect'); await mongoose.disconnect(); },
    });
    const stopped = shutdown('SIGTERM');

    // Stopped listening at once, while the database is still up for the request.
    await assert.rejects(get(healthUrl), { code: 'ECONNREFUSED' });
    assert.equal(mongoose.connection.readyState, 1);
    assert.deepEqual(exits, []);

    release.resolve();
    assert.deepEqual(await inFlight, { status: 200, body: 'saved' });
    assert.equal(await stopped, 0);
    assert.deepEqual(exits, [0]);
    assert.deepEqual(events, ['write done', 'disconnect']);
    assert.equal(mongoose.connection.readyState, 0);
  });

  test('a request that never ends is cut after the timeout and the exit is 1', async () => {
    const entered = deferred();
    const server = await listen(() => { entered.resolve(); /* never answers */ });
    const hanging = get(urlOf(server, '/hang')).then(() => 'answered', (err) => err.code);
    await entered.promise;

    const exits = [];
    let disconnected = false;
    const started = Date.now();
    const code = await createShutdown({
      server,
      log: quiet,
      timeoutMs: 300,
      exit: (c) => exits.push(c),
      disconnect: async () => { disconnected = true; },
    })('SIGTERM');

    assert.equal(code, 1);
    assert.deepEqual(exits, [1]);
    assert.ok(Date.now() - started >= 290, 'waited for the timeout');
    assert.equal(await hanging, 'ECONNRESET');
    assert.equal(disconnected, false);
  });

  test('a second signal joins the first stop; SIGTERM and SIGINT are both wired and removable', async () => {
    const server = await listen((req, res) => res.end('ok'));
    const before = { SIGTERM: process.listeners('SIGTERM'), SIGINT: process.listeners('SIGINT') };
    const exits = [];
    let disconnects = 0;
    const { remove } = handleShutdownSignals({
      server,
      log: quiet,
      exit: (c) => exits.push(c),
      disconnect: async () => { disconnects += 1; },
    });
    cleanup.push(async () => remove());

    const added = (signal) => process.listeners(signal).filter((l) => !before[signal].includes(l));
    assert.equal(added('SIGTERM').length, 1);
    assert.equal(added('SIGINT').length, 1);

    // Call the listeners directly: emitting a real signal event could also reach
    // the test runner's own handlers.
    const first = added('SIGTERM')[0]();
    const second = added('SIGINT')[0]();
    assert.equal(first, second);
    assert.equal(await first, 0);
    assert.deepEqual(exits, [0]);
    assert.equal(disconnects, 1);
    assert.equal(server.listening, false);

    remove();
    assert.equal(added('SIGTERM').length, 0);
    assert.equal(added('SIGINT').length, 0);
  });
});
