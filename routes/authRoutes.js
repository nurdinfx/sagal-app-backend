const express = require('express');
const { login } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);

// Simple test endpoint to verify auth routes are working
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;