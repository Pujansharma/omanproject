// routes/branches.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Branch = require('../Model/branch');
const Order = require('../Model/order');
const { authenticate, authorize } = require('../middleware/Auth');
const { connectedBranches } = require('../websocket');
const logger = require('../utils/loggers');

// Get all branches
router.get('/', authenticate, async (req, res) => {
  try {
    const { isActive } = req.query;
    const query = {};
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    const branches = await Branch.find(query).sort({ name: 1 });
    
    // Add online status
    const branchesWithStatus = branches.map(branch => ({
      ...branch.toObject(),
      isOnline: connectedBranches.has(branch._id.toString()),
      lastHeartbeat: branch.currentSession?.lastHeartbeat || null
    }));
    
    res.json({ success: true, data: branchesWithStatus });
  } catch (error) {
    logger.error('Get branches error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single branch
router.get('/:id', authenticate, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    
    const branchData = {
      ...branch.toObject(),
      isOnline: connectedBranches.has(branch._id.toString())
    };
    
    res.json({ success: true, data: branchData });
  } catch (error) {
    logger.error('Get branch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create branch (admin only)
router.post('/', authenticate, authorize('admin'), [
  body('name').notEmpty().trim(),
  body('code').notEmpty().trim(),
  body('address.street').optional(),
  body('address.city').optional(),
  body('address.state').optional(),
  body('address.zipCode').optional(),
  body('address.country').optional(),
  body('phone').optional(),
  body('email').optional().isEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const existingBranch = await Branch.findOne({ 
      $or: [{ name: req.body.name }, { code: req.body.code }] 
    });
    
    if (existingBranch) {
      return res.status(400).json({ success: false, error: 'Branch name or code already exists' });
    }
    
    const branch = new Branch(req.body);
    await branch.save();
    
    logger.info(`Branch created: ${branch.name} by ${req.user.username}`);
    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    logger.error('Create branch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update branch
router.put('/:id', authenticate, authorize('admin'), [
  body('name').optional().trim(),
  body('code').optional().trim(),
  body('isActive').optional().isBoolean(),
  body('posConfig.printerEnabled').optional().isBoolean(),
  body('posConfig.kitchenDisplayEnabled').optional().isBoolean(),
  body('posConfig.autoPrint').optional().isBoolean(),
  body('posConfig.printerIp').optional(),
  body('posConfig.printerPort').optional().isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    
    // Check for duplicate name/code
    if (req.body.name && req.body.name !== branch.name) {
      const existing = await Branch.findOne({ name: req.body.name });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Branch name already exists' });
      }
    }
    
    if (req.body.code && req.body.code !== branch.code) {
      const existing = await Branch.findOne({ code: req.body.code });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Branch code already exists' });
      }
    }
    
    Object.assign(branch, req.body);
    await branch.save();
    
    logger.info(`Branch updated: ${branch.name} by ${req.user.username}`);
    res.json({ success: true, data: branch });
  } catch (error) {
    logger.error('Update branch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete branch (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    
    // Check if branch has orders
    const orderCount = await Order.countDocuments({ branch: branch._id });
    if (orderCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot delete branch with ${orderCount} existing orders. Archive instead.` 
      });
    }
    
    await branch.deleteOne();
    
    logger.info(`Branch deleted: ${branch.name} by ${req.user.username}`);
    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    logger.error('Delete branch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get branch statistics
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const branchId = req.params.id;
    
    // Check access
    if (req.user.role === 'branch_staff' && req.user.branchId.toString() !== branchId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalOrders, todayOrders, pendingOrders, revenue] = await Promise.all([
      Order.countDocuments({ branch: branchId }),
      Order.countDocuments({ branch: branchId, createdAt: { $gte: today } }),
      Order.countDocuments({ 
        branch: branchId, 
        status: { $in: ['pending', 'confirmed', 'preparing'] } 
      }),
      Order.aggregate([
        { $match: { branch: branchId, status: 'completed', paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        pendingOrders,
        totalRevenue: revenue[0]?.total || 0,
        isOnline: connectedBranches.has(branchId)
      }
    });
  } catch (error) {
    logger.error('Get branch stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update branch printer configuration
router.patch('/:id/printer', authenticate, authorize('admin'), [
  body('printerEnabled').optional().isBoolean(),
  body('printerIp').optional().isIP(),
  body('printerPort').optional().isInt({ min: 1, max: 65535 }),
  body('autoPrint').optional().isBoolean()
], async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ success: false, error: 'Branch not found' });
    }
    
    branch.posConfig = {
      ...branch.posConfig,
      ...req.body
    };
    
    await branch.save();
    
    logger.info(`Printer config updated for branch ${branch.name}`);
    res.json({ success: true, data: branch.posConfig });
  } catch (error) {
    logger.error('Update printer config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;