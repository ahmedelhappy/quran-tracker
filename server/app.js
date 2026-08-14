const express = require('express');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimiters');

const app = express();

// Behind a hosting proxy (Render/Vercel) the real client IP arrives in
// X-Forwarded-For; trust the first hop so rate limiters key on the actual
// client instead of lumping everyone under the proxy's IP.
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Request logging (skipped under test to keep test output clean)
if (process.env.NODE_ENV !== 'test') {
  app.use(require('morgan')('dev'));
}

// Middleware
app.use(cors({
  origin: [
    process.env.NODE_ENV !== 'production' && 'http://localhost:5173',
    process.env.CLIENT_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(require('helmet')());
app.use(require('compression')());

// Health check for UptimeRobot
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Quran Tracker API is running!' });
});

// General API rate limiter (a no-op under test) — a safety net across every
// endpoint. Stricter per-route limiters (auth, chat) stack on top of it.
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/bookmarks', require('./routes/bookmarkRoutes'));
app.use('/api/annotations', require('./routes/annotationRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// 404 catch-all
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

module.exports = app;
