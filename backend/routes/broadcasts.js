const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Broadcast = require('../models/Broadcast');
const Template = require('../models/Template');
const Customer = require('../models/Customer');
const { getStatus: getWAStatus } = require('../utils/whatsappClient');
const { authenticate } = require('../middleware/auth');
const config = require('../config/broadcastConfig');

// ✅ IMPORT SERVICE
const broadcastService = require('../services/broadcastService');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
  notifyBroadcastCreated,
  notifyBroadcastPaused,
  notifyBroadcastResumed,
  notifyBroadcastDeleted
} = require('../utils/notificationHelper');

// Apply authenticate middleware to all routes
router.get('/debug/all', async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ createdAt: -1 }).limit(10);
    const User = require('../models/User');
    const users = await User.find().select('name username whatsappStatus whatsappError');
    res.json({ success: true, broadcasts, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

// ==================== HELPER FUNCTIONS ====================
// HELPER: Normalize phone number
const normalizePhone = (phone) => {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned.startsWith('62')) {
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
      cleaned = '62' + cleaned;
    }
  }
  return cleaned;
};

// ==================== STATISTICS ENDPOINTS ====================

// GET /api/broadcasts/stats/daily - Get daily statistics
router.get('/stats/daily', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const userId = req.user.id;
    const role = req.user.role;

    // Calculate date range
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    // Build match query
    const matchQuery = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (role !== 'admin') {
      matchQuery.createdBy = userId;
    }

    // Aggregate daily statistics
    const dailyStats = await Broadcast.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          broadcasts: { $sum: 1 },
          totalRecipients: {
            $sum: {
              $cond: [
                { $isArray: '$recipients' },
                { $size: '$recipients' },
                0
              ]
            }
          },
          sent: { $sum: { $ifNull: ['$successCount', 0] } },
          delivered: { $sum: { $ifNull: ['$successCount', 0] } },
          failed: { $sum: { $ifNull: ['$failedCount', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing dates with zeros
    const filledStats = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const existingStat = dailyStats.find(stat => stat._id === dateStr);

      if (existingStat) {
        filledStats.push({
          date: dateStr,
          broadcasts: existingStat.broadcasts,
          totalRecipients: existingStat.totalRecipients,
          sent: existingStat.sent,
          delivered: existingStat.delivered,
          failed: existingStat.failed,
          deliveryRate: existingStat.sent > 0
            ? ((existingStat.delivered / existingStat.sent) * 100).toFixed(1)
            : 0
        });
      } else {
        filledStats.push({
          date: dateStr,
          broadcasts: 0,
          totalRecipients: 0,
          sent: 0,
          delivered: 0,
          failed: 0,
          deliveryRate: 0
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate summary
    const summary = filledStats.reduce((acc, stat) => ({
      totalBroadcasts: acc.totalBroadcasts + stat.broadcasts,
      totalRecipients: acc.totalRecipients + stat.totalRecipients,
      totalSent: acc.totalSent + stat.sent,
      totalDelivered: acc.totalDelivered + stat.delivered,
      totalFailed: acc.totalFailed + stat.failed
    }), {
      totalBroadcasts: 0,
      totalRecipients: 0,
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0
    });

    summary.overallDeliveryRate = summary.totalSent > 0
      ? ((summary.totalDelivered / summary.totalSent) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      stats: filledStats,
      summary,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: parseInt(days)
      }
    });
  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily stats',
      error: error.message
    });
  }
});

// GET /api/broadcasts/stats - Dashboard stats 
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const filter = role === 'admin' ? {} : { createdBy: userId };

    const [active, completed, scheduled, total] = await Promise.all([
      Broadcast.countDocuments({ ...filter, status: 'on-process' }),
      Broadcast.countDocuments({ ...filter, status: 'completed' }),
      Broadcast.countDocuments({ ...filter, status: 'scheduled' }),
      Broadcast.countDocuments(filter)
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayBroadcasts = await Broadcast.find({
      ...filter,
      createdAt: { $gte: today }
    });

    let todayMessages = 0;
    todayBroadcasts.forEach(b => {
      todayMessages += b.successCount || 0;
    });

    const allBroadcasts = await Broadcast.find(filter);
    let totalSent = 0;
    let totalSuccess = 0;

    allBroadcasts.forEach(b => {
      totalSent += b.recipients?.length || 0;
      totalSuccess += b.successCount || 0;
    });

    const successRate = totalSent > 0
      ? ((totalSuccess / totalSent) * 100).toFixed(1)
      : 0;

    // ✅ GET REAL-TIME STATS FROM SERVICE
    const currentStats = broadcastService.getCurrentStats();

    res.json({
      success: true,
      data: {
        active,
        completed,
        scheduled,
        total,
        todayMessages,
        successRate: parseFloat(successRate),
        currentStats
      }
    });

  } catch (error) {
    console.error('Get broadcast stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcast stats',
      error: error.message
    });
  }
});

// ==================== CRUD ENDPOINTS ====================

