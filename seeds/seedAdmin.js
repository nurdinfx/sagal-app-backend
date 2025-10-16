const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/gas_delivery');
    
    // Check if admin already exists
    const adminExists = await User.findOne({ username: 'admin' });
    
    if (!adminExists) {
      await User.create({
        username: 'admin',
        password: 'admin123',
        role: 'admin'
      });
      console.log('Admin user created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
    } else {
      console.log('Admin user already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();