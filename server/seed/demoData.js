require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const UserProgress = require('../models/UserProgress');

const DEMO_EMAIL = 'demo@qurantracker.com';
const DEMO_PASSWORD = 'demo123456';
const DEMO_NAME = 'Abdullah (Demo)';

async function seedDemo() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const now = new Date();

  const planStart = new Date(now);
  planStart.setDate(planStart.getDate() - 90);
  planStart.setUTCHours(0, 0, 0, 0);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setUTCHours(20, 0, 0, 0);

  // Find or create demo user
  let user = await User.findOne({ email: DEMO_EMAIL }).select('+password');

  if (!user) {
    // Pass plaintext — the pre-save hook handles hashing
    user = new User({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      dailyNewPages: 2,
      reviewIntensity: 'standard',
      offDays: [],
      onboardingComplete: true,
      planStartDate: planStart,
      currentStreak: 14,
      lastActiveDate: yesterday,
    });
    await user.save();
    console.log('Created demo user:', DEMO_EMAIL);
  } else {
    user.name = DEMO_NAME;
    user.password = DEMO_PASSWORD; // reset so pre-save hook rehashes correctly
    user.dailyNewPages = 2;
    user.reviewIntensity = 'standard';
    user.offDays = [];
    user.onboardingComplete = true;
    user.planStartDate = planStart;
    user.currentStreak = 14;
    user.lastActiveDate = yesterday;
    await user.save();
    console.log('Updated demo user:', DEMO_EMAIL);
  }

  // Clear existing progress
  await UserProgress.deleteMany({ userId: user._id });

  // Distribute 150 pages across ~90 days (2 pages/day with some variation + rest days)
  const progressOps = [];
  let pageNum = 1;

  for (let day = 0; day < 90 && pageNum <= 150; day++) {
    // Every 5th day is a rest day (18 rest days total)
    if (day % 5 === 4) continue;

    const memDate = new Date(planStart);
    memDate.setDate(memDate.getDate() + day);
    memDate.setUTCHours(10, 0, 0, 0);

    // Mostly 2 pages per day, occasionally 1 page for variety
    const pagesThisDay = day % 7 === 0 ? 1 : 2;

    for (let p = 0; p < pagesThisDay && pageNum <= 150; p++) {
      // Review count: 2-5 reviews per page (deterministic variety)
      const reviewCount = 2 + (pageNum % 4);

      // Last review 1-14 days ago (spread out realistically)
      const daysAgoReviewed = 1 + ((pageNum * 7) % 14);
      const lastReviewDate = new Date(now);
      lastReviewDate.setDate(lastReviewDate.getDate() - daysAgoReviewed);
      lastReviewDate.setUTCHours(10, 0, 0, 0);

      progressOps.push({
        insertOne: {
          document: {
            userId: user._id,
            pageNumber: pageNum,
            status: 'memorized',
            memorizedDate: memDate,
            lastReviewedDate: lastReviewDate,
            reviewCount,
          },
        },
      });

      pageNum++;
    }
  }

  if (progressOps.length > 0) {
    await UserProgress.bulkWrite(progressOps);
  }

  console.log(`Seeded ${pageNum - 1} memorized pages (pages 1–${pageNum - 1})`);
  console.log('Demo account ready:');
  console.log('  Email:    demo@qurantracker.com');
  console.log('  Password: demo123456');
  console.log('  Streak:   14 days');

  await mongoose.disconnect();
  console.log('Done.');
}

seedDemo().catch(err => {
  console.error(err);
  process.exit(1);
});
