// models/Branch.js
const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  phone: String,
  email: String,
  posConfig: {
    printerEnabled: { type: Boolean, default: true },
    kitchenDisplayEnabled: { type: Boolean, default: false },
    autoPrint: { type: Boolean, default: true },
    printerIp: String,
    printerPort: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentSession: {
    sessionId: String,
    socketId: String,
    lastHeartbeat: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Branch', branchSchema);