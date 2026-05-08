// models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: String,
  vehicleDetails: {
    plateNumber: String,
    carMake: String,
    carModel: String,
    carColor: String
  },
  defaultBranch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch'
  },
  orderHistory: [{
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    date: Date,
    total: Number
  }],
  totalOrders: {
    type: Number,
    default: 0
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

customerSchema.index({ phoneNumber: 1 });
customerSchema.index({ 'vehicleDetails.plateNumber': 1 });

customerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Customer', customerSchema);