const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Protect routes by verifying Bearer JWT token in Authorization header
 * or cryptographically validated guest session credentials (x-guest-id + x-guest-secret).
 * Prevents unauthorized guest impersonation and identity spoofing.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Primary Authorization: Signed JWT token in Bearer header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'ipl_auction_arena_dev_secret_key_2026'
      );

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'User session no longer exists'
        });
      }

      return next();
    } catch (error) {
      // Invalid or expired JWT token, proceed to check cryptographic session credentials
    }
  }

  // 2. Cryptographic Guest Session fallback via (x-guest-id + x-guest-secret)
  const guestId = req.headers['x-guest-id'] || req.body?.guestId;
  const guestSecret = req.headers['x-guest-secret'] || req.body?.sessionSecret;

  if (guestId && guestSecret && typeof guestSecret === 'string') {
    const existingGuest = await User.findOne({ guestId: String(guestId).trim() }).select('+sessionSecret');
    if (existingGuest && existingGuest.sessionSecret) {
      const storedBuf = Buffer.from(existingGuest.sessionSecret);
      const suppliedBuf = Buffer.from(guestSecret);
      if (storedBuf.length === suppliedBuf.length && crypto.timingSafeEqual(storedBuf, suppliedBuf)) {
        req.user = existingGuest;
        return next();
      }
    }
  }

  // 3. Automatic guest provisioning ONLY for initial room creation without prior session
  if (req.method === 'POST' && (req.baseUrl === '/api/rooms' || req.originalUrl?.includes('/api/rooms')) && !req.originalUrl?.includes('/join')) {
    try {
      const newGuestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
      const sessionSecret = crypto.randomBytes(32).toString('hex');
      const name = (req.body?.displayName || req.body?.hostName || 'Manager').trim().slice(0, 50);

      const newGuest = await User.create({
        name,
        email: `${newGuestId}@arena.local`,
        guestId: newGuestId,
        sessionSecret,
        isGuest: true,
        favoriteTeam: ''
      });
      req.user = newGuest;
      return next();
    } catch (createErr) {
      // Continue to 401
    }
  }

  return res.status(401).json({
    success: false,
    code: 'UNAUTHORIZED',
    message: 'Not authorized: Valid session token or cryptographic credentials required'
  });
};

module.exports = { protect };
