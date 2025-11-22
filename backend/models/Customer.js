// backend/models/Customer.js
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  company: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'],
    default: 'active'
  },
  lastContactDate: {
    type: Date
  },
  customFields: {
    type: Map,
    of: String
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
customerSchema.index({ phone: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ tags: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdAt: -1 });

// Virtual for formatted phone number
customerSchema.virtual('formattedPhone').get(function() {
  // Remove non-numeric characters
  const cleaned = this.phone.replace(/\D/g, '');
  
  // Add country code if not present (Indonesia +62)
  if (!cleaned.startsWith('62')) {
    return `62${cleaned.startsWith('0') ? cleaned.substring(1) : cleaned}`;
  }
  return cleaned;
});

// Method to check if customer is active
customerSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Static method to find active customers
customerSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

// Static method to search customers
customerSchema.statics.search = function(query) {
  return this.find({
    $or: [
      { name: new RegExp(query, 'i') },
      { phone: new RegExp(query, 'i') },
      { email: new RegExp(query, 'i') },
      { company: new RegExp(query, 'i') }
    ]
  });
};

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;