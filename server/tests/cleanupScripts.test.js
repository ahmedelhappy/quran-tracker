// The one-off maintenance scripts, run only against the in-memory database.
// The core functions are called directly; the CLI is also spawned as a child
// process to prove the safety contract: no --uri → refuse, even with
// MONGODB_URI exported; dry run by default; --apply is the only way to write.
const { test, before, after, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const mongoose = require('mongoose');

const { connect, disconnect, clearDatabase, createUser } = require('./helpers');
const { maskUri, parseTargetArgs } = require('../scripts/lib/target');
const { findOrphans, deleteOrphans } = require('../scripts/cleanupOrphans');

const SCRIPTS = path.join(__dirname, '..', 'scripts');

// The in-memory server's URI, rebuilt from the live connection (the helpers keep
// the MongoMemoryServer instance private).
const memoryUri = () => {
  const c = mongoose.connection;
  return `mongodb://${c.host}:${c.port}/${c.name}`;
};

// Runs a script in a child process with a scrubbed environment (plus `env`).
const runScript = (file, args, env = {}) => {
  const childEnv = { ...process.env, ...env };
  if (!('MONGODB_URI' in env)) delete childEnv.MONGODB_URI;
  const res = spawnSync(process.execPath, [path.join(SCRIPTS, file), ...args], { env: childEnv, encoding: 'utf8', timeout: 60000 });
  return { code: res.status, out: `${res.stdout}${res.stderr}` };
};

describe('scripts/lib/target.js — explicit target only', () => {
  test('maskUri drops credentials and query options', () => {
    assert.equal(maskUri('mongodb+srv://me:s3cret@cluster0.ab.mongodb.net/app?retryWrites=true'), 'mongodb+srv://cluster0.ab.mongodb.net/app');
    assert.equal(maskUri('mongodb://127.0.0.1:27017/'), 'mongodb://127.0.0.1:27017');
    assert.equal(maskUri('mongodb://u:p@h1:1,h2:2/db'), 'mongodb://h1:1,h2:2/db');
    assert.equal(maskUri('postgres://x'), null);
    assert.equal(maskUri(undefined), null);
  });

  test('maskUri never prints part of a password that holds a raw @ / ? or :', () => {
    // The first two used to print "ss@cluster0…" and the whole URI.
    assert.equal(maskUri('mongodb+srv://user:p@ss@cluster0.x.net/app'), 'mongodb+srv://cluster0.x.net/app');
    assert.equal(maskUri('mongodb+srv://user:pa/ss@host/db'), 'mongodb+srv://host/db');
    assert.equal(maskUri('mongodb://user:pa?ss@host/db'), 'mongodb://host/db');
    assert.equal(maskUri('mongodb://u:p@[::1]:27017/db'), 'mongodb://[::1]:27017/db');
    // No '@' at all, but a "user:pass" where the host should be: not printable.
    assert.equal(maskUri('mongodb://user:pass/db'), null);
    const res = parseTargetArgs(['--uri', 'mongodb://user:s3cret/db']);
    assert.ok(res.error && !res.error.includes('s3cret'), 'the error does not echo the URI');
  });

  test('parseTargetArgs never falls back to MONGODB_URI', () => {
    const saved = process.env.MONGODB_URI;
    process.env.MONGODB_URI = 'mongodb://should-never-be-used:27017/prod';
    try {
      assert.match(parseTargetArgs([]).error, /explicit --uri/);
      assert.match(parseTargetArgs(['--apply'], { allowApply: true }).error, /explicit --uri/);
    } finally {
      if (saved === undefined) delete process.env.MONGODB_URI; else process.env.MONGODB_URI = saved;
    }
  });

  test('parseTargetArgs: --apply only where allowed, unknown flags rejected', () => {
    assert.deepEqual(parseTargetArgs(['--uri', 'mongodb://h/db']), { uri: 'mongodb://h/db', masked: 'mongodb://h/db', apply: false });
    assert.equal(parseTargetArgs(['--uri=mongodb://h/db', '--apply'], { allowApply: true }).apply, true);
    assert.match(parseTargetArgs(['--uri', 'mongodb://h/db', '--apply']).error, /Unknown argument/);
    assert.match(parseTargetArgs(['--uri', 'not-a-uri']).error, /mongodb/);
  });
});

describe('scripts/cleanupOrphans.js', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  // Two orphaned bookmarks + three orphaned annotations from a user that no
  // longer exists, next to a live user's documents that must survive.
  const seedOrphans = async () => {
    const live = await createUser();
    const ghostId = new mongoose.Types.ObjectId();
    const Bookmark = mongoose.model('Bookmark');
    const Annotation = mongoose.model('Annotation');
    await Bookmark.collection.insertMany([{ userId: ghostId, pageNumber: 1 }, { userId: ghostId, pageNumber: 2 }, { userId: live._id, pageNumber: 3 }]);
    await Annotation.collection.insertMany([
      { userId: ghostId, pageNumber: 1, kind: 'note' }, { userId: ghostId, pageNumber: 1, kind: 'highlight' },
      { userId: ghostId, pageNumber: 2, kind: 'drawing' }, { userId: live._id, pageNumber: 2, kind: 'note' },
    ]);
    return { live, ghostId };
  };

  test('findOrphans counts only documents whose user is gone; deleteOrphans removes exactly those', async () => {
    const { live, ghostId } = await seedOrphans();
    const report = await findOrphans();
    const byModel = Object.fromEntries(report.map((r) => [r.model, r]));
    assert.equal(byModel.Bookmark.count, 2);
    assert.equal(byModel.Annotation.count, 3);
    assert.equal(byModel.UserProgress.count, 0);
    assert.deepEqual(byModel.Bookmark.orphanUserIds.map(String), [String(ghostId)]);

    const deleted = await deleteOrphans(report);
    assert.equal(deleted.Bookmark, 2);
    assert.equal(deleted.Annotation, 3);
    assert.equal(await mongoose.model('Bookmark').countDocuments({ userId: live._id }), 1);
    assert.equal(await mongoose.model('Annotation').countDocuments({ userId: live._id }), 1);
    assert.equal(await mongoose.model('Bookmark').countDocuments({ userId: ghostId }), 0);
  });

  test('CLI refuses without --uri even when MONGODB_URI is exported, and touches nothing', async () => {
    await seedOrphans();
    const res = runScript('cleanupOrphans.js', ['--apply'], { MONGODB_URI: memoryUri() });
    assert.equal(res.code, 1);
    assert.match(res.out, /explicit --uri/);
    assert.equal(await mongoose.model('Bookmark').countDocuments(), 3);
  });

  test('CLI dry run prints the masked target and counts, deleting nothing', async () => {
    await seedOrphans();
    const res = runScript('cleanupOrphans.js', ['--uri', memoryUri()]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /^Target: mongodb:\/\//m);
    assert.match(res.out, /dry run/);
    assert.match(res.out, /Bookmark: 2 orphaned/);
    assert.match(res.out, /Annotation: 3 orphaned/);
    assert.equal(await mongoose.model('Bookmark').countDocuments(), 3);
    assert.equal(await mongoose.model('Annotation').countDocuments(), 4);
  });

  test('CLI --apply deletes the orphans and keeps live users\' documents', async () => {
    await seedOrphans();
    const res = runScript('cleanupOrphans.js', ['--uri', memoryUri(), '--apply']);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /deleted 2 from Bookmark/);
    assert.equal(await mongoose.model('Bookmark').countDocuments(), 1);
    assert.equal(await mongoose.model('Annotation').countDocuments(), 1);
  });

  // A --uri naming the wrong database (or none: the driver then uses "test")
  // finds no users, and every document there would count as orphaned.
  test('CLI --apply refuses when the database has no users at all, and deletes nothing', async () => {
    const someone = new mongoose.Types.ObjectId();
    await mongoose.model('Bookmark').collection.insertMany([{ userId: someone, pageNumber: 1 }, { userId: someone, pageNumber: 2 }]);
    const res = runScript('cleanupOrphans.js', ['--uri', memoryUri(), '--apply']);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /Users: 0/);
    assert.match(res.out, /no users/i);
    assert.equal(await mongoose.model('Bookmark').countDocuments(), 2);
  });

  test('CLI --apply refuses a URI that names no database', async () => {
    await seedOrphans();
    const c = mongoose.connection;
    const res = runScript('cleanupOrphans.js', ['--uri', `mongodb://${c.host}:${c.port}`, '--apply']);
    assert.equal(res.code, 1, res.out);
    assert.match(res.out, /names no database/);
    assert.equal(await mongoose.model('Bookmark').countDocuments(), 3);
  });

  test('CLI dry run shows the user count and each collection\'s total', async () => {
    await seedOrphans();
    const res = runScript('cleanupOrphans.js', ['--uri', memoryUri()]);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /Users: 1/);
    assert.match(res.out, /Bookmark: 2 orphaned of 3 document\(s\)/);
  });
});

