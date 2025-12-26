// File: backend/utils/whatsappClient.js - ✅ COMPLETE WITH READ RECEIPTS FIXED

const makeWASocket = require('@whiskeysockets/baileys').default;
const { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    proto
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

// Import Setting model for read receipts
const Setting = require('../models/Setting');

// ===========================================
// MULTI-USER STORAGE MAPS
// ===========================================
const socketsMap = new Map();
const statsMap = new Map();
const qrCodesMap = new Map();
const statusMap = new Map();
const reconnectTimeouts = new Map();

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
                    console.log(`🔌 [AUTO-CONNECT] Restoring session for user: ${userId}`);
                    
                    await restoreSession(userId);
                    
                    console.log(`✅ [AUTO-CONNECT] User ${userId} session restored`);
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
// ✅ RESTORE EXISTING SESSION - FIXED
// ===========================================

async function restoreSession(userId) {
    const User = require('../models/User');
    
    if (socketsMap.has(userId)) {
        console.log(`ℹ️ [RESTORE] User ${userId} already connected`);
        return;
    }
    
    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);
    
    try {
        loadStats(userId);
        
        // ✅ Load user settings for read receipts
        const settings = await getUserSettings(userId);
        console.log(`⚙️ [RESTORE] Settings loaded - Read Receipts: ${settings.readReceiptsEnabled}`);
        
        const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            
            // ✅ READ RECEIPTS CONFIG - FIXED FIELD NAME
            syncFullHistory: settings.readReceiptsEnabled !== false,
            markOnlineOnConnect: settings.readReceiptsEnabled !== false,
            
            getMessage: async key => {
                return proto.WebMessageInfo.fromObject({});
            },
            shouldIgnoreJid: (jid) => jid.includes('broadcast') || jid.endsWith('@g.us'),
        });
        
        socketsMap.set(userId, sock);
        statusMap.set(userId, 'connecting');
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔴 [RESTORE] User ${userId} connection closed. Reconnecting: ${shouldReconnect}`);
                
                if (!shouldReconnect) {
                    console.log(`⚠️ [RESTORE] User ${userId} logged out - session invalid`);
                    socketsMap.delete(userId);
                    statusMap.set(userId, 'disconnected');
                    qrCodesMap.delete(userId);
                    
                    try {
                        await User.findByIdAndUpdate(userId, {
                            whatsappStatus: 'disconnected',
                            whatsappError: 'Session expired - please reconnect'
                        });
                    } catch (dbErr) {}
                } else {
                    console.log(`🔄 [RESTORE] Attempting reconnect for user ${userId}...`);
                    statusMap.set(userId, 'reconnecting');
                    
                    const existingTimeout = reconnectTimeouts.get(userId);
                    if (existingTimeout) clearTimeout(existingTimeout);
                    
                    const timeout = setTimeout(() => {
                        restoreSession(userId);
                    }, 5000);
                    reconnectTimeouts.set(userId, timeout);
                }
            } else if (connection === 'open') {
                console.log(`✅ [RESTORE] User ${userId} connected successfully!`);
                statusMap.set(userId, 'connected');
                qrCodesMap.delete(userId);
                
                try {
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'connected',
                        lastWhatsAppConnection: new Date(),
                        whatsappError: null
                    });
                } catch (dbErr) {}
            } else if (connection === 'connecting') {
                console.log(`🔄 [RESTORE] User ${userId} connecting...`);
                statusMap.set(userId, 'connecting');
            }
            
            if (qr) {
                console.log(`⚠️ [RESTORE] User ${userId} session invalid - QR required`);
                console.log(`💡 User needs to manually reconnect via /whatsapp page`);
                
                qrCodesMap.set(userId, qr);
                statusMap.set(userId, 'qrcode');
                
                try {
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'qrcode',
                        whatsappError: 'Session expired - please scan QR code'
                    });
                } catch (dbErr) {}
            }
        });
        
        sock.ev.on('messages.upsert', async m => {
            const message = m.messages[0];
            if (!message.key.fromMe) {
                updateChatActivity(userId, message.key.remoteJid, 'received', message.messageTimestamp);
            } else {
                updateChatActivity(userId, message.key.remoteJid, 'sent', message.messageTimestamp);
            }
        });
        
    } catch (err) {
        console.error(`❌ [RESTORE] Error restoring user ${userId}:`, err.message);
        
        statusMap.set(userId, 'disconnected');
        
        try {
            await User.findByIdAndUpdate(userId, {
                whatsappStatus: 'disconnected',
                whatsappError: err.message
            });
        } catch (dbErr) {}
        
        throw err;
    }
}

// ===========================================
// ✅ WHATSAPP CONNECTION (MANUAL) - FIXED
// ===========================================

async function connectToWhatsApp(userId) {
    console.log(`\n🔌 [CONNECT] Starting WhatsApp connection for user: ${userId}`);
    
    loadStats(userId);
    
    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);
    
    if (!fs.existsSync(userAuthPath)) {
        fs.mkdirSync(userAuthPath, { recursive: true });
    }
    
    try {
        // ✅ Load user settings for read receipts
        const settings = await getUserSettings(userId);
        console.log(`⚙️ [CONNECT] Settings loaded - Read Receipts: ${settings.readReceiptsEnabled}`);
        
        const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,
            
            // ✅ READ RECEIPTS CONFIG - FIXED FIELD NAME
            syncFullHistory: settings.readReceiptsEnabled !== false,
            markOnlineOnConnect: settings.readReceiptsEnabled !== false,
            
            getMessage: async key => {
                return proto.WebMessageInfo.fromObject({});
            },
            shouldIgnoreJid: (jid) => jid.includes('broadcast') || jid.endsWith('@g.us'),
        });
        
        socketsMap.set(userId, sock);
        statusMap.set(userId, 'connecting');

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodesMap.set(userId, qr);
                statusMap.set(userId, 'qrcode');
                console.log(`📸 [QR] QR Code generated for user ${userId}`);
            }

            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                console.log(`🔴 [CLOSE] Connection closed for user ${userId}. Reason:`, lastDisconnect?.error?.message, '| Reconnecting:', shouldReconnect);

                if (!shouldReconnect) {
                    console.log(`👋 [LOGOUT] Session logged out for user ${userId}. Cleaning up...`);
                    
                    socketsMap.delete(userId);
                    qrCodesMap.delete(userId);
                    statusMap.set(userId, 'disconnected');
                    
                    try {
                        fs.rmSync(userAuthPath, { recursive: true, force: true });
                        console.log(`✅ [CLEANUP] Auth files deleted for user ${userId}`);
                    } catch (err) {
                        console.error(`⚠️ [CLEANUP] Error deleting auth files for user ${userId}:`, err.message);
                    }

                    console.log(`🔄 [RESTART] Restarting client for user ${userId} to generate new QR...`);
                    setTimeout(() => {
                        connectToWhatsApp(userId);
                    }, 2000);
                    return;
                }
                
                statusMap.set(userId, 'reconnecting');
                const existingTimeout = reconnectTimeouts.get(userId);
                if (existingTimeout) clearTimeout(existingTimeout);
                
                const timeout = setTimeout(() => {
                    connectToWhatsApp(userId);
                }, 5000);
                reconnectTimeouts.set(userId, timeout);

            } else if (connection === 'open') {
                statusMap.set(userId, 'connected');
                qrCodesMap.delete(userId);
                
                const userName = sock.user?.name || sock.user?.notify || sock.user?.id?.split(':')[0] || 'Unknown';
                const userNumber = sock.user?.id?.split(':')[0] || 'Unknown';
                console.log(`✅ [CONNECTED] User ${userId} connected as ${userName} (${userNumber})`);
            }
        });
        
        sock.ev.on('messages.upsert', async m => {
            const message = m.messages[0];
            if (!message.key.fromMe) {
                updateChatActivity(userId, message.key.remoteJid, 'received', message.messageTimestamp);
            } else {
                updateChatActivity(userId, message.key.remoteJid, 'sent', message.messageTimestamp);
            }
        });
        
    } catch (error) {
        console.error(`❌ [ERROR] Connection error for user ${userId}:`, error.message);
        statusMap.set(userId, 'error');
    }
}

// ===========================================
// DISCONNECT / LOGOUT (PER USER)
// ===========================================

async function disconnectWhatsAppClient(userId) {
    console.log(`\n🚪 [DISCONNECT] Manual disconnect requested for user: ${userId}`);
    
    const sock = socketsMap.get(userId);
    
    if (sock) {
        try {
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
    
    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);
    try {
        console.log(`🗑️ [CLEANUP] Deleting session files for user ${userId}...`);
        fs.rmSync(userAuthPath, { recursive: true, force: true });
        console.log(`✅ [CLEANUP] Session files deleted for user ${userId}`);
    } catch (e) {
        console.error(`⚠️ [CLEANUP] Failed to delete auth files for user ${userId}:`, e.message);
    }
    
    console.log(`🔄 [RESTART] Initializing new session for user ${userId}...`);
    setTimeout(() => {
        connectToWhatsApp(userId);
    }, 1500);
}

// ===========================================
// SEND MESSAGE (PER USER)
// ===========================================

async function sendMessage(userId, nomor, pesan) {
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
        
        await sock.sendMessage(jid, { text: pesan });
        
        console.log(`✅ [SEND] Message sent successfully by user ${userId} to ${waNumber}`);
        
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

function getStatus(userId) {
    return statusMap.get(userId) || 'disconnected';
}

function getQrCode(userId) {
    return qrCodesMap.get(userId) || null;
}

function getStoreStats(userId) {
    checkDailyReset(userId);
    
    const stats = statsMap.get(userId);
    const sock = socketsMap.get(userId);
    
    if (!stats) {
        return {
            messagesToday: '0',
            stats: {
                messagesToday: '0',
                sentToday: 0,
                receivedToday: 0,
                activeChats: '0',
                responseTime: '0s',
                successRate: '100%'
            },
            deviceInfo: null
        };
    }
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeChats = Object.values(stats.chats).filter(chat => chat.lastActivity > oneDayAgo).length.toString();
    
    const responseTime = calculateAverageResponseTime(stats.responseTimes || []);
    const successRate = calculateSuccessRate(stats.deliveryStatus || { success: 0, failed: 0 });
    
    let deviceInfo = null;
    if (sock && sock.user && statusMap.get(userId) === 'connected') {
        const userIdWA = sock.user.id ? sock.user.id.split(':')[0] : 'Unknown';
        
        const rawName = sock.user.name || sock.user.notify || '';
        
        const isNameSameAsNumber = 
            rawName === userIdWA || 
            rawName === `+${userIdWA}` ||
            rawName === `${userIdWA}` ||
            rawName.replace(/\D/g, '') === userIdWA;
        
        const userName = (isNameSameAsNumber || !rawName) 
            ? 'WhatsApp User'
            : rawName;
        
        const platformName = 
            sock.user.platform || 
            sock.user.phone?.platform || 
            sock.user.phone?.device_manufacturer || 
            sock.browser?.join(' ') ||
            'WhatsApp MD Client';
            
        deviceInfo = {
            number: userIdWA,
            name: userName,
            platform: platformName
        };
    }
    
    return {
        messagesToday: (stats.sentToday + stats.receivedToday).toString(),
        stats: {
            messagesToday: (stats.sentToday + stats.receivedToday).toString(),
            sentToday: stats.sentToday,
            receivedToday: stats.receivedToday,
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
// EXPORTS
// ===========================================

module.exports = {
    connectToWhatsApp,
    disconnectWhatsAppClient,
    sendMessage,
    getStatus,
    getQrCode,
    getStoreStats,
    autoConnectAllUsers,
    restoreSession,
    cleanupAllConnections
};