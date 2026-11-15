const Room = require('../models/Room');
const { getSanitizedRoomState } = require('../controllers/roomController');

// In-memory presence map:
// roomPresence: Map<roomCode, Map<userIdStr, Set<socketId>>>
const roomPresence = new Map();

/**
 * Add a socket to user's active sockets for a room
 * Returns { wasOnline, isNowOnline }
 */
const addUserSocket = (roomCode, userIdStr, socketId) => {
  if (!roomPresence.has(roomCode)) {
    roomPresence.set(roomCode, new Map());
  }
  const usersMap = roomPresence.get(roomCode);
  if (!usersMap.has(userIdStr)) {
    usersMap.set(userIdStr, new Set());
  }
  const socketSet = usersMap.get(userIdStr);
  const wasOnline = socketSet.size > 0;
  socketSet.add(socketId);
  return { wasOnline, isNowOnline: socketSet.size > 0 };
};

/**
 * Remove a socket from user's active sockets for a room
 * Returns { isNowOffline, remainingSocketsCount }
 */
const removeUserSocket = (roomCode, userIdStr, socketId) => {
  if (!roomPresence.has(roomCode)) {
    return { isNowOffline: true, remainingSocketsCount: 0 };
  }
  const usersMap = roomPresence.get(roomCode);
  if (!usersMap.has(userIdStr)) {
    return { isNowOffline: true, remainingSocketsCount: 0 };
  }
  const socketSet = usersMap.get(userIdStr);
  socketSet.delete(socketId);
  const remainingCount = socketSet.size;

  if (remainingCount === 0) {
    usersMap.delete(userIdStr);
    if (usersMap.size === 0) {
      roomPresence.delete(roomCode);
    }
    return { isNowOffline: true, remainingSocketsCount: 0 };
  }

  return { isNowOffline: false, remainingSocketsCount: remainingCount };
};

/**
 * Get Set of online user IDs (strings) for a given room
 */
const getOnlineUserIds = (roomCode) => {
  if (!roomPresence.has(roomCode)) return new Set();
  const usersMap = roomPresence.get(roomCode);
  return new Set(usersMap.keys());
};

/**
 * Check if a specific user is currently online in a room
 */
const isUserOnlineInRoom = (roomCode, userId) => {
  if (!roomPresence.has(roomCode)) return false;
  const userIdStr = userId.toString();
  const usersMap = roomPresence.get(roomCode);
  return usersMap.has(userIdStr) && usersMap.get(userIdStr).size > 0;
};

/**
 * Register all room lifecycle and presence Socket.IO events for a client socket
 * @param {import('socket.io').Server} io 
 * @param {import('socket.io').Socket} socket 
 */
