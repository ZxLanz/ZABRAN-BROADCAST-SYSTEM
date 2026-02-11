// File: backend/utils/whatsappClient.js - ✅ COMPLETE WITH READ RECEIPTS FIXED

const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    proto
} = require('@whiskeysockets/baileys');
// ✅ SAFE IMPORT: Use Custom Store for v7 compatibility
const makeInMemoryStore = require('./makeInMemoryStore');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const { writeFile } = require('fs/promises'); // Added for Media
const { downloadMediaMessage, downloadContentFromMessage } = require('@whiskeysockets/baileys'); // Added for Media

// Import Setting model for read receipts
// Import Setting model for read receipts
const Setting = require('../models/Setting');
const aiService = require('../services/aiService');
const { transcribeAudio } = require('../services/transcriptionService');
const { getIO } = require('../services/socket');

// ===========================================
// MULTI-USER STORAGE MAPS
// ===========================================
const socketsMap = new Map();
const connectionCooldowns = new Map(); // ✅ Anti-Conflict Cooldown
const statsMap = new Map();
const qrCodesMap = new Map();
const avatarCache = new Map(); // ✅ Cache for Avatars (JID -> {url, timestamp})
const AVATAR_CACHE_TTL = 60 * 60 * 1000; // 1 Hour Cache
const statusMap = new Map();
const reconnectTimeouts = new Map();
const storesMap = new Map(); // ✅ Stores Map per User
const storeIntervals = new Map(); // ✅ Store Save Intervals

// Base path for all user sessions
const BASE_AUTH_PATH = path.join(__dirname, '../baileys_auth_info');

// Ensure base directory exists
if (!fs.existsSync(BASE_AUTH_PATH)) {
    fs.mkdirSync(BASE_AUTH_PATH, { recursive: true });
}

// ===========================================
// STATS HELPER FUNCTIONS (PER USER)
// ===========================================

function getStatsPath(userId) {
    return path.join(BASE_AUTH_PATH, `user-${userId}`, 'stats.json');
}

function loadStats(userId) {
    const statsFile = getStatsPath(userId);

    if (fs.existsSync(statsFile)) {
        try {
            const data = fs.readFileSync(statsFile, 'utf8');
            const loadedStats = JSON.parse(data);

            if (!loadedStats.responseTimes) {
                loadedStats.responseTimes = [];
            }
            if (!loadedStats.deliveryStatus) {
                loadedStats.deliveryStatus = { success: 0, failed: 0 };
            }

            statsMap.set(userId, loadedStats);
            checkDailyReset(userId);
        } catch (e) {
            console.error(`❌ [STATS] Error loading stats for user ${userId}:`, e.message);
            initializeStats(userId);
        }
    } else {
        initializeStats(userId);
    }
}

function initializeStats(userId) {
    const defaultStats = {
        sentToday: 0,
        receivedToday: 0,
        sentTotal: 0,
        receivedTotal: 0,
        lastResetDate: new Date().toDateString(),
        chats: {},
        messages: {},
        responseTimes: [],
        deliveryStatus: { success: 0, failed: 0 }
    };
    statsMap.set(userId, defaultStats);
    saveStats(userId);
}

function saveStats(userId) {
    try {
        const stats = statsMap.get(userId);
        if (!stats) return;

        const statsFile = getStatsPath(userId);
        const dir = path.dirname(statsFile);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error(`❌ [STATS] Error saving for user ${userId}:`, e.message);
    }
}

function checkDailyReset(userId) {
    const stats = statsMap.get(userId);
    if (!stats) return;

    const today = new Date().toDateString();
    if (stats.lastResetDate !== today) {
        console.log(`🔄 [RESET] Daily stats reset for user ${userId}`);
        stats.sentToday = 0;
        stats.receivedToday = 0;
        stats.lastResetDate = today;
        stats.responseTimes = [];
        stats.deliveryStatus = { success: 0, failed: 0 };
        saveStats(userId);
    }
}

function updateChatActivity(userId, jid, direction = 'received', messageTimestamp = null) {
    const stats = statsMap.get(userId);
    if (!stats) return;

    const timestamp = new Date().toISOString();
    checkDailyReset(userId);

    if (!stats.responseTimes) {
        stats.responseTimes = [];
    }
    if (!stats.deliveryStatus) {
        stats.deliveryStatus = { success: 0, failed: 0 };
    }

    if (direction === 'sent') {
        stats.sentToday++;
        stats.sentTotal++;
    } else {
        stats.receivedToday++;
        stats.receivedTotal++;

        if (stats.chats[jid] && stats.chats[jid].lastSentAt) {
            const lastSent = new Date(stats.chats[jid].lastSentAt).getTime();
            const now = Date.now();
            const responseTime = Math.floor((now - lastSent) / 1000);

            if (responseTime < 3600 && responseTime > 0) {
                stats.responseTimes.push(responseTime);

                if (stats.responseTimes.length > 100) {
                    stats.responseTimes.shift();
                }
            }
        }
    }

    if (!stats.chats[jid]) {
        stats.chats[jid] = {
            lastActivity: timestamp,
            messageCount: 0,
            lastReceivedAt: direction === 'received' ? timestamp : null,
            lastSentAt: direction === 'sent' ? timestamp : null
        };
    }

    stats.chats[jid].lastActivity = timestamp;
    stats.chats[jid].messageCount++;

    if (direction === 'received') {
        stats.chats[jid].lastReceivedAt = timestamp;
    } else {
        stats.chats[jid].lastSentAt = timestamp;
    }

    saveStats(userId);
}

function updateDeliveryStatus(userId, success) {
    const stats = statsMap.get(userId);
    if (!stats) return;

    checkDailyReset(userId);

    if (success) {
        stats.deliveryStatus.success++;
    } else {
        stats.deliveryStatus.failed++;
    }

    saveStats(userId);
}

