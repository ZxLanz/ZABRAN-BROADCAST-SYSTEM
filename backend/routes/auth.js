// backend/routes/auth.js - ✅ WITH AUTO NOTIFICATIONS
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
  notifyLoginSuccess,
  notifyPasswordChanged,
  notifyProfileUpdated
} = require('../utils/notificationHelper');

// ============================================
// POST /api/auth/register
// ============================================
router.post('/register',
  [
    body('name').notEmpty().withMessage('Nama wajib diisi'),
    body('email').isEmail().withMessage('Email tidak valid'),
    body('username').notEmpty().withMessage('Username wajib diisi')
      .isLength({ min: 3 }).withMessage('Username minimal 3 karakter'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password minimal 6 karakter')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const { name, email, username, password, role } = req.body;

      const existingUser = await User.findOne({ 
        $or: [{ username }, { email }] 
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username atau email sudah terdaftar'
        });
      }

      const user = new User({
        name,
        email,
        username,
        password,
        role: role || 'user'
      });

      await user.save();

      console.log(`✅ User registered: ${username}`);

      res.status(201).json({
        success: true,
        message: 'Registrasi berhasil',
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal registrasi',
        error: error.message
      });
    }
  }
);

// ============================================
// POST /api/auth/login - ✅ WITH NOTIFICATION
// ============================================
router.post('/login',
  [
    body('username').notEmpty()
      .withMessage('Email/Username wajib diisi'),
    body('password').notEmpty()
      .withMessage('Password wajib diisi')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const { username, password } = req.body;

      const user = await User.findOne({ 
        $or: [
          { username: username },
          { email: username }
        ] 
      }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email/Username atau password salah'
        });
      }

      const isMatch = await user.comparePassword(password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Email/Username atau password salah'
        });
      }

      const token = jwt.sign(
        { 
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 
        'your-secret-key-change-this-in-production',
        { expiresIn: '7d' }
      );

      console.log(`✅ User logged in: ${username} (${user.role})`);

      // 🔔 NOTIFY: Login success
      await notifyLoginSuccess(user._id, user.name);

      res.json({
        success: true,
        message: 'Login berhasil',
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal login',
        error: error.message
      });
    }
  }
);

// ============================================
// GET /api/auth/me
// ============================================
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace(
      'Bearer ', 
      ''
    );

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 
      'your-secret-key-change-this-in-production'
    );

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Get me error:', error);
    res.status(401).json({
      success: false,
      message: 'Token tidak valid'
    });
  }
});

// ============================================
// 🆕 PUT /api/auth/profile - Update profile
// ============================================
router.put('/profile', authenticate, 
  [
    body('name').optional().notEmpty().withMessage('Nama tidak boleh kosong'),
    body('email').optional().isEmail().withMessage('Email tidak valid')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { name, email } = req.body;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }

      // Update fields if provided
      if (name) user.name = name;
      if (email) {
        // Check if email already exists
        const existingUser = await User.findOne({ 
          email, 
          _id: { $ne: userId } 
        });
        
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'Email sudah digunakan'
          });
        }
        
        user.email = email;
      }

      await user.save();

      console.log(`✅ Profile updated for user: ${userId}`);

      // 🔔 NOTIFY: Profile updated
      await notifyProfileUpdated(userId);

      res.json({
        success: true,
        message: 'Profile berhasil diupdate',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          username: user.username,
          role: user.role
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal update profile',
        error: error.message
      });
    }
  }
);

// ============================================
// 🆕 PUT /api/auth/change-password - Change password
// ============================================
router.put('/change-password', authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Password lama wajib diisi'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password baru minimal 6 karakter')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(userId).select('+password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Password lama tidak sesuai'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      console.log(`✅ Password changed for user: ${userId}`);

      // 🔔 NOTIFY: Password changed
      await notifyPasswordChanged(userId);

      res.json({
        success: true,
        message: 'Password berhasil diubah'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengubah password',
        error: error.message
      });
    }
  }
);

module.exports = router;