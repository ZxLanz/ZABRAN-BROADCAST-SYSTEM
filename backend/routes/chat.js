const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const { authenticate } = require('../middleware/auth');
const { getSocket, socketsMap, getContact, getContactName, getProfilePicture } = require('../utils/whatsappClient');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

// Middleware to ensure user is logged in
router.use(authenticate);

// Helper to normalize JID - extracts phone number only to group conversations correctly
function normalizeJid(jid) {
    if (!jid) return null;

    // ✅ NEW: Handle Abstract LID (LID:12345)
    if (jid.startsWith('LID:')) {
        return jid.split(':')[1];
    }

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

// DEBUG: Check Store Status
router.get('/debug-store', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { getStore } = require('../utils/whatsappClient');
        const store = getStore(userId);

        if (!store) {
            return res.status(404).json({ success: false, message: 'Store not found', userId });
        }

        const contacts = store.contacts ? Object.values(store.contacts) : [];
        const chats = store.chats ? store.chats.all() : [];

        const contactSummary = contacts.slice(0, 10).map(c => ({
            id: c.id,
            name: c.name,
            notify: c.notify,
            verifiedName: c.verifiedName
        }));

        res.json({
            success: true,
            counts: {
                contacts: contacts.length,
                chats: chats.length
            },
            sampleContacts: contactSummary
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 1. GET /chats - Get list of conversations (OPTIMIZED WITH AGGREGATION)
router.get('/', async (req, res) => {
    try {
        const userId = String(req.user.id); // ✅ FIX: Ensure String for Map lookup
        console.log(`🚀 [DEBUG] GET /chats HIT. UserID: ${userId}`);
        const startTime = Date.now();

        // 1. Load Customers for Lookup (Optimized: Select only needed fields)
        const Customer = require('../models/Customer');
        let customersByName = new Map();  // name (lowercase) → phone
        let customersByPhone = new Map(); // phone → name
        // ✅ 1b. Build Map from WhatsApp Store (Memory) - CRITICAL for LIDs/Phones
        let jidToPhoneMap = new Map();

        try {
            const clientUtils = require('../utils/whatsappClient');
            if (clientUtils && clientUtils.storesMap) {
                const store = clientUtils.storesMap.get(userId);

                if (store) {
                    const contactCount = store.contacts ? Object.keys(store.contacts).length : 0;
                    console.log(`📦 [DEBUG] Store FOUND. Contacts: ${contactCount}`);
                } else {
                    console.warn(`⚠️ [DEBUG] Store NOT FOUND for UserID: ${userId}`);
                    console.log(`ℹ️ [DEBUG] Available Keys in storesMap:`, Array.from(clientUtils.storesMap.keys()));
                }

                if (store && store.contacts) {
                    Object.values(store.contacts).forEach(c => {
                        // Normalize standard phone JID
                        const standardJid = c.id && c.id.includes('@s.whatsapp.net') ? c.id : null;
                        const lidJid = c.lid || (c.id && c.id.includes('@lid') ? c.id : null);

                        let phone = null;

                        // If we have a standard JID, extract the phone
                        if (standardJid) {
                            const parts = standardJid.split('@')[0];
                            phone = parts.replace(/\D/g, ''); // 628xxx
                            if (phone.startsWith('0')) phone = '62' + phone.substring(1);

                            // Map JID to Phone
                            jidToPhoneMap.set(standardJid, phone);
                            customersByPhone.set(phone, c.name || c.notify || c.verify || 'Unknown');
                        }

                        // If we have a LID, link it to the phone (if known)
                        if (lidJid) {
                            // If we resolved phone from standardJid, link LID -> Phone
                            if (phone) {
                                jidToPhoneMap.set(lidJid, phone);
                            } else {
                                // If LID is standalone, we might be able to link it later via name match
                            }
                        }

                        // Map Names to Phone (Allow fuzzy lookup)
                        if (phone) {
                            const validName = c.name || c.notify;
                            if (validName) {
                                customersByName.set(validName.toLowerCase().trim(), phone);
                            }
                        }
                    });
                }
            } // Close clientUtils check
        } catch (e) {
            console.error('Store Map Error:', e);
        }

        try {
            const customers = await Customer.find({ createdBy: userId }).select('name phone jids').lean();

            // ✅ HELPER: Sanitize Name (Remove Emojis & Symbols for Matching)
            const sanitizeName = (str) => {
                if (!str) return '';
                return str.toLowerCase()
                    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '') // Emojis
                    .replace(/[^a-z0-9]/g, ''); // Only alphanumeric
            };

            customers.forEach(c => {
                if (c.name && c.phone) {
                    let cleanPhone = c.phone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.substring(1);
                    if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

                    // 1. Literal Match
                    customersByName.set(c.name.toLowerCase(), cleanPhone);
                    // 2. Sanitized Match (e.g. "rasya𖣂" -> "rasya")
                    const simpleName = sanitizeName(c.name);
                    if (simpleName.length > 2) { // Only if reasonably distinctive
                        customersByName.set(simpleName, cleanPhone);
                    }

                    customersByPhone.set(cleanPhone, c.name);

                    // Map legacy/raw formats
                    customersByPhone.set(c.phone.replace(/\D/g, ''), c.name);

                    // Map JIDs
                    jidToPhoneMap.set(cleanPhone + '@s.whatsapp.net', cleanPhone);
                    if (c.jids && Array.isArray(c.jids)) {
                        c.jids.forEach(jid => {
                            if (jid) {
                                jidToPhoneMap.set(jid, cleanPhone);
                                if (jid.includes('@lid')) {
                                    // Handle both full LID and generic LID
                                    jidToPhoneMap.set(jid, cleanPhone);
                                    const lidUser = jid.split('@')[0].split(':')[0];
                                    jidToPhoneMap.set(`LID:${lidUser}`, cleanPhone);
                                }
                            }
                        });
                    }
                }
            });
        } catch (err) {
            console.warn('⚠️ Error loading customers:', err.message);
        }

        // 2. AGGREGATION PIPELINE (High Performance)
        // Instead of loading 10k messages, we group them by JID in the DB
        const aggregatedChats = await ChatMessage.aggregate([
            {
                $match: {
                    userId: userId,
                    messageType: { $nin: ['protocol', 'senderKeyDistribution', 'unknown'] },
                    remoteJid: { $not: { $regex: /broadcast|@g\.us/ } }
                }
            },
            { $sort: { timestamp: -1 } }, // Sort first to get latest message
            {
                $group: {
                    _id: "$remoteJid",
                    // ⚡ OPTIMIZATION: Only keep needed fields to save RAM
                    lastMessage: {
                        $first: {
                            content: "$content",
                            messageType: "$messageType",
                            timestamp: "$timestamp",
                            status: "$status",
                            fromMe: "$fromMe",
                            pushName: "$pushName",
                            mediaUrl: "$mediaUrl",
                            msgId: "$msgId"
                        }
                    },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$fromMe", false] }, { $ne: ["$status", "read"] }] },
                                1,
                                0
                            ]
                        }
                    },
                    lastMessageTime: { $first: "$timestamp" }
                }
            }
        ]).sort({ lastMessageTime: -1 }).limit(req.query.limit ? parseInt(req.query.limit) : 50).option({ allowDiskUse: true }); // ✅ Added Limit & Sort

        console.log(`📊 [PERF] DB Aggregation took ${Date.now() - startTime}ms.`);
        console.log(`📊 [PERF] Chat Groups Found: ${aggregatedChats.length}`);

        // =========================================================
        // ✅ NEW: CLEAN RUNTIME (Merge on Write Standard)
        // No more complex fuzzy merging. We trust the Database Migration.
        // =========================================================

        const finalChats = await Promise.all(aggregatedChats.map(async chat => {
            const rawJid = chat._id;

            // 1. Basic Resolution
            let cleanPhone = null;

            // Strict Phone Extraction (since we normalize upstream now)
            if (rawJid.includes('@s.whatsapp.net')) {
                cleanPhone = rawJid.split('@')[0];
            } else if (rawJid.includes('@lid')) {
                // Should have been normalized, but if not, try map
                if (jidToPhoneMap.has(rawJid)) {
                    cleanPhone = jidToPhoneMap.get(rawJid);
                }
            }

            // 2. Resolve Names (Fast Map Lookup)
            let displayName = null;
            let isSaved = false;

            // A. Try DB Map by Phone
            if (cleanPhone && customersByPhone.has(cleanPhone)) {
                displayName = customersByPhone.get(cleanPhone);
                isSaved = true;
            }

            // B. Try Baileys Store (In-Memory Cache)
            let storePushName = null;
            if (!displayName) {
                try {
                    const store = require('../utils/whatsappClient').getStore(userId);
                    if (store && store.contacts) {
                        // ✅ FIX: Access contacts as object, not Map
                        const contact = store.contacts[rawJid] || (store.contacts.get && store.contacts.get(rawJid));

                        if (contact) {
                            // ✅ USER REQUEST: Logic "Ambil dari WA langsung (Saved)" -> "Ambil PushName (Bio)" 
                            // Priority: 
                            // 1. Zabran DB (Already checked above) -> displayName set
                            // 2. WhatsApp Saved Name (contact.name)
                            // 3. WhatsApp Push Name (contact.notify)

                            const waSavedName = contact.name; // Name saved in phone book
                            const waPushName = contact.notify || contact.verifiedName; // Name in their profile

                            if (!displayName && waSavedName) {
                                displayName = waSavedName;
                                console.log(`📛 [NAME] ${rawJid} → "${displayName}" (source: whatsapp_saved)`);
                            }

                            if (waPushName) {
                                storePushName = waPushName;
                                if (!displayName) {
                                    displayName = waPushName;
                                    console.log(`📛 [NAME] ${rawJid} → "${displayName}" (source: push_name)`);
                                }
                            }
                        }
                    }
                } catch (e) { }
            }

            // C. Try PushName from Message (ONLY IF NOT FROM ME or System)
            // 🛑 FIX: Prevent showing own pushname ("Lord Zilan") for other chats
            let safePushName = null;

            // ✅ DEBUG: Check Message Props
            if (chat.lastMessage) {
                const isMsgFromMe = chat.lastMessage.fromMe === true || chat.lastMessage.fromMe === "true";
                // console.log(`🔍 [MSG CHECK] ${rawJid} | fromMe: ${chat.lastMessage.fromMe} (${isMsgFromMe}) | push: ${chat.lastMessage.pushName}`);

                if (!isMsgFromMe && chat.lastMessage.pushName && chat.lastMessage.pushName !== 'Unknown') {
                    // Extra safety: Don't use if it matches current user name logic (Lord Zilan)
                    // But we don't know my pushName here easily. 
                    // Just relying on !fromMe should be enough IF fromMe is correct.
                    safePushName = chat.lastMessage.pushName;
                }
            }

            // ✅ FALLBACK: If message didn't have pushName, use Store's notify
            if (!safePushName && storePushName) {
                safePushName = storePushName;
            }

            if (!displayName && safePushName) {
                displayName = safePushName;
                console.log(`📛 [NAME] ${rawJid} → "${displayName}" (source: last_msg_push)`);
            }

            // D. Fallback
            if (!displayName && cleanPhone) {
                displayName = cleanPhone;
                console.log(`📛 [NAME] ${rawJid} → "${displayName}" (source: phone_fallback)`);
            }

            if (!displayName) {
                displayName = "Unknown Contact";
            }

            // E. Fetch Profile Picture
            let profilePicUrl = null;
            try {
                const { getProfilePicture } = require('../utils/whatsappClient');
                profilePicUrl = await getProfilePicture(userId, rawJid);
            } catch (e) { }

            return {
                _id: rawJid,
                canonicalId: cleanPhone || rawJid,
                mainJid: rawJid,

                lastMessage: chat.lastMessage,
                lastMessageTime: chat.lastMessageTime,
                unreadCount: chat.unreadCount,

                displayName: displayName,
                phone: cleanPhone,
                cleanPhone: cleanPhone,
                isSaved: isSaved,
                pushName: safePushName, // ✅ Use safe pushName (now reinforced by Store)
                profilePictureUrl: profilePicUrl
            };
        }));

        // =========================================================
        // ✅ 3. MERGE & DEDUPLICATE (The Fix for Split Chats)
        // =========================================================
        const mergedChatsMap = new Map();

        finalChats.forEach(chat => {
            // Identifier: Use cleanPhone if available, otherwise rawJid
            // If cleanPhone is available, all LIDs/Aliases for that number will merge here.
            const key = chat.cleanPhone || chat.mainJid;

            // 🚨 STRICT FILTER: Hide Unresolved LIDs logic
            // User Request: "Jangan ada LID" (Do not show LID)
            // If we have no phone number and it's a raw LID, SKIP IT.
            if (!chat.cleanPhone && chat.mainJid.includes('@lid')) {
                // console.log(`👻 [FILTER] Hiding unresolved LID: ${chat.mainJid}`);
                return;
            }

            if (mergedChatsMap.has(key)) {
                // Merge Logic
                const existing = mergedChatsMap.get(key);

                // A. Prefer the entry that has a Real Name (not just number)
                if (existing.displayName === existing.cleanPhone && chat.displayName !== chat.cleanPhone) {
                    existing.displayName = chat.displayName;
                }

                // B. Prefer the entry that has a Profile Pic
                if (!existing.profilePictureUrl && chat.profilePictureUrl) {
                    existing.profilePictureUrl = chat.profilePictureUrl;
                }

                // C. Take the LATEST message time
                if (new Date(chat.lastMessageTime) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = chat.lastMessage;
                    existing.lastMessageTime = chat.lastMessageTime;
                }

                // D. Sum Unread Counts
                existing.unreadCount += chat.unreadCount;

                // E. Ensure Main JID is the Phone JID (Priority)
                if (chat.mainJid.includes('@s.whatsapp.net')) {
                    existing.mainJid = chat.mainJid;
                    existing._id = chat.mainJid;
                }

            } else {
                mergedChatsMap.set(key, chat);
            }
        });

        const dedupedChats = Array.from(mergedChatsMap.values());

        // Final Sort
        dedupedChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        console.log(`✅ [GET /chats] Returned ${dedupedChats.length} conversations (Merged from ${finalChats.length}, took ${Date.now() - startTime}ms)`);
        res.json({ success: true, data: dedupedChats });

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

        console.log(`🔍 [GET /messages] Request: ${jid} -> Normalized: ${normalizedNumber}`);

        // 🚀 SMART HISTORY LOOKUP (All-JID Capture)
        // User Request: "JANGAN SAMPAI ADA YANG LOLOS"
        // Strategy: Convert JID -> Phone -> Query ALL JIDs associated with that Phone.

        let targetPhone = normalizedNumber;

        // Safety: If normalizedNumber is null/weird, try strict extraction
        if (!targetPhone || targetPhone.includes('@')) {
            targetPhone = jid.replace(/\D/g, '');
            if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.substring(1);
        }

        console.log(`🔍 [GET /messages] Locking Target: ${targetPhone} (Original: ${jid})`);

        // 3. Build Query - THE "DRAGNET" QUERY
        // Matches:
        // 1. Exact Remote JID (Legacy)
        // 2. Extracted Phone Field (New Standard)
        // 3. Regex Match for Number (Covers @s.whatsapp.net AND @lid if phone is embedded)
        // 4. Participant Match (For group messages from this user)

        // 3. Build Query - THE "DRAGNET" QUERY
        // Matches:
        // 1. Exact Remote JID (Legacy)
        // 2. Extracted Phone Field (New Standard)
        // 3. Regex Match for Number (Covers @s.whatsapp.net AND @lid if phone is embedded)
        // 4. Participant Match (For group messages from this user)

        const orConditions = [
            { remoteJid: jid },
            { extractedPhone: targetPhone }
        ];

        // 🛡️ REGEX SAFETY: Only use Regex if targetPhone is long enough (avoid matching "62" against everyone)
        if (targetPhone && targetPhone.length >= 10) {
            orConditions.push({ remoteJid: { $regex: targetPhone } });
            orConditions.push({ participant: { $regex: targetPhone } });
        }

        const query = {
            userId: userId,
            $or: orConditions,
            // Limit to 3 months (Optimized)
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        };

        // Pagination
        if (before) {
            query.timestamp = {
                $lt: new Date(before),
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
            };
        }

        // 4. Execute Query
        const messages = await ChatMessage.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .lean();

        // 5. Post-Process: Attach Names
        const messagesWithNames = messages.map(msg => {
            let senderName = msg.pushName || 'Unknown';
            // ✅ FIX: Safety check for msg.key (some migrated messages might lack it)
            if (msg.key && msg.key.fromMe) senderName = 'Me';
            // If fromMe is true directly on the object (legacy)
            if (msg.fromMe) senderName = 'Me';

            return {
                ...msg,
                senderName: senderName,
                pushName: msg.pushName // ✅ Explicitly send PushName
            };
        });

        res.json({
            success: true,
            data: messagesWithNames.reverse(),
            debug: { targetPhone, found: messages.length, sources: ['JID', 'Phone', 'LID'] }
        });

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
        const { message, quotedMsgId } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const sock = socketsMap.get(userId);
        if (!sock) {
            return res.status(400).json({ success: false, error: 'WhatsApp not connected' });
        }

        let formattedJid = jid;

        // 🚨 HANDLE ABSTRACT LID (FROM MERGED CHATS)
        if (formattedJid.startsWith('LID:')) {
            const targetUser = formattedJid.split(':')[1];
            // Resolve to active JID via DB
            const ChatMessage = require('../models/ChatMessage');
            const latestMsg = await ChatMessage.findOne({
                userId,
                remoteJid: { $regex: new RegExp('^' + targetUser + '[:\@]') }
            }).sort({ timestamp: -1 });

            if (latestMsg) {
                formattedJid = latestMsg.remoteJid;
                console.log(`✅ [SEND] Resolved Abstract LID to: ${formattedJid}`);
            } else {
                formattedJid = `${targetUser}@s.whatsapp.net`; // Fallback
                console.warn(`⚠️ [SEND] Could not resolve device, trying phone: ${formattedJid}`);
            }
        } else if (!formattedJid.includes('@')) {
            formattedJid = formattedJid + '@s.whatsapp.net';
        }

        console.log(`Sending text to ${formattedJid}: ${message} ${quotedMsgId ? `(Reply to: ${quotedMsgId})` : ''}`);

        // ✅ HANDLE QUOTED MESSAGE (REPLY)
        let quotedMsg = undefined;
        if (quotedMsgId) {
            try {
                const store = require('../utils/whatsappClient').getStore(userId);
                if (store) {
                    // Try to load from store
                    const loaded = await store.loadMessage(formattedJid, quotedMsgId);
                    if (loaded) {
                        quotedMsg = loaded;
                        console.log(`✅ [REPLY] Found quoted message in Store`);
                    } else {
                        console.warn(`⚠️ [REPLY] Quoted message ${quotedMsgId} not found in Store`);
                    }
                }
            } catch (err) {
                console.error('Error loading quoted message:', err);
            }
        }

        const sentMsg = await sock.sendMessage(formattedJid, { text: message }, { quoted: quotedMsg });

        // ✅ MANUAL SAVE: Ensure message is saved immediately to DB (don't wait for upsert)
        const ChatMessage = require('../models/ChatMessage');

        let extractedPhone = null;
        if (formattedJid.includes('@')) {
            const parts = formattedJid.split('@')[0].split(':')[0];
            extractedPhone = parts.replace(/\D/g, ''); // Extract digits
        }

        const newMessage = {
            userId: userId,
            remoteJid: formattedJid,
            fromMe: true,
            msgId: sentMsg.key.id,
            messageType: 'conversation', // Usually 'conversation' for text
            content: message,
            status: 'sent', // Initially sent
            timestamp: new Date(),
            pushName: 'Me', // System sent
            extractedPhone: extractedPhone
        };

        await ChatMessage.findOneAndUpdate(
            { msgId: sentMsg.key.id }, // Check existence just in case upsert fires fast
            newMessage,
            { upsert: true, new: true }
        );

        console.log(`💾 [API] Saved sent message ${sentMsg.key.id} to DB manually.`);

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

        let filePath = file.path;
        let sentMsg;
        let finalMime = file.mimetype;
        let cleanupPath = null;

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
            // ✅ FFmpeg Conversion for Voice Note
            console.log(`🎙️ [AUDIO] Converting to Opus: ${filePath}`);

            const convertToOpus = (input) => {
                return new Promise((resolve, reject) => {
                    const output = input + '.ogg';
                    ffmpeg(input)
                        .audioCodec('libopus')
                        .toFormat('ogg')
                        .on('error', (err) => reject(err))
                        .on('end', () => resolve(output))
                        .save(output);
                });
            };

            try {
                const opusPath = await convertToOpus(filePath);
                filePath = opusPath;
                finalMime = 'audio/ogg; codecs=opus';
                cleanupPath = opusPath; // Mark for deletion if needed
                console.log(`✅ [AUDIO] Converted successfully: ${opusPath}`);

                sentMsg = await sock.sendMessage(formattedJid, {
                    audio: fs.readFileSync(filePath),
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                });
            } catch (convertErr) {
                console.error('❌ [AUDIO] Conversion failed, sending original:', convertErr);
                // Fallback to original
                sentMsg = await sock.sendMessage(formattedJid, {
                    audio: fs.readFileSync(filePath),
                    mimetype: 'audio/mp4',
                    ptt: true
                });
            }

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

// 6. POST /chats/:jid/react - Send Reaction
router.post('/:jid/react', async (req, res) => {
    try {
        const userId = String(req.user.id);
        const { jid } = req.params;
        const { emoji, msgId, fromMe, participant } = req.body;

        if (!msgId) {
            return res.status(400).json({ success: false, error: 'Message ID (msgId) is required' });
        }

        const { sendReaction } = require('../utils/whatsappClient');

        // Construct Key
        // If it's a group, participant is needed. If private, remoteJid is enough.
        // We need to know who we are reacting TO (the target message key)
        const targetKey = {
            remoteJid: jid.includes('@') ? jid : jid + '@s.whatsapp.net',
            fromMe: fromMe === true || fromMe === 'true',
            id: msgId
        };

        if (participant) {
            targetKey.participant = participant;
        }

        const formattedJid = targetKey.remoteJid;

        await sendReaction(userId, formattedJid, targetKey, emoji);

        res.json({ success: true, message: 'Reaction sent' });

    } catch (error) {
        console.error('Error sending reaction:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. POST /chats/:jid/read - Mark Chat as Read (SMART LID/PHONE HANDLE)
router.post('/:jid/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const { jid } = req.params;

        // 1. Normalize the Input JID (extracted phone)
        const normalizedNumber = normalizeJid(jid);
        if (!normalizedNumber) {
            return res.status(400).json({ success: false, error: 'Invalid JID' });
        }

        // 2. Find ALL JIDs associated with this contact (Phone + LIDs)
        const start = Date.now();
        let targetJids = [
            new RegExp(`^${normalizedNumber}@s\\.whatsapp\\.net`),
            new RegExp(`^${normalizedNumber}:`),
            new RegExp(`^${normalizedNumber}$`)
        ];

        // ✅ 2b. Check Memory Store (For unsaved contacts like 'rasya')
        try {
            const { storesMap } = require('../utils/whatsappClient');
            const store = storesMap.get(userId);
            if (store && store.contacts) {
                // Find contact by Phone JID, get LID
                const phoneJid = normalizedNumber + '@s.whatsapp.net';
                const contact = store.contacts[phoneJid];
                if (contact && contact.lid) {
                    targetJids.push(contact.lid);
                    // console.log(`🔗 [READ-SYNC] Found LID via Memory: ${contact.lid}`);
                }
            }
        } catch (e) { }

        try {
            const Customer = require('../models/Customer');
            const customer = await Customer.findOne({
                $or: [
                    { phone: normalizedNumber },
                    { jids: jid },
                    { jids: { $regex: new RegExp('^' + normalizedNumber + ':') } } // Handle LID:123
                ]
            });

            if (customer) {
                if (customer.phone) {
                    let p = customer.phone.replace(/\D/g, '');
                    if (p.startsWith('0')) p = '62' + p.substring(1);
                    // Add both exact phone and regex pattern for phone
                    targetJids.push(p + '@s.whatsapp.net');
                    targetJids.push(new RegExp(`^${p}@s\\.whatsapp\\.net`));
                }

                if (customer.jids && customer.jids.length > 0) {
                    customer.jids.forEach(j => {
                        if (j) targetJids.push(j);
                    });
                }
            }
        } catch (err) {
            console.error('Error resolving customer for read:', err);
        }

        // 2b. Include explicit JIDs passed from frontend (for merged chats)
        if (req.body.jids && Array.isArray(req.body.jids)) {
            req.body.jids.forEach(j => targetJids.push(j));
            // console.log(`🔗 [READ-SYNC] Added explicit JIDs: ${req.body.jids.join(', ')}`);
        }

        // 3. Build Query
        const query = {
            userId: new mongoose.Types.ObjectId(userId), // ✅ HARDENED: Explicit Cast
            remoteJid: { $in: targetJids }, // Match ANY of the known JIDs
            fromMe: false,
            status: { $ne: 'read' }
        };

        // 4. FETCH Unread Messages
        const unreadMessages = await ChatMessage.find(query)
            .select('msgId remoteJid')
            .limit(100);

        if (unreadMessages.length > 0) {
            // 5. Send Read Receipt to WhatsApp
            const sock = socketsMap.get(userId);
            if (sock) {
                const keys = unreadMessages.map(m => ({
                    remoteJid: m.remoteJid,
                    id: m.msgId,
                    fromMe: false
                }));

                await sock.readMessages(keys);
                console.log(`✅ [WA SYNC] Sent read receipts for ${keys.length} msgs (Phone: ${normalizedNumber})`);
            }

            // 6. Update DB Status
            const result = await ChatMessage.updateMany(
                { _id: { $in: unreadMessages.map(m => m._id) } },
                { status: 'read' }
            );

            console.log(`✅ [DB] Marked ${result.modifiedCount} msgs as read (Time: ${Date.now() - start}ms)`);
            res.json({ success: true, count: result.modifiedCount });
        } else {
            res.json({ success: true, count: 0 });
        }

    } catch (error) {
        console.error('❌ Error marking read:', error);
        res.status(500).json({ success: false, error: 'Failed to mark read' });
    }
    // Original Send Text Endpoint (Moved down or kept logic)
    // [REMOVED DUPLICATE SEND/READ HANDLERS]

});

// [REMOVED DUPLICATE]

// 6. DELETE /chats/:jid - Clear chat history (Hard Delete)
router.delete('/:jid', async (req, res) => {
    try {
        const userId = req.user.id;
        const { jid } = req.params;

        // Normalize JID to Phone for broad deletion
        let targetPhone = normalizeJid(jid);

        // Final safety cleanup of the phone string
        if (targetPhone && targetPhone.includes('@')) {
            targetPhone = targetPhone.replace(/\D/g, '');
            if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.substring(1);
        }

        console.log(`🗑️ [DELETE] Hard Deleting Chat: ${jid} (Target Phone: ${targetPhone})`);

        // 1. Delete Messages (The Root Cause of "Zombie Chats")
        // We delete ANY message that matches this phone number or JID
        const msgQuery = {
            userId: userId,
            $or: [
                { remoteJid: jid },
                { extractedPhone: targetPhone },
                { remoteJid: { $regex: targetPhone } }
            ]
        };

        const deleteResult = await ChatMessage.deleteMany(msgQuery);
        console.log(`   🔥 Deleted ${deleteResult.deletedCount} messages.`);

        res.json({ success: true, count: deleteResult.deletedCount });

    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ success: false, error: 'Failed to delete chat' });
    }
});

// 7. POST /messages/:msgId/download - Download Media Manual
router.post('/messages/:msgId/download', async (req, res) => {
    try {
        const userId = req.user.id;
        const { msgId } = req.params;
        const { remoteJid } = req.body; // Needed to find message in Baileys store/DB

        console.log(`📥 [DOWNLOAD] Request for msg: ${msgId} (Chat: ${remoteJid})`);

        const ChatMessage = require('../models/ChatMessage');
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const { getSocket, getStore } = require('../utils/whatsappClient');
        const fs = require('fs');
        const path = require('path');

        // 1. Find Message in DB to get keys
        const msg = await ChatMessage.findOne({ msgId: msgId });

        if (!msg) {
            return res.status(404).json({ success: false, error: 'Message not found in DB' });
        }

        // 2. Reconstruct Message Object for Baileys
        // We need the full message object (including media keys) to download
        // Since we only save partial data to DB, we might need to fetch from Store OR rely on what we saved.
        // ERROR: DB usually doesn't store the full 'message' object required for decryption.
        // STRATEGY: Try to find in Store first.

        let messageToDownload = null;
        const store = getStore(userId);

        if (store) {
            // Try to load message
            try {
                const loadedMsg = await store.loadMessage(remoteJid, msgId);
                if (loadedMsg) {
                    messageToDownload = loadedMsg;
                }
            } catch (e) {
                console.warn('Store load failed:', e);
            }
        }

        // If not in store, we can't accept generic download unless we stored the mediaKey (which we likely didn't in this simplified DB)
        // BUT, if the file is already in mediaUrl from previous auto-download, just return that.
        if (msg.mediaUrl) {
            return res.json({ success: true, url: msg.mediaUrl, type: 'cached' });
        }

        if (!messageToDownload) {
            return res.status(400).json({ success: false, error: 'Message data not found in memory. Cannot decrypt media.' });
        }

        // 3. Download
        const buffer = await downloadMediaMessage(
            messageToDownload,
            'buffer',
            {},
            { logger: console } // Pass logger
        );

        // 4. Save to Public
        const folder = path.join(__dirname, '../public/media/downloads');
        if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

        // Guess Ext
        let ext = '.bin';
        if (msg.messageType === 'imageMessage') ext = '.jpg';
        else if (msg.messageType === 'videoMessage') ext = '.mp4';
        else if (msg.messageType === 'audioMessage') ext = '.ogg';
        else if (msg.messageType === 'documentMessage') ext = '.dat'; // fallback

        const filename = `download_${msgId}${ext}`;
        const filepath = path.join(folder, filename);

        fs.writeFileSync(filepath, buffer);

        // 5. Update DB
        const publicUrl = `/media/downloads/${filename}`;
        await ChatMessage.updateOne({ _id: msg._id }, { mediaUrl: publicUrl });

        res.json({ success: true, url: publicUrl, type: 'downloaded' });

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

