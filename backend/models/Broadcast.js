const mongoose = require('mongoose');

// ✅ Use Schema.Types.Mixed for dynamic fields
const recipientSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  phone: {
    type: String,
    required: true
  },
  name: String,
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
    default: 'pending'
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  error: String,
  // ✅ CRITICAL: Store ALL other fields here
  customFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  _id: false,
  strict: false
});

const broadcastSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  recipients: [recipientSchema],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'on-process', 'completed', 'paused', 'failed'],
    default: 'draft'
  },
  sendAt: Date,
  startedAt: Date,
  completedAt: Date,
  successCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  totalRecipients: {
    type: Number,
    default: 0
  },
  type: {
    type: String,
    enum: ['text', 'image', 'document'],
    default: 'text'
  },
  mediaUrl: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

// Virtual untuk success rate
broadcastSchema.virtual('successRate').get(function() {
  if (this.totalRecipients === 0) return 0;
  return Math.round((this.successCount / this.totalRecipients) * 100);
});

// Virtual untuk sent count
broadcastSchema.virtual('sentCount').get(function() {
  return this.successCount + this.failedCount;
});

// Set toJSON untuk include virtuals
broadcastSchema.set('toJSON', { virtuals: true });
broadcastSchema.set('toObject', { virtuals: true });

// Pre-save: Set totalRecipients
broadcastSchema.pre('save', function(next) {
  if (this.isModified('recipients')) {
    this.totalRecipients = this.recipients.length;
  }
  next();
});

module.exports = mongoose.model('Broadcast', broadcastSchema);