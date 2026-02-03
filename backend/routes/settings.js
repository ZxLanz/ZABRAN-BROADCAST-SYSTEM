// backend/routes/settings.js
// 📁 LOCATION: backend/routes/settings.js
// 🎯 PURPOSE: API endpoints for settings (GET, PUT, POST)
// ✅ ACTION: CREATE NEW FILE
const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { authenticate } = require('../middleware/auth');

// GET /api/settings - Get user settings
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Find or create settings for user
    let settings = await Setting.findOne({ userId });

    if (!settings) {
      // Create default settings if not exists
      settings = new Setting({ userId });
      await settings.save();
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load settings'
    });
  }
});

// PUT /api/settings - Update user settings
router.put('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;

    // Find or create settings
    let settings = await Setting.findOne({ userId });

    if (!settings) {
      settings = new Setting({ userId, ...updateData });
    } else {
      // Update existing settings
      Object.keys(updateData).forEach(key => {
        if (key === 'businessHours' && updateData.businessHours) {
          // Merge business hours
          settings.businessHours = {
            ...settings.businessHours.toObject(),
            ...updateData.businessHours
          };
        } else {
          settings[key] = updateData[key];
        }
      });
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: settings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save settings'
    });
  }
});

// POST /api/settings/reset - Reset to default settings
router.post('/reset', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete existing settings
    await Setting.findOneAndDelete({ userId });

    // Create new default settings
    const settings = new Setting({ userId });
    await settings.save();

    res.json({
      success: true,
      message: 'Settings reset to default',
      data: settings
    });

  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset settings'
    });
  }
});

// GET /api/settings/check-business-hours - Check if currently in business hours
router.get('/check-business-hours', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await Setting.findOne({ userId });

    if (!settings || !settings.businessHoursEnabled) {
      return res.json({
        success: true,
        isBusinessHours: true, // Default to always available
        message: 'Business hours not enabled'
      });
    }

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    const todayHours = settings.businessHours[currentDay];

    if (!todayHours.enabled) {
      return res.json({
        success: true,
        isBusinessHours: false,
        message: 'Closed today'
      });
    }

    const isOpen = currentTime >= todayHours.open && currentTime <= todayHours.close;

    res.json({
      success: true,
      isBusinessHours: isOpen,
      currentDay,
      currentTime,
      openTime: todayHours.open,
      closeTime: todayHours.close
    });

  } catch (error) {
    console.error('Check business hours error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check business hours'
    });
  }
});

// GET /api/settings/system-health - Get server health stats
router.get('/system-health', authenticate, async (req, res) => {
  try {
    const os = require('os');

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    // Uptime
    const uptime = os.uptime(); // seconds

    // App Memory
    const appMem = process.memoryUsage();

    res.json({
      success: true,
      data: {
        cpu: 0, // Placeholder as OS loadavg is unreliable on Windows without libs
        memory: {
          total: totalMem,
          used: usedMem,
          free: freeMem,
          percent: memUsage,
          appHeap: appMem.heapUsed
        },
        uptime: uptime,
        platform: os.platform() + ' ' + os.release()
      }
    });
  } catch (error) {
    console.error('System health error:', error);
    res.status(500).json({ success: false, message: 'Failed to get system health' });
  }
});

module.exports = router;