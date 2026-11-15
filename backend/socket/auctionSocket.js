const Room = require('../models/Room');
const Player = require('../models/Player');
const { getSanitizedRoomState } = require('../controllers/roomController');
const { getOnlineUserIds } = require('./roomSocket');

// In-memory active timer state per room:
// roomCode -> { timerInterval, lotExpiresAt, isPaused, remainingSeconds, roomCode }
// ARCHITECTURAL NOTE: This in-memory registry supports a single Node.js backend instance.
// In a horizontally scaled / clustered environment, a shared distributed store (such as Redis
// with Redis adapter and Redlock / BullMQ) would be required for cross-pod coordination.
const activeAuctionTimers = new Map();

/**
 * Bid increment schedules:
 * 1. 'official': Verified published modern IPL bidding slabs:
 *    - Up to ₹1.00 Cr: ₹0.20 Cr (20 Lakhs)
 *    - ₹1.00 Cr to ₹2.00 Cr: ₹0.25 Cr (25 Lakhs)
 *    - Above ₹2.00 Cr: ₹0.50 Cr (50 Lakhs)
 * 2. 'custom': Retained custom arena ladder:
 *    - Below ₹1.00 Cr: ₹0.10 Cr (10 Lakhs)
 *    - ₹1.00 Cr to ₹5.00 Cr: ₹0.20 Cr (20 Lakhs)
 *    - ₹5.00 Cr to ₹10.00 Cr: ₹0.25 Cr (25 Lakhs)
 *    - Above ₹10.00 Cr: ₹0.50 Cr (50 Lakhs)
 */
const getBidIncrement = (currentBidCr, ladderType = 'official') => {
  const bid = Number(currentBidCr) || 0;
  if (ladderType === 'custom') {
    if (bid < 1.0) return 0.10;   // 10 Lakhs below 1 Cr
    if (bid < 5.0) return 0.20;   // 20 Lakhs from 1 Cr to 5 Cr
    if (bid < 10.0) return 0.25;  // 25 Lakhs from 5 Cr to 10 Cr
    return 0.50;                  // 50 Lakhs above 10 Cr
  }

  // Official verified published IPL auction slabs
  if (bid < 1.0) return 0.20;     // 20 Lakhs below 1 Cr
  if (bid < 2.0) return 0.25;     // 25 Lakhs from 1 Cr to 2 Cr
  return 0.50;                    // 50 Lakhs above 2 Cr
};

/**
 * Calculate the next minimum bid amount
 */
const getNextMinimumBid = (currentBidCr, hasBidder, basePriceCr, ladderType = 'official') => {
  const current = Number(currentBidCr) || 0;
  const base = Number(basePriceCr) || 0.20;
  if (!hasBidder) {
    return parseFloat(base.toFixed(2));
  }
  const inc = getBidIncrement(current, ladderType);
  return parseFloat((current + inc).toFixed(2));
};

/**
 * Clear any active countdown timer for a room
 */
const clearRoomTimer = (roomCode) => {
  if (!roomCode) return;
  const code = roomCode.toUpperCase();
  if (activeAuctionTimers.has(code)) {
    const timerObj = activeAuctionTimers.get(code);
    if (timerObj.timerInterval) {
      clearInterval(timerObj.timerInterval);
    }
    activeAuctionTimers.delete(code);
  }
};

/**
 * Start or restart the lot countdown timer
 * Server timestamp and lotExpiresAt in MongoDB are the authoritative truth
 */
const startLotTimer = async (io, roomCode, durationSeconds = 10) => {
  const code = roomCode.toUpperCase();
  clearRoomTimer(code);

  const duration = Math.max(5, Number(durationSeconds) || 10);
  const now = Date.now();
  const lotExpiresAt = new Date(now + duration * 1000);

  // Update authoritative timestamps in MongoDB
  await Room.findOneAndUpdate(
    { roomCode: code },
    {
      $set: {
        'currentAuction.lotStartedAt': new Date(now),
        'currentAuction.lotExpiresAt': lotExpiresAt,
        'currentAuction.timerDuration': duration,
        'currentAuction.timerRemaining': duration,
        'currentAuction.status': 'bidding'
      }
    }
  );

  // Broadcast initial timer
  io.to(code).emit('auction:timerUpdate', {
    roomCode: code,
    secondsRemaining: duration,
    expiresAt: lotExpiresAt.toISOString()
  });

  const timerObj = {
    roomCode: code,
    lotExpiresAt,
    isPaused: false,
    remainingSeconds: duration,
    timerInterval: null
  };

  timerObj.timerInterval = setInterval(async () => {
    try {
      if (timerObj.isPaused) return;

      const currentNow = Date.now();
      const remainingMs = timerObj.lotExpiresAt.getTime() - currentNow;
      const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));
      timerObj.remainingSeconds = secondsLeft;

      // Broadcast timer tick to all connected room members
      io.to(code).emit('auction:timerUpdate', {
        roomCode: code,
        secondsRemaining: secondsLeft,
        expiresAt: timerObj.lotExpiresAt.toISOString()
      });

      if (secondsLeft <= 0) {
        clearInterval(timerObj.timerInterval);
        activeAuctionTimers.delete(code);
        await processHammerDrop(io, code);
      }
    } catch (err) {
      console.error(`Error in countdown tick for room ${code}:`, err.message);
    }
  }, 1000);

  activeAuctionTimers.set(code, timerObj);
};

