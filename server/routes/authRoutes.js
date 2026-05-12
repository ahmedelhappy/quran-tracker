const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword, deleteAccount } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes (anyone can access)
router.post('/register', register);
router.post('/login', login);

// Protected routes (must be logged in)
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.delete('/account', protect, deleteAccount);

module.exports = router;