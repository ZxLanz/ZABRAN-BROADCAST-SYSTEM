const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express'); // Force Restart 31
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Import utilities
const { autoConnectAllUsers, cleanupAllConnections, storesMap } = require('./utils/whatsappClient');
const { initScheduler, stopScheduler } = require('./services/scheduler');
const { initSocket } = require('./services/socket');

// Import Routes
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const broadcastRoutes = require('./routes/broadcasts');
const customerRoutes = require('./routes/customers');
const templateRoutes = require('./routes/templates');
const settingsRoutes = require('./routes/settings');
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// DEBUG ROUTE FOR CONTACTS
app.get('/debug/contacts/:userId', (req, res) => {
    try {
        const store = storesMap.get(req.params.userId);
        if (!store) return res.json({ count: 0, status: 'No Store Found' });

        const contacts = store.contacts;
        const keys = Object.keys(contacts);

        // Find specific Irgi or 895
        const irgi = keys.find(k => k.includes('895393900802'));

        res.json({
            count: keys.length,
            lid_keys: keys.filter(k => k.includes('lid')),
            has_lid_prop: keys.find(k => contacts[k].lid),
            sample_full: keys.slice(0, 3).map(k => contacts[k])
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware
const corsOptions = {
    origin: [
        'http://localhost',
        'http://127.0.0.1',
        'http://localhost:5173',
        'http://localhost:3000',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
// Serve Static Media
app.use('/media', express.static(path.join(__dirname, 'public/media')));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== RATE LIMITING ====================
// Global rate limiter - applies to all requests
// Global rate limiter - applies to all requests
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // INCREASED: 1000 requests per windowMs (was 100)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => req.path === '/' // Skip root route
});
app.use(globalLimiter);

// Auth endpoints - stricter limit
// Auth endpoints - stricter limit
// Auth endpoints - stricter limit (Anti-Brute Force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // STRICT: 20 requests per 15 mins
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Broadcast endpoints - moderate limit
// Broadcast endpoints - moderate limit
const broadcastLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // INCREASED: 200 requests (was 20)
    message: 'Too many broadcast requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Chat/Message endpoints - higher limit (real-time)
// Chat/Message endpoints - higher limit (real-time)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 500, // INCREASED: 500 requests (was 50)
    message: 'Too many chat requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Customer/Template endpoints - relaxed limit (frequent reads)
const customerLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute (frequent data reads)
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Routes
// WhatsApp endpoints - higher limit for status polling and QR generation
// WhatsApp endpoints - higher limit for status polling and QR generation
const whatsappLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 500, // INCREASED: 500 requests (was 100)
    message: 'Too many WhatsApp requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/whatsapp', whatsappLimiter, whatsappRoutes);
app.use('/api/broadcasts', broadcastLimiter, broadcastRoutes);
app.use('/api/customers', customerLimiter, customerRoutes);
app.use('/api/templates', customerLimiter, templateRoutes);
app.use('/api/settings', globalLimiter, settingsRoutes);
app.use('/api/ai', broadcastLimiter, aiRoutes);
app.use('/api/notifications', globalLimiter, notificationRoutes);
app.use('/api/chats', chatLimiter, chatRoutes);

// Root Route
app.get('/', (req, res) => {
    res.send('Zabran Broadcast API is Running 🚀');
});

let server;

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start the HTTP server
        server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Access frontend at ${corsOptions.origin}`);
        });

        // ✅ INITIALIZE SOCKET.IO
        initSocket(server, corsOptions);
        console.log('🔌 Socket.IO Server Initialized');

        // ✅ AUTO-CONNECT WHATSAPP (Robust Logic)
        const initWhatsApp = async () => {
            console.log('\n🔄 [STARTUP] initializing WhatsApp auto-connect...');
            // Wait 2 seconds for server to stabilize
            setTimeout(async () => {
                try {
                    await autoConnectAllUsers();
                } catch (err) {
                    console.error('❌ [STARTUP] Auto-connect failed:', err.message);
                }
            }, 2000);
        };

        if (mongoose.connection.readyState === 1) {
            console.log('✅ MongoDB already connected');
            initWhatsApp();
        } else {
            mongoose.connection.once('open', async () => {
                console.log('✅ MongoDB Connected');
                initWhatsApp();
            });
        }

        // Initialize Broadcast Scheduler
        initScheduler();

    } catch (err) {
        console.error('\n💀 Failed to start server:', err.message);
        console.error(err.stack);
        process.exit(1);
    }
};

// Start the server
startServer();

// ============================================
// ✅ GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
    console.log(`\n🔴 ${signal} signal received: initiating graceful shutdown...`);

    // 1. Close HTTP server
    if (server) {
        server.close(() => {
            console.log('✅ HTTP server closed');
        });
    }

    // 2. Stop broadcast scheduler
    stopScheduler();

    // 3. Cleanup WhatsApp connections
    try {
        await cleanupAllConnections();
        console.log('✅ WhatsApp connections cleaned (sessions preserved)');
    } catch (err) {
        console.error('⚠️ Error cleaning WhatsApp connections:', err.message);
    }

    // 4. Close MongoDB connection
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
    } catch (err) {
        console.error('❌ Error closing MongoDB connection:', err.message);
    }

    console.log('👋 Goodbye! Sessions will auto-restore on next start.\n');
    process.exit(0);
};

// Handle signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('\n💥 Uncaught Exception:', err.message);
    console.error(err.stack);

    if (!err.message.includes('MongoServerSelectionError') &&
        !err.message.includes('MongoNetworkError')) {
        setTimeout(() => {
            gracefulShutdown('UncaughtException Exit');
        }, 1000);
    } else {
        console.log('⚠️ MongoDB connection error caught - server will continue running');
    }
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

module.exports = app;