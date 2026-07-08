const mongoose = require('mongoose');
require('dotenv').config();

const app = require('./app');

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
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('❌ MongoDB Error:', err);
    process.exit(1);
  }
})();
