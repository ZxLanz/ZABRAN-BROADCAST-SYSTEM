const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Broadcast = require('../models/Broadcast');
const Template = require('../models/Template');
const Customer = require('../models/Customer');
const { sendMessage, getStatus: getWAStatus } = require('../utils/whatsappClient');
const { authenticate } = require('../middleware/auth');

// 🔒 IMPORT BROADCAST CONFIG
const config = require('../config/broadcastConfig');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
  notifyBroadcastCreated,
  notifyBroadcastStarted,
  notifyBroadcastCompleted,
  notifyBroadcastFailed,
  notifyBroadcastPaused,
  notifyBroadcastResumed,
  notifyBroadcastDeleted
} = require('../utils/notificationHelper');

// Apply authenticate middleware to all routes
router.use(authenticate);

// 🔒 BROADCAST STATISTICS TRACKER
const broadcastStats = {
  currentHourStart: Date.now(),
  sentThisHour: 0,
  sentToday: 0,
  lastResetDate: new Date().toDateString(),
  consecutiveErrors: 0
};

// ==================== HELPER FUNCTIONS ====================

// HELPER: Replace variables in message
function replaceVariables(message, recipient) {
  let result = message;
  
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('🔄 [VARIABLE] Starting replacement...');
  console.log('📝 Original message:', message);
  console.log('👤 Recipient object type:', typeof recipient);
  
  const recipientObj = recipient.toObject ? recipient.toObject() : recipient;
  
  const allFields = {
    ...recipientObj,
    ...(recipientObj.customFields || {})
  };
  
  console.log('👤 All fields (merged):', JSON.stringify(allFields, null, 2));
  
  Object.keys(allFields).forEach(key => {
    console.log(`\n🔑 Processing key: "${key}"`);
    
    if (['status', 'sentAt', 'deliveredAt', 'readAt', 'error', '_id', 'customerId', 'customFields'].includes(key)) {
      console.log(`   ⭕ Skipped (internal field)`);
      return;
    }
    
    const value = allFields[key];
    console.log(`   📌 Value: "${value}" (type: ${typeof value})`);
    
    if (value && typeof value === 'string') {
      const exactPattern = new RegExp(`\\{${key}\\}`, 'gi');
      console.log(`   🔍 Trying pattern: {${key}}`);
      
      const beforeReplace = result;
      result = result.replace(exactPattern, value);
      
      if (beforeReplace !== result) {
        console.log(`   ✅ SUCCESS! Replaced {${key}} → "${value}"`);
      } else {
        console.log(`   ❌ No match found for {${key}}`);
      }
      
      const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      console.log(`   🔍 Trying pattern: {{${key}}}`);
      
      const beforeDouble = result;
      result = result.replace(doublePattern, value);
      
      if (beforeDouble !== result) {
        console.log(`   ✅ SUCCESS! Replaced {{${key}}} → "${value}"`);
      } else {
        console.log(`   ❌ No match found for {{${key}}}`);
      }
      
      if (key === 'name') {
        console.log(`   🔍 Special: Trying {nama} for key "name"`);
        const namaPattern = new RegExp(`\\{nama\\}`, 'gi');
        const beforeNama = result;
        result = result.replace(namaPattern, value);
        if (beforeNama !== result) {
          console.log(`   ✅ SUCCESS! Replaced {nama} → "${value}"`);
        }
      }
    }
  });
  
  console.log('\n📤 Final message:', result);
  console.log('╚═══════════════════════════════════════════════╝\n');
  
  return result;
}

/**
 * 🎯 SAFE DELAY FUNCTION - Conservative Mode
 * Random delay between 8-15 seconds with progressive increase
 */
