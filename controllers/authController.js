const jwt = require('jsonwebtoken');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'gas_delivery_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Hardcoded admin user for now
const adminUser = {
  _id: 'admin-user-id',
  username: 'admin',
  password: 'admin123',
  role: 'admin'
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log('🔐 Login attempt for:', username);

    // Check if username and password exist
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Simple authentication for admin
    if (username === adminUser.username && password === adminUser.password) {
      const token = signToken(adminUser._id);

      console.log('✅ Login successful for admin');
      return res.json({
        success: true,
        token,
        data: {
          id: adminUser._id,
          username: adminUser.username,
          role: adminUser.role
        }
      });
    }

    console.log('❌ Invalid credentials for:', username);
    return res.status(401).json({
      success: false,
      message: 'Incorrect username or password'
    });

  } catch (error) {
    console.error('🚨 Login controller error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'You are not logged in. Please log in to get access.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gas_delivery_secret');
    
    // For now, just check if it's the admin token
    if (decoded.id === adminUser._id) {
      req.user = adminUser;
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.'
    });

  } catch (error) {
    console.error('🚨 Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.'
    });
  }
};