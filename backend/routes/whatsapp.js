const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const {
    connectToWhatsApp,
    disconnectWhatsAppClient,
    sendMessage,
    getStatus,
    getQrCode,
    getStoreStats,
    getProfilePicture
} = require('../utils/whatsappClient');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
    notifyWhatsAppConnected,
    notifyWhatsAppDisconnected,
    notifyWhatsAppQRReady,
    notifyWhatsAppReconnecting,
    notifyWhatsAppError
} = require('../utils/notificationHelper');

// PROTECT ALL ROUTES
router.use(authenticate);

// ✅ NOTIFICATION DEBOUNCING
const qrNotificationLimits = new Map(); // Global map to track user notification timestamps

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper function untuk pesan status
function getStatusMessage(status, deviceInfo) {
    switch (status) {
        case 'connected':
            if (deviceInfo && deviceInfo.name) {
                return `Connected as ${deviceInfo.name} (${deviceInfo.number})`;
            }
            return 'Connected successfully.';
        case 'qrcode':
            return 'Scan QR Code to connect.';
        case 'reconnecting':
            return 'Reconnecting...';
        case 'error':
            return 'Connection error. Check backend logs.';
        case 'disconnected':
        default:
            return 'Disconnected. Click Connect to start.';
    }
}

// ENDPOINT: INITIALIZE CONNECTION
router.post('/connect', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    console.log(`🔌 [API] Connect request from user: ${userId}`);

    const currentStatus = getStatus(userId);

    if (currentStatus === 'connected') {
        const { stats, deviceInfo } = getStoreStats(userId);

        // 🔔 NOTIFY: Already connected (optional, no need to spam)
        // await notifyWhatsAppConnected(userId, deviceInfo);

        return res.json({
            success: true,
            status: 'connected',
            message: 'Already connected',
            deviceInfo: deviceInfo,
            stats: stats
        });
    }

    // Start connection process
    connectToWhatsApp(userId);

    res.json({
        success: true,
        status: 'connecting',
        message: 'Initializing WhatsApp connection. Please wait for QR code...'
    });
}));

// ENDPOINT: GET STATUS KONEKSI + DEVICE INFO
router.get('/status', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const status = getStatus(userId);
    const { stats, messagesToday, deviceInfo } = getStoreStats(userId);

    res.json({
        success: true,
        status: status,
        message: getStatusMessage(status, deviceInfo),
        messagesToday: messagesToday,
        deviceInfo: deviceInfo,
        stats: stats
    });
}));

// ENDPOINT: GET QR CODE STRING
router.get('/qr', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const qrCode = getQrCode(userId);

    if (qrCode) {
        // 🔔 NOTIFY: QR Code ready (DEBOUNCED)
        // Only send notification every 60 seconds
        const lastNotif = qrNotificationLimits.get(userId);
        const now = Date.now();

        if (!lastNotif || (now - lastNotif) > 60000) {
            await notifyWhatsAppQRReady(userId);
            qrNotificationLimits.set(userId, now);
            console.log(`🔔 [DEBOUNCE] Sent QR notification to user ${userId}`);
        }

        return res.json({
            success: true,
            qrCode: qrCode
        });
    }

    res.status(404).json({
        success: false,
        message: 'QR code not available. Client may already be connected or not initialized yet.'
    });
}));

// ENDPOINT: GET PROFILE PICTURE
router.get('/avatar/:jid', asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { jid } = req.params;

    // Decode if needed (express handles %40 usually)
    // ensure JID format
    let targetJid = jid;
    if (!targetJid.includes('@')) {
        // Assume phone -> s.whatsapp.net
        targetJid = targetJid + '@s.whatsapp.net';
    }

    const url = await getProfilePicture(userId, targetJid);

    if (url) {
        res.json({ success: true, url });
    } else {
        res.json({ success: false, url: null }); // Not 404 to avoid console errors
    }
}));

// ENDPOINT: GET STATS
router.get('/stats', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const { stats, messagesToday, deviceInfo } = getStoreStats(userId);

    res.json({
        success: true,
        messagesToday: messagesToday,
        stats: stats,
        deviceInfo: deviceInfo
    });
}));

// ENDPOINT: LOGOUT / DISCONNECT
router.post('/logout', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    console.log(`🚪 [API] Logout request from user: ${userId}`);

    await disconnectWhatsAppClient(userId);

    // 🔔 NOTIFY: WhatsApp disconnected
    await notifyWhatsAppDisconnected(userId, 'Manually disconnected by user');

    res.json({
        success: true,
        message: 'WhatsApp client disconnected and session removed.'
    });
}));

// ENDPOINT: SEND MESSAGE
router.post('/send-message', asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const status = getStatus(userId);

    if (status !== 'connected') {
        return res.status(400).json({
            success: false,
            message: 'WhatsApp is not connected. Please connect first.'
        });
    }

    const { nomor, pesan } = req.body;

    if (!nomor || !pesan) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields: nomor and pesan'
        });
    }

    try {
        const result = await sendMessage(userId, nomor, pesan);

        if (result.success) {
            res.json({
                success: true,
                message: 'Message sent successfully',
                data: {
                    to: result.to,
                    sentAt: result.sentAt
                }
            });
        } else {
            // 🔔 NOTIFY: Message send error (optional)
            // await notifyWhatsAppError(userId, result.error);

            res.status(500).json({
                success: false,
                message: 'Failed to send message',
                error: result.error
            });
        }
    } catch (error) {
        console.error(`❌ [API] Send message error for user ${userId}:`, error);

        // 🔔 NOTIFY: Critical error
        await notifyWhatsAppError(userId, error.message);

        res.status(500).json({
            success: false,
            message: 'Internal server error during message send.'
        });
    }
}));

module.exports = router;