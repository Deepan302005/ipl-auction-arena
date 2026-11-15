const http = require('http');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables early
dotenv.config();

const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');
const playerRoutes = require('./routes/playerRoutes');
const seasonRoutes = require('./routes/seasonRoutes');
const roomRoutes = require('./routes/roomRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// Trust reverse proxy (Render, Railway, Fly.io, Cloudflare, Nginx)
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security Headers Middleware (Production Hardened)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Port and client config
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const FRONTEND_URL = process.env.FRONTEND_URL || '';

// Express Middleware
const allowedOrigins = [
  CLIENT_URL,
  FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:3000'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      allowedOrigins.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /^https:\/\/.*\.onrender\.com$/.test(origin) ||
      /^https:\/\/.*\.up\.railway\.app$/.test(origin) ||
      /^https:\/\/.*\.railway\.app$/.test(origin) ||
      /^https:\/\/.*\.fly\.dev$/.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));

// Initialize Real-time Socket.IO
initSocket(server, CLIENT_URL);

// Mount API Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/rooms', roomRoutes);

// Serve static production frontend build if present
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/socket.io')) {
      return next();
    }
    return res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Fallback root route if frontend dist is not built
  app.get('/', (req, res) => {
    res.json({
      name: 'IPL Auction Arena API',
      status: 'online',
      version: '1.0.0',
      documentation: '/api/health'
    });
  });
}

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to Database & Start Server
const startServer = async () => {
  // Connect to MongoDB Atlas (handled gracefully)
  await connectDB();

  // Recover active auction timers after restart
  try {
    const { getIO, recoverActiveAuctionTimers } = require('./socket');
    const io = getIO();
    await recoverActiveAuctionTimers(io);
  } catch (err) {
    // Socket or DB not ready yet
  }

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`\n🏏 ===============================================`);
      console.log(`🚀 IPL Auction Arena Backend Server running`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🩺 Health API: http://localhost:${PORT}/api/health`);
      console.log(`⚡ WebSocket Server initialized on port ${PORT}`);
      console.log(`🏏 ===============================================\n`);
      resolve(server);
    });
  });
};

if (require.main === module) {
  startServer();
}

// Graceful Shutdown Handlers (Production Reliability)
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 [${signal}] Received shutdown signal. Closing server gracefully...`);

  if (server) {
    server.close(() => {
      console.log('   ✅ HTTP server closed.');
    });
  }

  try {
    const { getIO } = require('./socket');
    const io = getIO();
    if (io) {
      io.emit('server:shutdown', { message: 'Server is restarting or updating.' });
      io.close();
      console.log('   ✅ Active Socket.IO connections closed.');
    }
  } catch (_) {}

  try {
    const mongoose = require('mongoose');
    await mongoose.connection.close(false);
    console.log('   ✅ MongoDB connection drained and closed.');
  } catch (_) {}

  console.log('👋 [Shutdown Complete] Process exiting cleanly.\n');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server, startServer, gracefulShutdown };
