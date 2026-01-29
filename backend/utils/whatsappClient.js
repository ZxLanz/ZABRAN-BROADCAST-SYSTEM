// File: backend/utils/whatsappClient.js - ✅ COMPLETE WITH READ RECEIPTS FIXED

const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    proto
} = require('@whiskeysockets/baileys');
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

// ===========================================
// MULTI-USER STORAGE MAPS
// ===========================================
const socketsMap = new Map();
const statsMap = new Map();
const qrCodesMap = new Map();
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

        // ✅ INITIALIZE STORE
        const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
        const storePath = path.join(userAuthPath, 'baileys_store_multi.json');
        try {
            store.readFromFile(storePath);
        } catch (err) { }

        // Save store periodically (CLEANUP FIRST)
        if (storeIntervals.has(userId)) {
            clearInterval(storeIntervals.get(userId));
        }

        const intervalId = setInterval(() => {
            store.writeToFile(storePath);
        }, 10_000);
        storeIntervals.set(userId, intervalId);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,

            // ✅ READ RECEIPTS CONFIG - FIXED FIELD NAME
            syncFullHistory: settings.readReceiptsEnabled !== false,
            markOnlineOnConnect: settings.readReceiptsEnabled !== false,

            // ✅ ENABLE STORE
            getMessage: async key => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return proto.WebMessageInfo.fromObject({});
            },
            shouldIgnoreJid: (jid) => jid.includes('broadcast') || jid.endsWith('@g.us'),
        });

        // ✅ BIND STORE (SAFE BIND)
        try {
            store.bind(sock.ev);
            storesMap.set(userId, store);
        } catch (bindErr) {
            console.error(`❌ [STORE] Failed to bind in restoreSession:`, bindErr);
        }

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
                    } catch (dbErr) { }
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
                } catch (dbErr) { }
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
                } catch (dbErr) { }
            }
        });

        sock.ev.on('messages.upsert', async m => {
            try {
                // ✅ NEW: Loop through ALL messages to capture History Sync
                for (const msg of m.messages) {
                    if (!msg.message) continue; // Ignore system messages

                    const isFromMe = msg.key.fromMe;
                    let remoteJid = msg.key.remoteJid;

                    // 🛠️ FIX: Map LID to Phone Number if possible
                    if (remoteJid.endsWith('@lid') && !isFromMe) {
                        if (msg.key.participant && msg.key.participant.endsWith('@s.whatsapp.net')) {
                            console.log(`🔄 [JID FIX] Swapping LID ${remoteJid} -> ${msg.key.participant}`);
                            remoteJid = msg.key.participant;
                        }
                    }

                    // DEBUG AI
                    const fs = require('fs');
                    fs.appendFileSync('debug_ai.log', `[${new Date().toISOString()}] MSG: ${remoteJid} (Me:${isFromMe})\n`);

                    // Update Stats (Existing)
                    if (!isFromMe) {
                        updateChatActivity(userId, remoteJid, 'received', msg.messageTimestamp);
                    } else {
                        updateChatActivity(userId, remoteJid, 'sent', msg.messageTimestamp);
                    }

                    // ✅ NEW: Save Chat to Database
                    const ChatMessage = require('../models/ChatMessage');
                    const { getIO } = require('../services/socket');

                    // Extract Message Content
                    const messageType = Object.keys(msg.message)[0];

                    // HANDLE REVOKE (Delete for Everyone)
                    if (messageType === 'protocolMessage' && msg.message.protocolMessage?.type === 0) {
                        continue;
                    }

                    let content = '';
                    if (messageType === 'conversation') {
                        content = msg.message.conversation;
                    } else if (messageType === 'extendedTextMessage') {
                        content = msg.message.extendedTextMessage.text;
                    } else if (messageType === 'imageMessage') {
                        content = msg.message.imageMessage.caption || '[Image]';
                    } else if (messageType === 'audioMessage') {
                        // 🎤 VOICE NOTE HANDLING (BACKGROUND PROCESS)
                        // Fire-and-forget to prevent blocking the main event loop
                        (async () => {
                            try {
                                console.log('⏳ [Voice Background] Waiting 2s before download...');
                                await new Promise(r => setTimeout(r, 2000));

                                // 🛡️ CLONE MESSAGE
                                const msgClone = JSON.parse(JSON.stringify(msg));

                                // Using downloadContentFromMessage for safety (Passive Download)
                                const stream = await downloadContentFromMessage(msgClone.message.audioMessage, 'audio');
                                let buffer = Buffer.from([]);
                                for await (const chunk of stream) {
                                    buffer = Buffer.concat([buffer, chunk]);
                                }

                                const safeId = (msg.key.id || Date.now().toString()).replace(/[^a-zA-Z0-9]/g, '');
                                const tempPath = path.join(__dirname, `../temp_audio_${safeId}.ogg`);
                                fs.writeFileSync(tempPath, buffer);

                                const text = await transcribeAudio(tempPath);

                                // Cleanup
                                try { fs.unlinkSync(tempPath); } catch (e) { }

                                // UPDATE DATABASE & TRIGGER AI
                                if (text) {
                                    console.log(`🎤 [Voice] Transcribed: "${text}"`);
                                    const finalContent = `🎤 ${text}`;

                                    // 1. Update DB
                                    await ChatMessage.updateOne(
                                        { msgId: msg.key.id },
                                        { content: finalContent }
                                    );

                                    // 2. Emit Socket Update
                                    try {
                                        const io = getIO();
                                        io.emit('message_update', { msgId: msg.key.id, content: finalContent });
                                    } catch (e) { }

                                    // 3. TRIGGER AI (Late)
                                    if (!isFromMe && !remoteJid.includes('@g.us') && !remoteJid.includes('@newsletter')) {
                                        // ✅ FETCH SETTINGS INSIDE BACKGROUND PROCESS
                                        const settings = await getUserSettings(userId);

                                        if (settings.autoReply || settings.autoReplyEnabled) {
                                            // Trigger AI
                                            const promptText = `User mengirim Voice Note.\nTranskripsi: "${text}"\n\nJawablah dengan relevan.`;
                                            const reply = await aiService.getAutoReply(promptText);
                                            if (reply) {
                                                await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                                            }
                                        }
                                    }
                                }
                            } catch (err) {
                                console.error('❌ [Voice Background] Error:', err.message);
                            }
                        })();

                        // Set placeholder immediately so UI shows something
                        content = '[Voice Note] (Processing...)';
                        // 📸 IMAGE HANDLING
                        try {
                            // 🛡️ CLONE MESSAGE
                            const msgClone = JSON.parse(JSON.stringify(msg));

                            // Using downloadContentFromMessage for safety (Passive Download)
                            const stream = await downloadContentFromMessage(msgClone.message.imageMessage, 'image');
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                buffer = Buffer.concat([buffer, chunk]);
                            }

                            // Convert to Base64 for AI
                            const base64Image = buffer.toString('base64');

                            // Caption is the text content
                            const caption = msg.message.imageMessage.caption || '';
                            content = caption ? `[GAMBAR] ${caption}` : '[GAMBAR] (Tanpa Caption)';
                            msg.hasCaption = !!caption; // Flag to determine if AI should reply

                            // Attach image to message object strictly for AI processing later
                            // We don't save base64 to DB to save space, just marker in content
                            msg.base64Image = base64Image;

                        } catch (err) {
                            console.error('❌ [Image] Error processing:', err.message);
                            content = '[Image] (Error Download)';
                        }
                    } else {
                        content = `[${messageType}]`;
                    }

                    // Verify if message already exists (deduplication)
                    const existing = await ChatMessage.findOne({ msgId: msg.key.id });

                    if (!existing) {
                        // Extract phone number from remoteJid
                        let extractedPhone = null;
                        if (remoteJid.includes('@s.whatsapp.net')) {
                            const before = remoteJid.split('@')[0].split(':')[0];
                            extractedPhone = before.replace(/\D/g, '');
                            if (extractedPhone.startsWith('0')) {
                                extractedPhone = '62' + extractedPhone.substring(1);
                            }
                        }

                        // Extract Quoted Message Info
                        let quotedMsg = null;
                        const contextInfo = msg.message?.extendedTextMessage?.contextInfo ||
                            msg.message?.imageMessage?.contextInfo ||
                            msg.message?.videoMessage?.contextInfo ||
                            msg.message?.audioMessage?.contextInfo;

                        if (contextInfo && contextInfo.quotedMessage) {
                            const qm = contextInfo.quotedMessage;
                            const qContent = qm.conversation || qm.extendedTextMessage?.text || (qm.imageMessage ? '[Image]' : '[Media]');
                            quotedMsg = {
                                content: qContent,
                                participant: contextInfo.participant || contextInfo.remoteJid,
                                id: contextInfo.stanzaId
                            };
                        }

                        const newChat = await ChatMessage.create({
                            userId: userId,
                            remoteJid: remoteJid,
                            fromMe: isFromMe,
                            msgId: msg.key.id,
                            messageType: messageType.replace('Message', ''),
                            content: content,
                            timestamp: new Date(msg.messageTimestamp * 1000),
                            pushName: msg.pushName || 'Unknown',
                            extractedPhone: extractedPhone,
                            status: isFromMe ? 'sent' : undefined,
                            quotedMsg: quotedMsg // ✅ SAVE QUOTE
                        });

                        // 🤖 AI AUTO REPLY LOGIC (WITH CONTEXT)
                        // Block: Channels (@newsletter) and Groups (@g.us)
                        // SKIP if content is processing (Audio)
                        if (!isFromMe && content && !content.includes('(Processing...)') && !remoteJid.includes('@g.us') && !remoteJid.includes('@newsletter')) {

                            // 🛑 SKIP IMAGE IF NO CAPTION
                            if (messageType === 'imageMessage' && !msg.hasCaption) {
                                console.log(`🛑 [AI] Skipping Image without caption from ${remoteJid}`);
                                continue;
                            }

                            try {
                                const settings = await getUserSettings(userId);

                                if (settings.autoReply || settings.autoReplyEnabled) {
                                    // Fetch History
                                    try {
                                        const history = await ChatMessage.find({ userId, remoteJid })
                                            .sort({ timestamp: -1 })
                                            .limit(10);

                                        if (history.length > 0) {
                                            const context = history.reverse().map(m => {
                                                const role = m.fromMe ? 'CS (Anda)' : 'Customer';
                                                return `${role}: ${m.content}`;
                                            }).join('\n');

                                            // 🔍 FETCH CUSTOMER DATA
                                            const Customer = require('../models/Customer');
                                            const customer = await Customer.findOne({ phone: extractedPhone });

                                            let customerContext = `ID: ${extractedPhone}`;
                                            if (customer) {
                                                customerContext += `\nNama: ${customer.name}`;
                                                if (customer.tags && customer.tags.length > 0) customerContext += `\nTags: ${customer.tags.join(', ')}`;
                                                if (customer.notes) customerContext += `\nCatatan Customer: ${customer.notes}`;
                                            } else {
                                                // Handle unknown customer
                                                customerContext += `\n(Customer baru/belum tersimpan)`;
                                            }

                                            // 🧠 KNOWLEDGE BASE (Refined for "Republic Laptop")
                                            const knowledgeBase = `
INFO BISNIS "REPUBLIC LAPTOP":

📍 BANDUNG (PUSAT)
- Alamat: Jl. Perintis No.1, Sarijadi, Kec. Sukasari, Kota Bandung, Jawa Barat 40151
- Maps: https://maps.app.goo.gl/nLtscFnDYZpC5GT47
- Jam Buka: 
  * Senin: 11.00–20.30
  * Selasa - Minggu: 09.30–20.30
- No Telepon: 0877-7770-8083
- Website: https://republiclaptop.id/
- Katalog: https://wa.me/c/273233068748970

📍 SOLO (CABANG)
- Alamat: Jl. Garuda Mas No.09-12, Gatak, Karangasem, Kec. Kartasura, Solo, Jawa Tengah 57169
- Maps: https://maps.app.goo.gl/RQW7MYx8Vt2v3JNc8
- Jam Buka:
  * Senin: 11.00–20.30
  * Selasa - Minggu: 09.30–20.30
- No Telepon: 0877-8688-8882
- Website: https://republiclaptop.id/toko-laptop-solo/

PANDUAN PERSONA CS:
1. Nama: CS Republic Laptop (Gunakan bahasa "Saya" atau "Kami").
2. Gaya Bahasa: Ramah, Membantu, Santai tapi Sopan (Boleh pakai emoji wajar).
3. Tujuan: Arahkan customer untuk beli laptop, service, atau visit store.
4. Jika tanya stok/harga spesifik: Arahkan cek katalog atau website, atau minta detail kebutuhan mereka.
5. Jika ada Gambar Laptop Rusak: Berikan empati, lalu sarankan bawa ke store untuk pengecekan gratis.

Data Customer:
${customerContext}`;

                                            const promptText = `
Instruksi: Anda adalah CS Republic Laptop. Jawab pesan customer berdasarkan Info Bisnis di bawah.
HANYA JAWAB apa yang ditanya. Jangan berikan info yang tidak relevan.

${knowledgeBase}

Konteks Percakapan:
${context}

Pesan Terakhir Customer: "${content}"
(Jika ada gambar, perhatikan visualnya)

Respon (Singkat, Padat, Ramah):`;

                                            // Check for Image Payload
                                            let images = [];
                                            if (msg.base64Image) {
                                                images.push(msg.base64Image);
                                            }

                                            const reply = await aiService.getAutoReply(promptText, images);

                                            if (reply) {
                                                console.log(`🤖 [AI] Replying to ${remoteJid}`);
                                                setTimeout(async () => {
                                                    await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                                                }, Math.random() * 3000 + 2000);
                                            }
                                        }
                                    } catch (histErr) {
                                        console.error('History fetch failed:', histErr);
                                    }
                                }
                            } catch (aiErr) {
                                console.error('❌ [AI] AutoReply failed:', aiErr.message);
                            }
                        }

                        // Emit to frontend
                        try {
                            const io = getIO();
                            io.emit('new_message', {
                                userId,
                                message: newChat
                            });
                        } catch (err) { }
                    }
                }
            } catch (err) {
                console.error('❌ Error processing incoming message:', err);
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
        } catch (dbErr) { }

        throw err;
    }
}

