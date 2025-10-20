const express = require('express');
const router = express.Router();

// Simple login route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Simple admin authentication
    if (username === 'admin' && password === 'admin123') {
      return res.json({
        success: true,
        message: 'Login successful',
        token: 'admin-token-' + Date.now(),
        user: {
          username: 'admin',
          role: 'admin'
        }
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;