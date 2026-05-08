// seed.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models - UPDATE THESE PATHS TO MATCH YOUR ACTUAL FILE STRUCTURE
const User = require('./src/Model/user');
const Branch = require('./src/Model/branch');
const Customer = require('./src/Model/customer');

async function seed() {
  try {
    console.log('='.repeat(50));
    console.log('Starting Database Seeding...');
    console.log('='.repeat(50));
    
    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB\n');
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Branch.deleteMany({});
    await Customer.deleteMany({});
    console.log('✓ Existing data cleared\n');
    
    // Create branches
    console.log('🏪 Creating branches...');
    const branches = await Branch.insertMany([
      {
        name: 'Downtown Branch',
        code: 'DT001',
        address: {
          street: '123 Main Street',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10001',
          country: 'USA'
        },
        phone: '+1234567890',
        email: 'downtown@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      },
      {
        name: 'Uptown Branch',
        code: 'UT002',
        address: {
          street: '456 Broadway',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10002',
          country: 'USA'
        },
        phone: '+1234567891',
        email: 'uptown@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      },
      {
        name: 'Westside Branch',
        code: 'WS003',
        address: {
          street: '789 Park Avenue',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10003',
          country: 'USA'
        },
        phone: '+1234567892',
        email: 'westside@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      },
      {
        name: 'Eastside Branch',
        code: 'ES004',
        address: {
          street: '321 Lexington Ave',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10004',
          country: 'USA'
        },
        phone: '+1234567893',
        email: 'eastside@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      },
      {
        name: 'Southside Branch',
        code: 'SS005',
        address: {
          street: '555 5th Avenue',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10005',
          country: 'USA'
        },
        phone: '+1234567894',
        email: 'southside@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      },
      {
        name: 'Northside Branch',
        code: 'NS006',
        address: {
          street: '777 Madison Ave',
          city: 'Metropolis',
          state: 'NY',
          zipCode: '10006',
          country: 'USA'
        },
        phone: '+1234567895',
        email: 'northside@restaurant.com',
        posConfig: {
          printerEnabled: true,
          autoPrint: true
        },
        isActive: true
      }
    ]);
    
    console.log(`✓ Created ${branches.length} branches\n`);
    
    // Create users
    console.log('👤 Creating users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = await User.insertMany([
      {
        username: 'callcenter',
        email: 'callcenter@restaurant.com',
        password: hashedPassword,
        role: 'call_center',
        isActive: true
      },
      {
        username: 'branch_dt',
        email: 'branch.dt@restaurant.com',
        password: hashedPassword,
        role: 'branch_staff',
        branchId: branches[0]._id,
        isActive: true
      },
      {
        username: 'branch_ut',
        email: 'branch.ut@restaurant.com',
        password: hashedPassword,
        role: 'branch_staff',
        branchId: branches[1]._id,
        isActive: true
      },
      {
        username: 'admin',
        email: 'admin@restaurant.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      }
    ]);
    
    console.log(`✓ Created ${users.length} users\n`);
    
    // Create sample customers
    console.log('👥 Creating sample customers...');
    const customers = await Customer.insertMany([
      {
        phoneNumber: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        vehicleDetails: {
          plateNumber: 'ABC-1234',
          carMake: 'Toyota',
          carModel: 'Camry',
          carColor: 'Silver'
        },
        totalOrders: 5,
        totalSpent: 245.75
      },
      {
        phoneNumber: '+1234567891',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        vehicleDetails: {
          plateNumber: 'XYZ-5678',
          carMake: 'Honda',
          carModel: 'Civic',
          carColor: 'Red'
        },
        totalOrders: 3,
        totalSpent: 89.50
      },
      {
        phoneNumber: '+1234567892',
        firstName: 'Robert',
        lastName: 'Johnson',
        email: 'robert.j@example.com',
        vehicleDetails: {
          plateNumber: 'DEF-9012',
          carMake: 'Ford',
          carModel: 'Focus',
          carColor: 'Blue'
        },
        totalOrders: 8,
        totalSpent: 412.30
      },
      {
        phoneNumber: '+1234567893',
        firstName: 'Maria',
        lastName: 'Garcia',
        email: 'maria.g@example.com',
        vehicleDetails: {
          plateNumber: 'GHI-3456',
          carMake: 'Nissan',
          carModel: 'Altima',
          carColor: 'Black'
        },
        totalOrders: 2,
        totalSpent: 45.99
      },
      {
        phoneNumber: '+1234567894',
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.b@example.com',
        vehicleDetails: {
          plateNumber: 'JKL-7890',
          carMake: 'Chevrolet',
          carModel: 'Malibu',
          carColor: 'White'
        },
        totalOrders: 12,
        totalSpent: 678.45
      }
    ]);
    
    console.log(`✓ Created ${customers.length} customers\n`);
    
    console.log('='.repeat(50));
    console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('─'.repeat(50));
    console.log('🔹 Call Center Agent:');
    console.log('   Username: callcenter');
    console.log('   Password: password123');
    console.log('   Role: call_center\n');
    
    console.log('🔹 Branch Staff (Downtown):');
    console.log('   Username: branch_dt');
    console.log('   Password: password123');
    console.log('   Role: branch_staff\n');
    
    console.log('🔹 Branch Staff (Uptown):');
    console.log('   Username: branch_ut');
    console.log('   Password: password123');
    console.log('   Role: branch_staff\n');
    
    console.log('🔹 Administrator:');
    console.log('   Username: admin');
    console.log('   Password: password123');
    console.log('   Role: admin\n');
    
    console.log('📍 Access the application:');
    console.log('   http://localhost:3000/login.html\n');
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ SEEDING ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seed();