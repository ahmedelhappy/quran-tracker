// Shared test utilities: an in-memory MongoDB so tests never touch the real Atlas
// database, plus minimal QuranMetadata seeding and small factory helpers.
//
// Env must be set before the app (and its controllers) read it. JWT_SECRET is used
// when signing/verifying tokens; NODE_ENV=test silences request logging in app.js.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const QuranMetadata = require('../models/QuranMetadata');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

let mongod;

// Spin up an in-memory mongod and connect mongoose to it.
async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

// Disconnect mongoose and shut the in-memory server down so the process can exit.
async function disconnect() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

// Wipe every collection between tests for isolation.
async function clearDatabase() {
  const { collections } = mongoose.connection;
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({});
  }
}

// Seed the minimal page metadata the controllers join against. Pages 1..count is
// plenty for the logic under test (real app has 604). juzNumber follows the real
// ~21-pages-per-juz layout closely enough for these tests.
async function seedMetadata(count = 30) {
  const docs = [];
  for (let p = 1; p <= count; p++) {
    docs.push({
      pageNumber: p,
      juzNumber: Math.min(30, Math.ceil(p / 21)) || 1,
      surahName: `Surah ${p}`,
      surahNameArabic: '',
      surahs: [{ name: `Surah ${p}`, nameArabic: '' }],
    });
  }
  await QuranMetadata.insertMany(docs);
}

// Create a user (password is hashed by the model's pre-save hook).
async function createUser(overrides = {}) {
  return User.create({
    name: overrides.name || 'Test User',
    email: overrides.email || `user${Date.now()}${Math.random().toString(16).slice(2)}@example.com`,
    password: overrides.password || 'secret123',
    onboardingComplete: true,
    ...overrides,
  });
}

// Mint a valid Bearer token for a user id, matching authController.generateToken.
function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

// Insert a memorized-page progress record with explicit dates (UTC-controlled by caller).
async function addMemorizedPage(userId, pageNumber, { memorizedDate, lastReviewedDate, reviewCount = 0 }) {
  return UserProgress.create({
    userId,
    pageNumber,
    status: 'memorized',
    memorizedDate,
    lastReviewedDate,
    reviewCount,
  });
}

// Build a Date offset by whole days from now (negative = past), normalized to UTC midnight.
function daysAgo(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

module.exports = {
  connect,
  disconnect,
  clearDatabase,
  seedMetadata,
  createUser,
  tokenFor,
  addMemorizedPage,
  daysAgo,
};
