const express = require('express');
const router = express.Router();
const { getOrCreateGuestSession, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { guestSessionLimiter } = require('../middleware/rateLimiter');

// POST /api/auth/guest-session - Direct anonymous guest manager session (rate limited)
router.post('/guest-session', guestSessionLimiter.middleware(), getOrCreateGuestSession);
router.post('/session', guestSessionLimiter.middleware(), getOrCreateGuestSession); // Alias for consistency

// GET /api/auth/me - Current guest manager session profile
router.get('/me', protect, getMe);

// Dev/Test helper to reset rate limit
if (process.env.NODE_ENV !== 'production') {
  router.post('/reset-rate-limit', (req, res) => {
    guestSessionLimiter.reset();
    return res.status(200).json({ success: true, message: 'Rate limits reset' });
  });
}

module.exports = router;
