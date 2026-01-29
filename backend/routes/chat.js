const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const { authenticate } = require('../middleware/auth');
const { getSocket, socketsMap, getContact } = require('../utils/whatsappClient');

// Middleware to ensure user is logged in
router.use(authenticate);

// Helper to normalize JID - extracts phone number only to group conversations correctly
function normalizeJid(jid) {
    if (!jid) return null;

    // Extract before @ symbol
    const beforeAt = jid.split('@')[0];

    // For @lid format: "268165:20864989894@lid" → extract the ID part "268165"
    if (jid.includes('@lid')) {
        // Take the part before the colon if it exists, otherwise the whole thing
        return beforeAt.split(':')[0];
    }

    // For @s.whatsapp.net format: "628xxx@s.whatsapp.net" → extract number
    const beforeColon = beforeAt.split(':')[0];
    let phoneNumber = beforeColon.replace(/\D/g, ''); // Extract digits

    // Ensure format 62xxx (convert 0xxx to 62xxx)
    if (phoneNumber.startsWith('0')) {
        phoneNumber = '62' + phoneNumber.substring(1);
    }

    // Fix for 8xxx -> 628xxx (Indonesia)
    if (phoneNumber.startsWith('8') && phoneNumber.length > 7) {
        phoneNumber = '62' + phoneNumber;
    }

    if (!phoneNumber) {
        // console.warn(`⚠️ Could not extract phone from: "${jid}"`);
        return null;
    }

    return phoneNumber;
}

