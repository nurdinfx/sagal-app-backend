const User = require('../models/User');
const jwt = require('jsonwebtoken');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'gas_delivery_secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if username and password exist
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and password'
      });
    }

    // Check if user exists and password is correct
    const user = await User.findOne({ username }).select('+password');
    
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect username or password'
      });
    }

    // If everything ok, send token to client
    const token = signToken(user._id);

    res.json({
      success: true,
      token,
      data: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
    
    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.'
    });
  }
};