describe('scripts/cleanupInvalidPages.js', () => {
  before(connect);
  after(disconnect);
  beforeEach(clearDatabase);

  const { findInvalidPages, deleteInvalidPages } = require('../scripts/cleanupInvalidPages');
  const VALID = [1, 302, 604];
  const INVALID = [0, -5, 1.5, 2.25, 605, 99999, '7'];

  // Raw inserts — exactly the rows the unvalidated upserts used to leave behind.
  const seedPages = async () => {
    const user = await createUser();
    const docs = [...VALID, ...INVALID].map((pageNumber) => ({ userId: user._id, pageNumber, status: 'memorized' }));
    docs.push({ userId: user._id, status: 'memorized' }); // no pageNumber at all
    await mongoose.model('UserProgress').collection.insertMany(docs);
    return user;
  };

  test('finds every non-integer or out-of-range page and deletes only those', async () => {
    await seedPages();
    const found = await findInvalidPages();
    assert.equal(found.count, INVALID.length + 1);
    assert.equal(found.userCount, 1);

    assert.equal(await deleteInvalidPages(), INVALID.length + 1);
    const left = await mongoose.model('UserProgress').find({}, { pageNumber: 1 }).lean();
    assert.deepEqual(left.map((d) => d.pageNumber).sort((a, b) => a - b), VALID);
  });

  test('CLI dry run counts without deleting; --apply deletes; no --uri refuses', async () => {
    await seedPages();
    const total = VALID.length + INVALID.length + 1;
    const UserProgress = mongoose.model('UserProgress');

    const refused = runScript('cleanupInvalidPages.js', ['--apply'], { MONGODB_URI: memoryUri() });
    assert.equal(refused.code, 1);
    assert.equal(await UserProgress.countDocuments(), total);

    const dry = runScript('cleanupInvalidPages.js', ['--uri', memoryUri()]);
    assert.equal(dry.code, 0, dry.out);
    assert.match(dry.out, /^Target: mongodb:\/\//m);
    assert.match(dry.out, new RegExp(`invalid pageNumber: ${INVALID.length + 1} `));
    assert.equal(await UserProgress.countDocuments(), total);

    const applied = runScript('cleanupInvalidPages.js', ['--uri', memoryUri(), '--apply']);
    assert.equal(applied.code, 0, applied.out);
    assert.equal(await UserProgress.countDocuments(), VALID.length);
  });
});
