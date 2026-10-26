// The one place every controller's catch block goes through: client mistakes the
// model catches must come back as 400 / 409, only genuine faults as 500. Uses
// REAL Mongoose errors (no database needed) so a Mongoose upgrade that renames
// an error class fails here.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../models/User');
const { serverError } = require('../utils/errorResponse');

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
    assert.deepEqual(res.body, { success: false, message: 'Please provide your name' });
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
        assert.deepEqual(res.body, { success: false, message: 'Error saving progress' });
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
      assert.deepEqual(prod.body, { success: false, message: 'Error saving' });
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
