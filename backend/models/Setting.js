// backend/models/Setting.js
const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One setting document per user
  },

  // General Settings
  autoReply: {
    type: Boolean,
    default: false
  },
  autoReplyMessage: {
    type: String,
    default: 'Terima kasih telah menghubungi kami. Kami akan segera membalas pesan Anda.'
  },

  readReceipts: {
    type: Boolean,
    default: true
  },

  autoRead: {
    type: Boolean,
    default: false
  },

  notifications: {
    type: Boolean,
    default: true
  },

  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },

  language: {
    type: String,
    enum: ['id', 'en'],
    default: 'id'
  },

  // WhatsApp Settings (reference to existing whatsapp status)
  whatsappConnected: {
    type: Boolean,
    default: false
  },
  whatsappDevice: {
    type: String,
    default: ''
  }

}, {
  timestamps: true
});

// Index for fast lookup
settingSchema.index({ userId: 1 });

module.exports = mongoose.model('Setting', settingSchema);