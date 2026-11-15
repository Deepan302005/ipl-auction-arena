const express = require('express');
const router = express.Router();
const {
  createRoom,
  listRooms,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  closeRoom,
  claimFranchise,
  releaseFranchise,
  startAuction,
  pauseAuction,
  resumeAuction,
  correctSale,
  endAuction,
  updateRoomSettings,
  previewPlayerPool,
  getRoomEligiblePlayers,
  updateRoomPlayerPool
} = require('../controllers/roomController');
const { protect } = require('../middleware/authMiddleware');

// Public collection, preview and detail routes
router.get('/', listRooms);
router.post('/preview-pool', previewPlayerPool);
router.get('/:roomCode', getRoomByCode);

// Protected room management and customization routes
router.post('/', protect, createRoom);
router.put('/:roomCode/settings', protect, updateRoomSettings);
router.get('/:roomCode/eligible-players', protect, getRoomEligiblePlayers);
router.put('/:roomCode/player-pool', protect, updateRoomPlayerPool);
router.post('/:roomCode/join', protect, joinRoom);
router.post('/:roomCode/leave', protect, leaveRoom);
router.delete('/:roomCode', protect, closeRoom);
router.post('/:roomCode/claim', protect, claimFranchise);
router.post('/:roomCode/release', protect, releaseFranchise);
router.post('/:roomCode/start', protect, startAuction);
router.post('/:roomCode/pause', protect, pauseAuction);
router.post('/:roomCode/resume', protect, resumeAuction);
router.post('/:roomCode/correct-sale', protect, correctSale);
router.post('/:roomCode/end', protect, endAuction);

module.exports = router;