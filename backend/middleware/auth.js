// File: backend/middleware/auth.js - ✅ CLEAN VERSION (NO ROUTES!)

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan. Silakan login terlebih dahulu.'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
    );

    // Get user from database
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan. Token tidak valid.'
      });
    }

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.name
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error.message);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token telah kadaluarsa. Silakan login kembali.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Kesalahan autentikasi',
      error: error.message
    });
  }
};

// ============================================
// AUTHORIZATION MIDDLEWARE (ADMIN ONLY)
// ============================================

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please login first.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

// ============================================
// OPTIONAL AUTH (for public routes that can benefit from auth)
// ============================================

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
      );

      const user = await User.findById(decoded.id);

      if (user) {
        req.user = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
          name: user.name
        };
      }
    }

    next();

  } catch (error) {
    // Don't block request if token is invalid
    next();
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  authenticate,
  authorize,
  optionalAuth
};