// GET /api/broadcasts - List all
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { status, limit } = req.query;

    const filter = role === 'admin' ? {} : { createdBy: userId };
    if (status) filter.status = status;

    let query = Broadcast.find(filter)
      .populate('templateId', 'name message category')
      .sort({ createdAt: -1 });

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const broadcasts = await query;

    res.json({
      success: true,
      count: broadcasts.length,
      data: broadcasts
    });
  } catch (error) {
    console.error('Get broadcasts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcasts',
      error: error.message
    });
  }
});

// GET /api/broadcasts/:id - Get one
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const broadcast = await Broadcast.findById(req.params.id)
      .populate('templateId')
      .populate('recipients.customerId', 'name phone');

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    if (role !== 'admin' && broadcast.createdBy && broadcast.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/broadcasts - Create & send
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('templateId').notEmpty().withMessage('Template is required'),
    body('recipients').custom((value) => {
      if (Array.isArray(value) && value.length > 0) return true;
      if (typeof value === 'string' && value.trim().length > 0) return true;
      throw new Error('At least one recipient required');
    })
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

      const userId = req.user.id;

      console.log('📞 Checking WhatsApp status for user:', userId);
      const waStatus = getWAStatus(userId);
      console.log('📊 WhatsApp Status:', waStatus);

      if (waStatus !== 'connected') {
        return res.status(400).json({
          success: false,
          message: 'WhatsApp is not connected. Please connect first.',
          debug: { userId, waStatus }
        });
      }

      const { name, templateId, recipients, sendAt } = req.body;

      const template = await Template.findById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Template not found'
        });
      }

      let recipientsList = [];

      if (typeof recipients === 'string') {
        recipientsList = recipients.split(',').map(phone => ({
          phone: normalizePhone(phone.trim()),
          status: 'pending'
        }));
      } else if (Array.isArray(recipients)) {
        recipientsList = recipients.map(r => {
          if (typeof r === 'string') {
            return { phone: normalizePhone(r), status: 'pending' };
          }
          const { phone, name, customerId, ...customFields } = r;
          return {
            phone: normalizePhone(phone),
            name,
            customerId,
            status: 'pending',
            customFields
          };
        });
      }

      const invalidRecipients = recipientsList.filter(r => {
        const phone = r.phone.replace(/\D/g, '');
        return phone.length < 9 || phone.length > 15;
      });

      if (invalidRecipients.length > 0) {
        return res.status(400).json({
          success: false,
          message: `${invalidRecipients.length} recipients have invalid phone numbers`,
          invalidRecipients
        });
      }

      const broadcast = new Broadcast({
        name,
        templateId,
        message: template.message,
        recipients: recipientsList,
        status: sendAt ? 'scheduled' : 'draft',
        sendAt: sendAt || null,
        createdBy: userId
      });

      await broadcast.save();

      template.usageCount = (template.usageCount || 0) + 1;
      await template.save();

      // 🔔 NOTIFY: Broadcast created
      await notifyBroadcastCreated(userId, broadcast);

      if (!sendAt) {
        // ✅ CALL SERVICE INSTEAD OF LOCAL FUNCTION
        broadcastService.startBroadcast(broadcast, userId);

        return res.status(201).json({
          success: true,
          message: 'Broadcast started successfully.',
          data: broadcast,
          estimatedTime: `~${Math.ceil(recipientsList.length * 11.5 / 60)} minutes`
        });
      }

      res.status(201).json({
        success: true,
        message: 'Broadcast scheduled successfully',
        data: broadcast
      });

    } catch (error) {
      console.error('Create broadcast error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create broadcast',
        error: error.message
      });
    }
  }
);

// PUT /api/broadcasts/:id - Update
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }

    if (role !== 'admin' && broadcast.createdBy && broadcast.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    Object.assign(broadcast, req.body);
    await broadcast.save();

    res.json({ success: true, data: broadcast });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/broadcasts/:id/pause - Pause
router.post('/:id/pause', async (req, res) => {
  try {
    const userId = req.user.id;
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found' });
    }

    if (broadcast.createdBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (broadcast.status !== 'on-process') {
      return res.status(400).json({
        success: false,
        message: `Cannot pause broadcast with status: ${broadcast.status}`
      });
    }

    broadcast.status = 'paused';
    await broadcast.save();

    await notifyBroadcastPaused(userId, broadcast);

    res.json({
      success: true,
      message: 'Broadcast paused',
      data: broadcast
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/broadcasts/:id/resume - Resume
router.post('/:id/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found' });
    }

    if (broadcast.createdBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (broadcast.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: `Cannot resume broadcast with status: ${broadcast.status}`
      });
    }

    // ✅ RESUME VIA SERVICE
    broadcastService.startBroadcast(broadcast, userId);

    await notifyBroadcastResumed(userId, broadcast);

    res.json({
      success: true,
      message: 'Broadcast resumed',
      data: broadcast
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/broadcasts/:id
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const broadcast = await Broadcast.findById(req.params.id);

    if (!broadcast) {
      return res.status(404).json({ success: false, message: 'Broadcast not found' });
    }

    if (role !== 'admin' && broadcast.createdBy && broadcast.createdBy.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await Broadcast.findByIdAndDelete(req.params.id);

    await notifyBroadcastDeleted(userId, broadcast);

    res.json({ success: true, message: 'Broadcast deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;