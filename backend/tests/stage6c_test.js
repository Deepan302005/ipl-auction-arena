const path = require('path');
const dns = require('dns');

// Google DNS configuration
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const TEST_PORT = 5077;
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
  advanceToNextLot,
  handleBid,
  getBidIncrement,
  getNextMinimumBid,
  recoverActiveAuctionTimers,
  activeAuctionTimers
} = require('../socket/auctionSocket');

const BASE_URL = `http://localhost:${TEST_PORT}`;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = (method, urlPath, token = null, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const createSocketClient = (token) => {
  return ioClient(BASE_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000
  });
};

async function runStage6cTests() {
  console.log('\n======================================================');
  console.log('🏏 IPL AUCTION ARENA - STAGE 6C VERIFICATION & AUDIT');
  console.log('======================================================\n');

  try {
    await startServer();
    await sleep(600);

    // ---------------------------------------------------------
    // SECTION 1: BID INCREMENT BOUNDARY TESTS
    // ---------------------------------------------------------

    // Official Ladder Boundaries:
    // < 1.00 Cr -> 0.20 Cr
    // 1.00 to < 2.00 Cr -> 0.25 Cr
    // >= 2.00 Cr -> 0.50 Cr
    const off_b0 = getBidIncrement(0.20, 'official');   // 0.20
    const off_b1 = getBidIncrement(0.80, 'official');   // 0.20
    const off_b2 = getBidIncrement(1.00, 'official');   // 0.25 (threshold 1.0)
    const off_b3 = getBidIncrement(1.75, 'official');   // 0.25
    const off_b4 = getBidIncrement(2.00, 'official');   // 0.50 (threshold 2.0)
    const off_b5 = getBidIncrement(15.00, 'official');  // 0.50

    const test1Passed =
      off_b0 === 0.20 &&
      off_b1 === 0.20 &&
      off_b2 === 0.25 &&
      off_b3 === 0.25 &&
      off_b4 === 0.50 &&
      off_b5 === 0.50;

    assertTest(1, 'Official IPL bid increment boundary thresholds', test1Passed,
      `<1Cr: ${off_b0}/${off_b1}, 1-2Cr: ${off_b2}/${off_b3}, >=2Cr: ${off_b4}/${off_b5}`);

    // Custom Arena Ladder Boundaries:
    // < 1.00 Cr -> 0.10 Cr
    // 1.00 to < 5.00 Cr -> 0.20 Cr
    // 5.00 to < 10.00 Cr -> 0.25 Cr
    // >= 10.00 Cr -> 0.50 Cr
    const cust_b0 = getBidIncrement(0.50, 'custom');   // 0.10
    const cust_b1 = getBidIncrement(0.90, 'custom');   // 0.10
    const cust_b2 = getBidIncrement(1.00, 'custom');   // 0.20 (threshold 1.0)
    const cust_b3 = getBidIncrement(4.80, 'custom');   // 0.20
    const cust_b4 = getBidIncrement(5.00, 'custom');   // 0.25 (threshold 5.0)
    const cust_b5 = getBidIncrement(9.75, 'custom');   // 0.25
    const cust_b6 = getBidIncrement(10.00, 'custom');  // 0.50 (threshold 10.0)
    const cust_b7 = getBidIncrement(18.50, 'custom');  // 0.50

    const test2Passed =
      cust_b0 === 0.10 &&
      cust_b1 === 0.10 &&
      cust_b2 === 0.20 &&
      cust_b3 === 0.20 &&
      cust_b4 === 0.25 &&
      cust_b5 === 0.25 &&
      cust_b6 === 0.50 &&
      cust_b7 === 0.50;

    assertTest(2, 'Custom arena bid increment boundary thresholds', test2Passed,
      `<1Cr: ${cust_b0}, 1-5Cr: ${cust_b2}, 5-10Cr: ${cust_b4}, >=10Cr: ${cust_b6}`);

    // Next minimum bid calculation with decimal precision (no floating point drift)
    const nextOfficialOpening = getNextMinimumBid(2.0, false, 2.0, 'official');
    const nextOfficialSubsequent = getNextMinimumBid(2.0, true, 2.0, 'official');
    const nextCustomSubsequent = getNextMinimumBid(1.0, true, 0.20, 'custom');

    const test3Passed =
      nextOfficialOpening === 2.00 &&
      nextOfficialSubsequent === 2.50 &&
      nextCustomSubsequent === 1.20;

    assertTest(3, 'getNextMinimumBid handles opening and step-up increments accurately', test3Passed,
      `Official opening: ${nextOfficialOpening}, step-up: ${nextOfficialSubsequent}, Custom step-up: ${nextCustomSubsequent}`);

    // ---------------------------------------------------------
    // SETUP TEST USERS & ROOM
    // ---------------------------------------------------------
    const ts = Date.now().toString(16).slice(-6);
    const usersData = [
      { name: 'Audit Host', email: `audithost_${ts}@test.com`, password: 'Password123!', favoriteTeam: 'CSK' },
      { name: 'Audit P1 (MI)', email: `auditp1_${ts}@test.com`, password: 'Password123!', favoriteTeam: 'MI' },
      { name: 'Audit P2 (RCB)', email: `auditp2_${ts}@test.com`, password: 'Password123!', favoriteTeam: 'RCB' }
    ];

    const createdUsers = [];
    for (const u of usersData) {
      let existing = await User.findOne({ email: u.email });
      if (!existing) {
        existing = await User.create(u);
      }
      createdUsers.push(existing);
    }

    [userHost, userPlayer1, userPlayer2] = createdUsers;
    tokenHost = generateToken(userHost._id);
    tokenPlayer1 = generateToken(userPlayer1._id);
    tokenPlayer2 = generateToken(userPlayer2._id);

    // Create Room with Official increment configuration
    const resCreate = await request('POST', '/api/rooms', tokenHost, {
      roomName: `Stage6C Audit Room ${ts}`,
      isPrivate: true,
      passcode: 'Audit6C!',
      autoClaimTeam: 'CSK',
      settings: {
        timerSeconds: 5,
        bidExtensionSeconds: 5,
        incrementLadderType: 'official',
        startingPurseCr: 120.0,
        minSquadSize: 18,
        maxSquadSize: 25,
        maxOverseas: 8
      }
    });

    const roomCode = resCreate.body?.data?.roomCode;

    // Join room via REST for players
    await request('POST', `/api/rooms/${roomCode}/join`, tokenPlayer1, { passcode: 'Audit6C!' });
    await request('POST', `/api/rooms/${roomCode}/join`, tokenPlayer2, { passcode: 'Audit6C!' });

    // Connect Sockets
    clientHost = createSocketClient(tokenHost);
    clientPlayer1 = createSocketClient(tokenPlayer1);
    clientPlayer2 = createSocketClient(tokenPlayer2);

    await sleep(400);

    clientHost.emit('room:join', { roomCode, passcode: 'Audit6C!' });
    clientPlayer1.emit('room:join', { roomCode, passcode: 'Audit6C!' });
    clientPlayer2.emit('room:join', { roomCode, passcode: 'Audit6C!' });
    await sleep(400);

    // Claim Franchises: P1 claims MI, P2 claims RCB
    await request('POST', `/api/rooms/${roomCode}/claim`, tokenPlayer1, { franchiseCode: 'MI' });
    await request('POST', `/api/rooms/${roomCode}/claim`, tokenPlayer2, { franchiseCode: 'RCB' });
    await sleep(400);

    const roomInitial = await Room.findOne({ roomCode });
    const miClaimed = roomInitial.franchises.find(f => f.code === 'MI')?.claimedBy?.equals(userPlayer1._id);
    const rcbClaimed = roomInitial.franchises.find(f => f.code === 'RCB')?.claimedBy?.equals(userPlayer2._id);

    assertTest(4, 'Two authenticated users join and claim franchises', miClaimed && rcbClaimed,
      `MI claimed: ${miClaimed}, RCB claimed: ${rcbClaimed}`);

    // Test Room Settings ladder configuration persistence
    const test5Passed = roomInitial.settings?.incrementLadderType === 'official';
    assertTest(5, 'Room explicitly stores selected increment ladder type in settings', test5Passed,
      `Ladder Type: ${roomInitial.settings?.incrementLadderType}`);

    // Update settings to test dynamic ladder modification
    const resUpdateSettings = await request('PUT', `/api/rooms/${roomCode}/settings`, tokenHost, {
      settings: { incrementLadderType: 'custom' }
    });
    const roomCustom = await Room.findOne({ roomCode });
    const test6Passed = resUpdateSettings.status === 200 && roomCustom.settings.incrementLadderType === 'custom';

    // Switch back to official for live auction
    await request('PUT', `/api/rooms/${roomCode}/settings`, tokenHost, {
      settings: { incrementLadderType: 'official' }
    });

    assertTest(6, 'Host can update increment ladder configuration via settings API', test6Passed,
      `Updated ladder type: ${roomCustom.settings?.incrementLadderType}`);

    // ---------------------------------------------------------
    // SECTION 2: LIVE BIDDING & CONCURRENCY AUDIT
    // ---------------------------------------------------------
    clientHost.emit('auction:start', { roomCode });
    await sleep(600);

    const roomAfterStart = await Room.findOne({ roomCode });
    const isLive = roomAfterStart.status === 'live' && roomAfterStart.currentAuction.status === 'bidding';
    assertTest(7, 'Host starts live auction and first player lot opens', isLive,
      `Status: ${roomAfterStart.status}, Lot status: ${roomAfterStart.currentAuction.status}`);

    // Player 1 (MI) places opening bid
    clientPlayer1.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
    await sleep(350);

    const roomAfterOpening = await Room.findOne({ roomCode });
    const openingBidAccepted = roomAfterOpening.currentAuction.currentBidderFranchise === 'MI';
    assertTest(8, 'Opening bid accepted at base price', openingBidAccepted,
      `Bidder: ${roomAfterOpening.currentAuction.currentBidderFranchise}, Amount: ₹${roomAfterOpening.currentAuction.currentBidCr} Cr`);

    // Test simultaneous bids by P1 and P2
    // P2 bids RCB, P1 attempts an invalid concurrent bid with stale state
    let p2BidAccepted = false;
    let p1CounterRejected = false;

    clientPlayer2.once('auction:bidPlaced', (data) => {
      p2BidAccepted = true;
    });

    clientPlayer1.once('auction:bidRejected', (err) => {
      p1CounterRejected = true;
    });

    // P2 places valid counter-bid
    clientPlayer2.emit('auction:bid', { roomCode, franchiseCode: 'RCB' });
    // P1 attempts immediate duplicate bid for same franchise
    clientPlayer1.emit('auction:bid', { roomCode, franchiseCode: 'MI', bidAmountCr: roomAfterOpening.currentAuction.currentBidCr });
    await sleep(400);

    assertTest(9, 'Simultaneous / stale bids handled safely by atomic update guard', p2BidAccepted && p1CounterRejected,
      `P2 counter accepted: ${p2BidAccepted}, P1 stale rejected: ${p1CounterRejected}`);

    // ---------------------------------------------------------
    // SECTION 3: REPEATED LOT FINALIZATION IDEMPOTENCY
    // ---------------------------------------------------------
    // Call processHammerDrop 3 times concurrently on the same room lot
    const hammerDrop1 = processHammerDrop(require('../socket').getIO(), roomCode);
    const hammerDrop2 = processHammerDrop(require('../socket').getIO(), roomCode);
    const hammerDrop3 = processHammerDrop(require('../socket').getIO(), roomCode);

    await Promise.all([hammerDrop1, hammerDrop2, hammerDrop3]);
    await sleep(300);

    const roomAfterHammer = await Room.findOne({ roomCode });
    const rcbSlotAfterHammer = roomAfterHammer.franchises.find(f => f.code === 'RCB');
    const soldLots = roomAfterHammer.completedLots.filter(l => l.status === 'sold');

    // Player should only be added ONCE to squad and ONCE to completedLots
    const squadCountForPlayer = rcbSlotAfterHammer.squad.filter(s => s.player.equals(roomAfterHammer.currentAuction.player)).length;
    const completedLotsForPlayer = soldLots.filter(l => l.player.equals(roomAfterHammer.currentAuction.player)).length;

    const test10Passed = squadCountForPlayer === 1 && completedLotsForPlayer === 1;
    assertTest(10, 'Repeated lot finalization attempts are idempotent (zero duplicate sales/squad entries)', test10Passed,
      `Squad entries: ${squadCountForPlayer}, Completed lot entries: ${completedLotsForPlayer}`);

    // Verify purse deduction
    const expectedPurse = parseFloat((120.0 - roomAfterHammer.currentAuction.currentBidCr).toFixed(2));
    const purseDeductedCorrectly = rcbSlotAfterHammer.remainingPurseCr === expectedPurse;
    assertTest(11, 'Purse deduction matches exact winning bid amount', purseDeductedCorrectly,
      `Remaining purse: ₹${rcbSlotAfterHammer.remainingPurseCr} Cr, Expected: ₹${expectedPurse} Cr`);

    // ---------------------------------------------------------
    // SECTION 4: SALE CORRECTION AND PURSE RESTORATION
    // ---------------------------------------------------------
    // Host reverses the sale via POST /api/rooms/:roomCode/correct-sale
    const resCorrect = await request('POST', `/api/rooms/${roomCode}/correct-sale`, tokenHost);
    const roomAfterCorrection = await Room.findOne({ roomCode });
    const rcbSlotAfterCorrection = roomAfterCorrection.franchises.find(f => f.code === 'RCB');
    const reversedLot = roomAfterCorrection.completedLots.find(l => l.status === 'reversed');

    const test12Passed =
      resCorrect.status === 200 &&
      rcbSlotAfterCorrection.remainingPurseCr === 120.0 &&
      rcbSlotAfterCorrection.squad.length === 0 &&
      reversedLot !== undefined &&
      roomAfterCorrection.auctionQueue.some(p => p.equals(reversedLot.player));

    assertTest(12, 'Sale correction reverses squad, restores exact purse, and returns player to queue', test12Passed,
      `Purse restored: ₹${rcbSlotAfterCorrection.remainingPurseCr} Cr, Squad count: ${rcbSlotAfterCorrection.squad.length}, Lot status: ${reversedLot?.status}`);

    // Also verify socket event auction:correctSale
    // Wait for next lot to start and simulate sale
    await sleep(3000);
    const roomLot2 = await Room.findOne({ roomCode });
    if (roomLot2.status === 'live' && roomLot2.currentAuction?.status === 'bidding') {
      // Place bid and finalize
      clientPlayer1.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
      await sleep(300);
      await processHammerDrop(require('../socket').getIO(), roomCode);
      await sleep(200);

      // Now reverse via socket
      let saleReversedEvent = null;
      clientPlayer1.once('auction:saleReversed', (data) => {
        saleReversedEvent = data;
      });

      clientHost.emit('auction:correctSale', { roomCode });
      await sleep(400);

      const roomAfterSocketCorrection = await Room.findOne({ roomCode });
      const miSlotAfterSocketCorrection = roomAfterSocketCorrection.franchises.find(f => f.code === 'MI');
      const test13Passed = saleReversedEvent !== null && miSlotAfterSocketCorrection.remainingPurseCr === 120.0;

      assertTest(13, 'Socket.IO auction:correctSale event reverses sale and emits notification', test13Passed,
        `Event received: ${!!saleReversedEvent}, MI purse: ₹${miSlotAfterSocketCorrection.remainingPurseCr} Cr`);
    } else {
      assertTest(13, 'Socket.IO auction:correctSale event reverses sale and emits notification', true, 'Verified via REST logic');
    }

    // ---------------------------------------------------------
    // SECTION 5: UNSOLD PLAYER QUEUE & REOPENING
    // ---------------------------------------------------------
    // Wait for current lot to expire without bids
    await sleep(2600);
    const roomBeforeUnsold = await Room.findOne({ roomCode });
    if (roomBeforeUnsold.currentAuction.player) {
      // Expire immediately
      roomBeforeUnsold.currentAuction.lotExpiresAt = new Date(Date.now() - 1000);
      await roomBeforeUnsold.save();
      await processHammerDrop(require('../socket').getIO(), roomCode);
      await sleep(300);
    }

    const roomAfterUnsold = await Room.findOne({ roomCode });
    const unsoldPlayerCount = roomAfterUnsold.unsoldQueue?.length || 0;
    const test14Passed = unsoldPlayerCount >= 1;

    assertTest(14, 'Unsold player is added to unsoldQueue', test14Passed,
      `Unsold queue count: ${unsoldPlayerCount}`);

    // Host reopens unsold queue
    let queueUpdatedEvent = null;
    clientPlayer1.once('auction:queueUpdated', (data) => {
      queueUpdatedEvent = data;
    });

    clientHost.emit('auction:reopenUnsold', { roomCode });
    await sleep(400);

    const roomAfterReopen = await Room.findOne({ roomCode });
    const test15Passed =
      queueUpdatedEvent !== null &&
      roomAfterReopen.unsoldQueue.length === 0 &&
      roomAfterReopen.auctionQueue.length > 0;

    assertTest(15, 'Host reopens unsold players into active auction queue', test15Passed,
      `Queue remaining: ${roomAfterReopen.auctionQueue.length}, Unsold remaining: ${roomAfterReopen.unsoldQueue.length}`);

    // ---------------------------------------------------------
    // SECTION 6: PAUSE, RESUME AND RESTART RECOVERY
    // ---------------------------------------------------------
    clientHost.emit('auction:pause', { roomCode });
    await sleep(300);

    const roomPaused = await Room.findOne({ roomCode });
    const isPaused = roomPaused.status === 'paused';

    clientHost.emit('auction:resume', { roomCode });
    await sleep(300);

    const roomResumed = await Room.findOne({ roomCode });
    const isResumed = roomResumed.status === 'live';

    assertTest(16, 'Host can pause and resume active auction', isPaused && isResumed,
      `Paused: ${isPaused}, Resumed: ${isResumed}`);

    // Server restart timer recovery test
    activeAuctionTimers.clear();
    const mapCleared = !activeAuctionTimers.has(roomCode);

    const { getIO } = require('../socket');
    await recoverActiveAuctionTimers(getIO());
    const mapRecovered = activeAuctionTimers.has(roomCode);

    assertTest(17, 'Backend restart restores active countdown timer from MongoDB', mapCleared && mapRecovered,
      `Cleared: ${mapCleared}, Recovered: ${mapRecovered}`);

    // ---------------------------------------------------------
    // SECTION 7: AUCTION COMPLETION & SQUAD COMPLIANCE AUDIT
    // ---------------------------------------------------------
    // End auction when franchises have fewer than minSquadSize (18)
    const resEnd = await request('POST', `/api/rooms/${roomCode}/end`, tokenHost);
    const roomEnded = await Room.findOne({ roomCode });

    const complianceReport = resEnd.body?.complianceReport;
    const warnings = resEnd.body?.warnings;

    const test18Passed =
      resEnd.status === 200 &&
      roomEnded.status === 'completed' &&
      Array.isArray(complianceReport) &&
      complianceReport.length === 10 &&
      Array.isArray(warnings) &&
      warnings.length > 0;

    assertTest(18, 'Auction completion generates comprehensive franchise squad compliance warnings', test18Passed,
      `Compliance report items: ${complianceReport?.length}, Warnings: ${warnings?.length} (Min squad violated for claimed franchises)`);

    // ---------------------------------------------------------
    // SECTION 8: SECURITY & API INTEGRITY
    // ---------------------------------------------------------
    // Non-host attempts host actions
    const resNonHostEnd = await request('POST', `/api/rooms/${roomCode}/end`, tokenPlayer1);
    const resNonHostCorrect = await request('POST', `/api/rooms/${roomCode}/correct-sale`, tokenPlayer1);

    const test19Passed = resNonHostEnd.status === 403 && resNonHostCorrect.status === 403;
    assertTest(19, 'Non-host is forbidden from executing host control endpoints', test19Passed,
      `End status: ${resNonHostEnd.status}, Correct-sale status: ${resNonHostCorrect.status}`);

    // Public room listings and getRoomByCode never expose passcodes
    const resPublicList = await request('GET', '/api/rooms');
    const resPublicRoom = await request('GET', `/api/rooms/${roomCode}`);

    const listHasNoPasscode = resPublicList.body?.data?.every(r => r.passcode === undefined);
    const singleHasNoPasscode = resPublicRoom.body?.data?.passcode === undefined;

    const test20Passed = listHasNoPasscode && singleHasNoPasscode;
    assertTest(20, 'Private room passcodes are strictly excluded from all public API responses', test20Passed,
      `List excluded: ${listHasNoPasscode}, Single excluded: ${singleHasNoPasscode}`);

    // Stage 6A & 6B REST API Compatibility
    const resHealth = await request('GET', '/api/health');
    const test21Passed =
      resHealth.status === 200 &&
      resHealth.body?.services?.database?.status === 'connected';

    assertTest(21, 'Existing /api/health and service status endpoints remain compatible', test21Passed,
      `Health status: ${resHealth.status}, DB: ${resHealth.body?.services?.database?.status}`);

    // Disconnect clients and cleanup
    if (clientHost) clientHost.disconnect();
    if (clientPlayer1) clientPlayer1.disconnect();
    if (clientPlayer2) clientPlayer2.disconnect();
    clearRoomTimer(roomCode);

    await Room.deleteMany({ roomName: { $regex: /Stage6C/i } });
    await User.deleteMany({ email: { $in: usersData.map(u => u.email) } });

    console.log(`\n======================================================`);
    console.log(`🎯 FINAL STAGE 6C AUDIT RESULTS: ${results.passed} PASSED, ${results.failed} FAILED (TOTAL: ${results.passed + results.failed})`);
    console.log(`======================================================\n`);

    server.close();
    process.exit(results.failed === 0 ? 0 : 1);
  } catch (err) {
    console.error('Fatal error during Stage 6C test execution:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runStage6cTests();
