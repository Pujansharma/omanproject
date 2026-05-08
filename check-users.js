// check-users.js
const mongoose = require('mongoose');
require('dotenv').config();

// Import your User model (check your actual path)
const User = require('./src/Model/user');

async function checkUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    // Count users
    const userCount = await User.countDocuments();
    console.log(`Total users in database: ${userCount}\n`);
    
    if (userCount > 0) {
      // Get all users
      const users = await User.find({}).select('-password');
      console.log('Users found:');
      users.forEach(user => {
        console.log(`  - Username: ${user.username}, Role: ${user.role}, Active: ${user.isActive}`);
      });
    } else {
      console.log('No users found! You need to run: node seed.js');
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();