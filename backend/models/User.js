// backend/models/User.js - ✅ WITH PASSWORD HASHING & WHATSAPP FIELDS
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    },
    // ✅ WhatsApp Status Tracking
    whatsappStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'connecting', 'qrcode', 'reconnecting', 'error'],
      default: 'disconnected'
    },
    whatsappError: {
      type: String,
      default: null
    },
    lastWhatsAppConnection: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: true 
  }
);

// Index untuk performa
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ whatsappStatus: 1 }); // ✅ NEW INDEX

// ============================================
// 🔥 PRE-SAVE HOOK: HASH PASSWORD
// ============================================
UserSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt
    const salt = await bcrypt.genSalt(10);
    
    // Hash password
    this.password = await bcrypt.hash(this.password, salt);
    
    console.log(`✅ Password hashed for user: ${this.username}`);
    next();
  } catch (error) {
    console.error('❌ Error hashing password:', error);
    next(error);
  }
});

// ============================================
// 🔥 METHOD: COMPARE PASSWORD
// ============================================
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    return isMatch;
  } catch (error) {
    console.error('❌ Error comparing password:', error);
    return false;
  }
};

// ============================================
// 🔥 METHOD: TO JSON (Exclude password)
// ============================================
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', UserSchema);