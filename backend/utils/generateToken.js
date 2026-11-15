const jwt = require('jsonwebtoken');

/**
 * Generate a JWT token for a user
 * @param {string} id - User ID
 * @returns {string} - Signed JWT
 */
const generateToken = (id) => {
  const secret = process.env.JWT_SECRET || 'ipl_auction_arena_dev_secret_key_2026';
  return jwt.sign({ id }, secret, {
    expiresIn: '30d'
  });
};

module.exports = generateToken;
