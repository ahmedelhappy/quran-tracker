const express = require('express');
const cors = require('cors');
const { apiLimiter } = require('./middleware/rateLimiters');
const { parseTrustProxy } = require('./utils/trustProxy');

const app = express();

// Behind a hosting proxy (Render) the real client IP arrives in X-Forwarded-For;
// trusting the right number of hops lets the rate limiters key on the actual
// client instead of lumping everyone under the proxy's IP — or letting a client
// spoof its own. TRUST_PROXY sets it (see utils/trustProxy.js); unset, it is one
// hop in production and off elsewhere, as before.
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY, process.env.NODE_ENV);
if (trustProxy !== false) {
  app.set('trust proxy', trustProxy);
}

// Request logging (skipped under test to keep test output clean)
if (process.env.NODE_ENV !== 'test') {
  app.use(require('morgan')('dev'));
}

// Middleware
const isProduction = process.env.NODE_ENV === 'production';

// In development Vite picks the next free port when 5173 is taken (5174, 5175…),
// so allow any localhost port instead of pinning one. Production stays strict:
// only CLIENT_URL is accepted.
const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);
const localhostOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(cors({
  origin: (origin, callback) => {
    // Requests without an Origin header (curl, same-origin, health checks) pass.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && localhostOrigin.test(origin)) return callback(null, true);
    // Reject by omitting the CORS headers rather than throwing: the browser still
    // blocks the response, but we avoid turning every stray origin into a 500.
    return callback(null, false);
  },
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
app.use('/api/todos', require('./routes/todoRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// 404 catch-all
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Final error handler — must come after every route and middleware. Turns
// parser and unexpected errors into JSON instead of Express's HTML error page.
app.use(require('./middleware/errorHandler').jsonErrorHandler);

module.exports = app;