// ==================== NEW: CHAT STATISTICS ====================
router.get('/stats/daily', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const userId = req.user.id;

        // Date Range
        const endDate = new Date(); // To end of today
        endDate.setHours(23, 59, 59, 999);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        startDate.setHours(0, 0, 0, 0);

        // Aggregate DAILY stats
        const dailyStats = await ChatMessage.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    timestamp: { $gte: startDate, $lte: endDate },
                    fromMe: true // Only count OUTGOING messages for success rate
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: '+07:00' } },
                    total: { $sum: 1 },
                    sent: {
                        $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered', 'read']] }, 1, 0] }
                    },
                    delivered: {
                        $sum: { $cond: [{ $in: ['$status', ['delivered', 'read']] }, 1, 0] }
                    },
                    read: {
                        $sum: { $cond: [{ $eq: ['$status', 'read'] }, 1, 0] }
                    },
                    failed: {
                        $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fill missing dates
        const filledStats = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            // FIXED: Use local date string to match +07:00 aggregation
            // toISOString() uses UTC, which might shift 26th to 25th if time is < 07:00 UTC
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const found = dailyStats.find(s => s._id === dateStr);

            if (found) {
                filledStats.push({
                    date: dateStr,
                    sent: found.total, // Total attempts
                    delivered: found.delivered,
                    read: found.read,
                    failed: found.failed
                });
            } else {
                filledStats.push({ date: dateStr, sent: 0, delivered: 0, read: 0, failed: 0 });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Summary
        const summary = filledStats.reduce((acc, curr) => ({
            totalSent: acc.totalSent + curr.sent,
            totalDelivered: acc.totalDelivered + curr.delivered,
            totalRead: acc.totalRead + curr.read,
            totalFailed: acc.totalFailed + curr.failed
        }), { totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0 });

        summary.deliveryRate = summary.totalSent > 0
            ? ((summary.totalDelivered / summary.totalSent) * 100).toFixed(1)
            : 0;

        summary.readRate = summary.totalSent > 0
            ? ((summary.totalRead / summary.totalSent) * 100).toFixed(1)
            : 0;

        res.json({ success: true, stats: filledStats, summary });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// 1. GET /chats - Get list of conversations
// 1. GET /chats - Get list of conversations
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        // Get all messages
        const allMessages = await ChatMessage.find({ userId })
            .sort({ timestamp: -1 })
            .lean();

        // 1. Load Customers FIRST to build lookup maps
        const Customer = require('../models/Customer');
        let customersByName = new Map();  // name (lowercase) → phone
        let customersByPhone = new Map(); // phone → name
        let jidToPhoneMap = new Map();    // any jid (LID/Phone) → normalized phone

        try {
            const customers = await Customer.find({ createdBy: userId }).select('name phone jids').lean();
            customers.forEach(c => {
                if (c.name && c.phone) {
                    // Extract clean phone
                    let cleanPhone = c.phone.replace(/\D/g, '');
                    // Force 62 format for consistency
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
                    if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

                    customersByName.set(c.name.toLowerCase(), cleanPhone);
                    customersByPhone.set(cleanPhone, c.name);

                    // Add legacy/raw formats to map for robustness
                    customersByPhone.set(c.phone.replace(/\D/g, ''), c.name);

                    // Map the phone JID itself
                    jidToPhoneMap.set(cleanPhone + '@s.whatsapp.net', cleanPhone);

                    // Map all associated JIDs (LIDs etc)
                    if (c.jids && Array.isArray(c.jids)) {
                        c.jids.forEach(jid => {
                            if (jid) jidToPhoneMap.set(jid, cleanPhone);
                        });
                    }
                }
            });
            console.log(`DATA INFO: Loaded ${customers.length} customers for lookup.`);
        } catch (err) {
            console.warn('⚠️ Error loading customers:', err.message);
        }

        // Helper to collect LIDs that need linking
        const lidsToLink = new Map(); // cleanPhone -> set(LIDs)

        // Helper: Resolve any JID to a Canonical Phone Number (or fallback to original JID)
        const resolveToCanonical = (jid) => {
            if (!jid) return 'unknown';

            // 1. Check direct DB map (LID lookup etc)
            if (jidToPhoneMap.has(jid)) {
                return jidToPhoneMap.get(jid);
            }

            // 2. Try extracting from standard JID
            const beforeAt = jid.split('@')[0];
            if (jid.includes('@s.whatsapp.net')) {
                const beforeColon = beforeAt.split(':')[0];
                let phone = beforeColon.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (phone.startsWith('8') && phone.length > 9) phone = '62' + phone;
                return phone;
            }

            // 3. If LID, try to lookup in Baileys Store via getContact
            if (jid.includes('@lid')) {
                const contact = getContact(userId, jid);
                if (contact) {
                    if (contact.name || contact.notify) {
                        const nameKey = (contact.name || contact.notify).toLowerCase();
                        const phoneFromName = customersByName.get(nameKey);
                        if (phoneFromName) {
                            // SELF-HEALING: We found a link via Name!
                            if (!lidsToLink.has(phoneFromName)) {
                                lidsToLink.set(phoneFromName, new Set());
                            }
                            lidsToLink.get(phoneFromName).add(jid);

                            return phoneFromName;
                        }
                    }
                }
            }

            // Fallback for LIDs not in DB or other formats
            return jid;
        };

        // 2. Group Messages by Canonical ID
        const chatsMap = new Map();

        for (const msg of allMessages) {
            const remoteJid = msg.remoteJid;
            if (!remoteJid) continue;

            const canonicalId = resolveToCanonical(remoteJid);

            if (!chatsMap.has(canonicalId)) {
                chatsMap.set(canonicalId, {
                    canonicalId: canonicalId,
                    mainJid: remoteJid,
                    lastMessage: msg,
                    messages: [msg],
                    unreadCount: 0,
                    hasStandardJid: remoteJid.includes('@s.whatsapp.net')
                });
            } else {
                const chat = chatsMap.get(canonicalId);
                chat.messages.push(msg);

                if (!msg.fromMe && msg.status !== 'read') {
                    chat.unreadCount += 1;
                }

                // Update mainJid preference: Prefer @s.whatsapp.net over @lid
                if (!chat.hasStandardJid && remoteJid.includes('@s.whatsapp.net')) {
                    chat.mainJid = remoteJid;
                    chat.hasStandardJid = true;
                }
            }
        }

        // ==================== SELF-HEALING EXECUTION ====================
        if (lidsToLink.size > 0) {
            (async () => {
                for (const [phone, lids] of lidsToLink.entries()) {
                    try {
                        const lidsArray = Array.from(lids);
                        console.log(`🛠️ [SELF-HEAL] Linking LIDs to Customer ${phone}:`, lidsArray);
                        await Customer.updateOne(
                            { phone: { $regex: new RegExp(phone.substring(2)) } },
                            { $addToSet: { jids: { $each: lidsArray } } }
                        );
                    } catch (e) {
                        console.error('Self-heal failed:', e);
                    }
                }
            })();
        }

        // 3. Process grouped chats into final format
        let conversations = Array.from(chatsMap.values()).map(chat => {
            let cleanPhone = chat.canonicalId.match(/^\d+$/) ? chat.canonicalId : null;
            let displayName = null;

            // A. Try Customer DB Name
            if (cleanPhone && customersByPhone.has(cleanPhone)) {
                displayName = customersByPhone.get(cleanPhone);
            }

            // B. Try PushName from incoming messages
            if (!displayName) {
                const incomingMsg = chat.messages.find(m => !m.fromMe && m.pushName && m.pushName !== 'Unknown');
                if (incomingMsg) displayName = incomingMsg.pushName;
            }

            // C. Fallback: Formatted Phone
            if (!displayName && cleanPhone) {
                displayName = `+${cleanPhone}`;
            } else if (!displayName) {
                const contact = getContact(userId, chat.mainJid);
                if (contact && (contact.name || contact.notify)) {
                    displayName = contact.name || contact.notify;
                } else {
                    displayName = 'Unknown Contact';
                }
            }

            // 4. Try to salvage cleanPhone for LIDs/Unsaved contacts
            if (!cleanPhone) {
                // If mainJid is a phone number JID
                if (chat.mainJid.includes('@s.whatsapp.net')) {
                    cleanPhone = chat.mainJid.split('@')[0];
                }
                // Checks contact info for a phone-based JID
                else {
                    const contact = getContact(userId, chat.mainJid);
                    if (contact && contact.id && contact.id.includes('@s.whatsapp.net')) {
                        cleanPhone = contact.id.split('@')[0];
                    }
                }
            }

            // 5. DEEP SCAN: Check message history for leaked phone JIDs
            if (!cleanPhone && chat.messages && chat.messages.length > 0) {
                const phoneMsg = chat.messages.find(m =>
                    (m.key?.remoteJid?.includes('@s.whatsapp.net')) ||
                    (m.key?.participant?.includes('@s.whatsapp.net'))
                );

                if (phoneMsg) {
                    const raw = (phoneMsg.key.remoteJid && phoneMsg.key.remoteJid.includes('@s.whatsapp.net'))
                        ? phoneMsg.key.remoteJid
                        : phoneMsg.key.participant;
                    if (raw) cleanPhone = raw.split('@')[0];
                }
            }

            // 6. LAST RESORT: Fuzzy Name Match
            // If we have a name (e.g. "Rzz") but no phone, check if "Rzz" is part of a saved name 
            if (!cleanPhone && displayName) {
                const searchName = displayName.toLowerCase();
                for (const [savedName, savedPhone] of customersByName.entries()) {
                    if (savedName.includes(searchName) || searchName.includes(savedName)) {
                        // Found a potential match!
                        cleanPhone = savedPhone;
                        // Also update display name to full saved name
                        displayName = customersByName.get(savedPhone) || displayName;
                        break; // Take the first match
                    }
                }
            }

            // Check saved status safely
            let isSaved = !!(cleanPhone && customersByPhone.has(cleanPhone));

            if (!isSaved && displayName) {
                const nameKey = displayName.toLowerCase().trim(); // TRIM to fix whitespace mismatches

                if (customersByName.has(nameKey)) {
                    isSaved = true;
                    console.log(`✅ [MATCH] Found saved contact by name: "${displayName}" -> ${customersByName.get(nameKey)}`);

                    // CRITICAL FIX: Backfill cleanPhone so the UI shows the number!
                    if (!cleanPhone) {
                        cleanPhone = customersByName.get(nameKey);
                    }
                } else {
                    // Debug logging to see why it failed
                    if (displayName.toLowerCase().includes('putri')) {
                        console.log(`❌ [FAIL] Name "${nameKey}" (len=${nameKey.length}) not found. keys in DB:`, Array.from(customersByName.keys()).slice(0, 5));
                    }
                }
            }

            return {
                _id: chat.mainJid,
                cleanPhone: cleanPhone,
                displayName: displayName,
                lastMessage: {
                    content: chat.lastMessage?.content,
                    timestamp: chat.lastMessage?.timestamp,
                    fromMe: chat.lastMessage?.fromMe,
                    pushName: chat.lastMessage?.pushName
                },
                unreadCount: chat.unreadCount,
                isSaved: isSaved,
                // Add new fields for the async resolution step
                conversationId: cleanPhone || chat.canonicalId, // Prefer phone as ID
                lastMessageTime: chat.lastMessage?.timestamp || 0,
                mainJid: chat.mainJid // Keep mainJid for LID check
            };
        });

        // ==================== 🛠️ ASYNC RESOLUTION FOR MISSING NUMBERS ====================
        // For any contact that STILL has no number (LID), try the advanced Active Resolve
        const { resolvePhoneFromLid } = require('../utils/whatsappClient');

        await Promise.all(conversations.map(async (conv) => {
            if (!conv.cleanPhone && conv.mainJid.includes('@lid')) {
                const resolved = await resolvePhoneFromLid(req.user.id, conv.mainJid);
                if (resolved) {
                    console.log(`🎉 [MAGIC] Resolved LID ${conv.mainJid} to PHONE ${resolved}`);
                    conv.cleanPhone = resolved;
                    conv.conversationId = resolved;
                    conv.displayName = `+${resolved}`; // Default to phone if no name

                    // Try to re-match name with this new phone
                    const Customer = require('../models/Customer');
                    const saved = await Customer.findOne({ phone: resolved });
                    if (saved) conv.displayName = saved.name;
                }
            }
        }));

        // ==================== FINAL DEDUPLICATION ====================
        // ==================== FINAL DEDUPLICATION (SMART MERGE) ====================
        const deduplicatedMap = new Map();

        // 1. First Pass: Collect everything by "Best Available Key"
        // Priority: cleanPhone > displayName (lowercase)
        conversations.forEach(conv => {
            const hasPhone = !!conv.cleanPhone;
            const nameKey = conv.displayName ? conv.displayName.toLowerCase().trim() : null;

            // If we have a phone, use it as the PRIMARY key
            if (hasPhone) {
                if (!deduplicatedMap.has(conv.cleanPhone)) {
                    deduplicatedMap.set(conv.cleanPhone, conv);
                } else {
                    // MERGE into existing phone entry
                    const existing = deduplicatedMap.get(conv.cleanPhone);
                    if (new Date(conv.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)) {
                        existing.lastMessage = conv.lastMessage;
                        existing.lastMessageTime = conv.lastMessageTime;
                    }
                    existing.unreadCount += conv.unreadCount;
                    if (conv.isSaved) existing.isSaved = true;
                    // Prefer mainJid with @s.whatsapp.net
                    if (conv.mainJid.includes('@s.whatsapp.net') && !existing.mainJid.includes('@s.whatsapp.net')) {
                        existing.mainJid = conv.mainJid;
                    }
                }
            }
            // If NO Phone, but we have a NAME
            else if (nameKey) {
                // Check if this Name ALREADY exists in our map (from a phone entry)
                // We need to find if any EXISTING entry has this name
                let foundMatch = false;
                for (const [key, existing] of deduplicatedMap.entries()) {
                    if (existing.displayName && existing.displayName.toLowerCase().trim() === nameKey) {
                        // MATCH FOUND BY NAME! Merge this "nameless" chat into the "phone" chat
                        console.log(`🔗 [SMART MERGE] Merging LID-chat "${conv.displayName}" into Phone-chat ${existing.cleanPhone}`);

                        if (new Date(conv.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)) {
                            existing.lastMessage = conv.lastMessage;
                            existing.lastMessageTime = conv.lastMessageTime;
                        }
                        existing.unreadCount += conv.unreadCount;
                        if (conv.isSaved) existing.isSaved = true;
                        foundMatch = true;
                        break;
                    }
                }

                if (!foundMatch) {
                    // No match found yet, store by Name for now
                    // BUT check if we already have a "Name-Only" entry for this name
                    if (!deduplicatedMap.has(nameKey)) {
                        deduplicatedMap.set(nameKey, conv);
                    } else {
                        // Merge duplicates of name-only entries
                        const existing = deduplicatedMap.get(nameKey);
                        if (new Date(conv.lastMessage.timestamp) > new Date(existing.lastMessage.timestamp)) {
                            existing.lastMessage = conv.lastMessage;
                            existing.lastMessageTime = conv.lastMessageTime;
                        }
                        existing.unreadCount += conv.unreadCount;
                    }
                }
            }
            // Fallback: Just use canonicalId
            else {
                deduplicatedMap.set(conv.canonicalId, conv);
            }
        });

        // 🌟 FINAL SAFETY CHECK: Link Unknown LIDs to existing Phones (Cross-Check)
        // Sometimes "Name" isn't available, but we might have a loose link
        // We iterate through the map ONE MORE TIME
        const finalMap = new Map();
        for (const [key, conv] of deduplicatedMap.entries()) {
            // Is this an "Orphan" LID (no phone, just name or ID)?
            if (!conv.cleanPhone && conv.mainJid.includes('@lid')) {
                // Check if we have another chat with the same Display Name that HAS a phone
                // (This handles cases where the first pass didn't catch it due to order)
                let merged = false;
                for (const potentialParent of deduplicatedMap.values()) {
                    if (potentialParent.cleanPhone &&
                        potentialParent.displayName === conv.displayName) {
                        // MERGE!
                        potentialParent.lastMessage = new Date(conv.lastMessage.timestamp) > new Date(potentialParent.lastMessage.timestamp) ? conv.lastMessage : potentialParent.lastMessage;
                        merged = true;
                        break;
                    }
                }
                if (!merged) finalMap.set(key, conv);
            } else {
                finalMap.set(key, conv);
            }
        }

        conversations = Array.from(finalMap.values());

        // Sort by last message timestamp
        conversations.sort((a, b) =>
            (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)
        );

        console.log('✅ Final conversations sent to frontend');
        res.json({ success: true, data: conversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch chats' });
    }
});

// 2. GET /chats/:jid - Get message history
router.get('/:jid', async (req, res) => {
    try {
        const userId = req.user.id;
        const { jid } = req.params;
        const { limit = 50, before } = req.query; // Pagination support

        // Normalize JID to match all variants (e.g., @s.whatsapp.net and @lid)
        const normalizedNumber = normalizeJid(jid);

        const query = {
            userId: userId,
            remoteJid: new RegExp(`^${normalizedNumber}[:\\@]`) // Match all JID formats
        };

        if (before) {
            query.timestamp = { $lt: new Date(before) };
        }

        const messages = await ChatMessage.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json({ success: true, data: messages.reverse() });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
});

// 3. POST /chats/:jid/send - Send a message
router.post('/:jid/send', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const sock = socketsMap.get(userId);
        if (!sock) {
            return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
        }

        let formattedJid = jid;
        // Basic normalization
        if (!formattedJid.includes('@')) {
            formattedJid = formattedJid + '@s.whatsapp.net';
        }

        console.log(`Sending text to ${formattedJid}: ${message}`);

        const sentMsg = await sock.sendMessage(formattedJid, { text: message });

        res.json({
            success: true,
            data: {
                id: sentMsg.key.id,
                status: 'sent',
                timestamp: sentMsg.messageTimestamp
            }
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
    }
});

// ===========================================
// MEDIA UPLOAD SETUP
// ===========================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/media/uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// 4. POST /chats/:jid/send-media - Send Media Message
router.post('/:jid/send-media', upload.single('file'), async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;
        const { caption, type } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'No file uploaded' });
        }

        const sock = socketsMap.get(userId);
        if (!sock) {
            return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
        }

        let formattedJid = jid;
        if (!jid.includes('@')) formattedJid = `${jid}@s.whatsapp.net`;

        console.log(`📤 Sending MEDIA (${type}) to ${formattedJid}`);

        const filePath = file.path;
        let sentMsg;

        // Baileys Send Logic
        if (type === 'image') {
            sentMsg = await sock.sendMessage(formattedJid, {
                image: fs.readFileSync(filePath),
                caption: caption || ''
            });
        } else if (type === 'video') {
            sentMsg = await sock.sendMessage(formattedJid, {
                video: fs.readFileSync(filePath),
                caption: caption || ''
            });
        } else if (type === 'audio') {
            sentMsg = await sock.sendMessage(formattedJid, {
                audio: fs.readFileSync(filePath),
                mimetype: 'audio/mp4',
                ptt: true // True for voice note style
            });
        } else {
            // Document
            sentMsg = await sock.sendMessage(formattedJid, {
                document: fs.readFileSync(filePath),
                mimetype: file.mimetype,
                fileName: file.originalname,
                caption: caption || ''
            });
        }

        console.log('✅ Media sent:', sentMsg.key.id);
        res.json({ success: true, data: { id: sentMsg.key.id, status: 'sent', mediaUrl: `/media/uploads/${file.filename}` } });

    } catch (error) {
        console.error('❌ Error sending media:', error);
        res.status(500).json({ success: false, error: 'Failed to send media' });
    }
});

