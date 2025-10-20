const express = require('express');
const { login } = require('../controllers/authController');

const router = express.Router();

// POST login - for actual login
router.post('/login', login);

// GET test endpoint - to verify routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working correctly!',
    timestamp: new Date().toISOString(),
    endpoints: {
      login: 'POST /api/auth/login',
      test: 'GET /api/auth/test'
    }
  });
});

// GET login info endpoint
router.get('/login', (req, res) => {
  res.status(405).json({
    success: false,
    message: 'Method not allowed. Use POST instead.',
    example: {
      method: 'POST',
      url: '/api/auth/login',
      body: {
        username: 'admin',
        password: 'admin123'
      }
    }
  });
});

module.exports = router;