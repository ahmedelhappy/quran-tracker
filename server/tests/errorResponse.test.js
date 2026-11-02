// The one place every controller's catch block goes through: client mistakes the
// model catches must come back as 400 / 409, only genuine faults as 500. Uses
// REAL Mongoose errors (no database needed) so a Mongoose upgrade that renames
// an error class fails here.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const { serverError, logError } = require('../utils/errorResponse');

// The smallest stand-in for an Express response that records what was sent.
const fakeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('serverError — status mapping', () => {
  test('a ValidationError is a 400 carrying the model\'s own message', async () => {
    const err = await new User({ email: 'a@example.com', password: 'secret123' }).validate().catch((e) => e);
    const res = serverError(fakeRes(), 'Error saving', err);
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, { success: false, code: 'INVALID_REQUEST', message: 'Please provide your name' });
  });

  test('a cast failure inside a ValidationError names the field, not the value', async () => {
    const err = await new User({ name: 'A', email: 'a@example.com', password: 'secret123', dailyNewPages: 'lots' })
      .validate().catch((e) => e);
    const res = serverError(fakeRes(), 'Error saving', err);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid value for dailyNewPages');
  });

  test('a bare CastError (e.g. a malformed id in a query) is a 400', async () => {
    const err = await User.findById('not-an-id').exec().catch((e) => e);
    assert.equal(err.name, 'CastError');
    const res = serverError(fakeRes(), 'Error fetching', err);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Invalid value for _id');
  });

  test('a duplicate key (E11000) is a 409', () => {
    const dupEmail = Object.assign(new mongoose.mongo.MongoServerError({ message: 'E11000 duplicate key' }),
      { code: 11000, keyValue: { email: 'a@example.com' } });
    const res = serverError(fakeRes(), 'Error saving', dupEmail);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.message, 'An account with this email already exists');

    const dupOther = serverError(fakeRes(), 'Error saving', { code: 11000, keyPattern: { userId: 1, pageNumber: 1 } });
    assert.equal(dupOther.statusCode, 409);
  });

  test('a duplicate key from a multi-document write stays a 500 (part of it may be written)', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      for (const err of [
        Object.assign(new Error('E11000'), { name: 'MongoBulkWriteError', code: 11000, keyValue: { email: 'a@x.com' } }),
        { code: 11000, writeErrors: [{ code: 11000 }], keyPattern: { userId: 1, pageNumber: 1 } },
      ]) {
        const res = serverError(fakeRes(), 'Error saving progress', err);
        assert.equal(res.statusCode, 500);
        assert.deepEqual(res.body, { success: false, code: 'SERVER_ERROR', message: 'Error saving progress' });
      }
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  test('anything else stays a 500, with the raw message only outside production', () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const dev = serverError(fakeRes(), 'Error saving', new Error('socket hang up'));
      assert.equal(dev.statusCode, 500);
      assert.equal(dev.body.error, 'socket hang up');

      process.env.NODE_ENV = 'production';
      const prod = serverError(fakeRes(), 'Error saving', new Error('socket hang up'));
      assert.equal(prod.statusCode, 500);
      assert.deepEqual(prod.body, { success: false, code: 'SERVER_ERROR', message: 'Error saving' });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('logError — what a caught error leaves in the log (H-05)', () => {
  const capture = (label, error) => {
    const logged = [];
    const original = console.error;
    console.error = (...args) => logged.push(args);
    try { logError(label, error); } finally { console.error = original; }
    return logged;
  };

  test('a duplicate key is logged by class, code and frames, never the colliding value', () => {
    const single = Object.assign(
      new mongoose.mongo.MongoServerError({ message: 'E11000 duplicate key error collection: test.users index: email_1 dup key: { email: "a@example.com" }' }),
      { code: 11000, keyValue: { email: 'a@example.com' } },
    );
    const bulk = Object.assign(new Error('E11000 dup key: { email: "b@example.com" }'),
      { writeErrors: [{ code: 11000, keyValue: { email: 'b@example.com' } }] });
    for (const error of [single, bulk]) {
      const logged = capture('Save error:', error);
      assert.equal(logged.length, 1);
      assert.ok(logged[0].every((part) => typeof part === 'string'), 'nothing is printed as an object');
      const text = logged[0].join(' ');
      assert.ok(!text.includes('@example.com'), text);
      assert.match(text, /^Save error: \w+ 11000/);
      assert.match(text, /\n\s+at /, 'the frames say where it happened');
    }
  });

  test('a validation or cast error names the fields, never the refused value', () => {
    // A real ValidationError: logged whole, each field's `value` (here a
    // too-long name) would print with it.
    const invalid = new User({ name: `${'N'.repeat(48)}7f3a__`, email: 'a@example.com', password: 'secret123' }).validateSync();
    const cast = new mongoose.Error.CastError('Number', 'x7f3a', 'dailyNewPages');
    for (const [error, field] of [[invalid, 'name'], [cast, 'dailyNewPages']]) {
      const text = capture('Save error:', error)[0].join(' ');
      assert.ok(!text.includes('7f3a'), text);
      assert.ok(text.includes(`invalid value (${field})`), text);
    }
  });

  test('any other error is logged whole', () => {
    const error = new Error('socket hang up');
    const logged = capture('Save error:', error);
    assert.deepEqual(logged, [['Save error:', error]]);
  });
});