async function safeDelay(messageCount) {
  // 1. Base random delay (8-15 seconds)
  const baseDelay = Math.floor(
    Math.random() * (config.DELAY_MAX - config.DELAY_MIN + 1)
  ) + config.DELAY_MIN;
  
  // 2. Progressive delay (increases with message count)
  let progressiveDelay = 0;
  if (config.ENABLE_PROGRESSIVE) {
    progressiveDelay = Math.min(
      messageCount * config.PROGRESSIVE_INCREMENT,
      config.PROGRESSIVE_MAX
    );
  }
  
  // 3. Night penalty (slower at night)
  let nightPenalty = 0;
  if (config.ENABLE_NIGHT_PENALTY) {
    const hour = new Date().getHours();
    if (hour >= config.NIGHT_START_HOUR || hour <= config.NIGHT_END_HOUR) {
      nightPenalty = config.NIGHT_PENALTY;
    }
  }
  
  // 4. Calculate final delay
  const finalDelay = baseDelay + progressiveDelay + nightPenalty;
  
  // 5. Log delay info
  if (config.ENABLE_DETAILED_LOGS) {
    console.log(`⏳ Delay: ${(finalDelay/1000).toFixed(1)}s (base: ${(baseDelay/1000).toFixed(1)}s + progressive: ${(progressiveDelay/1000).toFixed(1)}s + night: ${(nightPenalty/1000).toFixed(1)}s)`);
  }
  
  // 6. Execute delay
  return new Promise(resolve => setTimeout(resolve, finalDelay));
}

/**
 * 🛡️ CHECK RATE LIMITS
 */
function checkRateLimits() {
  // Reset hourly counter
  const hourElapsed = Date.now() - broadcastStats.currentHourStart;
  if (hourElapsed >= 3600000) { // 1 hour
    broadcastStats.currentHourStart = Date.now();
    broadcastStats.sentThisHour = 0;
    console.log('🔄 Hourly counter reset');
  }
  
  // Reset daily counter
  const today = new Date().toDateString();
  if (today !== broadcastStats.lastResetDate) {
    broadcastStats.sentToday = 0;
    broadcastStats.lastResetDate = today;
    console.log('🔄 Daily counter reset');
  }
  
  // Check hourly limit
  if (config.CHECK_HOURLY_LIMIT && broadcastStats.sentThisHour >= config.MAX_PER_HOUR) {
    const waitTime = 3600000 - (Date.now() - broadcastStats.currentHourStart);
    throw new Error(`⚠️ Hourly limit reached (${config.MAX_PER_HOUR} messages). Wait ${Math.ceil(waitTime/60000)} minutes.`);
  }
  
  // Check daily limit
  if (config.CHECK_DAILY_LIMIT && broadcastStats.sentToday >= config.MAX_PER_DAY) {
    throw new Error(`⚠️ Daily limit reached (${config.MAX_PER_DAY} messages). Try again tomorrow.`);
  }
  
  return true;
}

/**
 * 📊 UPDATE STATISTICS
 */
function updateStats(success = true) {
  if (success) {
    broadcastStats.sentThisHour++;
    broadcastStats.sentToday++;
    broadcastStats.consecutiveErrors = 0;
  } else {
    broadcastStats.consecutiveErrors++;
    
    // Auto-pause on too many errors
    if (config.AUTO_PAUSE_ON_ERROR && 
        broadcastStats.consecutiveErrors >= config.MAX_CONSECUTIVE_ERRORS) {
      throw new Error(`🛑 Too many consecutive errors (${config.MAX_CONSECUTIVE_ERRORS}). Broadcast paused for safety.`);
    }
  }
}

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

/**
 * 🔥 MAIN BROADCAST SENDING FUNCTION - CONSERVATIVE MODE V2
 * With full integration of existing features + safe delays
 */
