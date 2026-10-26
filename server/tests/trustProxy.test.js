// M-06: how many proxy hops to trust is the owner's call (it depends on the
// production hosting chain), so it comes from TRUST_PROXY; unset, it keeps the
// old behaviour. This file sets the variable before the app loads — node --test
// runs each file in its own process, so it does not leak into the others.
process.env.TRUST_PROXY = '2';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('./helpers');
const app = require('../app');
const { parseTrustProxy } = require('../utils/trustProxy');

describe('TRUST_PROXY', () => {
  test('unset keeps the old default: one hop in production, off elsewhere', () => {
    assert.equal(parseTrustProxy(undefined, 'production'), 1);
    assert.equal(parseTrustProxy('', 'production'), 1);
    assert.equal(parseTrustProxy('  ', 'production'), 1);
    assert.equal(parseTrustProxy(undefined, 'development'), false);
    assert.equal(parseTrustProxy(undefined, 'test'), false);
  });

  test('accepts false, a hop count, true, or anything else Express takes', () => {
    assert.equal(parseTrustProxy('false', 'production'), false);
    assert.equal(parseTrustProxy('FALSE', 'production'), false);
    assert.equal(parseTrustProxy('0', 'production'), 0);
    assert.equal(parseTrustProxy('2', 'production'), 2);
    assert.equal(parseTrustProxy('true', 'development'), true);
    assert.equal(parseTrustProxy('loopback, 10.0.0.0/8', 'production'), 'loopback, 10.0.0.0/8');
  });

  test('the app applies it', () => {
    assert.equal(app.get('trust proxy'), 2);
  });
});
