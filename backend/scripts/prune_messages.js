const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load env manually to avoid path/dotenv issues
let MONGO_URI = 'mongodb://127.0.0.1:27017/zabran_broadcast';
try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/MONGODB_URI=(.+)/);
        if (match && match[1]) {
            MONGO_URI = match[1].trim();
            // console.log('✅ [PRUNE] Found URI in .env');
        }
    }
} catch (e) {
    console.warn('⚠️ [PRUNE] Manual .env read failed:', e);
}

const ChatMessage = require('../models/ChatMessage');

const PRUNE_DAYS = 90;

async function pruneMessages(isScheduled = false) {
    try {
        if (!isScheduled) {
            console.log('🧹 [PRUNE] Connecting to DB...'); // URI: ' + MONGO_URI
            if (mongoose.connection.readyState === 0) {
                await mongoose.connect(MONGO_URI);
            }
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - PRUNE_DAYS);

        console.log(`🧹 [PRUNE] Cutoff Date: ${cutoffDate.toISOString()} (${PRUNE_DAYS} days ago)`);

        // Count First
        const count = await ChatMessage.countDocuments({ timestamp: { $lt: cutoffDate } });
        console.log(`🧹 [PRUNE] Found ${count} messages to delete.`);

        if (count > 0) {
            const result = await ChatMessage.deleteMany({ timestamp: { $lt: cutoffDate } });
            console.log(`✅ [PRUNE] Success! Deleted ${result.deletedCount} old messages.`);
        } else {
            console.log('✅ [PRUNE] Database is clean.');
        }

        if (!isScheduled) process.exit(0);

    } catch (err) {
        console.error('❌ [PRUNE] Error:', err);
        if (!isScheduled) process.exit(1);
    }
}

if (require.main === module) {
    pruneMessages(false);
}

module.exports = pruneMessages;
