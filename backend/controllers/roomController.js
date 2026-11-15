const crypto = require('crypto');
const Room = require('../models/Room');
const Team = require('../models/Team');
const Player = require('../models/Player');
const generateToken = require('../utils/generateToken');

const ALLOWED_TIMERS = [5, 10, 15, 20, 30, 45, 60];
const ALLOWED_BID_EXTENSIONS = [0, 3, 5, 10];
const ALLOWED_AUCTION_MODES = ['standard', 'fast', 'marquee-first'];
const ALLOWED_POOL_TYPES = ['all-time', 'season', 'multi-season', 'custom-only', 'curated'];

/**
 * Helper to sanitize room state for API responses and Socket emissions.
 * Strips sensitive fields like room passcodes, hashes, or credentials.
 * Adds online status if onlineUsersSet (Set of userId strings) is provided.
 */
const getSanitizedRoomState = (roomDoc, onlineUsersSet = null) => {
  if (!roomDoc) return null;
  const raw = typeof roomDoc.toObject === 'function' ? roomDoc.toObject() : { ...roomDoc };

  // Never expose passcode
  delete raw.passcode;

  // Add online status for participants
  if (Array.isArray(raw.participants)) {
    raw.participants = raw.participants.map((p) => {
      if (typeof p === 'object' && p !== null && p._id) {
        const idStr = p._id.toString();
        delete p.password;
        return {
          _id: p._id,
          name: p.name,
          email: p.email,
          favoriteTeam: p.favoriteTeam,
          avatar: p.avatar,
          isOnline: onlineUsersSet ? onlineUsersSet.has(idStr) : false
        };
      }
      return p;
    });
  }

  raw.auctionQueueCount = Array.isArray(raw.auctionQueue) ? raw.auctionQueue.length : 0;
  raw.unsoldQueueCount = Array.isArray(raw.unsoldQueue) ? raw.unsoldQueue.length : 0;
  raw.completedLotsCount = Array.isArray(raw.completedLots) ? raw.completedLots.length : 0;

  return raw;
};

/**
 * Generate a clean, unique 6-character room code (e.g., 'IPL-4X7B' or 'IPL-9K2M')
 */
