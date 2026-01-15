require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');

// Import utilities
const { autoConnectAllUsers, cleanupAllConnections } = require('./utils/whatsappClient');
const { initScheduler, stopScheduler } = require('./services/scheduler');
const { initSocket } = require('./services/socket');

// Import Routes
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp');
const broadcastRoutes = require('./routes/broadcasts');
const customerRoutes = require('./routes/customers');
const templateRoutes = require('./routes/templates');
const settingsRoutes = require('./routes/settings');
// const reportRoutes = require('./routes/reports'); // Removed: File not found in directory listing
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174'
        ].filter(Boolean);

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== RATE LIMITING ====================
// Global rate limiter - applies to all requests
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => req.path === '/' // Skip root route
});
app.use(globalLimiter);

// Auth endpoints - stricter limit
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes (for login/register attempts)
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Broadcast endpoints - moderate limit
const broadcastLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: 'Too many broadcast requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

// Chat/Message endpoints - higher limit (real-time)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 requests per minute
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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/whatsapp', globalLimiter, whatsappRoutes);
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

        // ✅ AUTO-CONNECT WHATSAPP AFTER SERVER READY
        mongoose.connection.once('open', async () => {
            console.log('✅ MongoDB Connected');
            console.log('\n🔄 [STARTUP] Initializing WhatsApp auto-connect...');

            // Wait 3 seconds for server to stabilize
            setTimeout(async () => {
                try {
                    await autoConnectAllUsers();
                } catch (err) {
                    console.error('❌ [STARTUP] Auto-connect failed:', err.message);
                    console.log('💡 WhatsApp clients can be connected manually via /api/whatsapp/connect');
                }
            }, 3000);
        });

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