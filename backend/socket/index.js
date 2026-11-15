const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { registerRoomSocket } = require('./roomSocket');
const { registerAuctionSocket, recoverActiveAuctionTimers } = require('./auctionSocket');

let io = null;

/**
 * Initialize Socket.IO with HTTP server, CORS, and JWT authentication
 * @param {import('http').Server} server 
 * @param {string|string[]} clientUrl 
 * @returns {Server}
 */
const initSocket = (server, clientUrl) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication & Guest Session Middleware for all Socket.IO connections
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;
      if (!token && socket.handshake.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      }

      let user = null;

      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'ipl_auction_arena_dev_secret_key_2026'
          );
          user = await User.findById(decoded.id).select('-password');
        } catch (jwtErr) {
          // Fall through to guest identity check
        }
      }

      // Check guest identity with cryptographic sessionSecret verification
      if (!user) {
        const guestId = socket.handshake.auth?.guestId || socket.handshake.query?.guestId;
        const sessionSecret = socket.handshake.auth?.sessionSecret || socket.handshake.query?.sessionSecret;

        if (guestId && sessionSecret && typeof sessionSecret === 'string') {
          const candidate = await User.findOne({ guestId: String(guestId).trim() }).select('+sessionSecret');
          if (candidate && candidate.sessionSecret) {
            const storedBuf = Buffer.from(candidate.sessionSecret);
            const suppliedBuf = Buffer.from(sessionSecret);
            if (storedBuf.length === suppliedBuf.length && crypto.timingSafeEqual(storedBuf, suppliedBuf)) {
              user = candidate;
            }
          }
        } else if (guestId && !sessionSecret) {
          // Attempted connection with bare guestId without cryptographic secret -> reject
          return next(new Error('Authentication failed: Missing session secret for guest identity'));
        }
      }

      // Auto-provision fresh guest session only if socket is genuinely unauthenticated and anonymous
      if (!user) {
        const fallbackName = socket.handshake.auth?.userName || socket.handshake.query?.userName || 'Manager';
        const newGuestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
        const newSecret = crypto.randomBytes(32).toString('hex');
        user = await User.create({
          name: fallbackName,
          email: `${newGuestId}@arena.local`,
          guestId: newGuestId,
          sessionSecret: newSecret,
          isGuest: true,
          favoriteTeam: 'CSK'
        });
      }

      // Securely attach user identity from verified DB document
      socket.user = user;
      socket.data = {
        userId: user._id.toString(),
        userName: user.name,
        userEmail: user.email || '',
        joinedRooms: new Set()
      };

      return next();
    } catch (err) {
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ [Socket Connected]: ${socket.id} (User: ${socket.user.name} [${socket.user._id}])`);

    // Health-check / ping event
    socket.on('client:ping', (payload) => {
      socket.emit('server:pong', {
        status: 'online',
        receivedAt: new Date().toISOString(),
        userId: socket.user._id,
        payload: payload || null
      });
    });

    // Register room event handlers
    registerRoomSocket(io, socket);

    // Register live auction event handlers
    registerAuctionSocket(io, socket);

    socket.on('disconnect', (reason) => {
      console.log(`⚡ [Socket Disconnected]: ${socket.id} (User: ${socket.user?.name}, Reason: ${reason})`);
    });
  });

  return io;
};

/**
 * Access the initialized Socket.IO instance
 * @returns {Server}
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized yet!');
  }
  return io;
};

module.exports = { initSocket, getIO, recoverActiveAuctionTimers };