/**
 * Handle Hammer drop when the countdown reaches 0s
 * Idempotently marks lot SOLD or UNSOLD and advances to next lot
 */
const processHammerDrop = async (io, roomCode) => {
  const code = roomCode.toUpperCase();

  try {
    // Atomic test-and-set lock: transition from 'bidding' to 'finalizing'
    // Guarantees that only ONE thread/call can finalize this lot even under concurrent calls
    const lockedRoom = await Room.findOneAndUpdate(
      {
        roomCode: code,
        status: 'live',
        'currentAuction.status': 'bidding'
      },
      {
        $set: { 'currentAuction.status': 'finalizing' }
      },
      { new: true }
    ).populate('currentAuction.player');

    if (!lockedRoom || !lockedRoom.currentAuction?.player) {
      return;
    }

    const room = lockedRoom;

    const {
      player,
      currentBidCr,
      currentBidderFranchise,
      currentBidderUser,
      currentBidderName
    } = room.currentAuction;

    const hasWinningBid = !!currentBidderFranchise && currentBidCr > 0;

    if (hasWinningBid) {
      // ---------------------------------------------------------
      // CASE 1: Player is SOLD!
      // ---------------------------------------------------------
      const winningSlot = room.franchises.find(
        (f) => f.code.toUpperCase() === currentBidderFranchise.toUpperCase()
      );

      if (winningSlot) {
        // Prevent duplicate player insertion into squad
        const alreadyInSquad = winningSlot.squad.some(
          (s) => s.player && s.player.equals(player._id)
        );
        if (!alreadyInSquad) {
          // Deduct remaining purse
          winningSlot.remainingPurseCr = parseFloat(
            Math.max(0, winningSlot.remainingPurseCr - currentBidCr).toFixed(2)
          );

          // Add to franchise squad
          winningSlot.squad.push({
            player: player._id,
            name: player.name,
            role: player.role,
            country: player.country || 'India',
            boughtForCr: currentBidCr,
            boughtAt: new Date()
          });
        }
      }

      // Record in completed lots (prevent duplicate transaction)
      const alreadyCompleted = room.completedLots.some(
        (cl) => cl.player && cl.player.equals(player._id) && cl.status === 'sold'
      );
      if (!alreadyCompleted) {
        room.completedLots.push({
          player: player._id,
          status: 'sold',
          soldToFranchise: currentBidderFranchise,
          soldPriceCr: currentBidCr,
          buyerUser: currentBidderUser,
          buyerName: currentBidderName,
          completedAt: new Date()
        });
      }

      room.currentAuction.status = 'sold';
      await room.save();

      io.to(code).emit('auction:playerSold', {
        roomCode: code,
        player,
        franchiseCode: currentBidderFranchise,
        franchiseName: winningSlot?.name || currentBidderFranchise,
        soldPriceCr: currentBidCr,
        buyerName: currentBidderName,
        remainingPurseCr: winningSlot?.remainingPurseCr || 0,
        squadCount: winningSlot?.squad?.length || 0
      });
    } else {
      // ---------------------------------------------------------
      // CASE 2: Player is UNSOLD!
      // ---------------------------------------------------------
      if (!Array.isArray(room.unsoldQueue)) {
        room.unsoldQueue = [];
      }
      if (!room.unsoldQueue.some((id) => id.equals(player._id))) {
        room.unsoldQueue.push(player._id);
      }

      const alreadyCompleted = room.completedLots.some(
        (cl) => cl.player && cl.player.equals(player._id) && cl.status === 'unsold'
      );
      if (!alreadyCompleted) {
        room.completedLots.push({
          player: player._id,
          status: 'unsold',
          soldToFranchise: null,
          soldPriceCr: 0,
          completedAt: new Date()
        });
      }

      room.currentAuction.status = 'unsold';
      await room.save();

      io.to(code).emit('auction:playerUnsold', {
        roomCode: code,
        player,
        message: `${player.name} goes unsold at base price ₹${player.basePriceCr} Cr`,
        unsoldQueueCount: room.unsoldQueue.length
      });
    }

    // Broadcast updated room state
    const onlineUsers = getOnlineUserIds(code);
    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('auctionQueue', 'name role country nationality basePriceCr battingStyle bowlingStyle isOverseas')
      .populate('completedLots.player', 'name role country nationality basePriceCr')
      .populate('participants', 'name email favoriteTeam avatar');
    io.to(code).emit('auction:stateUpdated', { room: getSanitizedRoomState(populated, onlineUsers) });

    // Transition pause (2.5 seconds) before advancing to next player lot
    setTimeout(async () => {
      await advanceToNextLot(io, code);
    }, 2500);
  } catch (err) {
    console.error(`Error in processHammerDrop for room ${code}:`, err.message);
  }
};

