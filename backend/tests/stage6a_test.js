const path = require('path');
const dns = require('dns');

// Configure Google DNS for MongoDB SRV resolution before connecting
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_PORT = 5055;
process.env.PORT = String(TEST_PORT);
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/ipl_auction_arena';

const http = require('http');
const mongoose = require('mongoose');
const ioClient = require('socket.io-client');
const { app, server, startServer } = require('../server');
const User = require('../models/User');
const Room = require('../models/Room');
const generateToken = require('../utils/generateToken');
const { roomPresence } = require('../socket/roomSocket');
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test users
let userHost, userPlayer1, userPlayer2;
let tokenHost, tokenPlayer1, tokenPlayer2;

let clientHost = null;
let clientPlayer1 = null;
let clientPlayer2 = null;

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

const assertTest = (index, name, condition, details = '') => {
  if (condition) {
    results.passed++;
    results.tests.push({ index, name, status: 'PASSED', details });
    console.log(`✅ [TEST ${index}] ${name} - PASSED`);
  } else {
    results.failed++;
    results.tests.push({ index, name, status: 'FAILED', details });
    console.error(`❌ [TEST ${index}] ${name} - FAILED: ${details}`);
  }
};

// Helper for HTTP requests
const request = (method, urlPath, token = null, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const postData = body ? JSON.stringify(body) : '';

    const headers = {
      'Content-Type': 'application/json',
      'Connection': 'close'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (body) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch (e) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runStage6aTests() {
  console.log(`\n======================================================`);
  console.log(`🏏 IPL AUCTION ARENA - STAGE 6A AUTOMATED TEST SUITE`);
  console.log(`======================================================\n`);

  try {
    // 1. Connect server on TEST_PORT
    await startServer();
    console.log(`🚀 Test server listening on ${BASE_URL}\n`);

    // 2. Prepare test users in DB
    const usersData = [
      { name: 'Host Manager', email: 'stage6a_host@arena.com', password: 'Password123!', favoriteTeam: 'CSK' },
      { name: 'Player One', email: 'stage6a_player1@arena.com', password: 'Password123!', favoriteTeam: 'MI' },
      { name: 'Player Two', email: 'stage6a_player2@arena.com', password: 'Password123!', favoriteTeam: 'RCB' }
    ];

    await User.deleteMany({ email: { $in: usersData.map((u) => u.email) } });
    userHost = await User.create(usersData[0]);
    userPlayer1 = await User.create(usersData[1]);
    userPlayer2 = await User.create(usersData[2]);

    tokenHost = generateToken(userHost._id);
    tokenPlayer1 = generateToken(userPlayer1._id);
    tokenPlayer2 = generateToken(userPlayer2._id);

    // Clean up any test rooms
    await Room.deleteMany({ roomName: { $regex: /Stage6A/i } });

    // ---------------------------------------------------------
    // TEST 1: Valid JWT connection
    // ---------------------------------------------------------
    let test1Passed = false;
    let test1Details = '';
    try {
      clientHost = ioClient(BASE_URL, {
        auth: { token: tokenHost },
        transports: ['websocket'],
        reconnection: false
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timed out')), 5000);
        clientHost.on('connect', () => {
          clientHost.emit('client:ping', { test: true });
        });
        clientHost.on('server:pong', (data) => {
          clearTimeout(timeout);
          if (data && data.status === 'online' && data.userId === userHost._id.toString()) {
            test1Passed = true;
            test1Details = `Connected socket ${clientHost.id} for user ${userHost.name}`;
          }
          resolve();
        });
        clientHost.on('connect_error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    } catch (e) {
      test1Details = e.message;
    }
    assertTest(1, 'Valid JWT connection', test1Passed, test1Details);

    // ---------------------------------------------------------
    // TEST 2: Invalid JWT rejection
    // ---------------------------------------------------------
    let test2Passed = false;
    let test2Details = '';
    try {
      const clientBad = ioClient(BASE_URL, {
        auth: { token: 'invalid_malformed_token_123' },
        transports: ['websocket'],
        reconnection: false
      });

      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          clientBad.disconnect();
          resolve();
        }, 3000);

        clientBad.on('connect', () => {
          clearTimeout(timeout);
          test2Details = 'Socket connected unexpectedly with invalid token';
          clientBad.disconnect();
          resolve();
        });

        clientBad.on('connect_error', (err) => {
          clearTimeout(timeout);
          if (err.message && err.message.includes('Authentication failed')) {
            test2Passed = true;
            test2Details = `Rejected with: ${err.message}`;
          } else {
            test2Details = `Rejected with unexpected error: ${err.message}`;
          }
          clientBad.disconnect();
          resolve();
        });
      });
    } catch (e) {
      test2Details = e.message;
    }
    assertTest(2, 'Invalid JWT rejection', test2Passed, test2Details);

    // ---------------------------------------------------------
    // TEST 3: Public room creation
    // ---------------------------------------------------------
    const resCreatePublic = await request('POST', '/api/rooms', tokenHost, {
      roomName: 'Stage6A Public Arena',
      isPrivate: false,
      settings: {
        timerSeconds: 10,
        bidExtensionSeconds: 5,
        auctionMode: 'standard',
        startingPurseCr: 120.0
      }
    });

    const publicRoom = resCreatePublic.body?.data;
    const test3Passed =
      resCreatePublic.status === 201 &&
      publicRoom &&
      publicRoom.roomCode &&
      publicRoom.isPrivate === false &&
      publicRoom.settings?.timerSeconds === 10 &&
      publicRoom.settings?.bidExtensionSeconds === 5 &&
      publicRoom.franchises?.length === 10 &&
      publicRoom.passcode === undefined;

    assertTest(
      3,
      'Public room creation',
      test3Passed,
      `Code: ${publicRoom?.roomCode}, Franchises: ${publicRoom?.franchises?.length}`
    );

    const publicCode = publicRoom.roomCode;

    // ---------------------------------------------------------
    // TEST 4: Private room creation
    // ---------------------------------------------------------
    const resCreatePrivate = await request('POST', '/api/rooms', tokenHost, {
      roomName: 'Stage6A Private Arena',
      isPrivate: true,
      passcode: 'SecretArena123',
      settings: {
        timerSeconds: 15,
        bidExtensionSeconds: 5
      }
    });

    const privateRoom = resCreatePrivate.body?.data;
    const test4Passed =
      resCreatePrivate.status === 201 &&
      privateRoom &&
      privateRoom.roomCode &&
      privateRoom.isPrivate === true &&
      privateRoom.passcode === undefined; // Crucial: passcode must not be exposed

    assertTest(
      4,
      'Private room creation',
      test4Passed,
      `Code: ${privateRoom?.roomCode}, isPrivate: ${privateRoom?.isPrivate}, passcodeHidden: ${privateRoom?.passcode === undefined}`
    );

    const privateCode = privateRoom.roomCode;

    // ---------------------------------------------------------
    // TEST 5: Correct private room passcode
    // ---------------------------------------------------------
    const resJoinCorrect = await request('POST', `/api/rooms/${privateCode}/join`, tokenPlayer1, {
      passcode: 'SecretArena123'
    });

    const test5Passed =
      resJoinCorrect.status === 200 &&
      resJoinCorrect.body?.success === true &&
      resJoinCorrect.body?.data?.participants?.some((p) => p._id.toString() === userPlayer1._id.toString());

    assertTest(5, 'Correct private room passcode', test5Passed, `Status: ${resJoinCorrect.status}`);

    // ---------------------------------------------------------
    // TEST 6: Incorrect private room passcode
    // ---------------------------------------------------------
    const resJoinIncorrect = await request('POST', `/api/rooms/${privateCode}/join`, tokenPlayer2, {
      passcode: 'WrongPasswordXYZ'
    });

    const test6Passed = resJoinIncorrect.status === 403 && resJoinIncorrect.body?.success === false;

    assertTest(
      6,
      'Incorrect private room passcode',
      test6Passed,
      `Status: ${resJoinIncorrect.status}, message: ${resJoinIncorrect.body?.message}`
    );

    // ---------------------------------------------------------
    // Connect clientPlayer1 and clientPlayer2 for Socket.IO tests
    // ---------------------------------------------------------
    clientPlayer1 = ioClient(BASE_URL, {
      auth: { token: tokenPlayer1 },
      transports: ['websocket'],
      reconnection: false
    });
    clientPlayer2 = ioClient(BASE_URL, {
      auth: { token: tokenPlayer2 },
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise((resolve) => clientPlayer1.on('connect', resolve)),
      new Promise((resolve) => clientPlayer2.on('connect', resolve))
    ]);

    // ---------------------------------------------------------
    // TEST 7: Two users joining the same room
    // ---------------------------------------------------------
    let hostJoinedState = null;
    let player1JoinedState = null;
    let participantJoinedNotified = false;

    clientHost.on('room:joined', (payload) => {
      hostJoinedState = payload;
    });
    clientHost.on('room:participantJoined', (payload) => {
      if (payload.participant?._id === userPlayer1._id.toString()) {
        participantJoinedNotified = true;
      }
    });

    clientPlayer1.on('room:joined', (payload) => {
      player1JoinedState = payload;
    });

    // Host joins public room
    clientHost.emit('room:join', { roomCode: publicCode });
    await sleep(300);

    // Player 1 joins public room
    clientPlayer1.emit('room:join', { roomCode: publicCode });
    await sleep(400);

    const test7Passed =
      hostJoinedState !== null &&
      player1JoinedState !== null &&
      participantJoinedNotified === true &&
      player1JoinedState.room?.roomCode === publicCode;

    assertTest(
      7,
      'Two users joining the same room',
      test7Passed,
      `Host joined: ${!!hostJoinedState}, Player 1 joined: ${!!player1JoinedState}, Broadcast received: ${participantJoinedNotified}`
    );

    // ---------------------------------------------------------
    // TEST 8: Duplicate join prevention
    // ---------------------------------------------------------
    // Player 1 sends another join via REST and Socket
    const resDuplicateJoin = await request('POST', `/api/rooms/${publicCode}/join`, tokenPlayer1);
    const roomInDb = await Room.findOne({ roomCode: publicCode });
    const userOccurrences = roomInDb.participants.filter((p) => p.equals(userPlayer1._id)).length;

    const test8Passed = resDuplicateJoin.status === 200 && userOccurrences === 1;

    assertTest(
      8,
      'Duplicate join prevention',
      test8Passed,
      `Occurrences of user in participants array: ${userOccurrences}`
    );

    // ---------------------------------------------------------
    // TEST 9: Simultaneous franchise claim attempts
    // ---------------------------------------------------------
    // Player 2 joins public room first
    clientPlayer2.emit('room:join', { roomCode: publicCode });
    await sleep(300);

    let claimResultP1 = null;
    let claimResultP2 = null;
    let claimErrorP1 = null;
    let claimErrorP2 = null;

    clientPlayer1.once('room:franchiseClaimed', (data) => {
      if (data.franchiseCode === 'CSK') claimResultP1 = data;
    });
    clientPlayer1.once('room:error', (err) => {
      claimErrorP1 = err;
    });

    clientPlayer2.once('room:franchiseClaimed', (data) => {
      if (data.franchiseCode === 'CSK') claimResultP2 = data;
    });
    clientPlayer2.once('room:error', (err) => {
      claimErrorP2 = err;
    });

    // Emit simultaneous claims for CSK from both sockets
    clientPlayer1.emit('room:claimFranchise', { roomCode: publicCode, franchiseCode: 'CSK' });
    clientPlayer2.emit('room:claimFranchise', { roomCode: publicCode, franchiseCode: 'CSK' });

    await sleep(600);

    const roomAfterClaim = await Room.findOne({ roomCode: publicCode });
    const cskSlot = roomAfterClaim.franchises.find((f) => f.code === 'CSK');

    const oneGotError = (claimErrorP1 !== null && claimErrorP2 === null) || (claimErrorP1 === null && claimErrorP2 !== null);
    const cskClaimed = cskSlot && cskSlot.claimedBy !== null;

    const test9Passed = oneGotError && cskClaimed;

    assertTest(
      9,
      'Simultaneous franchise claim attempts',
      test9Passed,
      `CSK Owner: ${cskSlot?.claimedByName}, One Error: ${oneGotError}, Succeeded: 1`
    );

    // ---------------------------------------------------------
    // TEST 10: Host-only room settings enforcement
    // ---------------------------------------------------------
    // Non-host (Player 1) tries to update room settings
    const resNonHostSettings = await request('PUT', `/api/rooms/${publicCode}/settings`, tokenPlayer1, {
      settings: {
        timerSeconds: 30
      }
    });

    const test10Passed = resNonHostSettings.status === 403;

    assertTest(
      10,
      'Host-only room settings enforcement',
      test10Passed,
      `Status: ${resNonHostSettings.status}, message: ${resNonHostSettings.body?.message}`
    );

    // ---------------------------------------------------------
    // TEST 11: Host-only auction configuration enforcement
    // ---------------------------------------------------------
    // Host updates settings with valid configuration
    const resHostSettings = await request('PUT', `/api/rooms/${publicCode}/settings`, tokenHost, {
      settings: {
        timerSeconds: 20,
        bidExtensionSeconds: 10,
        auctionMode: 'fast',
        startingPurseCr: 100.0,
        minSquadSize: 15,
        maxSquadSize: 22,
        maxOverseas: 7
      }
    });

    // Attempt invalid timerSeconds
    const resInvalidTimer = await request('PUT', `/api/rooms/${publicCode}/settings`, tokenHost, {
      settings: {
        timerSeconds: 99 // Not in allowed enum
      }
    });

    const test11Passed =
      resHostSettings.status === 200 &&
      resHostSettings.body?.data?.settings?.timerSeconds === 20 &&
      resHostSettings.body?.data?.settings?.bidExtensionSeconds === 10 &&
      resHostSettings.body?.data?.settings?.auctionMode === 'fast' &&
      resInvalidTimer.status === 400;

    assertTest(
      11,
      'Host-only auction configuration enforcement',
      test11Passed,
      `Valid config status: ${resHostSettings.status}, Invalid timer rejected with status: ${resInvalidTimer.status}`
    );

    // ---------------------------------------------------------
    // TEST 12: Participant disconnection and reconnection
    // ---------------------------------------------------------
    // Identify which player owns CSK
    const cskOwnerToken = cskSlot.claimedBy.equals(userPlayer1._id) ? tokenPlayer1 : tokenPlayer2;
    const cskOwnerUser = cskSlot.claimedBy.equals(userPlayer1._id) ? userPlayer1 : userPlayer2;
    const cskOwnerClient = cskSlot.claimedBy.equals(userPlayer1._id) ? clientPlayer1 : clientPlayer2;

    let disconnectNotified = false;
    let reconnectNotified = false;

    clientHost.on('room:participantLeft', (payload) => {
      if (payload.participant?._id === cskOwnerUser._id.toString() && payload.isOffline) {
        disconnectNotified = true;
      }
    });

    clientHost.on('room:participantJoined', (payload) => {
      if (payload.participant?._id === cskOwnerUser._id.toString() && payload.participant?.isOnline) {
        reconnectNotified = true;
      }
    });

    // Disconnect the CSK owner socket
    cskOwnerClient.disconnect();
    await sleep(500);

    // Verify DB still holds CSK franchise claim
    const roomDuringDisconnect = await Room.findOne({ roomCode: publicCode });
    const cskDuringDisconnect = roomDuringDisconnect.franchises.find((f) => f.code === 'CSK');
    const claimPreserved = cskDuringDisconnect.claimedBy !== null && cskDuringDisconnect.claimedBy.equals(cskOwnerUser._id);

    // Reconnect the socket
    const reconnectedClient = ioClient(BASE_URL, {
      auth: { token: cskOwnerToken },
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise((resolve) => reconnectedClient.on('connect', resolve));
    reconnectedClient.emit('room:join', { roomCode: publicCode });
    await sleep(500);

    const test12Passed = disconnectNotified && claimPreserved && reconnectNotified;

    assertTest(
      12,
      'Participant disconnection and reconnection',
      test12Passed,
      `Disconnect notified: ${disconnectNotified}, Claim preserved in DB: ${claimPreserved}, Reconnect notified: ${reconnectNotified}`
    );

    // ---------------------------------------------------------
    // TEST 13: Multiple connections from the same user
    // ---------------------------------------------------------
    // Disconnect any earlier sockets for userPlayer2 so they start cleanly with 0 sockets
    if (clientPlayer2) {
      clientPlayer2.disconnect();
    }
    if (reconnectedClient) {
      reconnectedClient.disconnect();
    }
    await sleep(300);

    // Connect tab A and tab B for Player 2
    let tabA_offlineNotified = false;
    let tabB_offlineNotified = false;

    const tabA = ioClient(BASE_URL, {
      auth: { token: tokenPlayer2 },
      transports: ['websocket'],
      reconnection: false
    });
    const tabB = ioClient(BASE_URL, {
      auth: { token: tokenPlayer2 },
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise((resolve) => tabA.on('connect', resolve)),
      new Promise((resolve) => tabB.on('connect', resolve))
    ]);

    tabA.emit('room:join', { roomCode: publicCode });
    tabB.emit('room:join', { roomCode: publicCode });
    await sleep(400);

    let tabDisconnectCount = 0;
    const multiTabListener = (payload) => {
      if (payload.participant?._id === userPlayer2._id.toString() && payload.isOffline) {
        tabDisconnectCount++;
      }
    };
    clientHost.on('room:participantLeft', multiTabListener);

    // Disconnect Tab A: userPlayer2 still has Tab B active!
    tabA.disconnect();
    await sleep(400);

    const offlineAfterFirstTab = tabDisconnectCount > 0; // Should be FALSE

    // Disconnect Tab B: now userPlayer2 has 0 active tabs!
    tabB.disconnect();
    await sleep(400);

    const offlineAfterSecondTab = tabDisconnectCount === 1; // Should be TRUE

    clientHost.off('room:participantLeft', multiTabListener);

    const test13Passed = !offlineAfterFirstTab && offlineAfterSecondTab;

    assertTest(
      13,
      'Multiple connections from the same user',
      test13Passed,
      `Tab A closed (offline: ${offlineAfterFirstTab}), Tab B closed (offline: ${offlineAfterSecondTab})`
    );

    // ---------------------------------------------------------
    // TEST 14: Room state synchronization
    // ---------------------------------------------------------
    let syncedRoomState = null;
    clientHost.once('room:stateUpdated', (data) => {
      syncedRoomState = data.room;
    });

    clientHost.emit('room:getState', { roomCode: publicCode });
    await sleep(400);

    const test14Passed =
      syncedRoomState !== null &&
      syncedRoomState.roomCode === publicCode &&
      Array.isArray(syncedRoomState.franchises) &&
      Array.isArray(syncedRoomState.participants) &&
      syncedRoomState.settings?.timerSeconds !== undefined;

    assertTest(
      14,
      'Room state synchronization',
      test14Passed,
      `Synced code: ${syncedRoomState?.roomCode}, queue count: ${syncedRoomState?.auctionQueueCount}`
    );

    // ---------------------------------------------------------
    // TEST 15: Unauthorized franchise release rejection
    // ---------------------------------------------------------
    // Determine who owns CSK and select the non-owner to attempt unauthorized release
    const currentCskRoom = await Room.findOne({ roomCode: publicCode });
    const currentCskSlot = currentCskRoom.franchises.find((f) => f.code === 'CSK');
    const isOwnerP1 = currentCskSlot.claimedBy.equals(userPlayer1._id);
    const unauthorizedToken = isOwnerP1 ? tokenPlayer2 : tokenPlayer1;

    const resUnauthorizedRelease = await request('POST', `/api/rooms/${publicCode}/release`, unauthorizedToken, {
      franchiseCode: 'CSK'
    });

    // Check DB: CSK should still be claimed
    const roomAfterUnauthRelease = await Room.findOne({ roomCode: publicCode });
    const cskStillHeld = roomAfterUnauthRelease.franchises.find((f) => f.code === 'CSK').claimedBy !== null;

    // Now Host releases CSK
    const resHostRelease = await request('POST', `/api/rooms/${publicCode}/release`, tokenHost, {
      franchiseCode: 'CSK'
    });

    const roomAfterHostRelease = await Room.findOne({ roomCode: publicCode });
    const cskNowReleased = roomAfterHostRelease.franchises.find((f) => f.code === 'CSK').claimedBy === null;

    const test15Passed = resUnauthorizedRelease.status === 403 && cskStillHeld && resHostRelease.status === 200 && cskNowReleased;

    assertTest(
      15,
      'Unauthorized franchise release rejection',
      test15Passed,
      `Unauthorized release status: ${resUnauthorizedRelease.status}, Host release status: ${resHostRelease.status}`
    );

    // ---------------------------------------------------------
    // TEST 16: Countdown configuration persistence
    // ---------------------------------------------------------
    await request('PUT', `/api/rooms/${publicCode}/settings`, tokenHost, {
      settings: { timerSeconds: 30 }
    });

    const dbRoomTimer = await Room.findOne({ roomCode: publicCode });
    const test16Passed = dbRoomTimer.settings.timerSeconds === 30;

    assertTest(16, 'Countdown configuration persistence', test16Passed, `Persisted timerSeconds: ${dbRoomTimer.settings.timerSeconds}`);

    // ---------------------------------------------------------
    // TEST 17: Bid extension configuration persistence
    // ---------------------------------------------------------
    await request('PUT', `/api/rooms/${publicCode}/settings`, tokenHost, {
      settings: { bidExtensionSeconds: 10 }
    });

    const dbRoomBidExt = await Room.findOne({ roomCode: publicCode });
    const test17Passed = dbRoomBidExt.settings.bidExtensionSeconds === 10;

    assertTest(
      17,
      'Bid extension configuration persistence',
      test17Passed,
      `Persisted bidExtensionSeconds: ${dbRoomBidExt.settings.bidExtensionSeconds}`
    );

    // ---------------------------------------------------------
    // TEST 18: Isolation of settings between two different rooms
    // ---------------------------------------------------------
    // Create Room B
    const resRoomB = await request('POST', '/api/rooms', tokenHost, {
      roomName: 'Stage6A Room B',
      settings: {
        timerSeconds: 10,
        startingPurseCr: 120.0
      }
    });
    const roomBCode = resRoomB.body?.data?.roomCode;

    // Modify Public Room (Room A)
    await request('PUT', `/api/rooms/${publicCode}/settings`, tokenHost, {
      settings: {
        timerSeconds: 45,
        startingPurseCr: 200.0
      }
    });

    // Check Room B settings in DB
    const dbRoomB = await Room.findOne({ roomCode: roomBCode });
    const dbRoomA = await Room.findOne({ roomCode: publicCode });

    const test18Passed =
      dbRoomA.settings.timerSeconds === 45 &&
      dbRoomA.settings.startingPurseCr === 200.0 &&
      dbRoomB.settings.timerSeconds === 10 &&
      dbRoomB.settings.startingPurseCr === 120.0;

    assertTest(
      18,
      'Isolation of settings between two different rooms',
      test18Passed,
      `Room A timer: ${dbRoomA.settings.timerSeconds}s / ₹${dbRoomA.settings.startingPurseCr}Cr, Room B timer: ${dbRoomB.settings.timerSeconds}s / ₹${dbRoomB.settings.startingPurseCr}Cr`
    );

    // Clean up Room B
    await Room.deleteOne({ roomCode: roomBCode });

    // ---------------------------------------------------------
    // TEST 19: Existing REST API compatibility
    // ---------------------------------------------------------
    const resList = await request('GET', '/api/rooms');
    const resDetail = await request('GET', `/api/rooms/${publicCode}`);
    const resLeave = await request('POST', `/api/rooms/${publicCode}/leave`, tokenPlayer1);

    const test19Passed =
      resList.status === 200 &&
      resDetail.status === 200 &&
      resDetail.body?.data?.passcode === undefined &&
      resLeave.status === 200 &&
      resLeave.body?.success === true;

    assertTest(
      19,
      'Existing REST API compatibility',
      test19Passed,
      `List: ${resList.status}, Detail: ${resDetail.status}, Leave: ${resLeave.status}`
    );

    // ---------------------------------------------------------
    // TEST 20: Existing health endpoint compatibility
    // ---------------------------------------------------------
    const resHealth = await request('GET', '/api/health');
    const test20Passed =
      resHealth.status === 200 &&
      resHealth.body?.services?.database?.status === 'connected' &&
      resHealth.body?.services?.database?.connected === true &&
      resHealth.body?.services?.websocket?.status === 'initialized';

    assertTest(
      20,
      'Existing health endpoint compatibility',
      test20Passed,
      `Status: ${resHealth.status}, Database: ${resHealth.body?.services?.database?.status}`
    );

    // Clean up test sockets and rooms
    if (clientHost) clientHost.disconnect();
    if (clientPlayer1) clientPlayer1.disconnect();
    if (clientPlayer2) clientPlayer2.disconnect();
    if (reconnectedClient) reconnectedClient.disconnect();

    await Room.deleteMany({ roomName: { $regex: /Stage6A/i } });
    await User.deleteMany({ email: { $in: usersData.map((u) => u.email) } });

    console.log(`\n======================================================`);
    console.log(`🎯 FINAL TEST RESULTS: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: 20)`);
    console.log(`======================================================\n`);

    server.close();
    await mongoose.connection.close();

    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error during Stage 6A test run:', err);
    if (server.listening) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

runStage6aTests();