const mongoose = require('mongoose');
const path = require('path');
// Load .env explicitly
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const run = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        console.log('Using URI:', uri ? uri.substring(0, 20) + '...' : 'UNDEFINED');

        if (!uri) {
            console.error('❌ NO MONGO URI FOUND IN .env');
            process.exit(1);
        }

        await mongoose.connect(uri);
        console.log('✅ Connected to DB');

        const ChatMessage = require('./models/ChatMessage');

        // Search for Audio or Image messages OR Transcribed messages
        const msgs = await ChatMessage.find({
            $or: [
                { messageType: 'audio' },
                { messageType: 'image' },
                { content: { $regex: '🎤' } },
                { content: { $regex: 'GAMBAR' } }
            ]
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        console.log(`\n--- FOUND ${msgs.length} MEDIA MESSAGES ---`);
        msgs.forEach(m => {
            console.log(`\n[${m.timestamp ? m.timestamp.toISOString() : 'No Date'}]`);
            console.log(`   Type: ${m.messageType}`);
            console.log(`   Content: ${m.content}`);
        });

        process.exit(0);
    } catch (e) {
        console.error('Script Error:', e);
        process.exit(1);
    }
};

run();
