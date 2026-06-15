const express = require('express');
const cors = require('cors');

const app = express();

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

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

// 404 catch-all
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

module.exports = app;
