const express = require('express');
const router = express.Router();
const { getTeams, getTeamById } = require('../controllers/teamController');

// GET /api/teams - List all 10 IPL franchises
router.get('/', getTeams);

// GET /api/teams/:id - Get single franchise by ObjectId or Team Code (e.g. CSK, MI)
router.get('/:id', getTeamById);

module.exports = router;
