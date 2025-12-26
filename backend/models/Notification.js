// backend/models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['message', 'system', 'alert', 'success', 'warning'],
      default: 'system'
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    icon: {
      type: String,
      default: 'Bell'
    },
    unread: {
      type: Boolean,
      default: true,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    actionUrl: {
      type: String,
      trim: true
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// ✅ Compound indexes for efficient queries
notificationSchema.index({ user: 1, deletedAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, unread: 1, deletedAt: 1 });

// ✅ Virtual: isDeleted
notificationSchema.virtual('isDeleted').get(function() {
  return this.deletedAt !== null;
});

// ✅ Set toJSON to include virtuals
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);