// ===========================================
// ✅ WHATSAPP CONNECTION (MANUAL) - FIXED
// ===========================================

async function connectToWhatsApp(userId) {
    if (!userId || userId === 'undefined') {
        console.error('❌ [CONNECT] Cannot connect: userId is invalid', userId);
        return;
    }
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

        // ✅ INITIALIZE STORE
        const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
        const storePath = path.join(userAuthPath, 'baileys_store_multi.json');

        try {
            if (fs.existsSync(storePath)) {
                store.readFromFile(storePath);
                console.log(`✅ [STORE] Loaded existing store for user ${userId}`);
            }
        } catch (err) {
            console.error(`⚠️ [STORE] Corrupt store file detected for user ${userId}. Recreating...`);
            try {
                fs.unlinkSync(storePath);
            } catch (delErr) { }
        }

        // Save store periodically (CLEANUP FIRST)
        if (storeIntervals.has(userId)) {
            clearInterval(storeIntervals.get(userId));
        }

        const intervalId = setInterval(() => {
            store.writeToFile(storePath);
        }, 10_000);
        storeIntervals.set(userId, intervalId);

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            auth: state,

            // ✅ READ RECEIPTS CONFIG - FIXED FIELD NAME
            syncFullHistory: settings.readReceiptsEnabled !== false,
            markOnlineOnConnect: settings.readReceiptsEnabled !== false,

            // ✅ ENABLE STORE
            getMessage: async key => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return proto.WebMessageInfo.fromObject({});
            },
            shouldIgnoreJid: (jid) => jid.includes('broadcast') || jid.endsWith('@g.us'),
        });

        // ✅ BIND STORE (SAFE BIND)
        try {
            store.bind(sock.ev);
            storesMap.set(userId, store);
            console.log(`✅ [STORE] Store bound for user ${userId}`);
        } catch (bindErr) {
            console.error(`❌ [STORE] Failed to bind:`, bindErr);
        }

        console.log(`📡 [CONNECT] Socket created for user ${userId}. Waiting for connection update...`);


        socketsMap.set(userId, sock);
        statusMap.set(userId, 'connecting');

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                qrCodesMap.set(userId, qr);
                statusMap.set(userId, 'qrcode');
                console.log(`📸 [QR] QR Code generated for user ${userId}. Scan now!`);
            }

            if (connection) {
                console.log(`🔄 [UPDATE] Connection update for user ${userId}: ${connection}`);
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

                try {
                    const User = require('../models/User');
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'connected',
                        lastWhatsAppConnection: new Date(),
                        whatsappError: null
                    });
                } catch (dbErr) { }
            }

        });

        // ... inside connectToWhatsApp ...

        sock.ev.on('messages.upsert', async m => {
            try {
                // ✅ NEW: Loop through ALL messages to capture History Sync
                for (const msg of m.messages) {
                    if (!msg.message) continue; // Ignore system messages

                    const isFromMe = msg.key.fromMe;
                    const remoteJid = msg.key.remoteJid;

                    // DEBUG AI
                    // Debug log
                    // console.log(`[${new Date().toISOString()}] MSG: ${remoteJid} (Me:${isFromMe})`);

                    // Update Stats (Existing)
                    if (!isFromMe) {
                        updateChatActivity(userId, remoteJid, 'received', msg.messageTimestamp);

                        // ✅ CHECK SETTINGS FOR AUTO READ
                        try {
                            const Setting = require('../models/Setting');
                            const userSettings = await Setting.findOne({ userId });

                            // Only mark read if Auto Read is ON
                            if (userSettings?.autoRead) {
                                await sock.readMessages([msg.key]);
                                // console.log(`✅ [AUTO READ] Message from ${remoteJid} marked as read`);
                            }
                        } catch (e) {
                            console.error('Auto Read Error:', e.message);
                        }
                    } else {
                        updateChatActivity(userId, remoteJid, 'sent', msg.messageTimestamp);
                    }

                    // ✅ NEW: Save Chat to Database
                    const ChatMessage = require('../models/ChatMessage');
                    const { getIO } = require('../services/socket');

                    // ... (rest of upsert logic) ...



                    // Extract Message Content
                    const messageType = Object.keys(msg.message)[0];

                    // HANDLE REVOKE (Delete for Everyone)
                    if (messageType === 'protocolMessage' && msg.message.protocolMessage?.type === 0) {
                        console.log(`🛡️ [PERSISTENCE] Ignored WhatsApp deletion for msg: ${msg.message.protocolMessage.key.id}. Keeping persistent copy.`);
                        continue; // Ignore completely to keep message in DB
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

                            // Ensure directory exists
                            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

                            const filePath = path.join(publicDir, fileName);
                            await writeFile(filePath, buffer);

                            console.log(`📸 [MEDIA] Saved: ${fileName}`);
                            return {
                                path: filePath,
                                url: `/media/${fileName}`, // Public URL
                                type: mime
                            };

                        } catch (err) {
                            console.error('❌ [MEDIA] Download failed:', err.message);
                            return null;
                        }
                    };

                    let content = '';
                    let mediaInfo = null;

                    // CHECK & DOWNLOAD MEDIA
                    if (messageType === 'imageMessage' ||
                        messageType === 'videoMessage' ||
                        messageType === 'audioMessage' ||
                        messageType === 'documentMessage' ||
                        messageType === 'stickerMessage') {

                        mediaInfo = await saveMedia(msg);

                        if (messageType === 'imageMessage') content = msg.message.imageMessage.caption || '[Image]';
                        else if (messageType === 'videoMessage') content = msg.message.videoMessage.caption || '[Video]';
                        else if (messageType === 'stickerMessage') content = '[Sticker]';
                        else content = `[${messageType}]`;
                    }
                    else if (messageType === 'conversation') { // ... existing logic
                        content = msg.message.conversation;
                    } else if (messageType === 'extendedTextMessage') {
                        content = msg.message.extendedTextMessage.text;
                    } else if (messageType === 'imageMessage') {
                        content = msg.message.imageMessage.caption || '[Image]';
                    } else {
                        content = `[${messageType}]`;
                    }

                    // Verify if message already exists (deduplication)
                    const existing = await ChatMessage.findOne({ msgId: msg.key.id });

                    if (!existing) {
                        // Extract phone number from remoteJid
                        let extractedPhone = null;
                        if (remoteJid.includes('@s.whatsapp.net')) {
                            const before = remoteJid.split('@')[0].split(':')[0];
                            extractedPhone = before.replace(/\D/g, '');
                            if (extractedPhone.startsWith('0')) {
                                extractedPhone = '62' + extractedPhone.substring(1);
                            }
                        }

                        const newChat = await ChatMessage.create({
                            userId: userId,
                            remoteJid: remoteJid,
                            fromMe: isFromMe,
                            msgId: msg.key.id,
                            messageType: messageType.replace('Message', ''),
                            content: content,
                            timestamp: new Date(msg.messageTimestamp * 1000), // Convert to JS Date
                            pushName: msg.pushName || 'Unknown',
                            extractedPhone: extractedPhone,
                            status: isFromMe ? 'sent' : undefined,
                            // Save Media Fields
                            mediaUrl: mediaInfo?.url,
                            mediaPath: mediaInfo?.path,
                            mediaType: mediaInfo?.type
                        });

                        // 🤖 AI AUTO REPLY LOGIC (WITH CONTEXT)
                        if (!isFromMe && content && !remoteJid.includes('@g.us')) {
                            console.log(`[AI] Checking... Content: ${content.substring(0, 20)}`);
                            try {
                                const settings = await getUserSettings(userId);
                                console.log(`[AI] Settings: AutoReply=${settings.autoReply}, Enabled=${settings.autoReplyEnabled}`);

                                if (settings.autoReply || settings.autoReplyEnabled) {
                                    // Default prompt logic
                                    let promptText = content;

                                    // Fetch History
                                    try {
                                        const history = await ChatMessage.find({ userId, remoteJid })
                                            .sort({ timestamp: -1 })
                                            .limit(10);

                                        if (history.length > 0) {
                                            const context = history.reverse().map(m => {
                                                const role = m.fromMe ? 'CS (Anda)' : 'Customer';
                                                return `${role}: ${m.content}`;
                                            }).join('\n');

                                            // 🔍 FETCH CUSTOMER DATA
                                            const Customer = require('../models/Customer');
                                            const customer = await Customer.findOne({ phone: extractedPhone });

                                            let customerContext = `ID: ${extractedPhone}`;
                                            if (customer) {
                                                customerContext += `\nNama: ${customer.name}`;
                                                if (customer.tags && customer.tags.length > 0) customerContext += `\nTags: ${customer.tags.join(', ')}`;
                                                if (customer.notes) customerContext += `\nCatatan Customer: ${customer.notes}`;
                                            } else {
                                                customerContext += `\n(Customer ini belum terdaftar di database)`;
                                            }

                                            // 🧠 KNOWLEDGE BASE (Updated from User Data)
                                            const knowledgeBase = `
INFO BISNIS "REPUBLIC LAPTOP":
- Alamat: Jl. Perintis No.1, Sarijadi, Kec. Sukasari, Kota Bandung, Jawa Barat 40151.
- Google Maps: https://maps.app.goo.gl/republic-laptop
- Jam Operasional: Senin-Jumat 09.00-17.00, Sabtu 09.00-15.00, Minggu TUTUP.
- Layanan: Jual Beli Laptop (Baru/Second), Service (Ganti LCD, Baterai, dll), Sparepart.
- Instagram: @republiclaptop.id | Linktree: https://linktr.ee/republiclaptop.id

PANDUAN MENJAWAB:
- Jawab ramah sebagai CS Republic Laptop.
- Gunakan bahasa Indonesia yang santai tapi sopan.
- Pendek dan padat (maksimal 2-3 kalimat).`;

                                            promptText = `
Role: Anda adalah Customer Service "Republic Laptop".
Tugas: Balas pesan terakhir customer.
Aturan:
1. Jawab langsung seolah-olah Anda sedang chatting.
2. Pendek dan padat.

Info Bisnis:
${knowledgeBase}

Riwayat Chat:
${context}

Instruksi: Tulis balasan Anda sekarang.`;
                                        }
                                    } catch (histErr) {
                                        console.error('History fetch failed:', histErr);
                                    }

                                    // Restore Real Logic
                                    const reply = await aiService.getAutoReply(promptText);

                                    if (reply) {
                                        console.log(`🤖 [AI] Replying to ${remoteJid}`);
                                        setTimeout(async () => {
                                            await sock.sendMessage(remoteJid, { text: reply }, { quoted: msg });
                                            console.log(`[AI] SENT to ${remoteJid}`);
                                        }, Math.random() * 3000 + 2000);
                                    } else {
                                        console.log(`[AI] NO REPLY from Service`);
                                    }
                                } else {
                                    console.log(`[AI] Disabled in settings`);
                                }
                            } catch (aiErr) {
                                console.error('❌ [AI] AutoReply failed:', aiErr.message);
                                console.error('❌ [AI] AutoReply failed:', aiErr.message);
                            }
                        }

                        // Emit to frontend
                        try {
                            const io = getIO();
                            io.emit('new_message', {
                                userId,
                                message: newChat
                            });
                        } catch (err) {
                            // Socket might not be ready, ignore
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Error processing incoming message:', err);
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
                                io.emit('message_status_update', {
                                    messageId: key.id,
                                    status: newStatus,
                                    userId
                                });
                            } else {
                                console.error(`❌ [DB] Update failed: Message ${key.id} not found`);
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

async function restoreSession(userId) {
    if (!userId || userId === 'undefined') {
        console.error('❌ [RESTORE] Cannot restore: userId is invalid', userId);
        return;
    }
    console.log(`\n🔄 [RESTORE] Restoring session for user: ${userId}`);

    const userAuthPath = path.join(BASE_AUTH_PATH, `user-${userId}`);

    if (!fs.existsSync(userAuthPath)) {
        console.log(`ℹ️ [RESTORE] No session folder for user ${userId}`);
        return;
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(userAuthPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
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
                        const User = require('../models/User');
                        await User.findByIdAndUpdate(userId, {
                            whatsappStatus: 'disconnected',
                            whatsappError: 'Session expired - please reconnect'
                        });
                    } catch (dbErr) { }
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
                    const User = require('../models/User');
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'connected',
                        lastWhatsAppConnection: new Date(),
                        whatsappError: null
                    });
                } catch (dbErr) { }
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
                    const User = require('../models/User');
                    await User.findByIdAndUpdate(userId, {
                        whatsappStatus: 'qrcode',
                        whatsappError: 'Session expired - please scan QR code'
                    });
                } catch (dbErr) { }
            }
        });

        sock.ev.on('messages.upsert', async m => {
            try {
                for (const msg of m.messages) {
                    if (!msg.message) continue;

                    const isFromMe = msg.key.fromMe;
                    const remoteJid = msg.key.remoteJid;
                    const msgId = msg.key.id;

                    console.log(`📥 [UPSERT] Msg: ${msgId} | Jid: ${remoteJid} | FromMe: ${isFromMe}`);

                    // ✅ FIX: Send Read Receipt (Blue Tick) for incoming
                    if (!isFromMe) {
                        updateChatActivity(userId, remoteJid, 'received', msg.messageTimestamp);
                        try {
                            // Only ack if it's a real chat (not status/broadcast)
                            if (!remoteJid.includes('status@broadcast')) {
                                await sock.readMessages([msg.key]);
                            }
                        } catch (e) {
                            console.error('Failed to send read receipt:', e.message);
                        }
                    } else {
                        updateChatActivity(userId, remoteJid, 'sent', msg.messageTimestamp);
                    }

                    // Extract Content - Robust Method
                    const messageType = Object.keys(msg.message).find(key =>
                        key !== 'senderKeyDistributionMessage' &&
                        key !== 'messageContextInfo'
                    ) || Object.keys(msg.message)[0];

                    let content = '';

                    // Protocol Message (Revoke/Delete)
                    if (messageType === 'protocolMessage') {
                        console.log(`🛡️ [UPSERT] Protocol/Delete msg ${msgId} ignored.`);
                        continue;
                    }

                    // Standard Types
                    if (messageType === 'conversation') {
                        content = msg.message.conversation;
                    } else if (messageType === 'extendedTextMessage') {
                        content = msg.message.extendedTextMessage.text;
                    } else if (messageType === 'imageMessage') {
                        content = msg.message.imageMessage.caption || '[Image]';
                    } else if (messageType === 'videoMessage') {
                        content = msg.message.videoMessage.caption || '[Video]';
                    } else if (messageType === 'stickerMessage') {
                        content = '[Sticker]';
                    } else if (messageType === 'audioMessage') {
                        content = '[Voice Note]';
                        // (Voice Note processing would go here)
                    } else if (messageType === 'documentMessage') {
                        content = msg.message.documentMessage.fileName || '[Document]';
                    } else {
                        content = `[${messageType}]`;
                    }

                    // DB Deduplication
                    const ChatMessage = require('../models/ChatMessage');
                    const existing = await ChatMessage.findOne({ msgId: msgId });

                    if (!existing) {
                        // Extract phone
                        let extractedPhone = null;
                        if (remoteJid.includes('@s.whatsapp.net')) {
                            extractedPhone = remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '');
                            if (extractedPhone.startsWith('0')) extractedPhone = '62' + extractedPhone.substring(1);
                        }

                        // Save to DB
                        const newChat = await ChatMessage.create({
                            userId: userId,
                            remoteJid: remoteJid,
                            fromMe: isFromMe,
                            msgId: msgId,
                            messageType: messageType.replace('Message', ''),
                            content: content,
                            timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000),
                            pushName: msg.pushName || 'Unknown',
                            extractedPhone: extractedPhone,
                            status: isFromMe ? 'sent' : undefined,
                        });

                        console.log(`💾 [DB] Saved msg ${msgId}: ${content.substring(0, 30)}...`);

                        // Emit to Frontend
                        try {
                            const io = getIO();
                            io.emit('new_message', {
                                userId,
                                message: newChat
                            });
                            console.log(`📡 [SOCKET] Emitted new_message to frontend`);
                        } catch (err) {
                            console.error('Socket emit failed:', err.message);
                        }

                        // AI Logic (Only if not from me)
                        if (!isFromMe && !remoteJid.includes('@g.us') && !remoteJid.includes('status')) {
                            // ... (AI Logic trigger)
                        }
                    } else {
                        console.log(`⏭️ [UPSERT] Duplicate msg ${msgId} skipped.`);
                    }
                }
            } catch (err) {
                console.error('❌ Error processing incoming message:', err);
            }
        });

        // ✅ HANDLE READ RECEIPTS / STATUS UPDATES
        sock.ev.on('messages.update', async updates => {
            try {
                const ChatMessage = require('../models/ChatMessage');
                const { getIO } = require('../services/socket');
                const io = getIO();

                for (const { key, update } of updates) {
                    console.log(`📨 [UPDATE] Msg: ${key.id} | Status: ${update.status}`);

                    if (update.status) {
                        let newStatus = 'sent';
                        // Baileys Status Map: 
                        // 1: PENDING
                        // 2: SERVER_ACK (Sent)
                        // 3: DELIVERY_ACK (Delivered)
                        // 4: READ (Read)
                        // 5: PLAYED (Audio Played)

                        if (update.status === 2) newStatus = 'sent';
                        else if (update.status === 3) newStatus = 'delivered';
                        else if (update.status >= 4) newStatus = 'read';

                        if (newStatus !== 'sent') {
                            const result = await ChatMessage.findOneAndUpdate(
                                { msgId: key.id },
                                { status: newStatus },
                                { new: true }
                            );

                            if (result) {
                                console.log(`✅ [DB] Msg ${key.id} updated to ${newStatus}`);
                                io.emit('message_status_update', {
                                    messageId: key.id,
                                    status: newStatus,
                                    userId
                                });
                            } else {
                                console.warn(`⚠️ [DB] Msg ${key.id} not found for update`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Error in messages.update:', err);
            }
        });


    } catch (err) {
        console.error(`❌ [RESTORE] Error restoring user ${userId}:`, err.message);

        statusMap.set(userId, 'disconnected');

        try {
            const User = require('../models/User');
            await User.findByIdAndUpdate(userId, {
                whatsappStatus: 'disconnected',
                whatsappError: err.message
            });
        } catch (dbErr) { }

        throw err;
    }
}

// ===========================================
// DISCONNECT / LOGOUT (PER USER)
// ===========================================

async function disconnectWhatsAppClient(userId) {
    if (!userId || userId === 'undefined') return;
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

    console.log(`🔄 [RESTART] Initializing new session for user ${userId}...`);
    setTimeout(() => connectToWhatsApp(userId), 1500);
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

        const sentMsg = await sock.sendMessage(jid, { text: pesan });

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

function getStatus(userId) {
    return statusMap.get(userId) || 'disconnected';
}

function getQrCode(userId) {
    return qrCodesMap.get(userId) || null;
}

// ===========================================
// GET PROFILE PICTURE
// ===========================================
async function getProfilePicture(userId, jid) {
    const sock = socketsMap.get(userId);
    if (!sock) {
        return null;
    }

    try {
        // Try to get high res first, fall back to low res
        let url;
        try {
            url = await sock.profilePictureUrl(jid, 'image'); // High Res
        } catch (e) {
            url = await sock.profilePictureUrl(jid, 'preview'); // Low Res / Privacy restricted
        }
        return url;
    } catch (err) {
        // 404 or Privacy settings
        // console.log(`⚠️ [Avatar] Failed for ${jid}: ${err.message}`);
        return null;
    }
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
    if (statusMap.get(userId) === 'connected') {
        const sock = socketsMap.get(userId);

        // DEBUG: Log everything we know about the user
        // console.log(`🔍 [DEBUG] User ${userId} Socket User:`, JSON.stringify(sock?.user, null, 2));
        // console.log(`🔍 [DEBUG] User ${userId} Auth Me:`, JSON.stringify(sock?.authState?.creds?.me, null, 2));

        // Triangulate User ID/Number
        const rawId = sock?.user?.id || sock?.authState?.creds?.me?.id;
        const userIdWA = rawId ? rawId.split(':')[0] : 'Unknown';

        // Triangulate Name
        // Baileys often puts the pushname in 'notify' or 'name' of the contact
        const rawName = sock?.user?.name || sock?.user?.notify || sock?.authState?.creds?.me?.name || 'WhatsApp User';

        // Filter out if name is just the phone number
        const isNameSameAsNumber =
            rawName === userIdWA ||
            rawName === `+${userIdWA}` ||
            rawName.replace(/\D/g, '') === userIdWA;

        const userName = (isNameSameAsNumber) ? 'WhatsApp User' : rawName;

        // Triangulate Platform
        // "WhatsApp MD Client" is the default from our previous code, let's try to find the real one
        // Note: interacting with the phone is required for some info to sync, but let's try available fields
        // In multi-device, the platform might be in the device info of the session
        let platformName = 'Unknown Platform';

        if (sock?.user?.platform) {
            platformName = sock.user.platform;
        } else if (sock?.authState?.creds?.platform) {
            platformName = sock.authState.creds.platform;
        } else if (userIdWA.length > 13) {
            // Basic heuristic: Virtual numbers often different length, but hard to guess OS
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
        // 1. Check Store (InMemory) - Most reliable for active session
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

module.exports = {
    connectToWhatsApp,
    disconnectWhatsAppClient,
    sendMessage,
    getStatus,
    getQrCode,
    getProfilePicture, // Export this
    getStoreStats,
    autoConnectAllUsers,
    restoreSession,
    cleanupAllConnections,
    socketsMap, // ✅ Exporting this to allow direct access in route handlers
    storesMap, // ✅ Export Store Map for Debug
    resolvePhoneFromLid, // ✅ Exported for chat.js
    getContact: (userId, jid) => {
        const store = storesMap.get(userId);
        if (!store) return null;
        return store.contacts[jid]; // Return contact object { name, notify, etc }
    }
};