const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/healthController');

// GET /api/health - Health check endpoint
router.get('/health', getHealthStatus);

module.exports = router;
