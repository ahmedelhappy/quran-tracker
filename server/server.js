const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');
const Bookmark = require('./models/Bookmark');
const { handleShutdownSignals } = require('./utils/shutdown');

// Fail fast on missing critical configuration rather than booting a broken server
// that only errors on the first request (or, worse, signs tokens with an
// undefined secret).
const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(
    `❌ Missing required environment variable(s): ${missing.join(', ')}.\n` +
    '   Set them in server/.env before starting the server.'
  );
  process.exit(1);
}

const PORT = process.env.PORT || 5000;

// Connect to MongoDB first, then start listening — so the server never accepts
// traffic before the database is ready.
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');
    // Bring the bookmark indexes in line with the model. Idempotent; on the
    // first boot after bookmarks went from one-per-page to several-per-page it
    // drops the old UNIQUE { userId, pageNumber } index, which Mongoose would
    // otherwise leave in place (it never alters an existing index). A failure
    // is logged, not fatal — the app still serves everything else.
    try {
      const dropped = await Bookmark.syncIndexes();
      if (dropped.length) console.log(`🔧 Bookmark indexes synced (dropped: ${dropped.join(', ')})`);
    } catch (err) {
      console.error('⚠️ Bookmark index sync failed:', err.message);
    }
    const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    // A deploy (SIGTERM) or Ctrl+C lets the requests in flight finish before
    // the database connection closes, instead of cutting writes off half-way.
    handleShutdownSignals({ server });
  } catch (err) {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  }
})();