/**
 * Advance auction podium to the next player from the queue
 */
const advanceToNextLot = async (io, roomCode) => {
  const code = roomCode.toUpperCase();

  try {
    const room = await Room.findOne({ roomCode: code });

    if (!room || room.status !== 'live') {
      return;
    }

    if (!room.auctionQueue || room.auctionQueue.length === 0) {
      // All main queue lots completed!
      room.status = 'completed';
      room.currentAuction.player = null;
      room.currentAuction.status = 'idle';
      await room.save();

      clearRoomTimer(code);

      // Audit squad compliance
      const minSquad = room.settings?.minSquadSize || 18;
      const maxSquad = room.settings?.maxSquadSize || 25;
      const maxOverseas = room.settings?.maxOverseas || 8;
      const complianceReport = (room.franchises || []).map((f) => {
        const squadCount = f.squad?.length || 0;
        const overseasCount = (f.squad || []).filter(
          (s) => s.country && s.country.toLowerCase() !== 'india'
        ).length;
        const warnings = [];
        if (f.claimedBy && squadCount < minSquad) {
          warnings.push(`Squad size (${squadCount}) is below mandatory minimum of ${minSquad}`);
        }
        if (squadCount > maxSquad) {
          warnings.push(`Squad size (${squadCount}) exceeds maximum limit of ${maxSquad}`);
        }
        if (overseasCount > maxOverseas) {
          warnings.push(`Overseas count (${overseasCount}) exceeds limit of ${maxOverseas}`);
        }
        return {
          code: f.code,
          name: f.name,
          claimed: !!f.claimedBy,
          squadCount,
          overseasCount,
          remainingPurseCr: f.remainingPurseCr,
          isCompliant: warnings.length === 0,
          warnings
        };
      });

      const totalWarnings = complianceReport.reduce((acc, c) => acc.concat(c.warnings), []);

      io.to(code).emit('auction:completed', {
        roomCode: code,
        message: 'The IPL Auction has concluded! All sets and players have been auctioned.',
        completedLotsCount: room.completedLots.length,
        unsoldQueueCount: room.unsoldQueue?.length || 0,
        complianceReport,
        warnings: totalWarnings
      });

      const onlineUsers = getOnlineUserIds(code);
      const populated = await Room.findById(room._id)
        .populate('participants', 'name email favoriteTeam avatar');
      io.to(code).emit('auction:stateUpdated', { room: getSanitizedRoomState(populated, onlineUsers) });
      return;
    }

    // Pop next player from queue
    const nextPlayerId = room.auctionQueue.shift();
    const nextPlayer = await Player.findById(nextPlayerId);

    if (!nextPlayer) {
      return advanceToNextLot(io, code);
    }

    const timerSeconds = room.settings?.timerSeconds || 10;
    const now = Date.now();
    const lotExpiresAt = new Date(now + timerSeconds * 1000);
    const ladderType = room.settings?.incrementLadderType || 'official';
    const initialIncrement = getBidIncrement(nextPlayer.basePriceCr, ladderType);

    room.currentAuction = {
      player: nextPlayer._id,
      currentBidCr: nextPlayer.basePriceCr,
      currentBidderFranchise: null,
      currentBidderName: null,
      currentBidderUser: null,
      lotIndex: (room.currentAuction?.lotIndex || 0) + 1,
      lotStartedAt: new Date(now),
      lotExpiresAt,
      timerDuration: timerSeconds,
      timerRemaining: timerSeconds,
      bidCount: 0,
      bidHistory: [],
      status: 'bidding'
    };

    await room.save();

    // Broadcast new player lot spotlight
    io.to(code).emit('auction:playerChanged', {
      roomCode: code,
      player: nextPlayer,
      basePriceCr: nextPlayer.basePriceCr,
      bidIncrementCr: initialIncrement,
      nextMinimumBidCr: nextPlayer.basePriceCr,
      timerDuration: timerSeconds,
      lotExpiresAt: lotExpiresAt.toISOString(),
      queueRemaining: room.auctionQueue.length
    });

    io.to(code).emit('auction:queueUpdated', {
      roomCode: code,
      queueRemaining: room.auctionQueue.length,
      unsoldRemaining: room.unsoldQueue?.length || 0
    });

    // Start authoritative server timer
    await startLotTimer(io, code, timerSeconds);
  } catch (err) {
    console.error(`Error advancing to next lot for room ${code}:`, err.message);
  }
};