const registerRoomSocket = (io, socket) => {
  // socket.user is guaranteed by JWT middleware on connection

  // 1. Join Room
  socket.on('room:join', async ({ roomCode, passcode }) => {
    try {
      if (!roomCode || typeof roomCode !== 'string') {
        return socket.emit('room:error', {
          code: 'INVALID_ROOM_CODE',
          message: 'Please provide a valid room code'
        });
      }

      const code = roomCode.trim().toUpperCase();
      const room = await Room.findOne({ roomCode: code }).select('+passcode');

      if (!room) {
        return socket.emit('room:error', {
          code: 'ROOM_NOT_FOUND',
          message: `Auction room '${code}' not found`
        });
      }

      // Passcode check for private rooms
      if (room.isPrivate && room.passcode) {
        if (!passcode || passcode.trim() !== room.passcode) {
          return socket.emit('room:error', {
            code: 'INVALID_PASSCODE',
            message: 'Incorrect room passcode'
          });
        }
      }

      // Add to MongoDB participants if not already present
      const alreadyParticipant = room.participants.some((pId) => pId.equals(socket.user._id));
      if (!alreadyParticipant) {
        room.participants.push(socket.user._id);
        await room.save();
      }

      // Join socket channel & track joined room
      socket.join(code);
      if (!socket.data.joinedRooms) {
        socket.data.joinedRooms = new Set();
      }
      socket.data.joinedRooms.add(code);

      // Track presence
      const userIdStr = socket.user._id.toString();
      const { wasOnline } = addUserSocket(code, userIdStr, socket.id);

      // Fetch populated room
      const populated = await Room.findById(room._id)
        .populate('currentAuction.player')
        .populate('participants', 'name email favoriteTeam avatar');

      const onlineUsers = getOnlineUserIds(code);
      const sanitizedRoom = getSanitizedRoomState(populated, onlineUsers);

      // Emit room:joined to joining client
      socket.emit('room:joined', {
        room: sanitizedRoom,
        user: {
          _id: socket.user._id,
          name: socket.user.name,
          email: socket.user.email,
          favoriteTeam: socket.user.favoriteTeam
        }
      });

      // Broadcast participant joined to others in room if user just transitioned online
      if (!wasOnline) {
        socket.to(code).emit('room:participantJoined', {
          roomCode: code,
          participant: {
            _id: socket.user._id,
            name: socket.user.name,
            email: socket.user.email,
            avatar: socket.user.avatar,
            isOnline: true
          },
          participantCount: populated.participants.length
        });
      }

      // Keep all clients updated with current state
      io.to(code).emit('room:stateUpdated', { room: sanitizedRoom });
    } catch (err) {
      socket.emit('room:error', {
        code: 'JOIN_ERROR',
        message: err.message || 'Error joining room'
      });
    }
  });

  // 2. Leave Room
  socket.on('room:leave', async ({ roomCode }) => {
    try {
      if (!roomCode) return;
      const code = roomCode.trim().toUpperCase();

      socket.leave(code);
      if (socket.data.joinedRooms) {
        socket.data.joinedRooms.delete(code);
      }

      const userIdStr = socket.user._id.toString();
      const { isNowOffline } = removeUserSocket(code, userIdStr, socket.id);

      // Remove from room participants and release held franchises in MongoDB
      const room = await Room.findOne({ roomCode: code });
      if (room) {
        room.participants = room.participants.filter((pId) => !pId.equals(socket.user._id));
        room.franchises.forEach((f) => {
          if (f.claimedBy && f.claimedBy.equals(socket.user._id)) {
            f.claimedBy = null;
            f.claimedByName = '';
          }
        });
        await room.save();

        const populated = await Room.findById(room._id)
          .populate('currentAuction.player')
          .populate('participants', 'name email favoriteTeam avatar');

        const onlineUsers = getOnlineUserIds(code);
        const sanitizedRoom = getSanitizedRoomState(populated, onlineUsers);

        socket.emit('room:left', {
          roomCode: code,
          user: { _id: socket.user._id, name: socket.user.name }
        });

        io.to(code).emit('room:participantLeft', {
          roomCode: code,
          participant: { _id: socket.user._id, name: socket.user.name },
          participantCount: populated.participants.length,
          isOffline: isNowOffline
        });

        io.to(code).emit('room:stateUpdated', { room: sanitizedRoom });
      }
    } catch (err) {
      socket.emit('room:error', {
        code: 'LEAVE_ERROR',
        message: err.message || 'Error leaving room'
      });
    }
  });

  // 3. Get Room State
  socket.on('room:getState', async ({ roomCode }) => {
    try {
      if (!roomCode) {
        return socket.emit('room:error', {
          code: 'INVALID_ROOM_CODE',
          message: 'Please provide a valid room code'
        });
      }

      const code = roomCode.trim().toUpperCase();
      const room = await Room.findOne({ roomCode: code })
        .populate('currentAuction.player')
        .populate('participants', 'name email favoriteTeam avatar');

      if (!room) {
        return socket.emit('room:error', {
          code: 'ROOM_NOT_FOUND',
          message: `Auction room '${code}' not found`
        });
      }

      const onlineUsers = getOnlineUserIds(code);
      const sanitizedRoom = getSanitizedRoomState(room, onlineUsers);

      socket.emit('room:stateUpdated', { room: sanitizedRoom });
    } catch (err) {
      socket.emit('room:error', {
        code: 'GET_STATE_ERROR',
        message: err.message || 'Error getting room state'
      });
    }
  });

  // 4. Claim Franchise
  socket.on('room:claimFranchise', async ({ roomCode, franchiseCode }) => {
    try {
      if (!roomCode || !franchiseCode) {
        return socket.emit('room:error', {
          code: 'MISSING_PARAMS',
          message: 'Room code and franchise code are required'
        });
      }

      const code = roomCode.trim().toUpperCase();
      const fCode = franchiseCode.trim().toUpperCase();

      const room = await Room.findOne({ roomCode: code });
      if (!room) {
        return socket.emit('room:error', {
          code: 'ROOM_NOT_FOUND',
          message: `Auction room '${code}' not found`
        });
      }

      // Verify room membership for private rooms
      const isParticipant = (room.participants || []).some((p) => p.equals(socket.user._id));
      if (room.isPrivate && !isParticipant) {
        return socket.emit('room:error', {
          code: 'PRIVATE_ROOM_NOT_JOINED',
          message: 'You must join this private room with the correct passcode before claiming a franchise'
        });
      }

      // Check if user already holds another franchise unless allowed
      if (!room.settings.allowMultipleFranchisesPerUser) {
        const alreadyClaimedSlot = room.franchises.find(
          (f) => f.claimedBy && f.claimedBy.equals(socket.user._id)
        );
        if (alreadyClaimedSlot) {
          return socket.emit('room:error', {
            code: 'ALREADY_CLAIMED_OTHER',
            message: `You already hold ${alreadyClaimedSlot.name} (${alreadyClaimedSlot.code}) in this room. Release it first.`
          });
        }
      }

      // Target slot check
      const targetSlot = room.franchises.find((f) => f.code.toUpperCase() === fCode);
      if (!targetSlot) {
        return socket.emit('room:error', {
          code: 'FRANCHISE_NOT_FOUND',
          message: `Franchise '${fCode}' not found in this room`
        });
      }

      if (targetSlot.claimedBy) {
        return socket.emit('room:error', {
          code: 'SLOT_OCCUPIED',
          message: `${targetSlot.name} (${targetSlot.code}) is already claimed by ${targetSlot.claimedByName}`
        });
      }

      // Concurrency-safe atomic claim via $elemMatch
      const updatedRoom = await Room.findOneAndUpdate(
        {
          roomCode: code,
          franchises: {
            $elemMatch: {
              code: fCode,
              claimedBy: null
            }
          }
        },
        {
          $set: {
            'franchises.$.claimedBy': socket.user._id,
            'franchises.$.claimedByName': socket.user.name
          },
          $addToSet: {
            participants: socket.user._id
          }
        },
        { new: true }
      ).populate('participants', 'name email favoriteTeam avatar');

      if (!updatedRoom) {
        return socket.emit('room:error', {
          code: 'RACE_CONDITION_CLAIM',
          message: `Franchise '${fCode}' was claimed by another participant just now`
        });
      }

      const onlineUsers = getOnlineUserIds(code);
      const sanitizedRoom = getSanitizedRoomState(updatedRoom, onlineUsers);

      io.to(code).emit('room:franchiseClaimed', {
        roomCode: code,
        franchiseCode: fCode,
        claimedBy: socket.user._id,
        claimedByName: socket.user.name,
        franchises: updatedRoom.franchises
      });

      io.to(code).emit('room:stateUpdated', { room: sanitizedRoom });
    } catch (err) {
      socket.emit('room:error', {
        code: 'CLAIM_ERROR',
        message: err.message || 'Error claiming franchise'
      });
    }
  });

  // 5. Release Franchise
  socket.on('room:releaseFranchise', async ({ roomCode, franchiseCode }) => {
    try {
      if (!roomCode || !franchiseCode) {
        return socket.emit('room:error', {
          code: 'MISSING_PARAMS',
          message: 'Room code and franchise code are required'
        });
      }

      const code = roomCode.trim().toUpperCase();
      const fCode = franchiseCode.trim().toUpperCase();

      const room = await Room.findOne({ roomCode: code });
      if (!room) {
        return socket.emit('room:error', {
          code: 'ROOM_NOT_FOUND',
          message: `Auction room '${code}' not found`
        });
      }

      // Verify room membership for private rooms
      const isParticipant = (room.participants || []).some((p) => p.equals(socket.user._id));
      if (room.isPrivate && !isParticipant) {
        return socket.emit('room:error', {
          code: 'PRIVATE_ROOM_NOT_JOINED',
          message: 'You must join this private room with the correct passcode before claiming a franchise'
        });
      }

      const isHost = room.host.equals(socket.user._id);
      const slot = room.franchises.find((f) => f.code.toUpperCase() === fCode);

      if (!slot || !slot.claimedBy) {
        return socket.emit('room:error', {
          code: 'SLOT_NOT_CLAIMED',
          message: `Franchise '${fCode}' is not currently claimed`
        });
      }

      const isOwner = slot.claimedBy.equals(socket.user._id);
      if (!isHost && !isOwner) {
        return socket.emit('room:error', {
          code: 'UNAUTHORIZED_RELEASE',
          message: `Unauthorized: Only the room host or the manager of ${slot.name} can release this franchise`
        });
      }

      slot.claimedBy = null;
      slot.claimedByName = '';
      await room.save();

      const populated = await Room.findById(room._id)
        .populate('currentAuction.player')
        .populate('participants', 'name email favoriteTeam avatar');

      const onlineUsers = getOnlineUserIds(code);
      const sanitizedRoom = getSanitizedRoomState(populated, onlineUsers);

      io.to(code).emit('room:franchiseReleased', {
        roomCode: code,
        franchiseCode: fCode,
        franchises: room.franchises
      });

      io.to(code).emit('room:stateUpdated', { room: sanitizedRoom });
    } catch (err) {
      socket.emit('room:error', {
        code: 'RELEASE_ERROR',
        message: err.message || 'Error releasing franchise'
      });
    }
  });

  // 6. Socket Disconnect Handler (Presence Management)
  socket.on('disconnect', (reason) => {
    try {
      if (!socket.data.joinedRooms) return;
      const userIdStr = socket.user._id.toString();

      for (const code of socket.data.joinedRooms) {
        const { isNowOffline } = removeUserSocket(code, userIdStr, socket.id);

        if (isNowOffline) {
          // User has no active sockets remaining in this room
          io.to(code).emit('room:participantLeft', {
            roomCode: code,
            participant: {
              _id: socket.user._id,
              name: socket.user.name
            },
            isOffline: true
          });
        }
      }
    } catch (err) {
      console.error('Error in socket disconnect handler:', err.message);
    }
  });
};

module.exports = {
  registerRoomSocket,
  getOnlineUserIds,
  isUserOnlineInRoom,
  roomPresence
};