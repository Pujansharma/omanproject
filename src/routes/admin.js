// routes/admin.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../Model/user');
const Branch = require('../Model/branch');
const Order = require('../Model/order');
const { authenticate, authorize } = require('../middleware/Auth');
const logger = require('../utils/loggers');

// Get system statistics
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [totalUsers, totalBranches, totalOrders, totalRevenue, pendingOrders] = await Promise.all([
      User.countDocuments(),
      Branch.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { status: 'completed', paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing'] } })
    ]);
    
    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({ createdAt: { $gte: today } });
    
    // Get orders by source
    const ordersBySource = await Order.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        users: totalUsers,
        branches: totalBranches,
        orders: {
          total: totalOrders,
          today: todayOrders,
          pending: pendingOrders
        },
        revenue: totalRevenue[0]?.total || 0,
        ordersBySource: ordersBySource.reduce((acc, curr) => {
          acc[curr._id || 'unknown'] = curr.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    logger.error('Get admin stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all users
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find()
      .populate('branchId', 'name code')
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create user
router.post('/users', authenticate, authorize('admin'), [
  body('username').notEmpty().trim().isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['call_center', 'branch_staff', 'admin']),
  body('branchId').custom((value, { req }) => {
    if (req.body.role === 'branch_staff' && !value) {
      throw new Error('Branch ID is required for branch staff');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const existingUser = await User.findOne({ 
      $or: [{ username: req.body.username }, { email: req.body.email }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username or email already exists' });
    }
    
    const user = new User(req.body);
    await user.save();
    
    logger.info(`User created: ${user.username} by ${req.user.username}`);
    res.status(201).json({ 
      success: true, 
      data: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    logger.error('Create user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user
router.put('/users/:id', authenticate, authorize('admin'), [
  body('username').optional().trim(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['call_center', 'branch_staff', 'admin']),
  body('isActive').optional().isBoolean(),
  body('branchId').optional()
], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Don't allow disabling own account
    if (req.body.isActive === false && user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot disable your own account' });
    }
    
    Object.assign(user, req.body);
    await user.save();
    
    logger.info(`User updated: ${user.username} by ${req.user.username}`);
    res.json({ success: true, data: { id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own account' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await user.deleteOne();
    
    logger.info(`User deleted: ${user.username} by ${req.user.username}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;