const generateRoomCode = async () => {
  let isUnique = false;
  let code = '';
  while (!isUnique) {
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    code = `IPL-${randomHex}`;
    const existing = await Room.findOne({ roomCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

/**
 * Build room-specific auction player queue
 */
const buildAuctionQueue = async (settings = {}) => {
  const {
    poolType = 'all-time',
    selectedSeasons = [],
    includeRetired = true,
    includeCustom = true,
    maxQueueSize = 100,
    selectedCategories = []
  } = settings;

  const filter = {
    isAuctionEligible: true
  };

  // Exclude known corrupted franchise names
  const KNOWN_FRANCHISES = [
    'Chennai Super Kings', 'Sunrisers Hyderabad', 'Rajasthan Royals', 'Mumbai Indians',
    'Kolkata Knight Riders', 'Punjab Kings', 'Delhi Capitals', 'Gujarat Titans',
    'Lucknow Super Giants', 'Royal Challengers Bangalore', 'Kings XI Punjab',
    'Royal Challengers Bengaluru', 'Deccan Chargers', 'Delhi Daredevils', 'Pune Warriors',
    'Gujarat Lions', 'Rising Pune Supergiant', 'Rising Pune Supergiants', 'Kochi Tuskers Kerala'
  ];
  filter.name = { $nin: KNOWN_FRANCHISES };

  // Custom player filtering
  if (!includeCustom) {
    filter.isCustom = { $ne: true };
  } else if (poolType === 'custom-only') {
    filter.isCustom = true;
  }

  // Retired player filtering
  if (includeRetired === false) {
    filter.isRetired = false;
  }

  // Season-specific filtering
  if ((poolType === 'season' || poolType === 'multi-season') && Array.isArray(selectedSeasons) && selectedSeasons.length > 0) {
    filter.seasonsPlayed = { $in: selectedSeasons.map((s) => parseInt(s, 10)) };
  }

  // Category/Role-specific filtering (if provided)
  if (Array.isArray(selectedCategories) && selectedCategories.length > 0) {
    const normalized = selectedCategories.flatMap((c) => {
      if (c === 'Wicket-Keeper' || c === 'Wicketkeeper') return ['Wicketkeeper', 'Wicket-Keeper', 'Wicketkeepers'];
      if (c === 'Batsman' || c === 'Batsmen') return ['Batsman', 'Batsmen'];
      if (c === 'Bowler' || c === 'Bowlers') return ['Bowler', 'Bowlers', 'Fast Bowlers', 'Spinners'];
      if (c === 'All-Rounder' || c === 'All-Rounders') return ['All-Rounder', 'All-Rounders'];
      return [c];
    });
    filter.$or = [
      { role: { $in: normalized } },
      { category: { $in: normalized } }
    ];
  }

  const limit = Math.min(300, Math.max(10, parseInt(maxQueueSize, 10) || 100));

  const players = await Player.find(filter)
    .sort({ basePriceCr: -1, 'iplStats.runs': -1, 'iplStats.wickets': -1, name: 1 })
    .limit(limit)
    .lean();

  // Deduplicate ObjectIds
  const seen = new Set();
  const queue = [];
  for (const p of players) {
    const idStr = p._id.toString();
    if (!seen.has(idStr)) {
      seen.add(idStr);
      queue.push(p._id);
    }
  }

  return queue;
};

/**
 * @desc    Create a new auction room
 * @route   POST /api/rooms
 * @access  Private
 */
const createRoom = async (req, res, next) => {
  try {
    const { roomName, passcode, isPrivate, settings, autoClaimTeam, displayName, hostName } = req.body;

    // Update user display name if provided
    const chosenName = (displayName || hostName || req.user.name || 'Manager').trim().slice(0, 50);
    if (chosenName && chosenName !== req.user.name) {
      req.user.name = chosenName;
      await req.user.save();
    }

    if (!roomName || !roomName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid room name'
      });
    }

    if (isPrivate && (!passcode || !passcode.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A passcode is required for private rooms'
      });
    }

    // Validate settings if supplied
    const timerSeconds = settings?.timerSeconds !== undefined ? Number(settings.timerSeconds) : 10;
    if (!ALLOWED_TIMERS.includes(timerSeconds)) {
      return res.status(400).json({
        success: false,
        message: `Invalid timer duration. Allowed values: ${ALLOWED_TIMERS.join(', ')} seconds`
      });
    }

    const bidExtensionSeconds = settings?.bidExtensionSeconds !== undefined ? Number(settings.bidExtensionSeconds) : 5;
    if (!ALLOWED_BID_EXTENSIONS.includes(bidExtensionSeconds)) {
      return res.status(400).json({
        success: false,
        message: `Invalid bid extension duration. Allowed values: ${ALLOWED_BID_EXTENSIONS.join(', ')} seconds`
      });
    }

    const auctionMode = settings?.auctionMode || 'standard';
    if (!ALLOWED_AUCTION_MODES.includes(auctionMode)) {
      return res.status(400).json({
        success: false,
        message: `Invalid auction mode. Allowed values: ${ALLOWED_AUCTION_MODES.join(', ')}`
      });
    }

    const startingPurseCr = settings?.startingPurseCr !== undefined ? Number(settings.startingPurseCr) : 120.0;
    if (isNaN(startingPurseCr) || startingPurseCr < 20 || startingPurseCr > 250) {
      return res.status(400).json({
        success: false,
        message: 'Starting purse must be between ₹20 Cr and ₹250 Cr'
      });
    }

    const minSquadSize = settings?.minSquadSize !== undefined ? Number(settings.minSquadSize) : 18;
    const maxSquadSize = settings?.maxSquadSize !== undefined ? Number(settings.maxSquadSize) : 25;
    if (minSquadSize < 10 || minSquadSize > maxSquadSize || maxSquadSize > 30) {
      return res.status(400).json({
        success: false,
        message: 'Squad limits invalid (Min: 10-25, Max: 15-30, Min <= Max)'
      });
    }

    const maxOverseas = settings?.maxOverseas !== undefined ? Number(settings.maxOverseas) : 8;
    if (maxOverseas < 2 || maxOverseas > 10) {
      return res.status(400).json({
        success: false,
        message: 'Overseas limit must be between 2 and 10'
      });
    }

    const poolType = settings?.poolType || 'all-time';
    if (!ALLOWED_POOL_TYPES.includes(poolType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid pool type. Allowed: ${ALLOWED_POOL_TYPES.join(', ')}`
      });
    }

    const incrementLadderType = settings?.incrementLadderType || 'official';
    if (!['official', 'custom'].includes(incrementLadderType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid increment ladder type. Allowed: official, custom'
      });
    }

    const roomCode = await generateRoomCode();
    const teams = await Team.find({ isActive: true }).sort({ name: 1 });

    if (!teams || teams.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Franchise master data is not seeded yet. Please run database seeder.'
      });
    }

    const configuredSettings = {
      timerSeconds,
      bidExtensionSeconds,
      auctionMode,
      startingPurseCr,
      minSquadSize,
      maxSquadSize,
      maxOverseas,
      poolType,
      selectedSeasons: settings?.selectedSeasons || [],
      selectedCategories: settings?.selectedCategories || ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'],
      includeRetired: settings?.includeRetired !== undefined ? !!settings.includeRetired : true,
      includeCustom: settings?.includeCustom !== undefined ? !!settings.includeCustom : true,
      maxQueueSize: settings?.maxQueueSize || 100,
      allowMultipleFranchisesPerUser: !!settings?.allowMultipleFranchisesPerUser,
      incrementLadderType
    };

    // Build curated auction queue
    const auctionQueue = await buildAuctionQueue(configuredSettings);

    // Initialize the 10 in-room franchise slots
    const franchises = teams.map((team) => {
      const isClaimedByHost = autoClaimTeam && autoClaimTeam.toUpperCase() === team.code.toUpperCase();
      return {
        franchiseId: team.franchiseId,
        name: team.name,
        code: team.code,
        tagline: team.tagline,
        brand: team.brand,
        totalPurseCr: startingPurseCr,
        remainingPurseCr: startingPurseCr,
        claimedBy: isClaimedByHost ? req.user._id : null,
        claimedByName: isClaimedByHost ? req.user.name : '',
        squad: []
      };
    });

    const room = await Room.create({
      roomCode,
      roomName: roomName.trim(),
      host: req.user._id,
      hostName: req.user.name,
      passcode: isPrivate ? passcode.trim() : null,
      isPrivate: !!isPrivate,
      settings: configuredSettings,
      franchises,
      auctionQueue,
      participants: [req.user._id],
      status: 'waiting'
    });

    const populated = await Room.findById(room._id).populate('participants', 'name email favoriteTeam avatar');
    const token = generateToken(req.user._id);

    return res.status(201).json({
      success: true,
      message: `Auction room '${room.roomName}' created successfully`,
      data: {
        ...getSanitizedRoomState(populated),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List all active public rooms
 * @route   GET /api/rooms
 * @access  Public
 */
const listRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({})
      .select('-passcode')
      .sort({ createdAt: -1 })
      .lean();

    const formattedRooms = rooms.map((r) => ({
      _id: r._id,
      roomCode: r.roomCode,
      roomName: r.roomName,
      hostName: r.hostName,
      isPrivate: r.isPrivate,
      status: r.status,
      participantCount: r.participants?.length || 0,
      claimedFranchisesCount: r.franchises?.filter((f) => f.claimedBy)?.length || 0,
      totalFranchises: r.franchises?.length || 10,
      settings: r.settings,
      createdAt: r.createdAt
    }));

    return res.status(200).json({
      success: true,
      count: formattedRooms.length,
      data: formattedRooms
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get room state by code
 * @route   GET /api/rooms/:roomCode
 * @access  Public
 */
const getRoomByCode = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode })
      .populate('currentAuction.player')
      .populate('auctionQueue', 'name role country nationality basePriceCr battingStyle bowlingStyle isOverseas')
      .populate('completedLots.player', 'name role country nationality basePriceCr')
      .populate('participants', 'name email favoriteTeam avatar');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room with code '${roomCode}' not found`
      });
    }

    return res.status(200).json({
      success: true,
      data: getSanitizedRoomState(room)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Join an auction room as participant
 * @route   POST /api/rooms/:roomCode/join
 * @access  Private
 */
const joinRoom = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const { passcode, displayName } = req.body;

    if (displayName && typeof displayName === 'string' && displayName.trim()) {
      const cleanName = displayName.trim().slice(0, 50);
      if (req.user && req.user.name !== cleanName) {
        req.user.name = cleanName;
        await req.user.save();
      }
    }

    const room = await Room.findOne({ roomCode }).select('+passcode');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Verify passcode if private room
    if (room.isPrivate && room.passcode) {
      if (!passcode || passcode.trim() !== room.passcode) {
        return res.status(403).json({
          success: false,
          message: 'Incorrect room passcode'
        });
      }
    }

    // Add to participants if not already present (prevent duplicate participant records)
    const alreadyParticipant = room.participants.some((pId) => pId.equals(req.user._id));
    if (!alreadyParticipant) {
      room.participants.push(req.user._id);
      await room.save();
    }

    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    const token = generateToken(req.user._id);

    return res.status(200).json({
      success: true,
      message: `Joined room '${room.roomName}' successfully`,
      data: {
        ...getSanitizedRoomState(populated),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Leave an auction room
 * @route   POST /api/rooms/:roomCode/leave
 * @access  Private
 */
const leaveRoom = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Remove user from participants
    room.participants = room.participants.filter((pId) => !pId.equals(req.user._id));

    // Release any franchises held by this user
    let releasedCount = 0;
    room.franchises.forEach((f) => {
      if (f.claimedBy && f.claimedBy.equals(req.user._id)) {
        f.claimedBy = null;
        f.claimedByName = '';
        releasedCount += 1;
      }
    });

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: `Successfully left room '${room.roomName}'`,
      releasedFranchises: releasedCount,
      data: getSanitizedRoomState(populated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Close / Delete a room (Host only, only when waiting)
 * @route   DELETE /api/rooms/:roomCode
 * @access  Private
 */
const closeRoom = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Verify room membership for private rooms
    // Host check
    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room host can close this room'
      });
    }

    // Waiting status check
    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Cannot close an auction room that is live or completed'
      });
    }

    await Room.deleteOne({ _id: room._id });

    return res.status(200).json({
      success: true,
      message: `Room '${room.roomName}' (${roomCode}) has been closed successfully`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Claim an open franchise in a room
 * @route   POST /api/rooms/:roomCode/claim
 * @access  Private
 */
const claimFranchise = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const { franchiseCode } = req.body;

    if (!franchiseCode) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the franchise code to claim (e.g. CSK, MI, RCB)'
      });
    }

    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Verify room membership for private rooms
    const isParticipant = (room.participants || []).some((p) => p.equals(req.user._id));
    if (room.isPrivate && !isParticipant) {
      return res.status(403).json({
        success: false,
        code: 'PRIVATE_ROOM_NOT_JOINED',
        message: 'You must join this private room with the correct passcode before claiming a franchise'
      });
    }

    // Ensure user doesn't already hold another franchise unless multiple allowed
    if (!room.settings.allowMultipleFranchisesPerUser) {
      const alreadyClaimedSlot = room.franchises.find(
        (f) => f.claimedBy && f.claimedBy.equals(req.user._id)
      );
      if (alreadyClaimedSlot) {
        return res.status(400).json({
          success: false,
          message: `You have already claimed ${alreadyClaimedSlot.name} (${alreadyClaimedSlot.code}) in this room. Release it first to claim another.`
        });
      }
    }

    // Find requested franchise slot
    const targetSlot = room.franchises.find(
      (f) => f.code.toUpperCase() === franchiseCode.toUpperCase()
    );

    if (!targetSlot) {
      return res.status(404).json({
        success: false,
        message: `Franchise '${franchiseCode}' not found in this room`
      });
    }

    if (targetSlot.claimedBy) {
      return res.status(400).json({
        success: false,
        message: `${targetSlot.name} (${targetSlot.code}) is already claimed by ${targetSlot.claimedByName}`
      });
    }

    // Atomic claim via findOneAndUpdate with $elemMatch to prevent race conditions
    const updatedRoom = await Room.findOneAndUpdate(
      {
        roomCode,
        franchises: {
          $elemMatch: {
            code: franchiseCode.toUpperCase(),
            claimedBy: null
          }
        }
      },
      {
        $set: {
          'franchises.$.claimedBy': req.user._id,
          'franchises.$.claimedByName': req.user.name
        },
        $addToSet: {
          participants: req.user._id
        }
      },
      { new: true }
    ).populate('participants', 'name email favoriteTeam avatar');

    if (!updatedRoom) {
      return res.status(400).json({
        success: false,
        message: `Franchise '${franchiseCode}' was claimed by another participant just now`
      });
    }

    return res.status(200).json({
      success: true,
      message: `You have successfully claimed ${targetSlot.name} (${targetSlot.code})!`,
      data: getSanitizedRoomState(updatedRoom)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Release a claimed franchise in a room
 * @route   POST /api/rooms/:roomCode/release
 * @access  Private
 */
const releaseFranchise = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const { franchiseCode } = req.body;

    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Verify room membership for private rooms
    const isParticipant = (room.participants || []).some((p) => p.equals(req.user._id));
    if (room.isPrivate && !isParticipant) {
      return res.status(403).json({
        success: false,
        code: 'PRIVATE_ROOM_NOT_JOINED',
        message: 'You must join this private room with the correct passcode before claiming a franchise'
      });
    }

    const isHost = room.host.equals(req.user._id);

    // Find slot
    const slot = room.franchises.find((f) => {
      if (franchiseCode) {
        return f.code.toUpperCase() === franchiseCode.toUpperCase();
      }
      return f.claimedBy && f.claimedBy.equals(req.user._id);
    });

    if (!slot || !slot.claimedBy) {
      return res.status(400).json({
        success: false,
        message: 'No claimed franchise found to release'
      });
    }

    // Authorization check: only host or the claiming user can release
    const isOwner = slot.claimedBy.equals(req.user._id);
    if (!isHost && !isOwner) {
      return res.status(403).json({
        success: false,
        message: `Unauthorized: Only the room host or the manager of ${slot.name} can release this franchise`
      });
    }

    const releasedName = slot.name;
    slot.claimedBy = null;
    slot.claimedByName = '';

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: `Successfully released ${releasedName}`,
      data: getSanitizedRoomState(populated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Start auction in a room (Host only)
 * @route   POST /api/rooms/:roomCode/start
 * @access  Private
 */
const startAuction = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    // Verify room membership for private rooms
    const isParticipant = (room.participants || []).some((p) => p.equals(req.user._id));
    if (room.isPrivate && !isParticipant) {
      return res.status(403).json({
        success: false,
        code: 'PRIVATE_ROOM_NOT_JOINED',
        message: 'You must join this private room with the correct passcode before claiming a franchise'
      });
    }

    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room host can start the auction'
      });
    }

    if (room.status === 'live') {
      return res.status(400).json({
        success: false,
        message: 'The auction is already live!'
      });
    }

    // Validate queue is not empty
    if (!room.auctionQueue || room.auctionQueue.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot start auction: Auction queue is empty. Please configure or rebuild the player pool first.'
      });
    }

    // Advance to first lot
    const nextPlayerId = room.auctionQueue.shift();
    const nextPlayer = await Player.findById(nextPlayerId);

    const timerSeconds = room.settings?.timerSeconds || 10;
    const now = Date.now();
    const lotExpiresAt = new Date(now + timerSeconds * 1000);

    room.status = 'live';
    room.currentAuction = {
      player: nextPlayer._id,
      currentBidCr: nextPlayer.basePriceCr,
      currentBidderFranchise: null,
      currentBidderName: null,
      currentBidderUser: null,
      lotStartedAt: new Date(now),
      lotExpiresAt,
      timerDuration: timerSeconds,
      timerRemaining: timerSeconds,
      bidCount: 0,
      bidHistory: [],
      status: 'bidding'
    };

    await room.save();

    // Start socket countdown timer if socket server available
    try {
      const { getIO } = require('../socket');
      const { startLotTimer } = require('../socket/auctionSocket');
      const io = getIO();
      if (io) {
        io.to(roomCode).emit('auction:started', {
          roomCode,
          message: 'The IPL Auction is now LIVE!'
        });
        io.to(roomCode).emit('auction:playerChanged', {
          roomCode,
          player: nextPlayer,
          basePriceCr: nextPlayer.basePriceCr,
          timerDuration: timerSeconds,
          lotExpiresAt: lotExpiresAt.toISOString(),
          queueRemaining: room.auctionQueue.length
        });
        await startLotTimer(io, roomCode, timerSeconds);
      }
    } catch (e) {
      // Sockets might not be initialized in some test environments
    }

    const updatedRoom = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: `Auction room '${room.roomName}' is now LIVE!`,
      data: getSanitizedRoomState(updatedRoom)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Pause auction (Host only)
 * @route   POST /api/rooms/:roomCode/pause
 * @access  Private
 */
