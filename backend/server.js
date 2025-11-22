// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// DATABASE CONNECTION WITH RETRY LOGIC
// ============================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zabran-broadcast';

const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Remove deprecated options for MongoDB 6.0+
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000, // Timeout after 10s
        socketTimeoutMS: 45000, // Socket timeout
      });
      
      console.log('\n✅ MongoDB connected successfully!');
      console.log(`📦 Database: ${mongoose.connection.name}`);
      console.log(`🌍 Host: ${mongoose.connection.host}\n`);
      return;
      
    } catch (error) {
      retries++;
      console.error(`\n❌ MongoDB connection attempt ${retries}/${maxRetries} failed:`);
      console.error(`   Error: ${error.message}`);
      
      if (retries < maxRetries) {
        const waitTime = retries * 2;
        console.log(`   ⏳ Retrying in ${waitTime} seconds...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      } else {
        console.error('\n💀 Could not connect to MongoDB after multiple attempts');
        console.error('\n   🔍 Troubleshooting checklist:');
        console.error('   1. ✅ Check MONGODB_URI in .env file');
        console.error('   2. ✅ Verify username and password are correct');
        console.error('   3. ✅ Whitelist your IP in MongoDB Atlas (Network Access)');
        console.error('   4. ✅ Check network/firewall settings');
        console.error('   5. ✅ Verify database name in connection string\n');
        
        // Don't exit in development, just warn
        if (process.env.NODE_ENV !== 'production') {
          console.warn('⚠️  Running in development mode without database connection\n');
          return;
        }
        process.exit(1);
      }
    }
  }
};

// Monitor database connection events
mongoose.connection.on('disconnected', () => {
  console.warn('\n⚠️  MongoDB disconnected');
  console.log('   Attempting to reconnect...\n');
});

mongoose.connection.on('reconnected', () => {
  console.log('\n✅ MongoDB reconnected successfully!\n');
});

mongoose.connection.on('error', (err) => {
  console.error('\n❌ MongoDB error:', err.message, '\n');
});

mongoose.connection.on('connected', () => {
  console.log('🔌 MongoDB connection established\n');
});

// ============================================
// ROUTES
// ============================================

const customerRoutes = require('./routes/customers');
const aiRoutes = require('./routes/ai');
// const testRoutes = require('./routes/test'); // Disabled for now

// API Routes
app.use('/api/customers', customerRoutes);
app.use('/api/ai', aiRoutes);
// app.use('/api/test', testRoutes); // Disabled for now

// ============================================
// HEALTH CHECK & INFO ENDPOINTS
// ============================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbState] || 'unknown';

  res.json({
    success: true,
    message: 'ZABRAN Backend is running! 🚀',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    services: {
      api: 'healthy',
      database: dbStatus,
      ai: process.env.N8N_WEBHOOK_URL ? 'configured' : 'not configured'
    },
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'ZABRAN Broadcast System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      customers: '/api/customers',
      aiGenerate: 'POST /api/ai/generate',
      aiTest: '/api/ai/test',
      aiStatus: '/api/ai/status',
      testRoutes: '/api/test/*'
    },
    documentation: {
      customers: 'Customer management endpoints',
      ai: 'AI message generation powered by Gemini 2.5 Flash',
      test: 'Testing and development endpoints'
    },
    links: {
      health: `http://localhost:${process.env.PORT || 5000}/api/health`,
      docs: 'https://github.com/your-repo/zabran-broadcast'
    }
  });
});

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * 404 Not Found Handler
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /api/health',
      'GET /api/customers',
      'POST /api/customers',
      'POST /api/ai/generate',
      'GET /api/ai/test',
      'GET /api/ai/status',
      'GET /api/test/*'
    ],
    timestamp: new Date().toISOString()
  });
});

/**
 * Global Error Handler
 */
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    statusCode,
    path: req.path,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err.details || null
    })
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
  // Connect to database first
  await connectDB();
  
  // Then start HTTP server
  server = app.listen(PORT, () => {
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? '✅ Connected' : '❌ Disconnected';
    
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('  🚀 ZABRAN BROADCAST SYSTEM - Backend API');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`  ✅ Server running on port ${PORT}`);
    console.log(`  🌐 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('  📡 Main Endpoints:');
    console.log(`     • Health Check: http://localhost:${PORT}/api/health`);
    console.log(`     • Root Info:    http://localhost:${PORT}/`);
    console.log('');
    console.log('  👥 Customer Endpoints:');
    console.log(`     • List:         GET    /api/customers`);
    console.log(`     • Create:       POST   /api/customers`);
    console.log(`     • Get One:      GET    /api/customers/:id`);
    console.log(`     • Update:       PUT    /api/customers/:id`);
    console.log(`     • Delete:       DELETE /api/customers/:id`);
    console.log('');
    console.log('  🤖 AI Endpoints:');
    console.log(`     • Generate:     POST   /api/ai/generate`);
    console.log(`     • Test:         GET    /api/ai/test`);
    console.log(`     • Status:       GET    /api/ai/status`);
    console.log('');
    console.log('  🧪 Test Endpoints:');
    console.log(`     • All Tests:    GET    /api/test/*`);
    console.log('');
    console.log('  🤖 AI Service:');
    console.log(`     • Provider: Google Gemini 2.5 Flash`);
    console.log(`     • Webhook: ${process.env.N8N_WEBHOOK_URL || '⚠️  Not configured'}`);
    console.log('');
    console.log('  💾 Database:');
    
    // Mask password in URI for security
    const maskedURI = MONGODB_URI.replace(/:([^:@]+)@/, ':***@');
    console.log(`     • MongoDB: ${maskedURI}`);
    console.log(`     • Status: ${dbStatus}`);
    
    if (dbState !== 1) {
      console.log('     • ⚠️  Database not connected! Check connection settings.');
    }
    
    console.log('');
    console.log('  🔧 Environment:');
    console.log(`     • Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`     • Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('  💡 Tips:');
    console.log('     • Press Ctrl+C to stop the server');
    console.log('     • Use /api/health to check all services status');
    console.log('     • Check logs above for any connection warnings');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
  });
};

// Start the server
startServer().catch(err => {
  console.error('\n💀 Failed to start server:', err.message);
  console.error(err.stack);
  process.exit(1);
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  console.log(`\n📴 ${signal} signal received: initiating graceful shutdown...`);
  
  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
  }
  
  // Close database connection
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err.message);
  }
  
  console.log('👋 Goodbye!\n');
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('\n💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', err.message);
  console.error(err.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('\n💥 UNHANDLED REJECTION! Shutting down...');
  console.error('Error:', err.message);
  if (err.stack) console.error(err.stack);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;