// L-13: the seeds only ever write to a database named on the command line, and
// importing them runs nothing. Exercised against the in-memory database only.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');

const { connect, disconnect, clearDatabase } = require('./helpers');

const SEED = path.join(__dirname, '..', 'seed');

const memoryUri = () => {
  const c = mongoose.connection;
  return `mongodb://${c.host}:${c.port}/${c.name}`;
};
const runSeed = (file, args, env = {}) => {
  const childEnv = { ...process.env, ...env };
  if (!('MONGODB_URI' in env)) delete childEnv.MONGODB_URI;
  const res = spawnSync(process.execPath, [path.join(SEED, file), ...args], { env: childEnv, encoding: 'utf8', timeout: 60000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
};

describe('Seed scripts need an explicit target (L-13)', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  test('importing the seeds runs nothing, and buildQuranPages is reusable', () => {
    const quranData = require('../seed/quranData');
    const demoData = require('../seed/demoData');
    assert.equal(typeof demoData.main, 'function');
    const pages = quranData.buildQuranPages();
    assert.equal(pages.length, 604);
    assert.deepEqual(pages[49].surahs.map((s) => s.number), [3], 'page 50 is Aal-Imran alone');
  });

  for (const file of ['quranData.js', 'demoData.js']) {
    test(`${file} refuses without --uri even with MONGODB_URI exported, and writes nothing`, async () => {
      const res = runSeed(file, [], { MONGODB_URI: memoryUri() });
      assert.equal(res.code, 1, res.out);
      assert.match(res.out, /explicit --uri/);
      assert.equal(await mongoose.connection.db.collection('quranmetadatas').countDocuments(), 0);
      assert.equal(await mongoose.connection.db.collection('users').countDocuments(), 0);
    });
  }

  test('quranData.js with --uri prints the masked target first, then seeds 604 pages', async () => {
    const res = runSeed('quranData.js', ['--uri', memoryUri()]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out.split('\n')[0], /^Target: mongodb:\/\/[^@]+$/);
    assert.equal(await mongoose.connection.db.collection('quranmetadatas').countDocuments(), 604);
  });

  test('demoData.js with --uri seeds only the demo account', async () => {
    const res = runSeed('demoData.js', ['--uri', memoryUri()]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out.split('\n')[0], /^Target: mongodb:\/\//);
    const users = await mongoose.connection.db.collection('users').find({}, { projection: { email: 1 } }).toArray();
    assert.deepEqual(users.map((u) => u.email), ['demo@qurantracker.com']);
  });
});
