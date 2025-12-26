// backend/server.js - ✅ WITH AUTO-CONNECT & GRACEFUL SHUTDOWN + NOTIFICATIONS
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import utilities
const { autoConnectAllUsers, cleanupAllConnections } = require('./utils/whatsappClient'); // ✅ ADDED
const { initScheduler, stopScheduler } = require('./services/scheduler');

// ============================================
// ✅ IMPORT ROUTES
// ============================================
const authRoutes = require('./routes/auth');
const whatsappRoutes = require('./routes/whatsapp'); 
const settingsRoutes = require('./routes/settings');
const broadcastsRoutes = require('./routes/broadcasts');
const templatesRoutes = require('./routes/templates'); 
const customersRoutes = require('./routes/customers');
const notificationRoutes = require('./routes/notifications'); // ✅ NEW

const app = express();
const PORT = process.env.PORT || 5000;
let server = null; 

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
});

// ============================================
// ✅ APPLICATION ROUTES
// ============================================

app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to the WhatsApp Messaging API',
        status: 'running',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            whatsapp: '/api/whatsapp',
            broadcasts: '/api/broadcasts',
            templates: '/api/templates',
            customers: '/api/customers',
            settings: '/api/settings',
            notifications: '/api/notifications' // ✅ NEW
        }
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/broadcasts', broadcastsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/notifications', notificationRoutes); // ✅ NEW

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

app.use((err, req, res, next) => {
    console.error('❌ Global error handler:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
});

// ============================================
// ✅ ENHANCED MONGODB CONNECTION
// ============================================

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 2,
            maxIdleTimeMS: 10000,
            retryWrites: true,
            retryReads: true,
            heartbeatFrequencyMS: 2000,
        });
        
        console.log('✅ MongoDB Connected');
        
    } catch (error) {
        console.error('❌ [MongoDB] Initial connection failed:', error.message);
        console.log('🔄 [MongoDB] Retrying connection in 5 seconds...');
        setTimeout(connectDB, 5000);
    }
};

// ✅ MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('🟢 [MongoDB] Connected to database');
});

mongoose.connection.on('error', (err) => {
    console.error('🔴 [MongoDB] Connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB] Disconnected from database');
    console.log('🔄 [MongoDB] Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
    console.log('🟢 [MongoDB] Reconnected to database');
});

// ============================================
// DATABASE CONNECTION AND SERVER START
// ============================================

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start the HTTP server
        server = app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`🌐 Access frontend at ${corsOptions.origin}`);
            console.log(`📡 API Endpoints:`);
            console.log(`   - Auth: http://localhost:${PORT}/api/auth`);
            console.log(`   - WhatsApp: http://localhost:${PORT}/api/whatsapp`);
            console.log(`   - Broadcasts: http://localhost:${PORT}/api/broadcasts`);
            console.log(`   - Notifications: http://localhost:${PORT}/api/notifications`); // ✅ NEW
        });

        // ✅ AUTO-CONNECT WHATSAPP AFTER SERVER READY
        mongoose.connection.once('open', async () => {
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
// ✅ GRACEFUL SHUTDOWN - PRESERVE SESSIONS!
// ============================================

const gracefulShutdown = async (signal) => {
    console.log(`\n🔴 ${signal} signal received: initiating graceful shutdown...`);
    
    // 1. Close HTTP server (stop accepting new requests)
    if (server) {
        server.close(() => {
            console.log('✅ HTTP server closed');
        });
    }

    // 2. Stop broadcast scheduler
    stopScheduler();
    
    // 3. Cleanup WhatsApp connections (DON'T LOGOUT - just close!)
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
    
    // Don't exit on MongoDB connection errors
    if (!err.message.includes('MongoServerSelectionError') && 
        !err.message.includes('MongoNetworkError')) {
        setTimeout(() => {
            gracefulShutdown('UncaughtException Exit');
        }, 1000); 
    } else {
        console.log('⚠️ MongoDB connection error caught - server will continue running');
        console.log('🔄 MongoDB will attempt to reconnect automatically');
    }
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
    
    if (reason && (reason.message?.includes('MongoServerSelectionError') || 
                   reason.message?.includes('MongoNetworkError'))) {
        console.log('⚠️ MongoDB connection error - will retry automatically');
    }
});

module.exports = app;