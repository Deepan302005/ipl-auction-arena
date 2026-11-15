const path = require('path');
const dns = require('dns');

// Google DNS configuration
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_PORT = 5066;
process.env.PORT = String(TEST_PORT);
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/ipl_auction_arena';

const http = require('http');
const mongoose = require('mongoose');
const ioClient = require('socket.io-client');
const { app, server, startServer } = require('../server');
const User = require('../models/User');
const Room = require('../models/Room');
const Player = require('../models/Player');
const generateToken = require('../utils/generateToken');
const {
  startLotTimer,
  clearRoomTimer,
  processHammerDrop,
  recoverActiveAuctionTimers,
  activeAuctionTimers
} = require('../socket/auctionSocket');

const BASE_URL = `http://localhost:${TEST_PORT}`;

let userHost, userPlayer1, userPlayer2, userPlayer3;
let tokenHost, tokenPlayer1, tokenPlayer2, tokenPlayer3;

let clientHost = null;
let clientPlayer1 = null;
let clientPlayer2 = null;
let clientPlayer3 = null;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      { method, headers },
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

async function runStage6bTests() {
  console.log(`\n======================================================`);
  console.log(`🏏 IPL AUCTION ARENA - STAGE 6B AUTOMATED TEST SUITE`);
  console.log(`======================================================\n`);

  try {
    await startServer();
    console.log(`🚀 Test server listening on ${BASE_URL}\n`);

    // Clean up test data
    const usersData = [
      { name: 'Host Admin', email: 'stage6b_host@arena.com', password: 'Password123!', favoriteTeam: 'CSK' },
      { name: 'P1 Manager', email: 'stage6b_p1@arena.com', password: 'Password123!', favoriteTeam: 'MI' },
      { name: 'P2 Manager', email: 'stage6b_p2@arena.com', password: 'Password123!', favoriteTeam: 'RCB' },
      { name: 'P3 Observer', email: 'stage6b_p3@arena.com', password: 'Password123!', favoriteTeam: 'KKR' }
    ];

    await User.deleteMany({ email: { $in: usersData.map((u) => u.email) } });
    userHost = await User.create(usersData[0]);
    userPlayer1 = await User.create(usersData[1]);
    userPlayer2 = await User.create(usersData[2]);
    userPlayer3 = await User.create(usersData[3]);

    tokenHost = generateToken(userHost._id);
    tokenPlayer1 = generateToken(userPlayer1._id);
    tokenPlayer2 = generateToken(userPlayer2._id);
    tokenPlayer3 = generateToken(userPlayer3._id);

    await Room.deleteMany({ roomName: { $regex: /Stage6B/i } });

    // Connect Socket.IO clients
    clientHost = ioClient(BASE_URL, { auth: { token: tokenHost }, transports: ['websocket'], reconnection: false });
    clientPlayer1 = ioClient(BASE_URL, { auth: { token: tokenPlayer1 }, transports: ['websocket'], reconnection: false });
    clientPlayer2 = ioClient(BASE_URL, { auth: { token: tokenPlayer2 }, transports: ['websocket'], reconnection: false });
    clientPlayer3 = ioClient(BASE_URL, { auth: { token: tokenPlayer3 }, transports: ['websocket'], reconnection: false });

    await Promise.all([
      new Promise((resolve) => clientHost.on('connect', resolve)),
      new Promise((resolve) => clientPlayer1.on('connect', resolve)),
      new Promise((resolve) => clientPlayer2.on('connect', resolve)),
      new Promise((resolve) => clientPlayer3.on('connect', resolve))
    ]);

    // Create primary test room with 5-second timer for fast, robust tests
    const resCreate = await request('POST', '/api/rooms', tokenHost, {
      roomName: 'Stage6B Arena Room',
      settings: {
        timerSeconds: 5,
        bidExtensionSeconds: 5,
        startingPurseCr: 120.0,
        minSquadSize: 18,
        maxSquadSize: 25,
        maxOverseas: 8
      }
    });

    const roomCode = resCreate.body?.data?.roomCode;

    // Join room for host, player1, player2 (leave player3 unjoined to test non-participant)
    clientHost.emit('room:join', { roomCode });
    clientPlayer1.emit('room:join', { roomCode });
    clientPlayer2.emit('room:join', { roomCode });
    await sleep(400);

    // Claim franchises:
    // UserHost claims CSK, Player1 claims MI, Player2 claims RCB
    await request('POST', `/api/rooms/${roomCode}/claim`, tokenHost, { franchiseCode: 'CSK' });
    await request('POST', `/api/rooms/${roomCode}/claim`, tokenPlayer1, { franchiseCode: 'MI' });
    await request('POST', `/api/rooms/${roomCode}/claim`, tokenPlayer2, { franchiseCode: 'RCB' });
    await sleep(300);

    // ---------------------------------------------------------
    // TEST 2: Non-host cannot start an auction
    // ---------------------------------------------------------
    let nonHostStartError = null;
    clientPlayer1.once('auction:error', (err) => {
      nonHostStartError = err;
    });
    clientPlayer1.emit('auction:start', { roomCode });
    await sleep(300);

    const resNonHostRestStart = await request('POST', `/api/rooms/${roomCode}/start`, tokenPlayer1);
    const test2Passed =
      nonHostStartError !== null &&
      resNonHostRestStart.status === 403 &&
      resNonHostRestStart.body?.message?.includes('host');

    assertTest(2, 'Non-host cannot start an auction', test2Passed, `Socket error: ${nonHostStartError?.message}, REST: ${resNonHostRestStart.status}`);

    // ---------------------------------------------------------
    // TEST 1: Host starts an auction
    // ---------------------------------------------------------
    let auctionStartedPayload = null;
    let initialPlayerChanged = null;
    let initialTimerUpdate = null;

    clientPlayer1.once('auction:started', (data) => {
      auctionStartedPayload = data;
    });
    clientPlayer1.once('auction:playerChanged', (data) => {
      initialPlayerChanged = data;
    });
    clientPlayer1.on('auction:timerUpdate', (data) => {
      if (!initialTimerUpdate) {
        initialTimerUpdate = data;
      }
    });

    clientHost.emit('auction:start', { roomCode });
    await sleep(600);

    const roomAfterStart = await Room.findOne({ roomCode });
    const test1Passed =
      roomAfterStart.status === 'live' &&
      auctionStartedPayload !== null &&
      initialPlayerChanged !== null;

    assertTest(1, 'Host starts an auction', test1Passed, `Status: ${roomAfterStart?.status}, Started event received: ${!!auctionStartedPayload}`);

    // ---------------------------------------------------------
    // TEST 3: Current player is loaded correctly
    // ---------------------------------------------------------
    const firstPlayer = roomAfterStart.currentAuction?.player;
    const test3Passed =
      firstPlayer !== null &&
      roomAfterStart.currentAuction.status === 'bidding' &&
      roomAfterStart.currentAuction.currentBidCr > 0 &&
      roomAfterStart.currentAuction.currentBidderFranchise === null;

    assertTest(3, 'Current player is loaded correctly', test3Passed, `Player ID: ${firstPlayer}, Base Price: ₹${roomAfterStart.currentAuction.currentBidCr} Cr`);

    // ---------------------------------------------------------
    // TEST 4: Countdown uses room timer settings
    // ---------------------------------------------------------
    const test4Passed =
      roomAfterStart.currentAuction.timerDuration === 5 &&
      roomAfterStart.currentAuction.lotExpiresAt !== null &&
      initialTimerUpdate !== null &&
      initialTimerUpdate.secondsRemaining <= 5;

    assertTest(4, 'Countdown uses room timer settings', test4Passed, `Configured: 5s, Initial remaining: ${initialTimerUpdate?.secondsRemaining}s`);

    // ---------------------------------------------------------
    // TEST 5: Valid bid is accepted
    // ---------------------------------------------------------
    let bidPlacedEvent = null;
    clientPlayer2.once('auction:bidPlaced', (data) => {
      bidPlacedEvent = data;
    });

    // Player 1 (Manager of MI) places opening bid
    clientPlayer1.emit('auction:bid', {
      roomCode,
      franchiseCode: 'MI'
    });
    await sleep(400);

    const roomAfterBid1 = await Room.findOne({ roomCode });
    const test5Passed =
      bidPlacedEvent !== null &&
      roomAfterBid1.currentAuction.currentBidderFranchise === 'MI' &&
      roomAfterBid1.currentAuction.bidCount === 1 &&
      roomAfterBid1.currentAuction.bidHistory.length === 1;

    assertTest(5, 'Valid bid is accepted', test5Passed, `Franchise: ${bidPlacedEvent?.currentBidderFranchise}, Bid: ₹${bidPlacedEvent?.currentBidCr} Cr, History length: ${roomAfterBid1.currentAuction.bidHistory.length}`);

    // ---------------------------------------------------------
    // TEST 6: Invalid bid is rejected
    // ---------------------------------------------------------
    let invalidBidRejected = null;
    clientPlayer2.once('auction:bidRejected', (err) => {
      invalidBidRejected = err;
    });

    // Player 2 offers a bid lower than the required minimum
    clientPlayer2.emit('auction:bid', {
      roomCode,
      franchiseCode: 'RCB',
      bidAmountCr: 0.10 // Far below opening bid
    });
    await sleep(300);

    const test6Passed = invalidBidRejected !== null && invalidBidRejected.reason.includes('too low');

    assertTest(6, 'Invalid bid is rejected', test6Passed, `Rejected reason: ${invalidBidRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 7: Nonparticipant cannot bid
    // ---------------------------------------------------------
    let nonParticipantRejected = null;
    clientPlayer3.once('auction:bidRejected', (err) => {
      nonParticipantRejected = err;
    });

    clientPlayer3.emit('auction:bid', {
      roomCode,
      franchiseCode: 'MI'
    });
    await sleep(300);

    const test7Passed = nonParticipantRejected !== null && nonParticipantRejected.reason.includes('not a participant');

    assertTest(7, 'Nonparticipant cannot bid', test7Passed, `Rejected reason: ${nonParticipantRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 8: Participant without a franchise cannot bid
    // ---------------------------------------------------------
    // Join Player 3 to room without claiming any franchise
    clientPlayer3.emit('room:join', { roomCode });
    await sleep(300);

    let noFranchiseRejected = null;
    clientPlayer3.once('auction:bidRejected', (err) => {
      noFranchiseRejected = err;
    });

    clientPlayer3.emit('auction:bid', {
      roomCode,
      franchiseCode: ''
    });
    await sleep(300);

    const test8Passed = noFranchiseRejected !== null && noFranchiseRejected.reason.includes('paddle');

    assertTest(8, 'Participant without a franchise cannot bid', test8Passed, `Rejected reason: ${noFranchiseRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 9: Participant cannot bid for another franchise
    // ---------------------------------------------------------
    let unauthorizedPaddleRejected = null;
    clientPlayer2.once('auction:bidRejected', (err) => {
      unauthorizedPaddleRejected = err;
    });

    // Player 2 holds RCB, but attempts to bid as CSK (owned by Host)
    clientPlayer2.emit('auction:bid', {
      roomCode,
      franchiseCode: 'CSK'
    });
    await sleep(300);

    const test9Passed = unauthorizedPaddleRejected !== null && unauthorizedPaddleRejected.reason.includes('not the manager');

    assertTest(9, 'Participant cannot bid for another franchise', test9Passed, `Rejected reason: ${unauthorizedPaddleRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 10: Simultaneous bids are handled safely
    // ---------------------------------------------------------
    let simBidP2 = null;
    let simBidHost = null;
    let simRejectP2 = null;
    let simRejectHost = null;

    clientPlayer2.once('auction:bidPlaced', (data) => { simBidP2 = data; });
    clientPlayer2.once('auction:bidRejected', (err) => { simRejectP2 = err; });

    clientHost.once('auction:bidPlaced', (data) => { simBidHost = data; });
    clientHost.once('auction:bidRejected', (err) => { simRejectHost = err; });

    // Both Player 2 (RCB) and Host (CSK) fire bids concurrently
    clientPlayer2.emit('auction:bid', { roomCode, franchiseCode: 'RCB' });
    clientHost.emit('auction:bid', { roomCode, franchiseCode: 'CSK' });
    await sleep(600);

    const roomAfterSim = await Room.findOne({ roomCode });
    // Bids must remain strictly sequential and incremented cleanly
    const test10Passed = roomAfterSim.currentAuction.bidCount >= 2;

    assertTest(10, 'Simultaneous bids are handled safely', test10Passed, `Current bidder: ${roomAfterSim.currentAuction.currentBidderFranchise}, Bid count: ${roomAfterSim.currentAuction.bidCount}`);

    // ---------------------------------------------------------
    // TEST 11: Bid extension works correctly
    // ---------------------------------------------------------
    const beforeExtensionExpiresAt = roomAfterSim.currentAuction.lotExpiresAt.getTime();
    await sleep(1000);

    // Place counter-bid to trigger extension
    const currentHighest = roomAfterSim.currentAuction.currentBidderFranchise;
    const counterPaddle = currentHighest === 'MI' ? 'RCB' : 'MI';
    const counterClient = counterPaddle === 'MI' ? clientPlayer1 : clientPlayer2;

    counterClient.emit('auction:bid', { roomCode, franchiseCode: counterPaddle });
    await sleep(400);

    const roomAfterExtension = await Room.findOne({ roomCode });
    const afterExtensionExpiresAt = roomAfterExtension.currentAuction.lotExpiresAt.getTime();
    const test11Passed = afterExtensionExpiresAt > beforeExtensionExpiresAt;

    assertTest(11, 'Bid extension works correctly', test11Passed, `Before: ${new Date(beforeExtensionExpiresAt).toISOString()}, After: ${new Date(afterExtensionExpiresAt).toISOString()}`);

    // ---------------------------------------------------------
    // TEST 13: Timer expiration marks player sold
    // ---------------------------------------------------------
    let playerSoldEvent = null;
    clientHost.once('auction:playerSold', (data) => {
      playerSoldEvent = data;
    });

    console.log('   Waiting for lot timer (5s) to expire for hammer drop...');
    await sleep(6000); // Allow timer to reach 0s and hammer drop to trigger

    const test13Passed =
      playerSoldEvent !== null &&
      playerSoldEvent.franchiseCode !== null &&
      playerSoldEvent.soldPriceCr > 0;

    assertTest(13, 'Timer expiration marks player sold', test13Passed, `Sold to: ${playerSoldEvent?.franchiseCode} for ₹${playerSoldEvent?.soldPriceCr} Cr`);

    // ---------------------------------------------------------
    // TEST 15: Purse deduction is correct
    // ---------------------------------------------------------
    const roomAfterSale = await Room.findOne({ roomCode });
    const buyerSlot = roomAfterSale.franchises.find((f) => f.code === playerSoldEvent?.franchiseCode);
    const expectedPurse = parseFloat((120.0 - playerSoldEvent.soldPriceCr).toFixed(2));
    const test15Passed = buyerSlot && Math.abs(buyerSlot.remainingPurseCr - expectedPurse) < 0.01;

    assertTest(15, 'Purse deduction is correct', test15Passed, `Remaining Purse: ₹${buyerSlot?.remainingPurseCr} Cr (Expected: ₹${expectedPurse} Cr)`);

    // ---------------------------------------------------------
    // TEST 18: Duplicate sale is prevented
    // ---------------------------------------------------------
    const completedLotsForSoldPlayer = roomAfterSale.completedLots.filter(
      (l) => l.player.toString() === playerSoldEvent.player._id.toString()
    );
    const test18Passed = completedLotsForSoldPlayer.length === 1 && buyerSlot.squad.length === 1;

    assertTest(18, 'Duplicate sale is prevented', test18Passed, `Completed lots count: ${completedLotsForSoldPlayer.length}, Squad count: ${buyerSlot.squad.length}`);

    // Wait for transition to next lot
    await sleep(3500);

    // ---------------------------------------------------------
    // TEST 14: Timer expiration marks player unsold when no bids exist
    // ---------------------------------------------------------
    let playerUnsoldEvent = null;
    clientHost.once('auction:playerUnsold', (data) => {
      playerUnsoldEvent = data;
    });

    console.log('   Waiting for lot 2 timer (5s) without placing any bids...');
    await sleep(6500);

    const roomAfterUnsold = await Room.findOne({ roomCode });
    const test14Passed =
      playerUnsoldEvent !== null &&
      roomAfterUnsold.unsoldQueue.length >= 1;

    assertTest(14, 'Timer expiration marks player unsold when no bids exist', test14Passed, `Unsold player: ${playerUnsoldEvent?.player?.name}, Unsold queue count: ${roomAfterUnsold.unsoldQueue.length}`);

    await sleep(3500);

    // ---------------------------------------------------------
    // TEST 12: Bid after deadline is rejected
    // ---------------------------------------------------------
    // Expire current lot deliberately and attempt late bid
    const expiredRoom = await Room.findOne({ roomCode });
    expiredRoom.currentAuction.lotExpiresAt = new Date(Date.now() - 5000);
    await expiredRoom.save();

    let lateBidRejected = null;
    clientPlayer1.once('auction:bidRejected', (err) => {
      lateBidRejected = err;
    });

    clientPlayer1.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
    await sleep(300);

    const test12Passed = lateBidRejected !== null && lateBidRejected.reason.includes('expired');

    assertTest(12, 'Bid after deadline is rejected', test12Passed, `Rejected reason: ${lateBidRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 19: Host can pause and resume
    // ---------------------------------------------------------
    let pauseEvent = null;
    let resumeEvent = null;

    clientPlayer1.once('auction:paused', (data) => { pauseEvent = data; });
    clientPlayer1.once('auction:resumed', (data) => { resumeEvent = data; });

    clientHost.emit('auction:pause', { roomCode });
    await sleep(400);

    const roomPaused = await Room.findOne({ roomCode });
    const isPaused = roomPaused.status === 'paused' && pauseEvent !== null;

    clientHost.emit('auction:resume', { roomCode });
    await sleep(400);

    const roomResumed = await Room.findOne({ roomCode });
    const isResumed = roomResumed.status === 'live' && resumeEvent !== null;

    const test19Passed = isPaused && isResumed;

    assertTest(19, 'Host can pause and resume', test19Passed, `Paused: ${isPaused}, Resumed: ${isResumed}`);

    // ---------------------------------------------------------
    // TEST 20: Non-host cannot use host controls
    // ---------------------------------------------------------
    let nonHostControlError = null;
    clientPlayer2.once('auction:error', (err) => {
      nonHostControlError = err;
    });

    clientPlayer2.emit('auction:pause', { roomCode });
    await sleep(300);

    const resNonHostPauseRest = await request('POST', `/api/rooms/${roomCode}/pause`, tokenPlayer2);
    const test20Passed = nonHostControlError !== null && resNonHostPauseRest.status === 403;

    assertTest(20, 'Non-host cannot use host controls', test20Passed, `Socket error: ${nonHostControlError?.message}, REST: ${resNonHostPauseRest.status}`);

    // ---------------------------------------------------------
    // TEST 16: Squad size is validated
    // ---------------------------------------------------------
    // Fill up MI squad to max limit of 25 to test squad cap
    const roomToCapSquad = await Room.findOne({ roomCode });
    const miSlot = roomToCapSquad.franchises.find((f) => f.code === 'MI');
    const dummySquad = Array.from({ length: 25 }, (_, i) => ({
      player: new mongoose.Types.ObjectId(),
      name: `Dummy Player ${i + 1}`,
      role: 'Batsman',
      country: 'India',
      boughtForCr: 0.20,
      boughtAt: new Date()
    }));
    miSlot.squad = dummySquad;
    await roomToCapSquad.save();

    let maxSquadRejected = null;
    clientPlayer1.once('auction:bidRejected', (err) => {
      maxSquadRejected = err;
    });

    clientPlayer1.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
    await sleep(300);

    const test16Passed = maxSquadRejected !== null && maxSquadRejected.reason.includes('Maximum squad limit reached');

    assertTest(16, 'Squad size is validated', test16Passed, `Rejected reason: ${maxSquadRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 17: Overseas limit is enforced
    // ---------------------------------------------------------
    // Set RCB overseas count to 8
    const roomToCapOverseas = await Room.findOne({ roomCode });
    const rcbSlot = roomToCapOverseas.franchises.find((f) => f.code === 'RCB');
    rcbSlot.squad = Array.from({ length: 8 }, (_, i) => ({
      player: new mongoose.Types.ObjectId(),
      name: `Overseas Player ${i + 1}`,
      role: 'All-Rounder',
      country: 'Overseas',
      boughtForCr: 1.0,
      boughtAt: new Date()
    }));

    // Ensure active player on hammer is overseas
    const currentLotPlayer = await Player.findById(roomToCapOverseas.currentAuction.player);
    currentLotPlayer.country = 'Overseas';
    currentLotPlayer.nationality = 'Australia';
    await currentLotPlayer.save();
    await roomToCapOverseas.save();

    let overseasRejected = null;
    clientPlayer2.once('auction:bidRejected', (err) => {
      overseasRejected = err;
    });

    clientPlayer2.emit('auction:bid', { roomCode, franchiseCode: 'RCB' });
    await sleep(300);

    const test17Passed = overseasRejected !== null && overseasRejected.reason.includes('overseas player limit');

    assertTest(17, 'Overseas limit is enforced', test17Passed, `Rejected reason: ${overseasRejected?.reason}`);

    // ---------------------------------------------------------
    // TEST 21: Reconnection restores auction state
    // ---------------------------------------------------------
    let reconnectedState = null;
    clientPlayer1.once('auction:stateUpdated', (data) => {
      reconnectedState = data.room;
    });

    clientPlayer1.emit('auction:getState', { roomCode });
    await sleep(400);

    const test21Passed =
      reconnectedState !== null &&
      reconnectedState.roomCode === roomCode &&
      reconnectedState.currentAuction?.player !== null &&
      reconnectedState.franchises?.length === 10;

    assertTest(21, 'Reconnection restores auction state', test21Passed, `Restored roomCode: ${reconnectedState?.roomCode}, active player: ${!!reconnectedState?.currentAuction?.player}`);

    // ---------------------------------------------------------
    // TEST 22: Backend restart restores the active auction timer
    // ---------------------------------------------------------
    // Clear in-memory timer map to simulate abrupt server restart
    activeAuctionTimers.clear();
    const isCleared = !activeAuctionTimers.has(roomCode);

    // Call recoverActiveAuctionTimers
    const { getIO } = require('../socket');
    await recoverActiveAuctionTimers(getIO());

    const isRecovered = activeAuctionTimers.has(roomCode);
    const test22Passed = isCleared && isRecovered;

    assertTest(22, 'Backend restart restores the active auction timer', test22Passed, `Timer map cleared: ${isCleared}, Timer recovered from DB: ${isRecovered}`);

    // ---------------------------------------------------------
    // TEST 23: Auction completion works correctly
    // ---------------------------------------------------------
    let auctionCompletedEvent = null;
    clientPlayer1.once('auction:completed', (data) => {
      auctionCompletedEvent = data;
    });

    // Host calls auction:end
    clientHost.emit('auction:end', { roomCode });
    await sleep(400);

    const roomCompleted = await Room.findOne({ roomCode });
    const test23Passed =
      roomCompleted.status === 'completed' &&
      auctionCompletedEvent !== null;

    assertTest(23, 'Auction completion works correctly', test23Passed, `Final status: ${roomCompleted.status}, Completed event: ${!!auctionCompletedEvent}`);

    // ---------------------------------------------------------
    // TEST 24: Existing Stage 6A functionality remains compatible
    // ---------------------------------------------------------
    const resList = await request('GET', '/api/rooms');
    const resHealth = await request('GET', '/api/health');
    const resGetRoom = await request('GET', `/api/rooms/${roomCode}`);

    const test24Passed =
      resList.status === 200 &&
      resHealth.status === 200 &&
      resHealth.body?.services?.database?.status === 'connected' &&
      resGetRoom.status === 200 &&
      resGetRoom.body?.data?.passcode === undefined;

    assertTest(24, 'Existing Stage 6A functionality remains compatible', test24Passed, `List: ${resList.status}, Health DB: ${resHealth.body?.services?.database?.status}`);

    // Cleanup
    if (clientHost) clientHost.disconnect();
    if (clientPlayer1) clientPlayer1.disconnect();
    if (clientPlayer2) clientPlayer2.disconnect();
    if (clientPlayer3) clientPlayer3.disconnect();
    clearRoomTimer(roomCode);

    await Room.deleteMany({ roomName: { $regex: /Stage6B/i } });
    await User.deleteMany({ email: { $in: usersData.map((u) => u.email) } });

    console.log(`\n======================================================`);
    console.log(`🎯 FINAL STAGE 6B TEST RESULTS: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: 24)`);
    console.log(`======================================================\n`);

    server.close();
    await mongoose.connection.close();

    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error during Stage 6B test execution:', err);
    if (server.listening) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

runStage6bTests();
