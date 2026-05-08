// src/model/order.js - SIMPLE WORKING VERSION
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  specialInstructions: String,
  modifiers: [{ name: String, price: Number }]
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  customerFirstName: String,
  customerLastName: String,
  customerPhone: { type: String, required: true, index: true },
  vehiclePlateNumber: { type: String, index: true },
  branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  items: [orderItemSchema],
  subtotal: { type: Number, required: true },
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled', 'pending_offline'],
    default: 'pending' 
  },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  orderType: { type: String, enum: ['takeaway', 'curbside', 'dine_in', 'delivery'], default: 'takeaway' },
  source: { type: String, enum: ['call_center', 'pos', 'online'], default: 'call_center' },
  callCenterAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  branchStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  specialInstructions: String,
  estimatedReadyTime: Date,
  actualReadyTime: Date,
  pickupTime: Date,
  paymentMethod: { type: String, enum: ['cash', 'card', 'mobile_payment'], default: 'cash' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// NO pre-save middleware to avoid issues
// Generate order number in the route instead

module.exports = mongoose.model('Order', orderSchema);