// backend/models/Customer.js - ✅ FIXED WITH createdBy
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  // Informasi Utama
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: { // Nomor telepon WhatsApp (format: 628xxxx)
    type: String,
    required: true,
    unique: true, // Nomor telepon harus unik
    trim: true
  },
  jids: [{ // Daftar JID yang terkait dengan customer ini (termasuk @lid)
    type: String
  }],
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: false
  },

  // Informasi Tambahan
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

  // Tagging dan Status
  tags: [{ // Array of tags
    type: String,
    trim: true
  }],
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blocked'], // Status yang valid
    default: 'active'
  },

  // Custom Fields (untuk data pelanggan yang spesifik)
  customFields: {
    type: Map, // Menggunakan Map untuk menyimpan pasangan key-value dinamis
    of: String
  },

  // Log Kontak
  lastContactDate: {
    type: Date
  },

  // ✅ ADDED: User Ownership - Link customer to user who created it
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // ✅ WAJIB - Every customer must have an owner
  }

}, {
  timestamps: true // Menambahkan createdAt dan updatedAt
});

// Indexing untuk meningkatkan performa query
customerSchema.index({ phone: 1 });
customerSchema.index({ name: 1 });
customerSchema.index({ tags: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdBy: 1 }); // ✅ NEW INDEX - Fast filtering by user

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;