/**
 * Handle incoming live paddle bid
 */
const handleBid = async (io, socket, { roomCode, franchiseCode, bidAmountCr }) => {
  try {
    if (!roomCode) {
      return socket.emit('auction:bidRejected', {
        reason: 'Room code is required'
      });
    }

    const code = roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode: code }).populate('currentAuction.player');

    if (!room) {
      return socket.emit('auction:bidRejected', {
        reason: `Room '${code}' not found`
      });
    }

    // 1. Validate room status
    if (room.status !== 'live') {
      return socket.emit('auction:bidRejected', {
        reason: 'Auction is not currently live'
      });
    }

    // 2. Validate current lot status
    if (room.currentAuction.status !== 'bidding') {
      return socket.emit('auction:bidRejected', {
        reason: 'Bidding is not open for this lot'
      });
    }

    const player = room.currentAuction.player;
    if (!player) {
      return socket.emit('auction:bidRejected', {
        reason: 'No active player on the podium'
      });
    }

    // 3. Validate participant membership
    const isParticipant = room.participants.some((pId) => pId.equals(socket.user._id));
    if (!isParticipant) {
      return socket.emit('auction:bidRejected', {
        reason: 'You are not a participant in this auction room'
      });
    }

    // 4. Validate franchise ownership
    if (!franchiseCode) {
      return socket.emit('auction:bidRejected', {
        reason: 'Please specify the franchise paddle'
      });
    }

    const fCode = franchiseCode.toUpperCase();
    const franchiseSlot = room.franchises.find((f) => f.code.toUpperCase() === fCode);

    if (!franchiseSlot) {
      return socket.emit('auction:bidRejected', {
        reason: `Franchise '${fCode}' not found in this room`
      });
    }

    if (!franchiseSlot.claimedBy || !franchiseSlot.claimedBy.equals(socket.user._id)) {
      return socket.emit('auction:bidRejected', {
        reason: `You are not the manager of ${franchiseSlot.name} (${franchiseSlot.code})`
      });
    }

    // 5. Prevent consecutive outbidding of own franchise
    if (
      room.currentAuction.currentBidderFranchise &&
      room.currentAuction.currentBidderFranchise.toUpperCase() === fCode
    ) {
      return socket.emit('auction:bidRejected', {
        reason: `${franchiseSlot.name} already holds the highest active bid`
      });
    }

    // 6. Deadline check using authoritative server timestamp
    const now = Date.now();
    if (
      room.currentAuction.lotExpiresAt &&
      now >= room.currentAuction.lotExpiresAt.getTime()
    ) {
      return socket.emit('auction:bidRejected', {
        reason: 'Bidding time has expired for this lot'
      });
    }

    // 7. Calculate valid bid amount
    const ladderType = room.settings?.incrementLadderType || 'official';
    const hasBidder = !!room.currentAuction.currentBidderFranchise;
    const minNextBid = getNextMinimumBid(
      room.currentAuction.currentBidCr,
      hasBidder,
      player.basePriceCr,
      ladderType
    );

    let proposedBid;
    if (bidAmountCr !== undefined && bidAmountCr !== null && Number(bidAmountCr) > 0) {
      proposedBid = parseFloat(Number(bidAmountCr).toFixed(2));
      if (proposedBid < minNextBid) {
        return socket.emit('auction:bidRejected', {
          reason: `Bid of ₹${proposedBid} Cr is too low. Next minimum bid is ₹${minNextBid} Cr`
        });
      }
    } else {
      proposedBid = minNextBid;
    }

    // 8. Purse validation
    if (proposedBid > franchiseSlot.remainingPurseCr) {
      return socket.emit('auction:bidRejected', {
        reason: `Insufficient purse! Remaining: ₹${franchiseSlot.remainingPurseCr.toFixed(2)} Cr, required: ₹${proposedBid.toFixed(2)} Cr`
      });
    }

    // 9. Squad limit validation
    const maxSquad = room.settings?.maxSquadSize || 25;
    if (franchiseSlot.squad.length >= maxSquad) {
      return socket.emit('auction:bidRejected', {
        reason: `Maximum squad limit reached (${maxSquad} players)`
      });
    }

    // 10. Overseas player limit validation
    const isOverseas =
      (player.country && player.country.toLowerCase() !== 'india') ||
      (player.nationality && player.nationality.toLowerCase() !== 'india');

    if (isOverseas) {
      const maxOverseas = room.settings?.maxOverseas || 8;
      const overseasCount = franchiseSlot.squad.filter(
        (s) => s.country && s.country.toLowerCase() !== 'india'
      ).length;

      if (overseasCount >= maxOverseas) {
        return socket.emit('auction:bidRejected', {
          reason: `Maximum overseas player limit reached (${maxOverseas} overseas players)`
        });
      }
    }

    // 11. Calculate Bid Extension
    const extensionSec = room.settings?.bidExtensionSeconds !== undefined
      ? room.settings.bidExtensionSeconds
      : 5;

    let newLotExpiresAt = room.currentAuction.lotExpiresAt || new Date(now + 10000);
    if (extensionSec > 0) {
      const remainingMs = newLotExpiresAt.getTime() - now;
      const minRequiredMs = extensionSec * 1000;
      if (remainingMs < minRequiredMs) {
        newLotExpiresAt = new Date(now + minRequiredMs);
      }
    }

    const bidIncrement = hasBidder
      ? parseFloat((proposedBid - room.currentAuction.currentBidCr).toFixed(2))
      : 0;

    const bidRecord = {
      franchiseCode: franchiseSlot.code,
      franchiseName: franchiseSlot.name,
      userId: socket.user._id,
      userName: socket.user.name,
      amountCr: proposedBid,
      bidIncrementCr: bidIncrement,
      timestamp: new Date()
    };

    // 12. Concurrency-safe atomic MongoDB update with version/bidCount guard
    const currentBidCount = room.currentAuction.bidCount || 0;
    const updatedRoom = await Room.findOneAndUpdate(
      {
        roomCode: code,
        status: 'live',
        'currentAuction.status': 'bidding',
        'currentAuction.bidCount': currentBidCount
      },
      {
        $set: {
          'currentAuction.currentBidCr': proposedBid,
          'currentAuction.currentBidderFranchise': franchiseSlot.code,
          'currentAuction.currentBidderName': socket.user.name,
          'currentAuction.currentBidderUser': socket.user._id,
          'currentAuction.lotExpiresAt': newLotExpiresAt
        },
        $inc: { 'currentAuction.bidCount': 1 },
        $push: { 'currentAuction.bidHistory': bidRecord }
      },
      { new: true }
    ).populate('currentAuction.player');

    if (!updatedRoom) {
      return socket.emit('auction:bidRejected', {
        reason: 'Another bid was accepted simultaneously. Please submit your counter-bid.'
      });
    }

    // Update in-memory timer expiry if extended
    if (activeAuctionTimers.has(code)) {
      const timerObj = activeAuctionTimers.get(code);
      timerObj.lotExpiresAt = newLotExpiresAt;
    }

    // Broadcast accepted bid to all participants in the room
    io.to(code).emit('auction:bidPlaced', {
      roomCode: code,
      currentBidCr: proposedBid,
      currentBidderFranchise: franchiseSlot.code,
      currentBidderName: socket.user.name,
      bidCount: updatedRoom.currentAuction.bidCount,
      bidHistory: updatedRoom.currentAuction.bidHistory,
      nextMinimumBidCr: getNextMinimumBid(proposedBid, true, player.basePriceCr, ladderType)
    });

    // Broadcast updated timer
    const secondsRemaining = Math.max(0, Math.ceil((newLotExpiresAt.getTime() - Date.now()) / 1000));
    io.to(code).emit('auction:timerUpdate', {
      roomCode: code,
      secondsRemaining,
      expiresAt: newLotExpiresAt.toISOString()
    });
  } catch (err) {
    socket.emit('auction:bidRejected', {
      reason: err.message || 'Error processing bid'
    });
  }
};

