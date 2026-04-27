const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    process.env.CLIENT_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});