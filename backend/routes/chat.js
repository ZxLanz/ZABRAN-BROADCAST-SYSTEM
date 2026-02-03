const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ChatMessage = require('../models/ChatMessage');
const { authenticate } = require('../middleware/auth');
const { getSocket, socketsMap, getContact } = require('../utils/whatsappClient');
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

// 1. GET /chats - Get list of conversations
// 1. GET /chats - Get list of conversations (OPTIMIZED WITH AGGREGATION)
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const startTime = Date.now();

        // 1. Load Customers for Lookup (Optimized: Select only needed fields)
        const Customer = require('../models/Customer');
        let customersByName = new Map();  // name (lowercase) → phone
        let customersByPhone = new Map(); // phone → name
        let jidToPhoneMap = new Map();    // any jid (LID/Phone) → normalized phone

        // ✅ 1b. Build Map from WhatsApp Store (Memory) - CRITICAL for LIDs
        // This makes us behave like WhatsApp Web: we look at the contact list first!
        try {
            const { storesMap } = require('../utils/whatsappClient');
            const store = storesMap.get(userId);

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
                    userId: new mongoose.Types.ObjectId(userId),
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
        ]).option({ allowDiskUse: true }); // ✅ Allow disk use for heavy sort

        console.log(`📊 [PERF] DB Aggregation took ${Date.now() - startTime}ms.`);
        console.log(`📊 [PERF] Raw Chat Groups Found: ${aggregatedChats.length}`);

        // 3. Process & Merge Logic (Smart Merge)
        const lidsToLink = new Map(); // phone -> Set(lids)
        const processedChats = new Map(); // canonicalId -> chatObject

        // Helper: Resolve any JID to Canonical Phone
        const resolveToCanonical = (jid) => {
            if (!jid) return 'unknown';

            // A. Check Direct DB Map
            if (jidToPhoneMap.has(jid)) return jidToPhoneMap.get(jid);

            // B. Extract Standard Phone (Primary Method)
            if (jid.includes('@s.whatsapp.net')) {
                const parts = jid.split('@')[0].split(':')[0];
                let phone = parts.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                if (phone.startsWith('8') && phone.length > 9) phone = '62' + phone;
                return phone;
            }

            // C. Store/LID Lookup
            if (jid.includes('@lid')) {
                // 1. Try Memory Store
                const contact = getContact(userId, jid);
                if (contact && (contact.name || contact.notify)) {
                    const rawName = (contact.name || contact.notify).toLowerCase();

                    // 1. Literal Match
                    let phone = customersByName.get(rawName);

                    // 2. Sanitized Match (Fix "Rasya𖣂" issue)
                    if (!phone) {
                        const sanitizeName = (str) => str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/[^a-z0-9]/g, '');
                        const simpleName = sanitizeName(rawName);
                        if (simpleName.length > 2) {
                            phone = customersByName.get(simpleName);
                        }
                        // DEBUG DUPLICATION
                        if (rawName.includes('fozxnam') || rawName.includes('bapae')) {
                            console.log(`🔍 [DEDUP-TRACE] Looking up '${rawName}' -> Simple: '${simpleName}' -> Found: ${phone}`);
                        }
                    }

                    if (phone) {
                        if (!lidsToLink.has(phone)) lidsToLink.set(phone, new Set());
                        lidsToLink.get(phone).add(jid);

                        // Update map for future speed
                        jidToPhoneMap.set(jid, phone);
                        return phone;
                    }
                }

                // 2. Try Regex Map from Customers (Pre-loaded)
                // (Already handled by step A if jidToPhoneMap is populated correctly)
            }

            // D. Fallback: Group by LID User ID
            if (jid.includes('@lid')) {
                // 1. Try to find by PushName if available in Store
                const contact = getContact(userId, jid);
                if (contact && (contact.name || contact.notify)) {
                    const rawName = (contact.name || contact.notify).toLowerCase();
                    // Try Sanitized Match
                    const sanitizeName = (str) => str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').replace(/[^a-z0-9]/g, '');
                    const simpleName = sanitizeName(rawName);

                    if (customersByName.has(simpleName)) {
                        const phone = customersByName.get(simpleName);
                        jidToPhoneMap.set(jid, phone);
                        return phone;
                    }
                }

                const lidUser = jid.split('@')[0].split(':')[0];
                const abstractKey = `LID:${lidUser}`;
                if (jidToPhoneMap.has(abstractKey)) {
                    return jidToPhoneMap.get(abstractKey);
                }
                return abstractKey; // Group unmapped LIDs together
            }

            return jid; // Fallback to original
        };

        // Process each aggregated group
        for (const chatGroup of aggregatedChats) {
            const rawJid = chatGroup._id;
            if (!rawJid) continue;

            let canonicalId = resolveToCanonical(rawJid);
            const msg = chatGroup.lastMessage;

            // 🔍 FALLBACK: Link LID to Phone via PushName (if Store failed)
            if (rawJid.includes('@lid') && canonicalId.includes('@lid')) {
                const pushName = (!msg.fromMe && msg.pushName && msg.pushName !== 'Unknown') ? msg.pushName : null;
                if (pushName) {
                    const mappedPhone = customersByName.get(pushName.toLowerCase());
                    if (mappedPhone) {
                        canonicalId = mappedPhone;
                        // Cache for future
                        if (!lidsToLink.has(mappedPhone)) lidsToLink.set(mappedPhone, new Set());
                        lidsToLink.get(mappedPhone).add(rawJid);
                    }
                }
            }

            // Prepare Chat Object
            const chatObj = {
                _id: rawJid, // Default ID (will be overwritten if merged)
                canonicalId: canonicalId,
                mainJid: rawJid,

                // Content
                lastMessage: msg,
                lastMessageTime: chatGroup.lastMessageTime,
                unreadCount: chatGroup.unreadCount,

                // Metadata
                cleanPhone: canonicalId.match(/^\d+$/) ? canonicalId : null,
                displayName: null,
                isSaved: false,
                hasStandardJid: rawJid.includes('@s.whatsapp.net'),

                // For Merge Logic
                storePushName: null
            };

            // Enhance with Name Data immediately
            if (chatObj.cleanPhone && customersByPhone.has(chatObj.cleanPhone)) {
                chatObj.displayName = customersByPhone.get(chatObj.cleanPhone);
                chatObj.isSaved = true;
            } else {
                // Try pushName from message
                const pushName = (!msg.fromMe && msg.pushName && msg.pushName !== 'Unknown') ? msg.pushName : null;
                if (pushName) chatObj.displayName = pushName;

                // Try Store Contact
                const contact = getContact(userId, rawJid);
                if (contact && (contact.name || contact.notify)) {
                    chatObj.storePushName = (contact.name || contact.notify).toLowerCase().trim();
                    if (!chatObj.displayName) chatObj.displayName = contact.name || contact.notify;
                }
            }

            // MERGE INTO MAIN MAP
            if (!processedChats.has(canonicalId)) {
                chatObj.mergedJids = [rawJid]; // Track all JIDs that form this chat
                processedChats.set(canonicalId, chatObj);
            } else {
                // MERGE EXISTING
                const existing = processedChats.get(canonicalId);
                if (!existing.mergedJids.includes(rawJid)) {
                    existing.mergedJids.push(rawJid);
                }

                // 1. Prefer @s.whatsapp.net as mainJid
                if (chatObj.hasStandardJid && !existing.hasStandardJid) {
                    existing.mainJid = chatObj.mainJid;
                    existing._id = chatObj.mainJid;
                    existing.cleanPhone = chatObj.cleanPhone; // Ensure phone is set
                }

                // 2. Update Last Message (Take newest)
                if (new Date(chatObj.lastMessageTime) > new Date(existing.lastMessageTime)) {
                    existing.lastMessage = chatObj.lastMessage;
                    existing.lastMessageTime = chatObj.lastMessageTime;
                }

                // 3. Sum Unread
                existing.unreadCount += chatObj.unreadCount;

                // 4. Update Saved Status
                if (chatObj.isSaved) {
                    existing.isSaved = true;
                    existing.displayName = chatObj.displayName;
                }

                // 5. Merge PushName
                if (chatObj.storePushName) existing.storePushName = chatObj.storePushName;
            }
        }

        // ==================== SELF-HEALING (Async) ====================
        if (lidsToLink.size > 0) {
            (async () => {
                for (const [phone, lids] of lidsToLink.entries()) {
                    try {
                        const lidsArray = Array.from(lids);
                        await Customer.updateOne(
                            { phone: { $regex: new RegExp(phone.substring(2)) } },
                            { $addToSet: { jids: { $each: lidsArray } } }
                        );
                    } catch (e) { console.error('Self-heal error:', e); }
                }
            })();
        }

        // ==================== FINAL DEDUPLICATION (Deep Merge by PushName) ====================
        let conversations = Array.from(processedChats.values());

        // Map to group by Name for orphan LIDs
        const nameToChatMap = new Map(); // "lisnawati" -> chatObj (Phone)

        // ✅ Helper sanitization (re-defined or scoped)
        const sanitizeNameClean = (str) => {
            if (!str) return '';
            return str.toLowerCase()
                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                .replace(/[^a-z0-9]/g, '');
        };

        // 1. Index all chats that HAVE a phone number
        conversations.forEach(c => {
            if (c.cleanPhone) {
                if (c.displayName) {
                    nameToChatMap.set(c.displayName.toLowerCase(), c);
                    const clean = sanitizeNameClean(c.displayName);
                    if (clean.length > 2) nameToChatMap.set(clean, c);
                }
                if (c.storePushName) {
                    nameToChatMap.set(c.storePushName.toLowerCase(), c); // Strict
                    const clean = sanitizeNameClean(c.storePushName);
                    if (clean.length > 2) nameToChatMap.set(clean, c);
                }
            }
        });

        // ✅ HELPER: Levenshtein Distance for Fuzzy Matching
        const levenshteinDistance = (a, b) => {
            if (a.length === 0) return b.length;
            if (b.length === 0) return a.length;
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        };

        const finalChats = [];

        conversations.forEach(conv => {
            let merged = false;

            // Logic: If this is an ORPHAN LID (No Phone)
            if (!conv.cleanPhone) {
                // Check if its name matches a Phone Chat
                const nameKey = conv.displayName ? conv.displayName.toLowerCase() : null;
                const pushKey = conv.storePushName ? conv.storePushName.toLowerCase() : null;

                // Try Strict Match
                let parent = (nameKey && nameToChatMap.get(nameKey)) || (pushKey && nameToChatMap.get(pushKey));

                // 🔍 Try Sanitized Match (Fix for Rasya𖣂)
                if (!parent) {
                    const cleanName = sanitizeNameClean(conv.displayName);
                    const cleanPush = sanitizeNameClean(conv.storePushName);
                    if (cleanName.length > 2) parent = nameToChatMap.get(cleanName);
                    if (!parent && cleanPush.length > 2) parent = nameToChatMap.get(cleanPush);
                }

                // 🔍 Try Fuzzy Match (Fix for "Akbar" vs "Akbr")
                if (!parent) {
                    const candidateName = (conv.displayName || conv.storePushName || '').toLowerCase();
                    if (candidateName.length > 3) {
                        for (const [key, val] of nameToChatMap.entries()) {
                            // Only compare if key is reasonable length
                            if (key.length > 3) {
                                const dist = levenshteinDistance(candidateName, key);
                                // Allow 1 edit for short words (4-5 chars), 2 edits for longer
                                const threshold = key.length < 6 ? 1 : 2;
                                if (dist <= threshold) {
                                    console.log(`🔗 [FUZZY MERGE] Matched "${candidateName}" with "${key}" (Dist: ${dist})`);
                                    parent = val;

                                    // ✅ CRITICAL: Trigger Self-Healing so DB remembers this link
                                    if (parent.cleanPhone) {
                                        if (!lidsToLink.has(parent.cleanPhone)) lidsToLink.set(parent.cleanPhone, new Set());
                                        lidsToLink.get(parent.cleanPhone).add(conv._id); // Add orphan JID
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }

                if (parent && parent !== conv) {
                    console.log(`🔗 [DEEP MERGE] Merging Orphan "${conv.displayName}" -> Parent "${parent.displayName}"`);

                    // Merge into Parent
                    if (new Date(conv.lastMessageTime) > new Date(parent.lastMessageTime)) {
                        parent.lastMessage = conv.lastMessage;
                        parent.lastMessageTime = conv.lastMessageTime;
                    }
                    parent.unreadCount += conv.unreadCount;

                    // ✅ MERGE JIDs so markAsRead works for both
                    if (!parent.mergedJids) parent.mergedJids = [];
                    if (conv.mergedJids && Array.isArray(conv.mergedJids)) {
                        conv.mergedJids.forEach(j => {
                            if (!parent.mergedJids.includes(j)) parent.mergedJids.push(j);
                        });
                    } else {
                        if (!parent.mergedJids.includes(conv._id)) parent.mergedJids.push(conv._id);
                    }

                    merged = true;
                } else {
                    // Try Advanced Resolve (Last Ditch)
                    const { resolvePhoneFromLid } = require('../utils/whatsappClient');
                    // Note: We can't await here in forEach, so we mark it for potential async resolve in future or just let it be.
                    // For performance, we skip the heavy await loop here and rely on the self-healing in next refresh.
                }
            }

            if (!merged) {
                // Post-processing for frontend

                // 1. Determine Display Name (WhatsApp Web Logic)
                // - Saved? -> Use DB Name (Already set above)
                // - Unsaved? -> Use Formatted Phone (+62...)
                // - No Phone (LID)? -> Use PushName
                // - Nothing? -> Unknown

                // Store PushName explicitly for frontend (~Name display)
                const availablePushName = conv.storePushName || (conv.lastMessage?.pushName !== 'Unknown' ? conv.lastMessage?.pushName : null);
                conv.pushName = availablePushName;

                if (!conv.isSaved) {
                    if (conv.cleanPhone) {
                        // Unsaved with Number -> Show Number
                        conv.displayName = `+${conv.cleanPhone}`;
                    } else if (availablePushName) {
                        // Unsaved, No Number (LID) -> Show PushName
                        conv.displayName = availablePushName;
                    } else {
                        conv.displayName = 'Unknown Contact';
                    }
                }

                // Ensure ID is stable
                if (conv.cleanPhone) {
                    // Force the ID to be the phone JID to prevent React key duplication
                    conv._id = `${conv.cleanPhone}@s.whatsapp.net`;
                }

                finalChats.push(conv);
            }
        });

        // Final Sort
        finalChats.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

        console.log(`✅ [GET /chats] Returned ${finalChats.length} conversations (took ${Date.now() - startTime}ms)`);
        res.json({ success: true, data: finalChats });

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

        // 🚀 SMART HISTORY LOOKUP (Bridge Phone <-> LID)
        let targetJids = [new RegExp(`^${normalizedNumber}[:\\@]`)]; // Default Regex

        try {
            const Customer = require('../models/Customer');
            const customer = await Customer.findOne({
                $or: [{ phone: normalizedNumber }, { jids: jid }]
            });

            if (customer && customer.jids && customer.jids.length > 0) {
                // If customer found, fetch messages for ALL their known JIDs
                targetJids = customer.jids;
                // Add the current requested JID just in case it's new and not in DB yet
                if (!targetJids.includes(jid)) targetJids.push(jid);

                // Also add the Regex to catch any unlinked phone-based variations
                // actually $in accepts regex, so we can mix strings and regex if needed, 
                // but simpler to just use $in with known strings + the regex approach as fallback
            }
        } catch (err) {
            console.log('Error looking up customer for history:', err);
        }
        // 3. Build Query
        const query = {
            userId: userId,
            $or: [
                { remoteJid: { $in: targetJids } },
                { participant: { $in: targetJids } } // Handle group messages where 'participant' matches
                // Note: normalizedJid handles the merging, so we query basically everything related to this conversation
            ],
            // ✅ LIMIT HISTORY TO 3 MONTHS
            timestamp: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        };

        // Pagination
        if (before) {
            query.timestamp = {
                $lt: new Date(before),
                $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Maintain floor even when paging
            };
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

        console.log(`Sending text to ${formattedJid}: ${message}`);

        const sentMsg = await sock.sendMessage(formattedJid, { text: message });

        // ✅ MANUAL SAVE: Ensure message is saved immediately to DB (don't wait for upsert)
        const ChatMessage = require('../models/ChatMessage');
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
            extractedPhone: formattedJid.includes('@s.whatsapp.net') ? formattedJid.split('@')[0] : null
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

    // 5. POST /chats/:jid/read - Mark messages as read
    router.post('/:jid/read', async (req, res) => {
        try {
            const userId = req.user.id;
            const { jid } = req.params;
            const { jids } = req.body; // ✅ Support for Merged JIDs

            // Determine target JIDs (Single or Multiple)
            let targetJids = [jid];

            if (jids && Array.isArray(jids) && jids.length > 0) {
                targetJids = jids;
            }

            console.log(`👀 [READ] Marking as read for user ${userId}, targets:`, targetJids);

            // 1. Update DB (Mark all unread messages from these JIDs as read)
            await ChatMessage.updateMany(
                {
                    userId: new mongoose.Types.ObjectId(userId),
                    remoteJid: { $in: targetJids }, // ✅ Match ANY of the linked IDs
                    fromMe: false,
                    status: { $ne: 'read' }
                },
                { $set: { status: 'read' } }
            );

            // 2. Send Read Receipt to WhatsApp (Realtime)
            const sock = getSocket(userId);
            if (sock) {
                // We need valid keys to send read receipts. 
                // Ideally we find the unread messages first, but for performance we might skip 
                // or just rely on the frontend to have triggered a specific read if needed.
                // Baileys requires keys. If we just want to clear status, we assume user read them.
                // Implementing fully correct read receipts requires fetching the exact keys.

                // Allow "Bulk Read" attempt (Best Effort)
                // Ideally frontend sends keys, but here we just ensure DB is consistent.
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error marking read:', error);
            res.status(500).json({ success: false, error: 'Failed' });
        }
    });

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
    ```
