const express = require('express');
const router = express.Router();
const {
  getSeasons,
  getPlayersBySeason,
  buildMultiSeasonPool
} = require('../controllers/seasonController');

// GET /api/seasons - List all IPL seasons (2008-2026) with summaries
router.get('/', getSeasons);

// GET /api/seasons/:season/players - List players in a season with season-specific stats
router.get('/:season/players', getPlayersBySeason);

// POST /api/seasons/filter-pool - Build a custom auction pool across multiple seasons
router.post('/filter-pool', buildMultiSeasonPool);

module.exports = router;
