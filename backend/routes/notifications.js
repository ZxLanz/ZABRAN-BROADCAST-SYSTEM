// backend/routes/notifications.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Notification = require('../models/Notification');
const { authenticate } = require('../middleware/auth');

// ✅ Apply authenticate middleware to all routes
router.use(authenticate);

// ============================================
// GET /api/notifications/stats - Get unread count
// ============================================
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const filter = role === 'admin' 
      ? { deletedAt: null } 
      : { user: userId, deletedAt: null };

    const [unreadCount, totalCount] = await Promise.all([
      Notification.countDocuments({ ...filter, unread: true }),
      Notification.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        unread: unreadCount,
        total: totalCount
      }
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification stats',
      error: error.message
    });
  }
});

// ============================================
// GET /api/notifications - List all notifications
// ============================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { 
      page = 1, 
      limit = 20, 
      filter = 'all', // all, unread, read
      type 
    } = req.query;

    // Base filter: exclude deleted
    const baseFilter = role === 'admin' 
      ? { deletedAt: null } 
      : { user: userId, deletedAt: null };

    // Apply additional filters
    if (filter === 'unread') {
      baseFilter.unread = true;
    } else if (filter === 'read') {
      baseFilter.unread = false;
    }

    if (type) {
      baseFilter.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
      Notification.find(baseFilter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(baseFilter)
    ]);

    res.json({
      success: true,
      count: notifications.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: notifications
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// ============================================
// PATCH /api/notifications/read-all - Mark all as read
// ============================================
router.patch('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const filter = role === 'admin' 
      ? { unread: true, deletedAt: null }
      : { user: userId, unread: true, deletedAt: null };

    const result = await Notification.updateMany(
      filter,
      { $set: { unread: false } }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/notifications/clear - Clear all (soft delete)
// ============================================
router.delete('/clear', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const filter = role === 'admin' 
      ? { deletedAt: null }
      : { user: userId, deletedAt: null };

    const result = await Notification.updateMany(
      filter,
      { $set: { deletedAt: new Date() } }
    );

    res.json({
      success: true,
      message: 'All notifications cleared successfully',
      deletedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear notifications',
      error: error.message
    });
  }
});

// ============================================
// GET /api/notifications/:id - Get single notification
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const notification = await Notification.findById(req.params.id)
      .populate('user', 'name email');

    if (!notification || notification.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check ownership (unless admin)
    if (role !== 'admin' && notification.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
});

// ============================================
// PATCH /api/notifications/:id/read - Mark as read
// ============================================
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check ownership
    if (role !== 'admin' && notification.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    notification.unread = false;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// ============================================
// PATCH /api/notifications/:id/unread - Mark as unread
// ============================================
router.patch('/:id/unread', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check ownership
    if (role !== 'admin' && notification.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    notification.unread = true;
    await notification.save();

    res.json({
      success: true,
      message: 'Notification marked as unread',
      data: notification
    });

  } catch (error) {
    console.error('Mark as unread error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as unread',
      error: error.message
    });
  }
});

// ============================================
// DELETE /api/notifications/:id - Soft delete single
// ============================================
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const notification = await Notification.findById(req.params.id);

    if (!notification || notification.deletedAt) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Check ownership
    if (role !== 'admin' && notification.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    notification.deletedAt = new Date();
    await notification.save();

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// ============================================
// POST /api/notifications - Create notification (for testing)
// ============================================
router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('message').trim().notEmpty().withMessage('Message is required'),
    body('type')
      .optional()
      .isIn(['message', 'system', 'alert', 'success', 'warning'])
      .withMessage('Invalid notification type'),
    body('icon').optional().trim(),
    body('actionUrl').optional().trim(),
    body('userId').optional().isMongoId().withMessage('Invalid user ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId, type, title, message, icon, metadata, actionUrl } = req.body;

      // Use authenticated user or specified userId (admin only)
      const targetUserId = req.user.role === 'admin' && userId 
        ? userId 
        : req.user.id;

      const notification = await Notification.create({
        user: targetUserId,
        type,
        title,
        message,
        icon,
        metadata,
        actionUrl
      });

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: notification
      });

    } catch (error) {
      console.error('Create notification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create notification',
        error: error.message
      });
    }
  }
);

module.exports = router;