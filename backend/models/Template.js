// backend/models/Template.js - ✅ FIXED
const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: [
      'promo', 
      'reminder', 
      'announcement', 
      'confirmation', 
      'general', 
      'greeting', 
      'notification', 
      'follow-up'
    ],
    default: 'general'
  },
  variables: {
    type: [String],
    default: []
  },
  usageCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // ✅ FIXED: required: true
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true  // ✅ WAJIB ADA!
  }
}, {
  timestamps: true
});

// Extract variables from message
// Support: {{name}}, {name}
templateSchema.pre('save', function(next) {
  if (this.isModified('message')) {
    // Match {{var}} or {var}
    const regex = /\{\{?(\w+)\}\}?/g;
    const matches = [...this.message.matchAll(regex)];
    this.variables = [...new Set(matches.map(m => m[1]))];
  }
  next();
});

module.exports = mongoose.model('Template', templateSchema);