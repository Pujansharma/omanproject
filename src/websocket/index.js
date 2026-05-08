// src/websocket/index.js
const Order = require('../Model/order');
const Branch = require('../Model/branch');
const Customer = require('../Model/customer');
const logger = require('../utils/loggers');

const connectedBranches = new Map(); // branchId -> socketId
const connectedAgents = new Map(); // agentId -> socketId

function setupWebSocket(io) {
  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.branchId = decoded.branchId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, Role: ${socket.userRole}`);
    logger.info(`Socket connected: ${socket.id}, Role: ${socket.userRole}`);

    // Register branch connection
    if (socket.userRole === 'branch_staff') {
      connectedBranches.set(socket.branchId, socket.id);
      console.log(`Branch ${socket.branchId} connected. Total branches: ${connectedBranches.size}`);
      
      // Update branch session
      Branch.findByIdAndUpdate(socket.branchId, {
        'currentSession.socketId': socket.id,
        'currentSession.lastHeartbeat': new Date()
      }).catch(err => console.error('Failed to update branch session:', err));
      
      socket.join(`branch_${socket.branchId}`);
      
      socket.on('heartbeat', async () => {
        await Branch.findByIdAndUpdate(socket.branchId, {
          'currentSession.lastHeartbeat': new Date()
        });
        socket.emit('heartbeat_ack', { timestamp: new Date() });
      });
      
      socket.on('order_status_update', async (data) => {
        const { orderId, status, paymentStatus } = data;
        await Order.findByIdAndUpdate(orderId, { 
          status, 
          paymentStatus,
          updatedAt: new Date()
        });
        
        // Notify call center agent
        const order = await Order.findById(orderId).populate('callCenterAgent');
        if (order && order.callCenterAgent) {
          const agentSocketId = connectedAgents.get(order.callCenterAgent._id.toString());
          if (agentSocketId) {
            io.to(agentSocketId).emit('order_updated', {
              orderId,
              status,
              paymentStatus,
              branchId: socket.branchId
            });
          }
        }
        
        socket.emit('status_updated', { success: true });
      });
    }
    
    // Register call center agent connection
    if (socket.userRole === 'call_center') {
      connectedAgents.set(socket.userId, socket.id);
      console.log(`Agent ${socket.userId} connected. Total agents: ${connectedAgents.size}`);
      socket.join('call_center_agents');
      
      // Send pending orders
      Order.find({ 
        status: 'pending',
        source: 'call_center'
      }).populate('branch', 'name code')
        .populate('customer', 'firstName lastName phoneNumber')
        .then(orders => {
          socket.emit('pending_orders', orders);
        });
      
      socket.on('get_branch_status', async () => {
        const branches = await Branch.find({ isActive: true });
        const branchStatus = branches.map(b => ({
          id: b._id,
          name: b.name,
          isOnline: connectedBranches.has(b._id.toString()),
          lastHeartbeat: b.currentSession?.lastHeartbeat
        }));
        socket.emit('branch_status', branchStatus);
      });
    }

    // Handle new order from call center
    socket.on('new_order', async (orderData, callback) => {
      try {
        console.log('Received new order from agent:', orderData);
        
        if (socket.userRole !== 'call_center') {
          throw new Error('Unauthorized: Only call center agents can create orders');
        }
        
        // Validate required fields
        if (!orderData.customer || !orderData.branch || !orderData.items || orderData.items.length === 0) {
          throw new Error('Missing required fields: customer, branch, or items');
        }
        
        // Create order
        const order = new Order({
          ...orderData,
          source: 'call_center',
          callCenterAgent: socket.userId,
          status: 'pending',
          paymentStatus: 'unpaid',
          orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        });
        
        await order.save();
        console.log(`Order saved: ${order.orderNumber}`);
        
        // Update customer order history
        await Customer.findByIdAndUpdate(orderData.customer, {
          $inc: { totalOrders: 1, totalSpent: orderData.total },
          $push: { orderHistory: { orderId: order._id, date: new Date(), total: orderData.total } }
        });
        
        // Send to branch via WebSocket
        const branchSocketId = connectedBranches.get(orderData.branch);
        console.log(`Branch ${orderData.branch} socket ID: ${branchSocketId}`);
        console.log(`Connected branches: ${Array.from(connectedBranches.keys())}`);
        
        if (branchSocketId) {
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
          console.log(`Order ${order.orderNumber} sent to branch ${orderData.branch}`);
          callback({ success: true, orderId: order._id, orderNumber: order.orderNumber });
        } else {
          order.status = 'pending_offline';
          await order.save();
          console.log(`Branch ${orderData.branch} is offline, order saved as pending`);
          callback({ success: false, error: 'Branch is currently offline', orderId: order._id });
        }
      } catch (error) {
        console.error('New order error:', error);
        callback({ success: false, error: error.message });
      }
    });
    
    // Handle order cancellation
    socket.on('cancel_order', async (orderId, callback) => {
      try {
        const order = await Order.findById(orderId);
        if (!order) {
          throw new Error('Order not found');
        }
        
        if (socket.userRole === 'call_center' && order.source === 'call_center') {
          order.status = 'cancelled';
          await order.save();
          
          const branchSocketId = connectedBranches.get(order.branch.toString());
          if (branchSocketId) {
            io.to(branchSocketId).emit('order_cancelled', { orderId: order._id });
          }
          
          callback({ success: true });
        } else {
          throw new Error('Unauthorized');
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Remove from maps
      if (socket.userRole === 'branch_staff') {
        for (const [branchId, socketId] of connectedBranches.entries()) {
          if (socketId === socket.id) {
            connectedBranches.delete(branchId);
            console.log(`Branch ${branchId} disconnected`);
            break;
          }
        }
      }
      
      if (socket.userRole === 'call_center') {
        for (const [agentId, socketId] of connectedAgents.entries()) {
          if (socketId === socket.id) {
            connectedAgents.delete(agentId);
            console.log(`Agent ${agentId} disconnected`);
            break;
          }
        }
      }
    });
  });
}

module.exports = { 
  setupWebSocket, 
  connectedBranches, 
  connectedAgents 
};