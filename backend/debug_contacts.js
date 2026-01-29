const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        runDebug();
    })
    .catch(err => console.error('❌ Connection failed:', err));

async function runDebug() {
    try {
        const Customer = require('./models/Customer');
        const ChatMessage = require('./models/ChatMessage');

        // 1. DUMP CUSTOMERS (Focus on "Putri")
        console.log('\n🔍 --- SEARCHING CUSTOMERS (Name like "Putri") ---');
        const customers = await Customer.find({ name: { $regex: 'Putri', $options: 'i' } });
        console.log(`Found ${customers.length} customers:`);
        customers.forEach(c => {
            console.log(`- [${c.name}] Phone: ${c.phone}, JIDs: ${c.jids ? c.jids.join(', ') : 'None'}`);
        });

        // 2. DUMP RECENT MESSAGES (To find the JID being used)
        console.log('\n🔍 --- RECENT MESSAGES FROM "Putri" (PushName) ---');
        const messages = await ChatMessage.find({ pushName: { $regex: 'Putri', $options: 'i' } })
            .sort({ timestamp: -1 })
            .limit(5);

        console.log(`Found ${messages.length} messages:`);
        messages.forEach(m => {
            console.log(`- [${m.pushName}] JID: ${m.remoteJid}, Status: ${m.status}, Content: ${m.content.substring(0, 30)}...`);
        });

    } catch (err) {
        console.error('Debug Error:', err);
    } finally {
        mongoose.disconnect();
    }
}
