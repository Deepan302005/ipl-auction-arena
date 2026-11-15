const express = require('express');
const router = express.Router();
const {
  getPlayers,
  getPlayerById,
  getPlayerCategories,
  getAuctionRecords,
  getPlayerAuctionHistory,
  createCustomPlayer,
  updatePlayer,
  deletePlayer,
  updateBasePrice,
  toggleRetirePlayer,
  toggleAuctionEligibility,
  exportPlayersJson,
  exportPlayersCsv,
  importPlayersJson,
  importPlayersCsv
} = require('../controllers/playerController');

// Static / Export / Import / Auction routes (must precede /:id)
router.get('/export/json', exportPlayersJson);
router.get('/export/csv', exportPlayersCsv);
router.post('/import/json', importPlayersJson);
router.post('/import/csv', importPlayersCsv);
router.get('/categories', getPlayerCategories);
router.get('/auction-records', getAuctionRecords);

// Main collection routes
router.get('/', getPlayers);
router.post('/', createCustomPlayer);

// Single player parameterized routes
router.get('/:id/auctions', getPlayerAuctionHistory);
router.get('/:id', getPlayerById);
router.put('/:id', updatePlayer);
router.delete('/:id', deletePlayer);

// Specific property patch routes
router.patch('/:id/base-price', updateBasePrice);
router.patch('/:id/retire', toggleRetirePlayer);
router.patch('/:id/eligibility', toggleAuctionEligibility);

module.exports = router;
