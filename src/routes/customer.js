// routes/customers.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Customer = require('../Model/customer');
const Order = require('../Model/order');
const { authenticate } = require('../middleware/Auth');
const logger = require('../utils/loggers');

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (search) {
      query.$or = [
        { phoneNumber: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { 'vehicleDetails.plateNumber': { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [customers, total] = await Promise.all([
      Customer.find(query).skip(skip).limit(parseInt(limit)).sort({ totalOrders: -1 }),
      Customer.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get customers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer by phone
router.get('/phone/:phoneNumber', authenticate, async (req, res) => {
  try {
    const customer = await Customer.findOne({ phoneNumber: req.params.phoneNumber });
    
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Get recent orders
    const recentOrders = await Order.find({ customer: customer._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('branch', 'name');
    
    res.json({ 
      success: true, 
      data: { 
        customer, 
        recentOrders 
      } 
    });
  } catch (error) {
    logger.error('Get customer by phone error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update customer
router.post('/', authenticate, [
  body('phoneNumber').isMobilePhone().withMessage('Valid phone number required'),
  body('firstName').notEmpty().trim(),
  body('lastName').notEmpty().trim(),
  body('vehicleDetails.plateNumber').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phoneNumber, firstName, lastName, email, vehicleDetails, notes } = req.body;
    
    let customer = await Customer.findOne({ phoneNumber });
    
    if (customer) {
      // Update existing
      customer.firstName = firstName;
      customer.lastName = lastName;
      if (email) customer.email = email;
      if (vehicleDetails) customer.vehicleDetails = vehicleDetails;
      if (notes) customer.notes = notes;
      await customer.save();
    } else {
      // Create new
      customer = new Customer({
        phoneNumber,
        firstName,
        lastName,
        email,
        vehicleDetails,
        notes
      });
      await customer.save();
    }
    
    res.json({ success: true, data: customer });
  } catch (error) {
    logger.error('Create/update customer error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get customer order history
router.get('/:customerId/orders', authenticate, async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.params.customerId })
      .sort({ createdAt: -1 })
      .populate('branch', 'name');
    
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Get customer orders error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;