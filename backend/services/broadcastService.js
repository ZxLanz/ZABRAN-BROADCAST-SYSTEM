// backend/services/broadcastService.js
const Broadcast = require('../models/Broadcast');
const { sendMessage, getStatus: getWAStatus } = require('../utils/whatsappClient');
const config = require('../config/broadcastConfig');
const { getIO } = require('./socket');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
    notifyBroadcastStarted,
    notifyBroadcastCompleted,
    notifyBroadcastFailed
} = require('../utils/notificationHelper');



// 🔒 BROADCAST STATISTICS TRACKER (In-Memory State)
const broadcastStats = {
    currentHourStart: Date.now(),
    sentThisHour: 0,
    sentToday: 0,
    lastResetDate: new Date().toDateString(),
    consecutiveErrors: 0
};

// ==================== HELPER FUNCTIONS ====================

// HELPER: Replace variables in message (Advanced Version)
function replaceVariables(message, recipient) {
    let result = message;

    const recipientObj = recipient.toObject ? recipient.toObject() : recipient;

    const allFields = {
        ...recipientObj,
        ...(recipientObj.customFields || {})
    };

    Object.keys(allFields).forEach(key => {
        // Skip internal fields
        if (['status', 'sentAt', 'deliveredAt', 'readAt', 'error', '_id', 'customerId', 'customFields'].includes(key)) {
            return;
        }

        const value = allFields[key];

        if (value && typeof value === 'string') {
            // 1. Ganti {key}
            const exactPattern = new RegExp(`\\{${key}\\}`, 'gi');
            result = result.replace(exactPattern, value);

            // 2. Ganti {{key}}
            const doublePattern = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
            result = result.replace(doublePattern, value);

            // 3. Special case: {nama} -> name
            if (key === 'name') {
                const namaPattern = new RegExp(`\\{nama\\}`, 'gi');
                result = result.replace(namaPattern, value);
            }
        }
    });

    return result;
}

/**
 * 🎯 SAFE DELAY FUNCTION - Conservative Mode
 * Random delay between 8-15 seconds with progressive increase
 */
