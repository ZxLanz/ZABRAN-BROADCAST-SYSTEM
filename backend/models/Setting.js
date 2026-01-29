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

  // Business Hours
  businessHoursEnabled: {
    type: Boolean,
    default: false
  },
  businessHours: {
    monday: {
      enabled: { type: Boolean, default: true },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    tuesday: {
      enabled: { type: Boolean, default: true },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    wednesday: {
      enabled: { type: Boolean, default: true },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    thursday: {
      enabled: { type: Boolean, default: true },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    friday: {
      enabled: { type: Boolean, default: true },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    saturday: {
      enabled: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    },
    sunday: {
      enabled: { type: Boolean, default: false },
      open: { type: String, default: '09:00' },
      close: { type: String, default: '17:00' }
    }
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