/**
 * Register all real-time Auction WebSocket event listeners
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const registerAuctionSocket = (io, socket) => {
  // -------------------------------------------------------------
  // 1. Host Starts Auction
  // -------------------------------------------------------------
  socket.on('auction:start', async ({ roomCode }) => {
    try {
      if (!roomCode) {
        return socket.emit('auction:error', { message: 'Room code is required' });
      }

      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room) {
        return socket.emit('auction:error', { message: `Room '${code}' not found` });
      }

      // Host-only verification
      if (!room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can start the auction' });
      }

      if (room.status === 'live') {
        return socket.emit('auction:error', { message: 'The auction is already live!' });
      }

      // Validate queue is not empty
      if (!room.auctionQueue || room.auctionQueue.length === 0) {
        return socket.emit('auction:error', {
          message: 'Cannot start auction: Player queue is empty. Configure player pool first.'
        });
      }

      room.status = 'live';
      await room.save();

      io.to(code).emit('auction:started', {
        roomCode: code,
        message: 'The IPL Auction is now LIVE!'
      });

      // Advance to first lot
      await advanceToNextLot(io, code);
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 2. Place Paddle Bid
  // -------------------------------------------------------------
  socket.on('auction:bid', async (payload) => {
    await handleBid(io, socket, payload || {});
  });

  // -------------------------------------------------------------
  // 3. Host Pauses Auction
  // -------------------------------------------------------------
  socket.on('auction:pause', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room) {
        return socket.emit('auction:error', { message: `Room '${code}' not found` });
      }

      if (!room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can pause the auction' });
      }

      if (room.status !== 'live') {
        return socket.emit('auction:error', { message: 'Auction is not live' });
      }

      room.status = 'paused';
      if (room.currentAuction.status === 'bidding') {
        room.currentAuction.status = 'paused';
      }

      let remainingSecs = 10;
      if (activeAuctionTimers.has(code)) {
        const timerObj = activeAuctionTimers.get(code);
        timerObj.isPaused = true;
        const now = Date.now();
        remainingSecs = Math.max(0, Math.ceil((timerObj.lotExpiresAt.getTime() - now) / 1000));
        timerObj.remainingSeconds = remainingSecs;
        if (timerObj.timerInterval) {
          clearInterval(timerObj.timerInterval);
        }
      }

      room.currentAuction.timerRemaining = remainingSecs;
      await room.save();

      io.to(code).emit('auction:paused', {
        roomCode: code,
        secondsRemaining: remainingSecs
      });
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 4. Host Resumes Auction
  // -------------------------------------------------------------
  socket.on('auction:resume', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room) {
        return socket.emit('auction:error', { message: `Room '${code}' not found` });
      }

      if (!room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can resume the auction' });
      }

      if (room.status !== 'paused') {
        return socket.emit('auction:error', { message: 'Auction is not paused' });
      }

      const remainingSecs = room.currentAuction.timerRemaining || 10;
      room.status = 'live';
      room.currentAuction.status = 'bidding';
      await room.save();

      io.to(code).emit('auction:resumed', {
        roomCode: code,
        secondsRemaining: remainingSecs
      });

      // Resume timer with remaining seconds
      await startLotTimer(io, code, remainingSecs);
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 5. Host Skips Current Player
  // -------------------------------------------------------------
  socket.on('auction:skipPlayer', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room || !room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can skip a player' });
      }

      if (room.status !== 'live') {
        return socket.emit('auction:error', { message: 'Auction is not live' });
      }

      clearRoomTimer(code);

      // Return current player to back of queue
      if (room.currentAuction.player) {
        room.auctionQueue.push(room.currentAuction.player);
      }

      await room.save();
      await advanceToNextLot(io, code);
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 6. Host Marks Current Player Unsold
  // -------------------------------------------------------------
  socket.on('auction:markUnsold', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room || !room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can mark a player unsold' });
      }

      if (room.status !== 'live' || room.currentAuction.status !== 'bidding') {
        return socket.emit('auction:error', { message: 'Lot is not currently bidding' });
      }

      clearRoomTimer(code);
      // Reset any bids on current lot to force unsold outcome
      room.currentAuction.currentBidderFranchise = null;
      room.currentAuction.currentBidderUser = null;
      room.currentAuction.currentBidderName = null;
      await room.save();

      await processHammerDrop(io, code);
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 7. Host Reopens Unsold Players Round
  // -------------------------------------------------------------
  socket.on('auction:reopenUnsold', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room || !room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can reopen unsold players' });
      }

      if (!room.unsoldQueue || room.unsoldQueue.length === 0) {
        return socket.emit('auction:error', { message: 'No unsold players available to reopen' });
      }

      // Move unsold queue back into auction queue
      room.auctionQueue = [...room.auctionQueue, ...room.unsoldQueue];
      room.unsoldQueue = [];
      room.status = 'live';
      await room.save();

      io.to(code).emit('auction:queueUpdated', {
        roomCode: code,
        queueRemaining: room.auctionQueue.length,
        unsoldRemaining: 0,
        message: 'Unsold players round reopened!'
      });

      // If podium is idle, advance
      if (!room.currentAuction.player || room.currentAuction.status === 'idle') {
        await advanceToNextLot(io, code);
      }
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 8. Host Corrects / Reverses Last Sale (Socket Event)
  // -------------------------------------------------------------
  socket.on('auction:correctSale', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room || !room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can correct a sale' });
      }

      // Find last sold lot in completedLots
      const lastSoldIndex = [...room.completedLots].reverse().findIndex((l) => l.status === 'sold');
      if (lastSoldIndex === -1) {
        return socket.emit('auction:error', { message: 'No sold player lots found to reverse' });
      }

      const actualIndex = room.completedLots.length - 1 - lastSoldIndex;
      const lot = room.completedLots[actualIndex];

      const franchiseSlot = room.franchises.find(
        (f) => f.code.toUpperCase() === lot.soldToFranchise.toUpperCase()
      );

      if (franchiseSlot) {
        // Refund purse
        franchiseSlot.remainingPurseCr = parseFloat(
          (franchiseSlot.remainingPurseCr + lot.soldPriceCr).toFixed(2)
        );
        // Remove player from squad
        franchiseSlot.squad = franchiseSlot.squad.filter(
          (s) => !s.player.equals(lot.player)
        );
      }

      lot.status = 'reversed';
      lot.reversedAt = new Date();

      // Return player to front of queue
      room.auctionQueue.unshift(lot.player);
      await room.save();

      io.to(code).emit('auction:saleReversed', {
        roomCode: code,
        player: lot.player,
        franchiseCode: lot.soldToFranchise,
        refundedAmountCr: lot.soldPriceCr,
        message: 'A previous sale was reversed and the player returned to the auction queue.'
      });

      io.to(code).emit('auction:queueUpdated', {
        roomCode: code,
        queueRemaining: room.auctionQueue.length,
        unsoldRemaining: room.unsoldQueue?.length || 0,
        message: 'A previous sale was corrected and the player was returned to the auction queue.'
      });

      const onlineUsers = getOnlineUserIds(code);
      const populated = await Room.findById(room._id)
        .populate('currentAuction.player')
        .populate('auctionQueue', 'name role country nationality basePriceCr battingStyle bowlingStyle isOverseas')
        .populate('completedLots.player', 'name role country nationality basePriceCr')
        .populate('participants', 'name email favoriteTeam avatar');
      io.to(code).emit('auction:stateUpdated', { room: getSanitizedRoomState(populated, onlineUsers) });
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 9. Host Ends Auction Early
  // -------------------------------------------------------------
  socket.on('auction:end', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code });

      if (!room || !room.host.equals(socket.user._id)) {
        return socket.emit('auction:error', { message: 'Only the room host can end the auction' });
      }

      clearRoomTimer(code);
      room.status = 'completed';
      room.currentAuction.status = 'idle';
      room.currentAuction.player = null;
      await room.save();

      // Audit squad compliance
      const minSquad = room.settings?.minSquadSize || 18;
      const maxSquad = room.settings?.maxSquadSize || 25;
      const maxOverseas = room.settings?.maxOverseas || 8;
      const complianceReport = (room.franchises || []).map((f) => {
        const squadCount = f.squad?.length || 0;
        const overseasCount = (f.squad || []).filter(
          (s) => s.country && s.country.toLowerCase() !== 'india'
        ).length;
        const warnings = [];
        if (f.claimedBy && squadCount < minSquad) {
          warnings.push(`Squad size (${squadCount}) is below mandatory minimum of ${minSquad}`);
        }
        if (squadCount > maxSquad) {
          warnings.push(`Squad size (${squadCount}) exceeds maximum limit of ${maxSquad}`);
        }
        if (overseasCount > maxOverseas) {
          warnings.push(`Overseas count (${overseasCount}) exceeds limit of ${maxOverseas}`);
        }
        return {
          code: f.code,
          name: f.name,
          claimed: !!f.claimedBy,
          squadCount,
          overseasCount,
          remainingPurseCr: f.remainingPurseCr,
          isCompliant: warnings.length === 0,
          warnings
        };
      });

      const totalWarnings = complianceReport.reduce((acc, c) => acc.concat(c.warnings), []);

      io.to(code).emit('auction:completed', {
        roomCode: code,
        message: 'The auction was concluded by the host.',
        completedLotsCount: room.completedLots?.length || 0,
        unsoldQueueCount: room.unsoldQueue?.length || 0,
        complianceReport,
        warnings: totalWarnings
      });

      const onlineUsers = getOnlineUserIds(code);
      const populated = await Room.findById(room._id)
        .populate('participants', 'name email favoriteTeam avatar');
      io.to(code).emit('auction:stateUpdated', { room: getSanitizedRoomState(populated, onlineUsers) });
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });

  // -------------------------------------------------------------
  // 10. Get Auction State (for Reconnection and Sync)
  // -------------------------------------------------------------
  socket.on('auction:getState', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.toUpperCase();
      const room = await Room.findOne({ roomCode: code })
        .populate('currentAuction.player')
        .populate('auctionQueue', 'name role country nationality basePriceCr battingStyle bowlingStyle isOverseas')
        .populate('completedLots.player', 'name role country nationality basePriceCr')
        .populate('participants', 'name email favoriteTeam avatar');

      if (!room) {
        return socket.emit('auction:error', { message: `Room '${code}' not found` });
      }

      const onlineUsers = getOnlineUserIds(code);
      const sanitized = getSanitizedRoomState(room, onlineUsers);

      // Attach authoritative live timer calculation
      let liveSecondsRemaining = 0;
      if (room.currentAuction.lotExpiresAt && room.currentAuction.status === 'bidding') {
        const now = Date.now();
        liveSecondsRemaining = Math.max(0, Math.ceil((room.currentAuction.lotExpiresAt.getTime() - now) / 1000));
      } else if (room.currentAuction.status === 'paused') {
        liveSecondsRemaining = room.currentAuction.timerRemaining || 0;
      }

      sanitized.currentAuction.liveSecondsRemaining = liveSecondsRemaining;
      socket.emit('auction:stateUpdated', { room: sanitized });
    } catch (err) {
      socket.emit('auction:error', { message: err.message });
    }
  });
};

/**
 * Server startup recovery:
 * Recovers and resumes active auction countdown timers from MongoDB state
 */