const pauseAuction = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room '${roomCode}' not found` });
    }
    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the room host can pause the auction' });
    }
    if (room.status !== 'live') {
      return res.status(400).json({ success: false, message: 'Auction is not currently live' });
    }

    room.status = 'paused';
    if (room.currentAuction.status === 'bidding') {
      room.currentAuction.status = 'paused';
    }

    let remainingSecs = room.currentAuction.timerRemaining || 10;
    try {
      const { clearRoomTimer, activeAuctionTimers } = require('../socket/auctionSocket');
      if (activeAuctionTimers && activeAuctionTimers.has(roomCode)) {
        const timerObj = activeAuctionTimers.get(roomCode);
        const now = Date.now();
        remainingSecs = Math.max(0, Math.ceil((timerObj.lotExpiresAt.getTime() - now) / 1000));
        clearRoomTimer(roomCode);
      }
    } catch (e) {}

    room.currentAuction.timerRemaining = remainingSecs;
    await room.save();

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) io.to(roomCode).emit('auction:paused', { roomCode, secondsRemaining: remainingSecs });
    } catch (e) {}

    const updated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: 'Auction paused successfully',
      data: getSanitizedRoomState(updated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resume auction (Host only)
 * @route   POST /api/rooms/:roomCode/resume
 * @access  Private
 */
const resumeAuction = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room '${roomCode}' not found` });
    }
    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the room host can resume the auction' });
    }
    if (room.status !== 'paused') {
      return res.status(400).json({ success: false, message: 'Auction is not currently paused' });
    }

    const remainingSecs = room.currentAuction.timerRemaining || 10;
    room.status = 'live';
    room.currentAuction.status = 'bidding';
    await room.save();

    try {
      const { getIO } = require('../socket');
      const { startLotTimer } = require('../socket/auctionSocket');
      const io = getIO();
      if (io) {
        io.to(roomCode).emit('auction:resumed', { roomCode, secondsRemaining: remainingSecs });
        await startLotTimer(io, roomCode, remainingSecs);
      }
    } catch (e) {}

    const updated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: 'Auction resumed successfully',
      data: getSanitizedRoomState(updated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Correct/reverse an accidental sale (Host only)
 * @route   POST /api/rooms/:roomCode/correct-sale
 * @access  Private
 */
const correctSale = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room '${roomCode}' not found` });
    }
    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the room host can correct a sale' });
    }

    // Find the last sold lot in completedLots
    const lastSoldIndex = [...room.completedLots].reverse().findIndex((l) => l.status === 'sold');
    if (lastSoldIndex === -1) {
      return res.status(400).json({ success: false, message: 'No sold player lots found to reverse' });
    }

    const actualIndex = room.completedLots.length - 1 - lastSoldIndex;
    const lot = room.completedLots[actualIndex];

    // Find franchise that bought the player
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

    // Mark lot as reversed
    lot.status = 'reversed';
    lot.reversedAt = new Date();

    // Return player to front of auctionQueue
    room.auctionQueue.unshift(lot.player);

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(roomCode).emit('auction:saleReversed', {
          roomCode,
          player: lot.player,
          franchiseCode: lot.soldToFranchise,
          refundedAmountCr: lot.soldPriceCr,
          message: 'A previous sale was reversed and the player returned to the auction queue.'
        });
        io.to(roomCode).emit('auction:queueUpdated', {
          roomCode,
          queueRemaining: room.auctionQueue.length,
          unsoldRemaining: room.unsoldQueue?.length || 0,
          message: 'A previous sale was corrected and the player was returned to the auction queue.'
        });
        io.to(roomCode).emit('auction:stateUpdated', {
          room: getSanitizedRoomState(populated)
        });
      }
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Sale successfully reversed. Player returned to queue and purse refunded.',
      data: getSanitizedRoomState(populated)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    End auction early (Host only)
 * @route   POST /api/rooms/:roomCode/end
 * @access  Private
 */
const endAuction = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      return res.status(404).json({ success: false, message: `Room '${roomCode}' not found` });
    }
    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Only the room host can end the auction' });
    }

    // Audit franchise squad compliance
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

    try {
      const { clearRoomTimer } = require('../socket/auctionSocket');
      clearRoomTimer(roomCode);
    } catch (e) {}

    room.status = 'completed';
    room.currentAuction.status = 'idle';
    room.currentAuction.player = null;
    await room.save();

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        io.to(roomCode).emit('auction:completed', {
          roomCode,
          message: 'The auction was concluded by the host.',
          completedLotsCount: room.completedLots?.length || 0,
          unsoldQueueCount: room.unsoldQueue?.length || 0,
          complianceReport,
          warnings: totalWarnings
        });
      }
    } catch (e) {}

    const populated = await Room.findById(room._id)
      .populate('participants', 'name email favoriteTeam avatar');

    const sanitized = getSanitizedRoomState(populated);
    sanitized.complianceReport = complianceReport;
    sanitized.complianceWarnings = totalWarnings;

    return res.status(200).json({
      success: true,
      message: 'Auction ended successfully',
      data: sanitized,
      complianceReport,
      warnings: totalWarnings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update room settings & customize player pool (Host only)
 * @route   PUT /api/rooms/:roomCode/settings
 * @access  Private
 */
const updateRoomSettings = async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode.toUpperCase();
    const { settings, rebuildQueue } = req.body;

    const room = await Room.findOne({ roomCode });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Auction room '${roomCode}' not found`
      });
    }

    if (!room.host.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the room host can customize auction pool and room settings'
      });
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({
        success: false,
        message: 'Room settings and player pool can only be customized before the auction starts'
      });
    }

    if (settings) {
      if (settings.timerSeconds !== undefined) {
        const val = Number(settings.timerSeconds);
        if (!ALLOWED_TIMERS.includes(val)) {
          return res.status(400).json({
            success: false,
            message: `Invalid timer duration. Allowed values: ${ALLOWED_TIMERS.join(', ')} seconds`
          });
        }
        room.settings.timerSeconds = val;
      }

      if (settings.bidExtensionSeconds !== undefined) {
        const val = Number(settings.bidExtensionSeconds);
        if (!ALLOWED_BID_EXTENSIONS.includes(val)) {
          return res.status(400).json({
            success: false,
            message: `Invalid bid extension duration. Allowed values: ${ALLOWED_BID_EXTENSIONS.join(', ')} seconds`
          });
        }
        room.settings.bidExtensionSeconds = val;
      }

      if (settings.auctionMode !== undefined) {
        if (!ALLOWED_AUCTION_MODES.includes(settings.auctionMode)) {
          return res.status(400).json({
            success: false,
            message: `Invalid auction mode. Allowed values: ${ALLOWED_AUCTION_MODES.join(', ')}`
          });
        }
        room.settings.auctionMode = settings.auctionMode;
      }

      if (settings.startingPurseCr !== undefined) {
        const val = Number(settings.startingPurseCr);
        if (isNaN(val) || val < 20 || val > 250) {
          return res.status(400).json({
            success: false,
            message: 'Starting purse must be between ₹20 Cr and ₹250 Cr'
          });
        }
        room.settings.startingPurseCr = val;
        // Update purse of franchises that have empty squads
        room.franchises.forEach((f) => {
          if (!f.squad || f.squad.length === 0) {
            f.totalPurseCr = val;
            f.remainingPurseCr = val;
          }
        });
      }

      if (settings.minSquadSize !== undefined) {
        const val = Number(settings.minSquadSize);
        if (val < 10 || val > 25) {
          return res.status(400).json({
            success: false,
            message: 'Minimum squad size must be between 10 and 25'
          });
        }
        room.settings.minSquadSize = val;
      }

      if (settings.maxSquadSize !== undefined) {
        const val = Number(settings.maxSquadSize);
        if (val < 15 || val > 30) {
          return res.status(400).json({
            success: false,
            message: 'Maximum squad size must be between 15 and 30'
          });
        }
        room.settings.maxSquadSize = val;
      }

      if (room.settings.minSquadSize > room.settings.maxSquadSize) {
        return res.status(400).json({
          success: false,
          message: 'Minimum squad size cannot exceed maximum squad size'
        });
      }

      if (settings.maxOverseas !== undefined) {
        const val = Number(settings.maxOverseas);
        if (val < 2 || val > 10) {
          return res.status(400).json({
            success: false,
            message: 'Overseas limit must be between 2 and 10'
          });
        }
        room.settings.maxOverseas = val;
      }

      if (settings.poolType !== undefined) {
        if (!ALLOWED_POOL_TYPES.includes(settings.poolType)) {
          return res.status(400).json({
            success: false,
            message: `Invalid pool type. Allowed: ${ALLOWED_POOL_TYPES.join(', ')}`
          });
        }
        room.settings.poolType = settings.poolType;
      }

      if (settings.selectedSeasons !== undefined) room.settings.selectedSeasons = settings.selectedSeasons;
      if (settings.selectedCategories !== undefined) room.settings.selectedCategories = settings.selectedCategories;
      if (settings.includeRetired !== undefined) room.settings.includeRetired = !!settings.includeRetired;
      if (settings.includeCustom !== undefined) room.settings.includeCustom = !!settings.includeCustom;
      if (settings.maxQueueSize !== undefined) {
        const val = Number(settings.maxQueueSize);
        if (val < 10 || val > 300) {
          return res.status(400).json({
            success: false,
            message: 'Queue size must be between 10 and 300'
          });
        }
        room.settings.maxQueueSize = val;
      }
      if (settings.allowMultipleFranchisesPerUser !== undefined) {
        room.settings.allowMultipleFranchisesPerUser = !!settings.allowMultipleFranchisesPerUser;
      }
      if (settings.incrementLadderType !== undefined) {
        if (!['official', 'custom'].includes(settings.incrementLadderType)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid incrementLadderType. Allowed: official, custom'
          });
        }
        room.settings.incrementLadderType = settings.incrementLadderType;
      }
    }

    if (rebuildQueue) {
      room.auctionQueue = await buildAuctionQueue(room.settings);
    }

    await room.save();

    const populated = await Room.findById(room._id)
      .populate('currentAuction.player')
      .populate('participants', 'name email favoriteTeam avatar');

    return res.status(200).json({
      success: true,
      message: 'Room settings updated successfully',
      data: getSanitizedRoomState(populated)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
  getSanitizedRoomState,
  buildAuctionQueue,
  ALLOWED_TIMERS,
  ALLOWED_BID_EXTENSIONS,
  ALLOWED_AUCTION_MODES,
  ALLOWED_POOL_TYPES
};