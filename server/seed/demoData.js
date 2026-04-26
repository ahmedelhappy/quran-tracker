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

  let user = await User.findOne({ email: DEMO_EMAIL }).select('+password');

  if (!user) {
    user = new User({
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      dailyNewPages: 2,
      reviewIntensity: 'standard',
      offDays: [5],
      onboardingComplete: true,
      planStartDate: planStart,
      currentStreak: 14,
      lastActiveDate: yesterday,
    });
    await user.save();
    console.log('Created demo user:', DEMO_EMAIL);
  } else {
    user.name = DEMO_NAME;
    user.password = DEMO_PASSWORD;
    user.dailyNewPages = 2;
    user.reviewIntensity = 'standard';
    user.offDays = [5];
    user.onboardingComplete = true;
    user.planStartDate = planStart;
    user.currentStreak = 14;
    user.lastActiveDate = yesterday;
    await user.save();
    console.log('Updated demo user:', DEMO_EMAIL);
  }

  // Use raw collection to set createdAt explicitly (bypass Mongoose timestamp auto-set)
  const col = UserProgress.collection;
  await col.deleteMany({ userId: user._id });

  // Randomly skipped days to simulate missed days (indices into the 90-day window)
  const skippedDays = new Set([6, 13, 21, 28, 35, 48, 55, 69, 76, 83]);

  const progressDocs = [];
  let pageNum = 1;

  for (let day = 0; day < 90 && pageNum <= 180; day++) {
    const memDate = new Date(planStart);
    memDate.setDate(memDate.getDate() + day);

    // Skip Fridays (day.getUTCDay() === 5)
    if (memDate.getUTCDay() === 5) continue;
    // Skip some days to simulate imperfect consistency
    if (skippedDays.has(day)) continue;

    memDate.setUTCHours(10, 0, 0, 0);

    // 2 pages/day mostly, occasionally 1 for variety
    const pagesThisDay = day % 11 === 0 ? 1 : 2;

    for (let p = 0; p < pagesThisDay && pageNum <= 180; p++) {
      const reviewCount = 2 + (pageNum % 4); // 2–5

      // Last review 1–14 days ago, spread deterministically
      const daysAgoReviewed = 1 + ((pageNum * 7) % 14);
      const lastReviewDate = new Date(now);
      lastReviewDate.setDate(lastReviewDate.getDate() - daysAgoReviewed);
      lastReviewDate.setUTCHours(10, 0, 0, 0);

      progressDocs.push({
        userId: user._id,
        pageNumber: pageNum,
        status: 'memorized',
        memorizedDate: new Date(memDate),
        lastReviewedDate: lastReviewDate,
        reviewCount,
        createdAt: new Date(memDate),
        updatedAt: lastReviewDate,
      });

      pageNum++;
    }
  }

  if (progressDocs.length > 0) {
    await col.insertMany(progressDocs);
  }

  console.log(`Seeded ${pageNum - 1} memorized pages (pages 1–${pageNum - 1})`);
  console.log('Demo account ready:');
  console.log('  Email:    demo@qurantracker.com');
  console.log('  Password: demo123456');
  console.log('  Streak:   14 days');
  console.log('  Off days: Friday');

  await mongoose.disconnect();
  console.log('Done.');
}

seedDemo().catch(err => {
  console.error(err);
  process.exit(1);
});