async function safeDelay(messageCount) {
    // 1. Base random delay
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

    // 5. Execute delay
    if (config.ENABLE_DETAILED_LOGS) {
        console.log(`⏳ Delay: ${(finalDelay / 1000).toFixed(1)}s`);
    }
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
        throw new Error(`⚠️ Hourly limit reached (${config.MAX_PER_HOUR} messages). Wait ${Math.ceil(waitTime / 60000)} minutes.`);
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

/**
 * 🔥 MAIN BROADCAST SENDING FUNCTION - CONSERVATIVE MODE V2
 */
async function sendBroadcastMessages(broadcast, userId) {
    console.log(`\n🚀 [BROADCAST] Starting: ${broadcast.name} (${broadcast._id})`);

    // Re-fetch to ensure clean state
    broadcast = await Broadcast.findById(broadcast._id);
    if (!broadcast) return;

    // 🛡️ Pre-check connection
    const waStatus = getWAStatus(userId);
    if (waStatus !== 'connected') {
        console.log(`❌ [BROADCAST] Cannot start: WhatsApp status is ${waStatus}`);
        broadcast.status = 'paused'; // Auto-pause because not connected
        await broadcast.save();
        await notifyBroadcastFailed(userId, broadcast, `WhatsApp disconnected (Status: ${waStatus})`);
        return;
    }

    broadcast.status = 'on-process';
    broadcast.startedAt = new Date();
    await broadcast.save();

    // 🔔 NOTIFY: Broadcast started
    await notifyBroadcastStarted(userId, broadcast);

    let successCount = broadcast.successCount || 0;
    let failedCount = broadcast.failedCount || 0;
    let hasError = false;
    let lastError = null;

    // Find where we left off (if restarting) or start from 0
    const startIndex = broadcast.recipients.findIndex(r => r.status === 'pending');
    // If no pending, maybe all done? check full list if startIndex -1, default 0

    const recipientsToProcess = broadcast.recipients;

    for (let i = 0; i < recipientsToProcess.length; i++) {
        const recipient = recipientsToProcess[i];

        // Skip if already processed
        if (recipient.status !== 'pending') continue;

        const messageNumber = i + 1;

        // Check if paused
        const currentBroadcast = await Broadcast.findById(broadcast._id);
        if (!currentBroadcast || currentBroadcast.status === 'paused') {
            console.log('⏸️ [BROADCAST] Paused by user');
            return;
        }

        console.log(`\n📤 [${messageNumber}/${recipientsToProcess.length}] Sending to: ${recipient.phone}`);

        try {
            // 🛡️ Check connection periodically in loop
            const waStatus = getWAStatus(userId);
            if (waStatus !== 'connected') {
                throw new Error(`WhatsApp disconnected (Status: ${waStatus})`);
            }

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
                        await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY));
                    } else {
                        throw sendError;
                    }
                }
            }

        } catch (error) {
            // 🧪 DECIDE: Fail or Pause?
            // If it's a connection issue, we should pause the campaign
            if (error.message.includes('WhatsApp is not connected') || error.message.includes('WhatsApp disconnected')) {
                console.log(`🛑 [BROADCAST] Stopping loop: ${error.message}`);
                broadcast.status = 'paused';
                await broadcast.save();
                await notifyBroadcastFailed(userId, broadcast, error.message);
                return; // STOP THE LOOP
            }

            recipient.status = 'failed';
            recipient.error = error.message;
            failedCount++;
            hasError = true;
            lastError = error.message;
            updateStats(false);
            console.log(`   ❌ Failed: ${error.message}`);
        }

        // Update broadcast progress in DB
        // Optimization: Update fewer times? For now keep safety.
        await Broadcast.updateOne(
            { _id: broadcast._id, "recipients.phone": recipient.phone },
            {
                $set: {
                    "recipients.$.status": recipient.status,
                    "recipients.$.sentAt": recipient.sentAt,
                    "recipients.$.error": recipient.error,
                },
                $inc: {
                    successCount: recipient.status === 'sent' ? 1 : 0,
                    failedCount: recipient.status === 'failed' ? 1 : 0
                },
                lastRecipientNumber: recipient.phone
            }
        );

        // 🔌 EMIT PROGRESS VIA SOCKET
        try {
            const io = getIO();
            const currentStats = {
                broadcastId: broadcast._id,
                successCount: successCount,
                failedCount: failedCount,
                totalRecipients: recipientsToProcess.length,
                lastRecipient: recipient.phone,
                status: 'on-process'
            };

            // Emit to specific user room if users are partitioned, or just global
            // Since we have userId, we can emit to user room
            io.to(userId).emit('broadcast_progress', currentStats);
            // Also emit globally for now just in case
            io.emit('broadcast_progress', currentStats);
        } catch (socketErr) {
            // Non-critical
        }

        // ⏸️ DELAY BETWEEN MESSAGES
        if (i < recipientsToProcess.length - 1) {
            await safeDelay(messageNumber);

            // 📦 BATCH BREAK
            if (config.BATCH_SIZE && messageNumber % config.BATCH_SIZE === 0) {
                console.log(`\n🛑 BATCH BREAK - Resting for ${config.BATCH_BREAK / 1000}s`);
                await new Promise(resolve => setTimeout(resolve, config.BATCH_BREAK));
            }
        }
    }

    // ✅ UPDATE FINAL STATUS
    const finalStatus = 'completed';
    await Broadcast.findByIdAndUpdate(broadcast._id, {
        status: finalStatus,
        completedAt: new Date(),
        successCount,
        failedCount
    });

    console.log('\n🎉 BROADCAST COMPLETED!');

    // 🔔 NOTIFY: Broadcast completed or failed
    const finalBroadcast = await Broadcast.findById(broadcast._id);
    if (hasError && successCount === 0) {
        await notifyBroadcastFailed(userId, finalBroadcast, lastError);
    } else {
        await notifyBroadcastCompleted(userId, finalBroadcast);
    }
}

// WRAPPER to allow "fire and forget" with error logging
const startBroadcast = (broadcast, userId) => {
    sendBroadcastMessages(broadcast, userId).catch(err => {
        console.error('❌ Broadcast Service Error:', err);
    });
};

// EXPORT STATS GETTER
const getCurrentStats = () => {
    return {
        sentThisHour: broadcastStats.sentThisHour,
        maxPerHour: config.MAX_PER_HOUR,
        sentToday: broadcastStats.sentToday,
        maxPerDay: config.MAX_PER_DAY
    };
};

module.exports = {
    startBroadcast,
    getCurrentStats
};