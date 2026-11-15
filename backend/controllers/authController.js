const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Get current user / guest session profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get or create stable guest manager session with cryptographic ownership verification
 * @route   POST /api/auth/guest-session
 * @access  Public
 */
const getOrCreateGuestSession = async (req, res, next) => {
  try {
    let { guestId, sessionSecret, displayName, favoriteTeam } = req.body || {};

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      displayName = 'Manager';
    }
    displayName = displayName.trim().slice(0, 50);

    const validTeams = ['CSK', 'MI', 'RCB', 'KKR', 'DC', 'RR', 'SRH', 'GT', 'LSG', 'PBKS'];
    const team = validTeams.includes(favoriteTeam) ? favoriteTeam : 'CSK';

    let user = null;
    const hasCandidateGuestId = Boolean(guestId && typeof guestId === 'string' && guestId.trim().length >= 6);

    if (hasCandidateGuestId) {
      user = await User.findOne({ guestId: guestId.trim() }).select('+sessionSecret');
    }

    if (user) {
      // -------------------------------------------------------------
      // CRYPTOGRAPHIC GUEST OWNERSHIP VERIFICATION (Anti-Impersonation)
      // -------------------------------------------------------------
      let isAuthorized = false;

      // 1. Check Bearer JWT token in Authorization header
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const rawToken = req.headers.authorization.split(' ')[1];
        try {
          const decoded = jwt.verify(
            rawToken,
            process.env.JWT_SECRET || 'ipl_auction_arena_dev_secret_key_2026'
          );
          if (decoded?.id && decoded.id.toString() === user._id.toString()) {
            isAuthorized = true;
          }
        } catch (_) {
          // Token expired or invalid, fall back to sessionSecret check below
        }
      }

      // 2. Check sessionSecret in body
      if (!isAuthorized && user.sessionSecret && sessionSecret && typeof sessionSecret === 'string') {
        const storedBuf = Buffer.from(user.sessionSecret);
        const suppliedBuf = Buffer.from(sessionSecret);
        if (storedBuf.length === suppliedBuf.length && crypto.timingSafeEqual(storedBuf, suppliedBuf)) {
          isAuthorized = true;
        }
      }

      // If neither secret nor valid token matches, REJECT impersonation attempt
      if (!isAuthorized && user.sessionSecret) {
        return res.status(401).json({
          success: false,
          code: 'UNAUTHORIZED_GUEST_ACCESS',
          message: 'Unauthorized: Invalid guest session credentials. Impersonation of another guest identity is strictly blocked.'
        });
      }

      // If user had no secret yet (legacy transition), assign one now
      if (!user.sessionSecret) {
        user.sessionSecret = crypto.randomBytes(32).toString('hex');
      }

      // Reconnection authorized: update display name or favorite team if provided
      if (displayName && user.name !== displayName) {
        user.name = displayName;
      }
      if (team && user.favoriteTeam !== team) {
        user.favoriteTeam = team;
      }
      await user.save();
    } else {
      // -------------------------------------------------------------
      // Create new stable, cryptographically protected guest user
      // -------------------------------------------------------------
      const cleanGuestId = hasCandidateGuestId
        ? guestId.trim()
        : `guest_${crypto.randomBytes(8).toString('hex')}`;

      const generatedSecret = crypto.randomBytes(32).toString('hex');

      user = await User.create({
        name: displayName,
        email: `${cleanGuestId}@arena.local`,
        guestId: cleanGuestId,
        sessionSecret: generatedSecret,
        isGuest: true,
        favoriteTeam: team,
        avatar: ''
      });
    }

    const token = generateToken(user._id);

    const userProfile = {
      _id: user._id,
      guestId: user.guestId,
      name: user.name,
      favoriteTeam: user.favoriteTeam,
      isGuest: true
    };

    return res.status(200).json({
      success: true,
      message: 'Guest session ready',
      data: {
        ...userProfile,
        user: userProfile,
        sessionSecret: user.sessionSecret,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOrCreateGuestSession,
  getMe
};