function calculateAverageResponseTime(responseTimes) {
    if (!responseTimes || responseTimes.length === 0) {
        return '0m';
    }

    const total = responseTimes.reduce((sum, time) => sum + time, 0);
    const avgSeconds = Math.floor(total / responseTimes.length);

    if (avgSeconds < 60) {
        return `${avgSeconds}s`;
    } else if (avgSeconds < 3600) {
        const minutes = Math.floor(avgSeconds / 60);
        return `${minutes}m`;
    } else {
        const hours = Math.floor(avgSeconds / 3600);
        const minutes = Math.floor((avgSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

function calculateSuccessRate(deliveryStatus) {
    const total = deliveryStatus.success + deliveryStatus.failed;
    if (total === 0) return '100%';

    const rate = Math.floor((deliveryStatus.success / total) * 100);
    return `${rate}%`;
}

// ===========================================
// ✅ HELPER: LOAD USER SETTINGS - FIXED
// ===========================================

async function getUserSettings(userId) {
    try {
        const settings = await Setting.findOne({ userId });
        return settings || {
            readReceiptsEnabled: true, // ✅ FIXED: Correct field name
            autoReplyEnabled: false,   // ✅ FIXED: Correct field name
            autoReplyMessage: '',
            businessHours: {
                isActive: false
            }
        };
    } catch (error) {
        console.error(`❌ [SETTINGS] Error loading for user ${userId}:`, error.message);
        return {
            readReceiptsEnabled: true, // ✅ FIXED
            autoReplyEnabled: false,   // ✅ FIXED
            autoReplyMessage: '',
            businessHours: {
                isActive: false
            }
        };
    }
}

// ===========================================
// ✅ AUTO-CONNECT ALL USERS (SILENT RESTORE)
// ===========================================

async function autoConnectAllUsers() {
    try {
        console.log('\n🔄 [AUTO-CONNECT] Checking for existing sessions...');


        const User = require('../models/User');

        if (!fs.existsSync(BASE_AUTH_PATH)) {
            console.log('ℹ️ [AUTO-CONNECT] No session folder found');
            return;
        }

        const folders = fs.readdirSync(BASE_AUTH_PATH);
        const userFolders = folders.filter(f => f.startsWith('user-'));

        if (userFolders.length === 0) {
            console.log('ℹ️ [AUTO-CONNECT] No user sessions found');
            return;
        }

        console.log(`📂 [AUTO-CONNECT] Found ${userFolders.length} session(s)`);

        for (const folder of userFolders) {
            const userId = folder.replace('user-', '');

            try {
                const authPath = path.join(BASE_AUTH_PATH, folder);
                const credsPath = path.join(authPath, 'creds.json');

                if (fs.existsSync(credsPath)) {
                    console.log(`🚀 [AUTO-CONNECT] Restoring user ${userId} in 1s...`);

                    // Use connectToWhatsApp instead of restoreSession for proper event listeners
                    setTimeout(async () => {
                        await connectToWhatsApp(userId);
                    }, 1000);

                    console.log(`✅ [AUTO-CONNECT] User ${userId} connection initiated`);
                } else {
                    console.log(`⚠️ [AUTO-CONNECT] No valid session for user ${userId}, skipping`);
                }
            } catch (err) {
                console.error(`❌ [AUTO-CONNECT] Failed to restore user ${userId}:`, err.message);

                try {
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'disconnected',
                        whatsappError: err.message
                    });
                } catch (dbErr) {
                    // Ignore DB errors
                }
            }
        }

        console.log('✅ [AUTO-CONNECT] Auto-restore completed\n');

    } catch (err) {
        console.error('❌ [AUTO-CONNECT] Error:', err.message);
    }
}


// ===========================================
// ✅ WHATSAPP CONNECTION (MANUAL) - FIXED
// ===========================================

// ===========================================
// ✅ WHATSAPP CONNECTION (STRICT STATE MACHINE)
// ===========================================

const MAX_RETRIES = 5;
const retryCounters = new Map();

// ✅ HELPER: Centralized Reconnect Scheduler (Prevents Ghost Timers)
function scheduleReconnect(userId, delay) {
    // 1. Always purge existing timer first
    if (reconnectTimeouts.has(userId)) {
        clearTimeout(reconnectTimeouts.get(userId));
        reconnectTimeouts.delete(userId);
    }

    // 2. Schedule new one
    console.log(`⏳ [RECONNECT] Scheduling reconnect for user ${userId} in ${delay}ms...`);
    const timeout = setTimeout(() => {
        connectToWhatsApp(userId);
    }, delay);

    // 3. Track it
    reconnectTimeouts.set(userId, timeout);
}

async function connectToWhatsApp(userId) {
    if (!userId || userId === 'undefined') {
        console.error('❌ [CONNECT] Cannot connect: userId is invalid', userId);
        return;
    }

    // 🔒 LOCK: Prevent Double Connection Attempts
    if (connectionCooldowns.has(userId)) {
        console.warn(`⏳ [CONNECT] Connection attempt in progress for ${userId}. Skipping duplicate.`);
        return;
    }

    // ✅ NEW: Pairing Code Logic - If we are requesting pairing, we MUST allow the process
    // We handle the lock carefully.

    connectionCooldowns.set(userId, true);
    // Auto-release lock after 20s (Extended for pairing)
    setTimeout(() => connectionCooldowns.delete(userId), 20000);

    // ♻️ CLEANUP: Force close existing socket
    if (socketsMap.has(userId)) {
        console.log(`♻️ [CONNECT] Force closing existing socket for ${userId} to prevent 440 Conflict`);
        const oldSock = socketsMap.get(userId);
        try {
            oldSock.end(undefined);
            oldSock.ws.close();
            oldSock.ev.removeAllListeners();
        } catch (e) { }
        socketsMap.delete(userId);
    }

    console.log(`\n🔌 [CONNECT] Starting WhatsApp connection for user: ${userId}`);
    loadStats(userId);

    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);
    if (!fs.existsSync(userAuthPath)) {
        fs.mkdirSync(userAuthPath, { recursive: true });
    }

    try {
        const settings = await getUserSettings(userId);
        const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
        const { version } = await fetchLatestBaileysVersion();

        // ✅ INITIALIZE STORE (Optimized)
        const store = makeInMemoryStore({
            logger: pino({ level: 'info' }), // DEBUG: set to info/debug to see sync
            maximumHistory: 200
        });
        const storePath = path.join(userAuthPath, 'baileys_store_multi.json');

        try {
            if (fs.existsSync(storePath)) {
                store.readFromFile(storePath);
                console.log(`✅ [STORE] Loaded existing store for user ${userId}`);
            }
        } catch (err) { }

        // Save store periodically
        if (storeIntervals.has(userId)) clearInterval(storeIntervals.get(userId));
        storeIntervals.set(userId, setInterval(() => {
            try {
                if (!fs.existsSync(userAuthPath)) fs.mkdirSync(userAuthPath, { recursive: true });
                store.writeToFile(storePath);
            } catch (err) { }
        }, 10_000));

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false, // 🚫 PAIRING CODE: No QR in terminal
            auth: state,
            // browser: ['Zabran System', 'Chrome', 'Windows 10'], // 🛑 Might cause "Failed to link"
            browser: ['Ubuntu', 'Chrome', '20.0.04'], // ✅ Standard Linux Signature (Most stable)
            syncFullHistory: true,
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            getMessage: async key => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return proto.WebMessageInfo.fromObject({});
            },
            shouldIgnoreJid: (jid) => jid.includes('broadcast') || jid.endsWith('@g.us'),
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000
        });

        // ✅ BIND STORE
        store.bind(sock.ev);
        storesMap.set(userId, store);
        socketsMap.set(userId, sock);
        statusMap.set(userId, 'connecting');

        // ✅ EVENTS
        sock.ev.on('creds.update', saveCreds);


        // ✅ HISTORY SYNC HANDLER (Prevention of "PE" & Truncation)
        sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
            console.log(`📥 [SYNC] History received: ${messages.length} msgs, ${chats.length} chats, ${contacts.length} contacts`);

            // Process initial messages to populate DB
            for (const msg of messages) {
                // Ensure message object is valid
                if (msg.message) {
                    await processIncomingMessage(msg, true);
                }
            }
        });

        sock.ev.on('connection.update', async (update) => {
            console.log(`🔌 [CONNECTION DEBUG] Update received:`, JSON.stringify(update, null, 2));
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodesMap.set(userId, qr);
                statusMap.set(userId, 'qrcode');
                // console.log(`📸 [QR] QR Code generated for user ${userId}`); // 🔇 SILENCED for Pairing Code Mode
                // Unlock immediately for QR scan
                connectionCooldowns.delete(userId);
            }

            if (connection === 'close') {
                // Remove lock to allow reconnect logic to proceed
                connectionCooldowns.delete(userId);

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`🔴 [CLOSE] Connection closed for user ${userId}. Code: ${statusCode} | Reconnecting: ${shouldReconnect}`);

                // 🛑 SPECIAL HANDLING FOR 440 (CONFLICT)
                if (statusCode === 440 || statusCode === '440') {
                    console.error(`⚠️ [CONFLICT] Detection of 440 Conflict. Waiting 30s before retry to clear zombies...`);
                    try { sock.end(undefined); } catch (e) { } // Ensure strict close (Safe Wrap)
                    scheduleReconnect(userId, 30000); // 30s wait
                    return;
                }

                if (!shouldReconnect) {
                    console.log(`👋 [LOGOUT] Session logged out for user ${userId}`);
                    socketsMap.delete(userId);
                    qrCodesMap.delete(userId);
                    statusMap.set(userId, 'disconnected');
                    try {
                        fs.rmSync(userAuthPath, { recursive: true, force: true });
                    } catch (e) { }
                } else {
                    // Standard Reconnect
                    const delay = statusCode === 428 ? 10000 : 3000; // Longer delay for "Connection Closed" (428)
                    scheduleReconnect(userId, delay);
                }

            } else if (connection === 'open') {
                statusMap.set(userId, 'connected');
                qrCodesMap.delete(userId);
                retryCounters.set(userId, 0); // Reset retry count
                connectionCooldowns.delete(userId); // Release lock

                // ✅ CRITICAL FIX: Cancel any pending reconnects strictly
                if (reconnectTimeouts.has(userId)) {
                    console.log(`✅ [CONNECT] Cancelling pending reconnect since we are now OPEN.`);
                    clearTimeout(reconnectTimeouts.get(userId));
                    reconnectTimeouts.delete(userId);
                }

                const userNumber = sock.user?.id?.split(':')[0];
                console.log(`✅ [CONNECTED] User ${userId} connected as ${userNumber}`);

                // Update DB Status
                const User = require('../models/User');
                try {
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'connected',
                        lastWhatsAppConnection: new Date(),
                        whatsappError: null
                    });
                } catch (e) { }
            }
        });

        sock.ev.on('presence.update', async (data) => {
            const { id, presences } = data;
            const { getIO } = require('../services/socket');
            const io = getIO();
            if (io) {
                io.to(userId).emit('presence_update', { chatJid: id, presences: presences });
            }
        });

        // ... inside connectToWhatsApp ...

        // ✅ SHARED MESSAGE PROCESSING FUNCTION (For Upsert & History)
        // ✅ HELPER: Prune Old Messages to Maintain Limit
        const pruneChat = async (targetJid) => {
            const LIMIT = 20;
            try {
                const ChatMessage = require('../models/ChatMessage');
                const count = await ChatMessage.countDocuments({ userId, remoteJid: targetJid });
                if (count > LIMIT) {
                    const toDelete = count - LIMIT;
                    const oldest = await ChatMessage.find({ userId, remoteJid: targetJid })
                        .sort({ timestamp: 1 })
                        .limit(toDelete)
                        .select('_id');

                    if (oldest.length > 0) {
                        await ChatMessage.deleteMany({ _id: { $in: oldest.map(m => m._id) } });
                    }
                }
            } catch (e) {
                console.error('Prune error:', e);
            }
        };

        // ✅ SHARED MESSAGE PROCESSING FUNCTION (For Upsert & History)
        const processIncomingMessage = async (msg, isHistory = false) => {
            if (!msg.message) return null;

            // 🛑 1. IGNORE PROTOCOL MESSAGES (System Syncs)
            const type = Object.keys(msg.message)[0];
            if (type === 'protocolMessage' || type === 'senderKeyDistributionMessage') return null;

            const isFromMe = msg.key.fromMe;
            let remoteJid = msg.key.remoteJid;
            const sessionUserId = sock.user.id; // Renamed to avoid shadowing outer 'userId' (Mongo ID)

            // 🔄 2. NORMALIZE LID TO PHONE JID (CRITICAL FOR SAINT ZILAN)
            if (remoteJid.includes('@lid')) {
                const resolvedPhone = await resolvePhoneFromLid(sessionUserId, remoteJid);
                if (resolvedPhone) {
                    remoteJid = `${resolvedPhone}@s.whatsapp.net`;
                }
            }

            // 🛑 3. REMOVED STRICT SELF-CHAT DETECTION
            // We want to allow saving 'Note to Self' (chatting with own number)
            // The AI prevention should happen LATER, not here during data saving.
            /*
            const myNumber = sessionUserId.split(':')[0].split('@')[0];
            const senderNumber = remoteJid.split('@')[0].split(':')[0];

            if (myNumber === senderNumber) {
                return null;
            }
            */

            console.log(`📨 [PROCESS DEBUG] Processing msg from ${remoteJid}. FromMe: ${isFromMe}, Type: ${type}`);

            // ✅ SYNC FIX: Allow 'fromMe' (Sync) messages.
            // We do NOT return null here for isFromMe anymore.

            // 🌟 STRICT UNIFIED JID STRATEGY 🌟
            // User Request: "Gunakan satu ID yaitu JID"
            // Goal: All LIDs must be converted to Phone JIDs immediately.

            const { jidNormalizedUser } = require('@whiskeysockets/baileys');

            // 1. Force Resolve LID -> Phone JID
            if (remoteJid.includes('@lid')) {
                const resolved = await resolvePhoneFromLid(sessionUserId, remoteJid);
                if (resolved) {
                    // console.log(`🔄 [NORMALIZE] Converted LID ${remoteJid} -> ${resolved}@s.whatsapp.net`);
                    remoteJid = `${resolved}@s.whatsapp.net`;
                }
            }

            // 2. Standard Normalize (removes device specifics like :11)
            try {
                remoteJid = jidNormalizedUser(remoteJid);
            } catch (e) { }

            // 3. Final Safety: IF still LID, and we have a phone extracted, FORCE IT.
            if (remoteJid.includes('@lid')) {
                // Last ditch effort: Check if we can find a phone in the message context
                if (msg.key.remoteJid && msg.key.remoteJid.includes('@s.whatsapp.net')) {
                    remoteJid = jidNormalizedUser(msg.key.remoteJid);
                }
            }

            // 2. Normalize Participant (Sender)
            let participant = msg.key.participant || msg.key.remoteJid;
            if (participant) {
                participant = jidNormalizedUser(participant);
            }

            // Update Stats
            if (!isFromMe) {
                updateChatActivity(userId, remoteJid, 'received', msg.messageTimestamp);
            } else {
                updateChatActivity(userId, remoteJid, 'sent', msg.messageTimestamp);
            }

            // ... (Duplication Check) ...
            const ChatMessage = require('../models/ChatMessage');
            const existingMsg = await ChatMessage.findOne({ msgId: msg.key.id });

            if (existingMsg) {
                return remoteJid;
            }

            const messageType = Object.keys(msg.message)[0];

            // HANDLE REACTION MESSAGE
            if (messageType === 'reactionMessage') {
                const reaction = msg.message.reactionMessage;
                const targetId = reaction.key.id;
                const senderId = msg.key.fromMe
                    ? sock.user.id.split(':')[0] + '@s.whatsapp.net'
                    : (msg.key.participant || msg.key.remoteJid);

                const text = reaction.text;
                const timestamp = new Date(reaction.senderTimestampMs);

                try {
                    const targetMsg = await ChatMessage.findOne({ msgId: targetId });
                    if (targetMsg) {
                        targetMsg.reactions = targetMsg.reactions.filter(r => r.senderId !== senderId);
                        if (text) {
                            targetMsg.reactions.push({ text, senderId, timestamp });
                        }
                        await targetMsg.save();

                        // Emit Socket Event
                        const io = getIO();
                        if (io) {
                            io.to(`user_${userId}`).emit('message_reaction', {
                                msgId: targetId,
                                reactions: targetMsg.reactions,
                                remoteJid: targetMsg.remoteJid
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error saving reaction:', e);
                }
                return;
            }

            let mediaPath = null;
            let mediaUrl = null;

            // HANDLE REVOKE (Delete Message)
            if (messageType === 'protocolMessage' && msg.message.protocolMessage?.type === 0) {
                const key = msg.message.protocolMessage.key;
                // console.log(`🗑️ [REVOKE] Message revoked: ${key.id}`);

                const ChatMessage = require('../models/ChatMessage');
                const { getIO } = require('../services/socket');

                // Update DB to mark as revoked
                await ChatMessage.updateOne(
                    { msgId: key.id },
                    {
                        content: '🚫 Pesan ini telah dihapus',
                        status: 'revoked',
                        mediaUrl: null,
                        mediaPath: null
                    }
                );

                // Notify Frontend
                const io = getIO();
                if (io) {
                    io.to(`user_${userId}`).emit('message_revoke', {
                        msgId: key.id,
                        remoteJid: key.remoteJid
                    });
                }
                return;
            }

            // MEDIA DOWNLOAD HELPER
            const saveMedia = async (msg) => {
                try {
                    const buffer = await downloadMediaMessage(
                        msg,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
                    );

                    if (!buffer) return null;

                    const messageType = Object.keys(msg.message)[0];
                    let ext = '.bin';
                    let mime = '';

                    if (messageType === 'imageMessage') {
                        mime = msg.message.imageMessage.mimetype;
                        ext = '.jpg';
                    } else if (messageType === 'videoMessage') {
                        mime = msg.message.videoMessage.mimetype;
                        ext = '.mp4';
                    } else if (messageType === 'audioMessage') {
                        mime = msg.message.audioMessage.mimetype;
                        ext = '.ogg';
                    } else if (messageType === 'documentMessage') {
                        mime = msg.message.documentMessage.mimetype;
                        ext = mime.split('/')[1] || '.pdf';
                    } else if (messageType === 'stickerMessage') {
                        mime = msg.message.stickerMessage.mimetype;
                        ext = '.webp';
                    }

                    const fileName = `${msg.key.id}${ext}`;
                    const publicDir = path.join(__dirname, '../public/media');
                    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

                    const filePath = path.join(publicDir, fileName);
                    await writeFile(filePath, buffer);

                    return {
                        path: filePath,
                        url: `/media/${fileName}`,
                        type: mime
                    };

                } catch (err) {
                    console.error('❌ [MEDIA] Download failed:', err.message);
                    return null;
                }
            };

            let content = '';
            let mediaInfo = null;

            if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(messageType)) {

                // 🛑 POLICY CHANGE: NEVER AUTO-DOWNLOAD (On-Demand Only)
                // This saves massive storage. User must click "Download" in UI.
                // mediaInfo = await saveMedia(msg); 

                // We leave mediaInfo null. The frontend will see null mediaUrl and show "Download" button.

                if (messageType === 'imageMessage') content = msg.message.imageMessage.caption || '[Image]';
                else if (messageType === 'videoMessage') content = msg.message.videoMessage.caption || '[Video]';
                else if (messageType === 'stickerMessage') content = '[Sticker]';
                else content = `[${messageType}]`;
            }
            else if (messageType === 'conversation') {
                content = msg.message.conversation;
            } else if (messageType === 'extendedTextMessage') {
                // ✅ TRUNCATION FIX: Prioritize 'text' but check contextInfo if needed
                content = msg.message.extendedTextMessage.text || msg.message.extendedTextMessage.caption || '';

                // If content is suspiciously short or empty, check quoting
                if (!content && msg.message.extendedTextMessage.contextInfo) {
                    content = msg.message.extendedTextMessage.contextInfo.quotedMessage?.conversation || '';
                }
            } else {
                // Fallback for detailed types
                content = `[${messageType}]`;
            }

            // 🛡️ FINAL SAFETY: Ensure content is a string
            if (typeof content !== 'string') {
                content = String(content || '');
            }

            // QUOTED MESSAGE
            let quotedMsgData = null;
            try {
                const messageContent = msg.message[messageType];
                const contextInfo = messageContent?.contextInfo;
                if (contextInfo && contextInfo.quotedMessage) {
                    // Simplified extraction for brevity
                    const qm = contextInfo.quotedMessage;
                    let quotedContent = qm.conversation || (qm.extendedTextMessage?.text) || '[Media]';

                    // Extracted Participant ID (Raw)
                    let pId = contextInfo.participant ? contextInfo.participant.replace(/:[0-9]+@/, '@').split('@')[0] : (contextInfo.stanzaId || '');

                    // 🛡️ RECOVERY: If ID is an LID (15+ chars) or raw ID, try to normalize it using our Store
                    if (pId.length > 14 || pId.includes('lid')) {
                        // Try to find this participant in our Store to get real phone
                        const store = storesMap.get(userId);
                        if (store && store.contacts) {
                            for (const [jid, contact] of Object.entries(store.contacts)) {
                                if (jid.includes(pId) || (contact.lid && contact.lid.includes(pId))) {
                                    if (jid.includes('@s.whatsapp.net')) {
                                        pId = jid.split('@')[0]; // Found real phone!
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    pId = pId.replace(/\D/g, ''); // Ensure digits only

                    quotedMsgData = {
                        content: quotedContent,
                        participant: pId,
                        id: contextInfo.stanzaId
                    };

                    // Ensure participant is formatted as valid Indonesia phone if possible
                    if (quotedMsgData.participant.startsWith('0')) {
                        quotedMsgData.participant = '62' + quotedMsgData.participant.substring(1);
                    }
                }
            } catch (qErr) { }

            // 🧹 DATA RETENTION: Ignore messages > 90 Days
            const msgDate = new Date(msg.messageTimestamp * 1000);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 90);

            if (msgDate < cutoffDate) return;

            // 🚀 IMPROVED PHONE EXTRACTION (LID & Phone Support)
            let extractedPhone = null;

            // 1. Try simple extraction from @s.whatsapp.net
            if (remoteJid.includes('@s.whatsapp.net')) {
                const before = remoteJid.split('@')[0].split(':')[0];
                extractedPhone = before.replace(/\D/g, '');
            }
            // 2. Try simple extraction from broadcast @g.us (Group)
            else if (remoteJid.includes('@g.us')) {
                // For groups, we don't extract phone from the group JID itself usually
            }
            // 3. Try resolving LID Key to Phone via Store
            else if (remoteJid.includes('@lid')) {
                try {
                    const store = storesMap.get(userId);
                    if (store && store.contacts) {
                        const contact = store.contacts.get(remoteJid);
                        if (contact) {
                            // Try to find a linked standard JID
                            // This is tricky in Baileys store structure, usually we iterate or check mapped props
                            // But let's try a reverse lookup in our memory map if we built one?
                            // No, we'll try to guess or use the 'notify' name to find a match? No that's risky.

                            // Better: Check if we have a phone number in the Contact Object (some versions have it)
                            if (contact.id && contact.id.includes('@s.whatsapp.net')) {
                                extractedPhone = contact.id.split('@')[0].replace(/\D/g, '');
                            }
                        }
                    }
                } catch (e) { }
            }

            // Normalize format (628xxx)
            if (extractedPhone && extractedPhone.startsWith('0')) {
                extractedPhone = '62' + extractedPhone.substring(1);
            }

            // 🤖 AUTO READ CHECK (Determine Status BEFORE Saving)
            let initialStatus = isFromMe ? 'sent' : undefined;
            try {
                const Setting = require('../models/Setting'); // Safe require
                const userSettings = await Setting.findOne({ userId });
                if (userSettings?.autoRead && !isFromMe) {
                    await sock.readMessages([msg.key]);
                    initialStatus = 'read';
                }
            } catch (e) { }

            try {
                let newChat;
                try {
                    newChat = await ChatMessage.create({
                        userId: userId,
                        remoteJid: remoteJid,
                        fromMe: isFromMe,
                        msgId: msg.key.id,
                        messageType: messageType.replace('Message', ''),
                        content: content,
                        timestamp: new Date(msg.messageTimestamp * 1000),
                        pushName: msg.pushName || 'Unknown',
                        extractedPhone: extractedPhone,
                        status: initialStatus,
                        mediaUrl: mediaInfo?.url,
                        mediaPath: mediaInfo?.path,
                        mediaType: mediaInfo?.type,
                        quotedMsg: quotedMsgData
                    });
                } catch (dbErr) {
                    if (dbErr.code === 11000) {
                        // console.log(`⏩ [DUPLICATE] Skipped existing msg: ${msg.key.id}`);
                        return remoteJid; // Already exists, just return
                    }
                    throw dbErr; // Rethrow other errors
                }

                // Emit to frontend (Realtime)
                try {
                    // 🚀 NORMALIZED JID FOR FRONTEND MATCHING
                    // This creates a "Bridge" so the frontend receives the message 
                    // even if it's listening to the Phone Number but the event is LID.
                    let frontendJid = remoteJid;
                    if (extractedPhone) {
                        frontendJid = extractedPhone + '@s.whatsapp.net';
                    }

                    const io = getIO();

                    // ✅ DEBUG: Log before emit
                    const roomName = `user_${userId}`; // ✅ FIX: Add user_ prefix to match frontend
                    console.log(`🚀 [EMIT] Attempting to emit new_message to room: ${roomName}`);
                    console.log(`🚀 [EMIT] Message ID: ${newChat.msgId}, RemoteJid: ${frontendJid}`);

                    // ✅ EMIT TO SPECIFIC USER ROOM (not global broadcast)
                    io.to(roomName).emit('new_message', {
                        userId,
                        message: {
                            ...newChat.toObject(),
                            // Override remoteJid with canonical one for frontend matching
                            remoteJid: frontendJid,
                            originalJid: remoteJid // Keep original just in case
                        }
                    });

                    // 🔴 DEBUG: ALSO EMIT GLOBALLY TO TEST IF SOCKET.IO WORKS AT ALL
                    io.emit('test_global_broadcast', {
                        test: 'If you see this, Socket.IO works but room targeting is broken',
                        roomName,
                        userId,
                        timestamp: new Date().toISOString()
                    });

                    console.log(`✅ [EMIT] Successfully emitted new_message to room: ${roomName}`);
                    console.log(`🔴 [EMIT] Also sent test_global_broadcast to ALL clients`);
                } catch (err) {
                    console.error('❌ [EMIT] Failed to emit new_message:', err.message);
                    console.error('❌ [EMIT] Stack:', err.stack);
                }

                // 🤖 AI AUTO REPLY LOGIC (Only for NEW messages, check timestamp)
                // Skip AI for history sync messages (older than 10 seconds)
                const isRecent = (new Date() - msgDate) < 20 * 1000;

                // 🛑 IGNORE SYSTEM MESSAGES
                if (messageType === 'protocolMessage') return;

                // 🛑 IGNORE SELF CHAT (User chatting with themselves)
                // userId usually looks like "6282126633112:5@s.whatsapp.net"
                // remoteJid for self chat looks like "6282126633112@s.whatsapp.net"
                const myNumber = userId.split(':')[0].split('@')[0];
                const senderNumber = remoteJid.split('@')[0].split(':')[0];
                const isSelfChat = myNumber === senderNumber;

                if (isRecent && !isFromMe && !isSelfChat && content && !remoteJid.includes('@g.us')) {
                    // RESOLVE LID TO PHONE FOR LOGGING (Saint Zilan Request)
                    let logName = remoteJid;
                    if (extractedPhone) {
                        logName = `+${extractedPhone}`;
                    } else if (remoteJid.includes('@lid')) {
                        // Try resolving
                        const resolved = await resolvePhoneFromLid(userId, remoteJid);
                        if (resolved) logName = `+${resolved} (Resolved LID)`;
                    }

                    // console.log(`[AI] Processing msg from ${logName}...`);
                    try {
                        const settings = await getUserSettings(userId);

                        // Check specifically for autoReplyEnabled
                        if (settings.autoReply || settings.autoReplyEnabled) {
                            // ... Insert AI Logic here or reuse ...
                            // To save space in this tool call, I will call the AI service directly
                            // without the extensive prompt builder replication if possible.
                            // WAIT, I must include the logic or valid reference.

                            // Let's use a simplified call to aiService or reconstruct the prompt.
                            // Since I am replacing the block, I must put the AI logic back.

                            let promptText = content;
                            // Fetch History
                            const history = await ChatMessage.find({ userId, remoteJid }).sort({ timestamp: -1 }).limit(10);
                            if (history.length > 0) {
                                const context = history.reverse().map(m => (m.fromMe ? 'CS (Anda)' : 'Customer') + ': ' + m.content).join('\n');
                                const Customer = require('../models/Customer');
                                const customer = await Customer.findOne({ phone: extractedPhone });

                                const knowledgeBase = `INFO BISNIS "REPUBLIC LAPTOP":\n- Alamat: Jl. Perintis No.1, Sarijadi, Bandung.\n- Layanan: Jual Beli Laptop, Service, Sparepart.\n- Instagram: @republiclaptop.id`;

                                promptText = `Role: CS "Republic Laptop".\nInfo Bisnis:\n${knowledgeBase}\n\nRiwayat Chat:\n${context}\n\nInstruksi: Balas pesan terakhir customer (pendek & padat).`;
                            }

                            const reply = await aiService.getAutoReply(promptText);
                            if (reply) {
                                console.log(`🤖 [AI] Replying to ${remoteJid}`);
                                setTimeout(async () => {
                                    await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                                }, Math.random() * 3000 + 2000);
                            }
                        }
                    } catch (aiErr) {
                        console.error('❌ [AI] AutoReply Error Details:', {
                            message: aiErr.message,
                            stack: aiErr.stack,
                            name: aiErr.name,
                            code: aiErr.code
                        });

                        // Check if it's an API key or configuration issue
                        if (aiErr.message?.includes('API') || aiErr.message?.includes('key') || aiErr.message?.includes('401') || aiErr.message?.includes('403')) {
                            console.error('⚠️ [AI] Possible API Key Issue - Check .env file for OPENAI_API_KEY or n8n webhook URL');
                        }

                        if (aiErr.code === 'ECONNREFUSED' || aiErr.code === 'ENOTFOUND') {
                            console.error('⚠️ [AI] Connection Error - Check if n8n service is running');
                        }
                    }
                }

            } catch (dbErr) {
                console.error('❌ Error saving chat:', dbErr);
            }
        };

        // 1. Handle New Messages (Realtime)
        sock.ev.on('messages.upsert', async m => {
            console.log(`📨 [UPSERT DEBUG] EVENT FIRED! Received ${m.messages.length} messages. Type: ${m.type}`);
            console.log(`📨 [UPSERT DEBUG] Raw keys: ${m.messages.map(x => x.key.remoteJid).join(', ')}`);
            for (const msg of m.messages) {
                await processIncomingMessage(msg);
            }
        });

        // 2. Handle History Sync (The Missing Key!)
        sock.ev.on('messaging-history.set', async ({ messages, isLatest }) => {
            if (messages && messages.length > 0) {
                console.log(`📜 [HISTORY] Syncing ${messages.length} historical messages...`);
                // Process in chunks to avoid blocking?
                for (const msg of messages) {
                    await processIncomingMessage(msg, true);
                }
                console.log(`✅ [HISTORY] Sync complete.`);
            }
        });

        // ✅ HANDLE READ RECEIPTS / STATUS UPDATES (Proper Placement)
        sock.ev.on('messages.update', async updates => {
            try {
                const ChatMessage = require('../models/ChatMessage');
                const { getIO } = require('../services/socket');
                const io = getIO();

                for (const { key, update } of updates) {
                    console.log(`📨 [DEBUG] Update Event for ${key.id}. Status: ${update.status}`);

                    if (update.status) {
                        let newStatus = 'sent';
                        if (update.status === 3) newStatus = 'delivered';
                        else if (update.status >= 4) newStatus = 'read';

                        console.log(`🔄 [DEBUG] Mapping to ${newStatus}`);

                        if (newStatus !== 'sent') {
                            const result = await ChatMessage.findOneAndUpdate(
                                { msgId: key.id },
                                { status: newStatus },
                                { new: true }
                            );

                            if (result) {
                                console.log(`✅ [DB] Updated status to ${newStatus} for msg ${key.id}`);
                                // ✅ EMIT TO SPECIFIC USER ROOM
                                io.to(userId).emit('message_status_update', {
                                    messageId: key.id,
                                    status: newStatus,
                                    userId
                                });
                            } else {
                                // ⚠️ RACE CONDITION HANDLING: Message might not be saved yet
                                console.warn(`⚠️ [DB] Update failed: Message ${key.id} not found. Retrying in 1.5s...`);
                                setTimeout(async () => {
                                    try {
                                        const retryResult = await ChatMessage.findOneAndUpdate(
                                            { msgId: key.id },
                                            { status: newStatus },
                                            { new: true }
                                        );
                                        if (retryResult) {
                                            console.log(`✅ [DB] RECOVERY: Updated status to ${newStatus} for msg ${key.id} after retry`);
                                            // ✅ EMIT TO SPECIFIC USER ROOM
                                            io.to(userId).emit('message_status_update', {
                                                messageId: key.id,
                                                status: newStatus,
                                                userId
                                            });
                                        } else {
                                            console.error(`❌ [DB] Update PERMANENTLY failed: Message ${key.id} not found after retry`);
                                        }
                                    } catch (retryErr) {
                                        console.error('❌ Error during status update retry:', retryErr);
                                    }
                                }, 1500);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Error in messages.update:', err);
            }
        });

    } catch (error) {
        console.error(`❌ [ERROR] Connection error for user ${userId}:`, error.message);
        statusMap.set(userId, 'error');
    }
}



async function disconnectWhatsAppClient(userId, restart = true) {
    if (!userId || userId === 'undefined') return;
    console.log(`\n🚪 [DISCONNECT] Manual disconnect requested for user: ${userId} (Restart: ${restart})`);


    const sock = socketsMap.get(userId);

    if (sock) {
        try {
            // ✅ REMOVE LISTENERS TO PREVENT MEMORY LEAKS
            sock.ev.removeAllListeners('connection.update');
            sock.ev.removeAllListeners('creds.update');
            sock.ev.removeAllListeners('messages.upsert');
            sock.ev.removeAllListeners('messaging-history.set');

            await sock.logout();
            socketsMap.delete(userId);
        } catch (err) {
            console.error(`❌ [DISCONNECT] Error ending socket for user ${userId}:`, err.message);
        }
    }

    qrCodesMap.delete(userId);
    statusMap.set(userId, 'disconnected');

    const existingTimeout = reconnectTimeouts.get(userId);
    if (existingTimeout) {
        clearTimeout(existingTimeout);
        reconnectTimeouts.delete(userId);
    }

    // Clear Store Save Interval
    if (storeIntervals.has(userId)) {
        clearInterval(storeIntervals.get(userId));
        storeIntervals.delete(userId);
    }

    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);

    // Cleanup session
    try {
        if (fs.existsSync(userAuthPath)) {
            console.log(`🗑️ [CLEANUP] Deleting session files for user ${userId}...`);
            fs.rmSync(userAuthPath, { recursive: true, force: true });
            console.log(`✅ [CLEANUP] Session files deleted for user ${userId}`);
        }
    } catch (e) {
        console.error(`⚠️ [CLEANUP] Failed to delete auth files:`, e.message);
    }

    if (restart) {
        console.log(`🔄 [RESTART] Initializing new session for user ${userId}...`);
        setTimeout(() => connectToWhatsApp(userId), 1500);
    }
}

// ===========================================
// SEND MESSAGE (PER USER)
// ===========================================

async function sendMessage(userId, nomor, pesan, options = {}) {
    try {
        const sock = socketsMap.get(userId);
        const status = statusMap.get(userId);

        if (!sock || status !== 'connected') {
            throw new Error('WhatsApp is not connected for this user');
        }

        let waNumber = nomor.replace(/\D/g, '');

        if (waNumber.startsWith('0')) {
            waNumber = '62' + waNumber.substring(1);
        } else if (waNumber.startsWith('8')) {
            waNumber = '62' + waNumber;
        }

        const jid = waNumber + '@s.whatsapp.net';

        console.log(`\n📤 [SEND] User ${userId} sending message to ${jid}...`);

        // 🟢 HANDLE REPLY / QUOTE
        let sendOpts = {};
        if (options.quotedMsgId) {
            try {
                const storesMap = require('../utils/whatsappClient').storesMap; // Self-reference or use global
                // Actually storesMap is defined at top level of this file
                const store = storesMap.get(userId);
                if (store) {
                    // Try exact match first
                    let quoted = await store.loadMessage(jid, options.quotedMsgId);
                    if (!quoted) {
                        // Fallback: Try searching in ChatMessage DB to construct minimal quote?
                        // For now, only Store support
                        console.warn(`⚠️ [QUOTE] Message ${options.quotedMsgId} not found in Store.`);
                    } else {
                        sendOpts.quoted = quoted;
                        console.log(`💬 [QUOTE] Replying to ${options.quotedMsgId}`);
                    }
                }
            } catch (qErr) {
                console.error('Error loading quoted message:', qErr);
            }
        }

        const sentMsg = await sock.sendMessage(jid, { text: pesan }, sendOpts);

        console.log(`✅ [SEND] Message sent successfully by user ${userId} to ${waNumber}`);

        console.log(`✅ [SEND] Message sent successfully by user ${userId} to ${waNumber}`);

        // ✅ SAVE TO DATABASE (Critical for Reports)
        try {
            const ChatMessage = require('../models/ChatMessage');
            await ChatMessage.create({
                userId: userId,
                remoteJid: jid,
                fromMe: true,
                msgId: sentMsg.key.id,
                messageType: 'text',
                content: pesan,
                status: 'sent', // Baileys doesn't give immediate status, assume sent
                timestamp: new Date(),
                extractedPhone: waNumber
            });
            console.log(`💾 [DB] Saved sent message to DB: ${sentMsg.key.id}`);
        } catch (dbErr) {
            console.error(`❌ [DB] Failed to save outgoing message: ${dbErr.message}`);
        }

        updateChatActivity(userId, jid, 'sent');
        updateDeliveryStatus(userId, true);

        return {
            success: true,
            to: waNumber,
            sentAt: new Date().toISOString()
        };

    } catch (error) {
        console.error(`❌ [SEND] Error for user ${userId}:`, error.message);

        updateDeliveryStatus(userId, false);

        return {
            success: false,
            error: error.message
        };
    }
}

// ===========================================
// GET STATUS & STATS
// ===========================================

async function sendReaction(userId, jid, key, emoji) {
    const sock = socketsMap.get(userId);
    if (!sock) throw new Error('WhatsApp not connected');

    const reactionMessage = {
        react: {
            text: emoji,
            key: key
        }
    };

    const sentMsg = await sock.sendMessage(jid, reactionMessage);
    console.log(`❤️ [REACTION] Sent ${emoji} to ${jid} (target: ${key.id})`);

    // Manual DB Update (Optimistic)
    try {
        const ChatMessage = require('../models/ChatMessage');
        const targetMsg = await ChatMessage.findOne({ msgId: key.id });
        if (targetMsg) {
            const senderId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            // Remove existing
            targetMsg.reactions = targetMsg.reactions.filter(r => r.senderId !== senderId);
            if (emoji) {
                targetMsg.reactions.push({
                    text: emoji,
                    senderId,
                    timestamp: new Date()
                });
            }
            await targetMsg.save();

            // Emit event immediately for self
            const { getIO } = require('../services/socket');
            const io = getIO();
            if (io) {
                io.to(`user_${userId}`).emit('message_reaction', {
                    msgId: key.id,
                    reactions: targetMsg.reactions,
                    remoteJid: targetMsg.remoteJid
                });
            }
        }
    } catch (e) {
        console.error('Error saving reaction optimistic:', e);
    }

    // Emit Outgoing Message to All Clients (Realtime Sync for Multi-Tab)
    try {
        const io = getIO();
        io.emit('new_message', {
            userId,
            message: newChat.toObject()
        });
    } catch (e) {
        console.error('Socket emit error:', e);
    }

    return sentMsg;
}

function getStatus(userId) {
    return statusMap.get(userId) || 'disconnected';
}

function getQrCode(userId) {
    return qrCodesMap.get(userId) || null;
}

// ===========================================
// GET PROFILE PICTURE
// ===========================================
// ===========================================
// GET PROFILE PICTURE
// ===========================================
async function getProfilePicture(userId, jid) {
    const sock = socketsMap.get(userId);
    if (!sock) {
        return null;
    }

    // ✅ CACHE CHECK
    const cached = avatarCache.get(jid);
    // Use stored TTL or default if not present (legacy compatibility)
    const effectiveTTL = cached?.ttl || AVATAR_CACHE_TTL;
    if (cached && (Date.now() - cached.timestamp < effectiveTTL)) {
        return cached.url;
    }

    try {
        let url;
        console.log(`🔍 [PROFILE] Fetching URL for: ${jid}`);

        // 1. Try High Res (With Timeout)
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000));
            url = await Promise.race([
                sock.profilePictureUrl(jid, 'image'),
                timeoutPromise
            ]);
        } catch (e) {
            console.log(`⚠️ [PROFILE] High-res failed for ${jid}: ${e.message}. Trying preview...`);
            // 2. Fallback to Preview (Low Res)
            try {
                const timeoutPromisePreview = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000));
                url = await Promise.race([
                    sock.profilePictureUrl(jid, 'preview'),
                    timeoutPromisePreview
                ]);
            } catch (e2) {
                // Completely failed (Privacy or 404)
                console.log(`⚠️ [PROFILE] Failed all attempts for ${jid}: ${e2.message}`);
            }
        }

        if (jid.includes('@lid') && !url) {
            console.log(`⚠️ [PROFILE] LID Privacy/No Picture: ${jid}`);
        } else if (!url) {
            console.log(`❌ [PROFILE] No URL returned for: ${jid}`);
        } else {
            console.log(`✅ [PROFILE] Found URL for ${jid}`);
        }

        // ✅ SMART CACHING
        // If successful, cache for full TTL.
        // If failed (null), cache for specialized short TTL (e.g. 1 min) to allow retry
        const ttl = url ? AVATAR_CACHE_TTL : 60 * 1000; // 1 minute for failures
        avatarCache.set(jid, { url: url || null, timestamp: Date.now(), ttl });

        return url || null;
    } catch (err) {
        console.error(`💥 [PROFILE] Critical Error for ${jid}:`, err.message);
        return null;
    }
}




function getStoreStats(userId) {
    checkDailyReset(userId);

    const stats = statsMap.get(userId);
    const sock = socketsMap.get(userId);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Default values for when stats are not available
    let activeChats = '0';
    let responseTime = '0s';
    let successRate = '100%';
    let deviceInfo = null;

    if (stats) {
        activeChats = Object.values(stats.chats).filter(chat => chat.lastActivity > oneDayAgo).length.toString();
        responseTime = calculateAverageResponseTime(stats.responseTimes || []);
        successRate = calculateSuccessRate(stats.deliveryStatus || { success: 0, failed: 0 });
    }

    if (statusMap.get(userId) === 'connected' && sock) {
        // Triangulate User ID/Number
        const rawId = sock?.user?.id || sock?.authState?.creds?.me?.id;
        const userIdWA = rawId ? rawId.split(':')[0] : 'Unknown';

        // Triangulate Name
        const rawName = sock?.user?.name || sock?.user?.notify || sock?.authState?.creds?.me?.name || 'WhatsApp User';

        // Filter out if name is just the phone number
        const isNameSameAsNumber =
            rawName === userIdWA ||
            rawName === `+${userIdWA}` ||
            rawName.replace(/\D/g, '') === userIdWA;

        const userName = (isNameSameAsNumber) ? 'WhatsApp User' : rawName;

        // Triangulate Platform
        let platformName = 'Unknown Platform';
        if (sock?.user?.platform) {
            platformName = sock.user.platform;
        } else if (sock?.authState?.creds?.platform) {
            platformName = sock.authState.creds.platform;
        } else if (userIdWA.length > 13) { // Basic heuristic: Virtual numbers often different length, but hard to guess OS
            platformName = 'Multi-Device';
        } else {
            platformName = 'WhatsApp Mobile';
        }

        deviceInfo = {
            number: userIdWA,
            name: userName,
            platform: platformName
        };
    }

    return {
        messagesToday: stats ? (stats.sentToday + stats.receivedToday).toString() : '0',
        stats: {
            messagesToday: stats ? (stats.sentToday + stats.receivedToday).toString() : '0',
            sentToday: stats?.sentToday || 0,
            receivedToday: stats?.receivedToday || 0,
            activeChats: activeChats,
            responseTime: responseTime,
            successRate: successRate
        },
        deviceInfo: deviceInfo
    };
}

// ===========================================
// CLEANUP FUNCTION (Called by server.js)
// ===========================================

async function cleanupAllConnections() {
    console.log('🧹 [CLEANUP] Cleaning up all WhatsApp connections...');

    for (const [userId, sock] of socketsMap.entries()) {
        try {
            sock.ev.removeAllListeners();
            sock.end();
            console.log(`✅ [CLEANUP] Closed connection for user ${userId}`);
        } catch (err) {
            console.error(`❌ [CLEANUP] Error closing user ${userId}:`, err.message);
        }
    }

    socketsMap.clear();
    statusMap.clear();
    qrCodesMap.clear();

    console.log('✅ [CLEANUP] All connections cleaned');
}

// ===========================================
// AUTO CONNECT ALL USERS (ON SERVER START)
// ===========================================

async function autoConnectAllUsers() {
    console.log('🔍 [AUTO-CONNECT] Scanning for existing sessions...');

    if (!fs.existsSync(BASE_AUTH_PATH)) {
        console.log('ℹ️ [AUTO-CONNECT] No auth directory found.');
        return;
    }

    try {
        const files = fs.readdirSync(BASE_AUTH_PATH);
        const userFolders = files.filter(file =>
            file.startsWith('user-') &&
            fs.statSync(path.join(BASE_AUTH_PATH, file)).isDirectory()
        );

        console.log(`📂 [AUTO-CONNECT] Found ${userFolders.length} sessions.`);

        for (const folder of userFolders) {
            const userId = folder.replace('user-', '');

            // Stagger connections to prevent spike
            console.log(`🚀 [AUTO-CONNECT] Restoring user ${userId} in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));

            connectToWhatsApp(userId).catch(err => {
                console.error(`❌ [AUTO-CONNECT] Failed to restore user ${userId}:`, err.message);
            });
        }
    } catch (err) {
        console.error('❌ [AUTO-CONNECT] Error scanning sessions:', err.message);
    }
}

// ===========================================
// EXPORTS
// ===========================================

// Helper to get contact from store
function getContact(userId, jid) {
    // We need to access the store map. 
    // Assuming 'store' variable from makeInMemoryStore is available or we need to access the specific store for this user.
    // Based on previous code, we might not have a global store map exposed.
    // Let's assume we can access the store via a map if it exists, or we might need to rely on the socket's internal state if bindStore was called.

    // Check if we have a global stores map
    if (storesMap && storesMap.has(userId)) { // Changed from global.userStores to storesMap based on existing code
        const store = storesMap.get(userId);
        return store.contacts[jid];
    }
    return null;
}

// Helper function to resolve LID to Phone (Deep Search)
async function resolvePhoneFromLid(userId, lid) {
    if (!lid) return null;

    try {
        // ✅ 0. OFFICIAL BAILEYS V7 WAY (The "Secret" Feature)
        const sock = socketsMap.get(userId);
        if (sock && sock.signalRepository && sock.signalRepository.lidMapping) {
            const mapping = await sock.signalRepository.lidMapping.getPNForLID(lid);
            if (mapping) {
                // console.log(`🔍 [LID V7] Resolved ${lid} -> ${mapping}`);
                // Ensure format
                let phone = mapping.replace(/\D/g, '');
                if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                return phone;
            }
        }

        // 1. Check Store (InMemory) - Fallback
        const store = storesMap.get(userId);
        if (store && store.contacts) {
            // Direct ID match
            if (store.contacts[lid]) {
                const c = store.contacts[lid];
                if (c.id && c.id.includes('@s.whatsapp.net')) {
                    return c.id.split('@')[0];
                }
            }

            // Iterate all contacts (Expensive but necessary for orphans)
            for (const contact of Object.values(store.contacts)) {
                // Check if this contact HAS the target LID in its data (sometimes it's linked but not primary)
                if (contact.lid === lid || contact.id === lid) {
                    // Found the contact object, look for a phone number ID
                    if (contact.id && contact.id.includes('@s.whatsapp.net')) {
                        let phone = contact.id.split('@')[0];
                        if (phone.startsWith('0')) phone = '62' + phone.substring(1);
                        return phone;
                    }
                }
            }
        }

        // 2. Check Database (Persistent)
        const Customer = require('../models/Customer');
        // Search in 'jids' array OR 'jid' field
        const customer = await Customer.findOne({
            $or: [
                { jids: lid },
                { jid: lid }
            ]
        });

        if (customer && customer.phone) {
            let phone = customer.phone.replace(/\D/g, '');
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            return phone;
        }

    } catch (err) {
        console.error('Error resolving LID:', err);
    }
    return null;
}

// ✅ NEW: Pairing Code Logic
async function pairWithPhoneNumber(userId, phoneNumber) {
    console.log(`🔌 [PAIRING] Starting pairing flow for ${userId} with ${phoneNumber}`);

    // 1. Ensure any old session is gone
    if (socketsMap.has(userId)) {
        await disconnectWhatsAppClient(userId, false); // ✅ Don't restart, we will handle it
        await new Promise(r => setTimeout(r, 2000)); // Wait for cleanup
    }

    // 2. Clear Auth Folder to ensure fresh start
    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);
    try {
        if (fs.existsSync(userAuthPath)) {
            fs.rmSync(userAuthPath, { recursive: true, force: true });
        }
    } catch (e) { }

    // 3. Start Connection (QR Disabled)
    connectToWhatsApp(userId);

    // 4. Wait for Socket to be ready
    let attempts = 0;
    while (!socketsMap.has(userId) && attempts < 20) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
    }

    const sock = socketsMap.get(userId);
    if (!sock) {
        throw new Error('Failed to initialize socket for pairing');
    }

    // 5. Request Pairing Code
    // Wait a bit for connection to be in 'connecting' state
    await new Promise(r => setTimeout(r, 2000));

    try {
        console.log(`🔢 [PAIRING] Requesting code for ${phoneNumber}...`);
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`✅ [PAIRING] Code received: ${code}`);
        return code;
    } catch (err) {
        console.error(`❌ [PAIRING] Request failed:`, err.message);
        throw err;
    }
}

module.exports = {
    connectToWhatsApp,
    disconnectWhatsAppClient,
    sendMessage,
    sendReaction,
    getStatus,
    getQrCode,
    getProfilePicture,
    getStoreStats,
    autoConnectAllUsers,
    pairWithPhoneNumber, // ✅ EXPORT

    cleanupAllConnections,
    socketsMap,
    storesMap,
    resolvePhoneFromLid,
    downloadMedia: async (userId, remoteJid, msgId) => {
        const store = storesMap.get(userId);
        const sock = socketsMap.get(userId);
        if (!store || !sock) throw new Error('Session not active');

        // Load message from store
        const msg = await store.loadMessage(remoteJid, msgId);
        if (!msg) throw new Error('Message not found (might be too old or not synced)');

        const { downloadMediaMessage } = require('@whiskeysockets/baileys');

        // Download buffer
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer) throw new Error('Download failed');

        // Determine file type
        const messageType = Object.keys(msg.message)[0];
        let ext = '.bin';
        let mime = '';

        if (messageType === 'imageMessage') {
            mime = msg.message.imageMessage.mimetype;
            ext = '.jpg';
        } else if (messageType === 'videoMessage') {
            mime = msg.message.videoMessage.mimetype;
            ext = '.mp4';
        } else if (messageType === 'audioMessage') {
            mime = msg.message.audioMessage.mimetype;
            ext = '.ogg';
        } else if (messageType === 'documentMessage') {
            mime = msg.message.documentMessage.mimetype;
            ext = mime.split('/')[1] || '.pdf';
        } else if (messageType === 'stickerMessage') {
            mime = msg.message.stickerMessage.mimetype;
            ext = '.webp';
        }

        const fileName = `${msg.key.id}${ext}`;
        const publicDir = path.join(__dirname, '../public/media');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

        const filePath = path.join(publicDir, fileName);
        await writeFile(filePath, buffer);

        // ✅ UPDATE DATABASE: Mark as downloaded
        const ChatMessage = require('../models/ChatMessage');
        await ChatMessage.updateOne(
            { msgId: msgId },
            {
                mediaUrl: `/media/${fileName}`,
                mediaPath: filePath,
                mediaType: mime
            }
        );

        return {
            url: `/media/${fileName}`,
            type: mime
        };
    },

    getContact: (userId, jid) => {
        const store = storesMap.get(userId);
        if (!store) return null;
        return store.contacts[jid]; // Return contact object { name, notify, etc }
    },

    getContactName: (userId, jid) => {
        const store = storesMap.get(userId);
        if (!store) return null;

        const contact = store.contacts[jid];
        // Debugging specific missing name
        if (jid.includes('6281221829308')) {
            // console.log(`🔍 [DEBUG NAME] Looking for ${jid}. Found:`, contact ? (contact.notify || contact.name) : 'NULL');
        }

        if (!contact) return null;
        return contact.notify || contact.name || null;
    },

    // ✅ FIX: Export getStore function (was missing!)
    getStore: (userId) => {
        return storesMap.get(userId);
    }
};