const recoverActiveAuctionTimers = async (io) => {
  try {
    const liveRooms = await Room.find({
      status: { $in: ['live', 'paused'] },
      'currentAuction.status': { $in: ['bidding', 'paused'] }
    }).populate('currentAuction.player');

    if (!liveRooms || liveRooms.length === 0) {
      return;
    }

    console.log(`🔄 [Recovery]: Found ${liveRooms.length} active auction room(s) to restore...`);

    for (const room of liveRooms) {
      const code = room.roomCode;

      if (room.status === 'paused' || room.currentAuction.status === 'paused') {
        console.log(`   Room ${code} recovered in PAUSED state (${room.currentAuction.timerRemaining || 10}s)`);
        activeAuctionTimers.set(code, {
          roomCode: code,
          lotExpiresAt: room.currentAuction.lotExpiresAt || new Date(),
          isPaused: true,
          remainingSeconds: room.currentAuction.timerRemaining || 10,
          timerInterval: null
        });
        continue;
      }

      const now = Date.now();
      const expiresAt = room.currentAuction.lotExpiresAt ? room.currentAuction.lotExpiresAt.getTime() : 0;

      if (now >= expiresAt) {
        console.log(`   Room ${code} timer expired during restart. Finalizing lot...`);
        await processHammerDrop(io, code);
      } else {
        const remainingSecs = Math.ceil((expiresAt - now) / 1000);
        console.log(`   Room ${code} timer resuming with ${remainingSecs}s remaining...`);
        await startLotTimer(io, code, remainingSecs);
      }
    }
  } catch (err) {
    console.error('Error in recoverActiveAuctionTimers:', err.message);
  }
};

module.exports = {
  registerAuctionSocket,
  startLotTimer,
  clearRoomTimer,
  processHammerDrop,
  advanceToNextLot,
  handleBid,
  getBidIncrement,
  getNextMinimumBid,
  recoverActiveAuctionTimers,
  activeAuctionTimers
};