async function sendBroadcastMessages(broadcast, userId) {
  console.log(`\n🚀 [BROADCAST] Starting: ${broadcast.name} (${broadcast._id})`);
  console.log(`👤 [BROADCAST] User ID: ${userId}`);
  console.log('┌────────────────────────────────────────────────┐');
  console.log('🔒 CONSERVATIVE BROADCAST MODE V2 ACTIVE');
  console.log(`📊 Total recipients: ${broadcast.recipients.length}`);
  console.log(`⚙️ Config: Delay ${config.DELAY_MIN/1000}-${config.DELAY_MAX/1000}s, Batch ${config.BATCH_SIZE} msgs, Max ${config.MAX_PER_HOUR}/hour`);
  console.log(`⏱️ Estimated time: ~${Math.ceil(broadcast.recipients.length * 11.5 / 60)} minutes`);
  console.log('└────────────────────────────────────────────────┘\n');
  
  broadcast.status = 'on-process';
  broadcast.startedAt = new Date();
  await broadcast.save();
  
  // 🔔 NOTIFY: Broadcast started
  await notifyBroadcastStarted(userId, broadcast);
  
  let successCount = 0;
  let failedCount = 0;
  let hasError = false;
  let lastError = null;
  
  for (let i = 0; i < broadcast.recipients.length; i++) {
    const recipient = broadcast.recipients[i];
    const messageNumber = i + 1;
    
    // Check if paused
    const currentBroadcast = await Broadcast.findById(broadcast._id);
    if (currentBroadcast.status === 'paused') {
      console.log('⏸️ [BROADCAST] Paused by user');
      return;
    }
    
    console.log(`\n📤 [${messageNumber}/${broadcast.recipients.length}] Sending to: ${recipient.phone}`);
    
    try {
      // 🛡️ Check rate limits before sending
      checkRateLimits();
      
      // Replace variables in message
      const message = replaceVariables(
        broadcast.message, 
        recipient.toObject ? recipient.toObject() : recipient
      );
      
      // Send message with retry logic
      let sent = false;
      let attempts = 0;
      let result = null;
      
      while (!sent && attempts < config.MAX_RETRY_ATTEMPTS) {
        attempts++;
        
        try {
          console.log(`   🔄 Attempt ${attempts}/${config.MAX_RETRY_ATTEMPTS}...`);
          result = await sendMessage(userId, recipient.phone, message);
          
          if (result.success) {
            sent = true;
            recipient.status = 'sent';
            recipient.sentAt = new Date();
            successCount++;
            updateStats(true);
            console.log(`   ✅ Sent successfully!`);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
          
        } catch (sendError) {
          console.log(`   ⚠️ Attempt ${attempts} failed: ${sendError.message}`);
          
          if (attempts < config.MAX_RETRY_ATTEMPTS) {
            console.log(`   🔄 Retrying in ${config.RETRY_DELAY/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY));
          } else {
            throw sendError;
          }
        }
      }
      
    } catch (error) {
      recipient.status = 'failed';
      recipient.error = error.message;
      failedCount++;
      hasError = true;
      lastError = error.message;
      updateStats(false);
      console.log(`   ❌ Failed: ${error.message}`);
    }
    
    // Update broadcast progress
    broadcast.recipients[i] = recipient;
    broadcast.successCount = successCount;
    broadcast.failedCount = failedCount;
    await broadcast.save();
    
    // 📊 Log progress periodically
    if (config.LOG_PROGRESS_EVERY && messageNumber % config.LOG_PROGRESS_EVERY === 0) {
      console.log(`\n┌────────────────────────────────────────────────┐`);
      console.log(`📊 PROGRESS: ${messageNumber}/${broadcast.recipients.length} (${Math.round(messageNumber/broadcast.recipients.length*100)}%)`);
      console.log(`   Success: ${successCount} | Failed: ${failedCount}`);
      console.log(`   Hourly: ${broadcastStats.sentThisHour}/${config.MAX_PER_HOUR} | Daily: ${broadcastStats.sentToday}/${config.MAX_PER_DAY}`);
      console.log(`└────────────────────────────────────────────────┘\n`);
    }
    
    // ⏸️ DELAY BETWEEN MESSAGES (except last one)
    if (i < broadcast.recipients.length - 1) {
      // 🔒 Safe delay with all features (8-15s + progressive + night)
      await safeDelay(messageNumber);
      
      // 📦 BATCH BREAK (every X messages)
      if (config.BATCH_SIZE && messageNumber % config.BATCH_SIZE === 0) {
        console.log(`\n🛑 BATCH BREAK - Resting for ${config.BATCH_BREAK/1000}s (sent ${config.BATCH_SIZE} messages)`);
        await new Promise(resolve => setTimeout(resolve, config.BATCH_BREAK));
        console.log('✅ Break complete, resuming...\n');
      }
    }
  }
  
  // ✅ UPDATE FINAL STATUS
  broadcast.status = 'completed';
  broadcast.completedAt = new Date();
  await broadcast.save();
  
  console.log('\n┌────────────────────────────────────────────────┐');
  console.log('🎉 BROADCAST COMPLETED!');
  console.log(`✅ Success: ${successCount}/${broadcast.recipients.length}`);
  console.log(`❌ Failed: ${failedCount}/${broadcast.recipients.length}`);
  console.log(`⏱️ Duration: ${Math.round((Date.now() - broadcast.startedAt) / 60000)} minutes`);
  console.log('└────────────────────────────────────────────────┘\n');
  
  // 🔔 NOTIFY: Broadcast completed or failed
  if (hasError && successCount === 0) {
    await notifyBroadcastFailed(userId, broadcast, lastError);
  } else {
    await notifyBroadcastCompleted(userId, broadcast);
  }
}

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

// GET /api/broadcasts/stats - Dashboard stats (EXISTING)
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
    
    res.json({
      success: true,
      data: {
        active,
        completed,
        scheduled,
        total,
        todayMessages,
        successRate: parseFloat(successRate),
        // 🔒 Add current broadcast stats
        currentStats: {
          sentThisHour: broadcastStats.sentThisHour,
          maxPerHour: config.MAX_PER_HOUR,
          sentToday: broadcastStats.sentToday,
          maxPerDay: config.MAX_PER_DAY
        }
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
        console.error('❌ WhatsApp not connected for user:', userId);
        console.error('   Current status:', waStatus);
        return res.status(400).json({
          success: false,
          message: 'WhatsApp is not connected. Please connect first.',
          debug: { userId, waStatus }
        });
      }
      
      console.log('✅ WhatsApp is connected, proceeding with broadcast...');
      
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
      
      console.log('\n📋 [BROADCAST] Recipients parsed:', JSON.stringify(recipientsList, null, 2));
      
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
        sendBroadcastMessages(broadcast, userId).catch(err => {
          console.error('❌ Broadcast error:', err);
        });
        
        return res.status(201).json({
          success: true,
          message: 'Broadcast started. Messages are being sent with safe delays.',
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
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }
    
    if (broadcast.status !== 'on-process') {
      return res.status(400).json({
        success: false,
        message: 'Can only pause broadcasts in progress'
      });
    }
    
    broadcast.status = 'paused';
    await broadcast.save();
    
    // 🔔 NOTIFY: Broadcast paused
    await notifyBroadcastPaused(userId, broadcast);
    
    res.json({
      success: true,
      message: 'Broadcast paused',
      data: broadcast
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/broadcasts/:id/resume - Resume
router.post('/:id/resume', async (req, res) => {
  try {
    const userId = req.user.id;
    
    const broadcast = await Broadcast.findById(req.params.id);
    
    if (!broadcast) {
      return res.status(404).json({
        success: false,
        message: 'Broadcast not found'
      });
    }
    
    if (broadcast.status !== 'paused') {
      return res.status(400).json({
        success: false,
        message: 'Can only resume paused broadcasts'
      });
    }
    
    // 🔔 NOTIFY: Broadcast resumed
    await notifyBroadcastResumed(userId, broadcast);
    
    sendBroadcastMessages(broadcast, userId).catch(err => {
      console.error('❌ Resume broadcast error:', err);
    });
    
    res.json({
      success: true,
      message: 'Broadcast resumed',
      data: broadcast
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE /api/broadcasts/:id - Delete
router.delete('/:id', async (req, res) => {
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
    
    const broadcastName = broadcast.name;
    
    await Broadcast.findByIdAndDelete(req.params.id);
    
    // 🔔 NOTIFY: Broadcast deleted
    await notifyBroadcastDeleted(userId, broadcastName);
    
    res.json({
      success: true,
      message: 'Broadcast deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 🔒 GET /api/broadcasts/config/current - Get current broadcast config
router.get('/config/current', (req, res) => {
  try {
    res.json({
      success: true,
      config: {
        delayRange: `${config.DELAY_MIN/1000}-${config.DELAY_MAX/1000}s`,
        batchSize: config.BATCH_SIZE,
        batchBreak: `${config.BATCH_BREAK/1000}s`,
        maxPerHour: config.MAX_PER_HOUR,
        maxPerDay: config.MAX_PER_DAY,
        progressiveDelay: config.ENABLE_PROGRESSIVE,
        nightPenalty: config.ENABLE_NIGHT_PENALTY
      },
      currentStats: broadcastStats
    });
  } catch (error) {
    console.error('❌ Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.sendBroadcastMessages = sendBroadcastMessages;