// 5. POST /chats/:jid/read - Mark Chat as Read
router.post('/:jid/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const { jid } = req.params;

        console.log(`🔹 [READ REQUEST] JID: ${jid} | User: ${userId}`);

        let queryRegex;

        if (jid.includes('@lid')) {
            // For LIDs, extract the User ID part
            const lidUser = jid.split('@')[0].split(':')[0]; // "123" from "123:45@lid"
            queryRegex = new RegExp(`^${lidUser}`);
            console.log(`🔹 [READ] LID detected. Using Regex: ${queryRegex}`);
        } else {
            // For Phone numbers
            const beforeAt = jid.split('@')[0];
            let phone = beforeAt.split(':')[0].replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            if (phone.startsWith('8')) phone = '62' + phone;

            queryRegex = new RegExp(`^${phone}`);
            console.log(`🔹 [READ] Phone detected. Using Regex: ${queryRegex}`);
        }

        // 2. Build Query to update ALL messages from this "Contact"
        const query = {
            userId: userId,
            remoteJid: { $regex: queryRegex },
            fromMe: false,
            status: { $ne: 'read' }
        };

        // 3. Update DB
        const result = await ChatMessage.updateMany(query, { status: 'read' });

        console.log(`✅ [READ] Marked ${result.modifiedCount} messages as read for ${jid} (Regex: ${queryRegex})`);
        res.json({ success: true, count: result.modifiedCount });

    } catch (error) {
        console.error('❌ Error marking read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark read' });
    }
});

// Original Send Text Endpoint (Moved down or kept logic)
// [REMOVED DUPLICATE SEND/READ HANDLERS]

// Delete chat history
router.delete('/:jid', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;

        // Normalize JID to delete all variants
        const normalizedNumber = normalizeJid(jid);

        // Delete duplicates based on regex search for the normalized number or original keys
        await ChatMessage.deleteMany({
            userId,
            $or: [
                { remoteJid: new RegExp(`^${normalizedNumber}[:\\@]`) },
                { remoteJid: jid }
            ]
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ success: false, error: 'Failed' });
    }
});

module.exports = router;
