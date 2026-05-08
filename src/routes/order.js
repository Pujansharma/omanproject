// routes/orders.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Order = require('../Model/order');
const Customer = require('../Model/customer');
const Branch = require('../Model/branch');
const { authenticate, authorize } = require('../middleware/Auth');
const logger = require('../utils/loggers');

// Get orders with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { 
      status, 
      branchId, 
      customerPhone, 
      vehiclePlate,
      startDate, 
      endDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (branchId) query.branch = branchId;
    if (customerPhone) query.customerPhone = { $regex: customerPhone, $options: 'i' };
    if (vehiclePlate) query.vehiclePlateNumber = { $regex: vehiclePlate, $options: 'i' };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    if (req.user.role === 'branch_staff') {
      query.branch = req.user.branchId;
    }
    
    const skip = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'firstName lastName phoneNumber vehicleDetails')
        .populate('branch', 'name code')
        .populate('callCenterAgent', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get orders error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single order
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'firstName lastName phoneNumber email vehicleDetails')
      .populate('branch', 'name code address phone')
      .populate('callCenterAgent', 'username email')
      .populate('branchStaff', 'username');
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (req.user.role === 'branch_staff' && order.branch._id.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Get order error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update order status
router.patch('/:id/status', authenticate, [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']),
  body('paymentStatus').optional().isIn(['unpaid', 'partial', 'paid'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    if (req.user.role === 'branch_staff' && order.branch.toString() !== req.user.branchId.toString()) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    if (req.body.status === 'completed' && !order.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, error: 'Cannot complete order without payment' });
    }
    
    order.status = req.body.status;
    if (req.body.paymentStatus) order.paymentStatus = req.body.paymentStatus;
    if (req.body.status === 'completed') order.pickupTime = new Date();
    if (req.body.status === 'ready') order.actualReadyTime = new Date();
    
    await order.save();
    
    res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search orders by phone or plate
router.get('/search/:query', authenticate, async (req, res) => {
  try {
    const { query } = req.params;
    const { status = 'pending' } = req.query;
    
    const searchQuery = {
      status,
      $or: [
        { customerPhone: { $regex: query, $options: 'i' } },
        { vehiclePlateNumber: { $regex: query, $options: 'i' } }
      ]
    };
    
    if (req.user.role === 'branch_staff') {
      searchQuery.branch = req.user.branchId;
    }
    
    const orders = await Order.find(searchQuery)
      .populate('customer', 'firstName lastName phoneNumber vehicleDetails')
      .populate('branch', 'name')
      .limit(10);
    
    res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Search orders error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// Add this to routes/orders.js
// In your routes/order.js, update the create endpoint
router.post('/create', authenticate, async (req, res) => {
  try {
    const orderData = req.body;
    
    // Generate order number manually
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const order = new Order({
      orderNumber: orderNumber,  // Set it explicitly
      customer: orderData.customer,
      customerFirstName: orderData.customerFirstName,
      customerLastName: orderData.customerLastName,
      customerPhone: orderData.customerPhone,
      vehiclePlateNumber: orderData.vehiclePlateNumber || '',
      branch: orderData.branch,
      items: orderData.items,
      subtotal: orderData.subtotal,
      tax: orderData.tax,
      total: orderData.total,
      orderType: orderData.orderType,
      specialInstructions: orderData.specialInstructions || '',
      source: 'call_center',
      callCenterAgent: req.user.id,
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    await order.save();

    console.log(`Order saved via HTTP: ${order.orderNumber}, ID: ${order._id}`);
    
    // Update customer order history
    try {
      await Customer.findByIdAndUpdate(orderData.customer, {
        $inc: { totalOrders: 1, totalSpent: orderData.total },
        $push: { orderHistory: { orderId: order._id, date: new Date(), total: orderData.total } }
      });
      console.log('Customer updated successfully');
    } catch (customerError) {
      console.error('Customer update error:', customerError);
      // Don't fail the order if customer update fails
    }
    
    // Get io instance
    const io = req.app.get('io');
    
    // Send to branch via WebSocket if online
    const { connectedBranches } = require('../websocket');
    const branchSocketId = connectedBranches.get(orderData.branch);
    
    if (branchSocketId && io) {
      io.to(branchSocketId).emit('new_order', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        customerName: `${orderData.customerFirstName} ${orderData.customerLastName}`,
        customerPhone: orderData.customerPhone,
        vehiclePlateNumber: orderData.vehiclePlateNumber,
        items: orderData.items,
        subtotal: orderData.subtotal,
        tax: orderData.tax,
        total: orderData.total,
        specialInstructions: orderData.specialInstructions,
        orderType: orderData.orderType,
        timestamp: order.createdAt
      });
      console.log(`Order ${order.orderNumber} sent to branch via WebSocket`);
    } else {
      console.log(`Branch ${orderData.branch} is offline or no WebSocket connection`);
    }
    
    res.json({ success: true, orderId: order._id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error('HTTP Create order error:', error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});


module.exports = router;