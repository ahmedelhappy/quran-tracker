// The API the end-to-end flows run against: the real server/app.js on a
// throwaway in-memory MongoDB. It never loads server/.env, never reads
// MONGODB_URI and never has a Groq key, so a flow cannot reach a real database
// or a paid API whatever the shell it starts from has exported.
//
//   node e2e/support/api-server.cjs            (Playwright's webServer starts it)
//
// E2E_API_PORT (default 5140) serves the app. E2E_ADMIN_PORT (default 5141) is
// a test-only window on the same database, bound to 127.0.0.1: GET
// /counts/:userId returns how many documents each model still holds for a user,
// which is how the account-deletion flow proves nothing was left behind.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createRequire } = require('module');

const SERVER_DIR = path.resolve(__dirname, '../../../server');
// The server's own dependencies, resolved from its package (client/ does not
// have them).
const serverRequire = createRequire(path.join(SERVER_DIR, 'package.json'));

const API_PORT = Number(process.env.E2E_API_PORT || 5140);
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 5141);

// Set before app.js is required: it reads them at load time. NODE_ENV=test turns
// off the IP rate limiters (the flows register and sign in many times from one
// address) and request logging; it is not production, so CORS lets the
// localhost preview origin through. A fresh secret per run means no token from
// anywhere else can ever be valid here.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.MONGODB_URI;
delete process.env.GROQ_API_KEY;
delete process.env.CLIENT_URL;

const main = async () => {
  const { MongoMemoryServer } = serverRequire('mongodb-memory-server');
  const mongoose = serverRequire('mongoose');
  const express = serverRequire('express');

  // One fixed data directory, emptied at every start, rather than a fresh temp
  // directory per run: on Windows Playwright stops this process with a hard
  // kill, which skips the server's own cleanup and would leave ~200 MB of
  // mongod files in %TEMP% after every run.
  const dbPath = path.resolve(__dirname, '../../node_modules/.cache/e2e-mongo');
  fs.rmSync(dbPath, { recursive: true, force: true });
  fs.mkdirSync(dbPath, { recursive: true });
  const mongod = await MongoMemoryServer.create({ instance: { dbPath } });
  await mongoose.connect(mongod.getUri());

  // The real 604-page metadata, built from the committed structure file the way
  // the production seed builds it — and checked the same way: buildQuranPages
  // throws unless all 604 pages are there, so a damaged file stops the stack
  // here rather than surfacing as missing pages halfway through a flow.
  const QuranMetadata = require(path.join(SERVER_DIR, 'models/QuranMetadata'));
  const { buildQuranPages } = require(path.join(SERVER_DIR, 'seed/quranData'));
  await QuranMetadata.insertMany(buildQuranPages());

  const app = require(path.join(SERVER_DIR, 'app'));
  const server = app.listen(API_PORT, '127.0.0.1');

  const admin = express();
  admin.get('/counts/:userId', async (req, res) => {
    const counts = {};
    for (const name of mongoose.modelNames()) {
      const Model = mongoose.model(name);
      if (name === 'User') counts.User = await Model.countDocuments({ _id: req.params.userId });
      else if (Model.schema.path('userId')) counts[name] = await Model.countDocuments({ userId: req.params.userId });
    }
    res.json(counts);
  });
  const adminServer = admin.listen(ADMIN_PORT, '127.0.0.1');

  await Promise.all([server, adminServer].map((s) => new Promise((resolve, reject) => {
    s.once('listening', resolve);
    s.once('error', reject);
  })));
  console.log(`e2e API on http://127.0.0.1:${API_PORT}/api (admin on ${ADMIN_PORT})`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    server.close();
    adminServer.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
