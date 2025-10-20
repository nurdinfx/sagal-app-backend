// SIMPLE VERSION - authController.js
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Login attempt:', { username });

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Simple admin authentication
    if (username === 'admin' && password === 'admin123') {
      console.log('✅ Login successful');
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

    console.log('❌ Invalid credentials');
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });

  } catch (error) {
    console.error('🚨 Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
};