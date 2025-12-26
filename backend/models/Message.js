// backend/models/Message.js - ✅ FIXED CommonJS
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  broadcastId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Broadcast',
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending',
  },
  error: {
    type: String,
    default: '',
  },
  // ✅ ADD: Track who created this message
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional karena bisa auto-generated dari broadcast
  }
}, { 
  timestamps: true 
});

// Index untuk query cepat
messageSchema.index({ broadcastId: 1, status: 1 });
messageSchema.index({ customerId: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);