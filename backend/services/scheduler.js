// ============================================
// SCHEDULER SERVICE - Auto-Start Scheduled Broadcasts
// ============================================
// File: backend/services/scheduler.js

const cron = require('node-cron');
const Broadcast = require('../models/Broadcast');
const { sendBroadcastMessages } = require('../routes/broadcasts');

let isSchedulerRunning = false;
let cronJob = null;

/**
 * Initialize Broadcast Scheduler
 * Checks database every 1 minute for scheduled broadcasts
 */
const initScheduler = () => {
  if (isSchedulerRunning) {
    console.log('⚠️  [SCHEDULER] Already running');
    return cronJob;
  }

  console.log('\n⏰ [SCHEDULER] Initializing Broadcast Scheduler...');

  // ============================================
  // CRON JOB: Runs every 1 minute
  // Pattern: '* * * * *' = every minute
  // ============================================
  cronJob = cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      console.log(`\n🕐 [SCHEDULER] Checking at ${now.toISOString()}`);
      
      // ✅ FIX: Populate createdBy to get user info
      const scheduledBroadcasts = await Broadcast.find({
        status: 'scheduled',
        sendAt: { $lte: now }
      }).populate('createdBy');

      if (scheduledBroadcasts.length === 0) {
        console.log('   ✅ No broadcasts to send');
        return;
      }

      console.log(`📬 [SCHEDULER] Found ${scheduledBroadcasts.length} scheduled broadcast(s) ready to send`);

      // Process each scheduled broadcast
      for (const broadcast of scheduledBroadcasts) {
        try {
          console.log(`\n🚀 [SCHEDULER] Starting broadcast: ${broadcast.name} (${broadcast._id})`);
          console.log(`   Scheduled for: ${broadcast.sendAt.toISOString()}`);
          console.log(`   Current time: ${now.toISOString()}`);
          console.log(`   Recipients: ${broadcast.totalRecipients || broadcast.recipients?.length || 0}`);

          // ✅ FIX: Extract userId with safe fallback
          let userId = broadcast.createdBy?._id || broadcast.createdBy;

          // ✅ CRITICAL: Validate userId exists
          if (!userId) {
            console.error(`❌ [SCHEDULER] No user ID found for broadcast ${broadcast._id}`);
            broadcast.status = 'failed';
            await broadcast.save();
            continue;
          }

          // ✅ SAFE: Convert to string (handle both ObjectId and String)
          userId = userId.toString ? userId.toString() : String(userId);

          console.log(`   User ID: ${userId}`);

          // Change status to 'on-process'
          broadcast.status = 'on-process';
          broadcast.startedAt = new Date();
          await broadcast.save();

          // ✅ FIX: Pass userId as second parameter
          sendBroadcastMessages(broadcast, userId).catch(err => {
            console.error(`❌ [SCHEDULER] Broadcast error (${broadcast._id}):`, err.message);
          });

          console.log(`✅ [SCHEDULER] Broadcast started: ${broadcast.name}`);

        } catch (error) {
          console.error(`❌ [SCHEDULER] Failed to start broadcast ${broadcast._id}:`, error.message);
          
          // Mark as failed
          try {
            broadcast.status = 'failed';
            await broadcast.save();
          } catch (saveErr) {
            console.error(`❌ [SCHEDULER] Failed to update status:`, saveErr.message);
          }
        }
      }

      console.log('✅ [SCHEDULER] Finished checking broadcasts\n');

    } catch (error) {
      console.error('❌ [SCHEDULER] Cron job error:', error.message);
      console.error(error.stack);
    }
  });

  isSchedulerRunning = true;
  console.log('✅ [SCHEDULER] Initialized (checking every 1 minute)\n');
  
  // ✅ Run initial check after 2 seconds
  setTimeout(async () => {
    console.log('🔄 [SCHEDULER] Running initial check...');
    try {
      const now = new Date();
      const scheduledBroadcasts = await Broadcast.find({
        status: 'scheduled',
        sendAt: { $lte: now }
      }).populate('createdBy');

      if (scheduledBroadcasts.length > 0) {
        console.log(`📬 [SCHEDULER] Found ${scheduledBroadcasts.length} pending broadcast(s) on startup`);
        
        // ✅ ADDED: Process pending broadcasts immediately
        for (const broadcast of scheduledBroadcasts) {
          try {
            let userId = broadcast.createdBy?._id || broadcast.createdBy;
            
            if (!userId) {
              console.error(`❌ [SCHEDULER] No user ID for broadcast ${broadcast._id}`);
              continue;
            }
            
            userId = userId.toString ? userId.toString() : String(userId);
            
            console.log(`🚀 [SCHEDULER] Starting pending broadcast: ${broadcast.name}`);
            
            broadcast.status = 'on-process';
            broadcast.startedAt = new Date();
            await broadcast.save();
            
            sendBroadcastMessages(broadcast, userId).catch(err => {
              console.error(`❌ [SCHEDULER] Startup broadcast error:`, err.message);
            });
            
          } catch (error) {
            console.error(`❌ [SCHEDULER] Error processing broadcast ${broadcast._id}:`, error.message);
          }
        }
      } else {
        console.log('✅ [SCHEDULER] No pending broadcasts on startup');
      }
    } catch (error) {
      console.error('❌ [SCHEDULER] Initial check error:', error.message);
      console.error('   Stack:', error.stack);
    }
  }, 2000);

  return cronJob;
};

/**
 * Stop the scheduler (for graceful shutdown)
 */
const stopScheduler = () => {
  if (cronJob && isSchedulerRunning) {
    console.log('🛑 [SCHEDULER] Stopping...');
    cronJob.stop();
    isSchedulerRunning = false;
    console.log('✅ [SCHEDULER] Stopped');
  }
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = () => {
  return {
    running: isSchedulerRunning,
    checkInterval: '1 minute',
    nextCheck: cronJob ? 'Within 1 minute' : 'Not scheduled'
  };
};

module.exports = {
  initScheduler,
  stopScheduler,
  getSchedulerStatus
};