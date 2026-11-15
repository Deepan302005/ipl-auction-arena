const path = require('path');
const dns = require('dns');

// Configure local database connection
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/ipl_auction_arena';
const TEST_PORT = 5088;
process.env.PORT = String(TEST_PORT);

const mongoose = require('mongoose');
const ioClient = require('socket.io-client');
const { app, server, startServer } = require('../server');
const User = require('../models/User');
const Room = require('../models/Room');
const Player = require('../models/Player');
const Team = require('../models/Team');
const generateToken = require('../utils/generateToken');

const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runTest() {
  console.log('🏏 ========================================================');
  console.log('📱💻 PC & MOBILE SIMULTANEOUS LIVE AUCTION CONCURRENCY TEST');
  console.log('🏏 ========================================================\n');

  await startServer();
  console.log(`🚀 Test server listening on ${BASE_URL}`);

  // 1. Create PC Host and Mobile Client users
  let pcUser = await User.findOne({ email: 'pc.manager@iplarena.com' });
  if (!pcUser) {
    pcUser = await User.create({
      name: 'Rohan Sharma (Desktop PC)',
      email: 'pc.manager@iplarena.com',
      password: 'password123',
      favoriteTeam: 'CSK'
    });
  }
  const pcToken = generateToken(pcUser._id);

  let mobileUser = await User.findOne({ email: 'mobile.manager@iplarena.com' });
  if (!mobileUser) {
    mobileUser = await User.create({
      name: 'Pooja Iyer (Mobile Phone)',
      email: 'mobile.manager@iplarena.com',
      password: 'password123',
      favoriteTeam: 'MI'
    });
  }
  const mobileToken = generateToken(mobileUser._id);

  // 2. Fetch real players and teams
  const teams = await Team.find({ isActive: true }).sort({ name: 1 });
  const players = await Player.find({}).limit(5);
  const virat = players.find(p => p.name.includes('Kohli')) || players[0];

  const defaultFranchises = teams.map((team) => ({
    franchiseId: team.franchiseId,
    name: team.name,
    code: team.code,
    tagline: team.tagline,
    brand: team.brand,
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    claimedBy: null,
    claimedByName: '',
    squad: []
  }));

  const ROOM_CODE = 'IPL-DUAL';
  await Room.deleteMany({ roomCode: ROOM_CODE });

  const room = await Room.create({
    roomCode: ROOM_CODE,
    roomName: 'PC + Mobile Live Final Showdown',
    host: pcUser._id,
    hostName: pcUser.name,
    isPrivate: false,
    status: 'waiting',
    participants: [pcUser._id, mobileUser._id],
    franchises: defaultFranchises,
    playerPool: players.map(p => p._id),
    auctionQueue: players.map(p => p._id),
    settings: {
      timerSeconds: 5,
      bidExtensionSeconds: 5,
      startingPurseCr: 120.0,
      incrementLadderType: 'official'
    }
  });

  console.log(`✅ Room ${ROOM_CODE} initialized in MongoDB`);

  // 3. Connect PC Socket (Simulating Chrome Desktop)
  const pcSocket = ioClient(BASE_URL, {
    auth: { token: pcToken },
    extraHeaders: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Desktop PC' },
    transports: ['websocket']
  });

  // 4. Connect Mobile Socket (Simulating iPhone Safari / Android Chrome)
  const mobileSocket = ioClient(BASE_URL, {
    auth: { token: mobileToken },
    extraHeaders: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Phone' },
    transports: ['websocket']
  });

  await Promise.all([
    new Promise(res => pcSocket.once('connect', res)),
    new Promise(res => mobileSocket.once('connect', res))
  ]);

  console.log(`⚡ PC Socket connected: ${pcSocket.id}`);
  console.log(`⚡ Mobile Socket connected: ${mobileSocket.id}`);

  // 5. Join Room simultaneously
  pcSocket.emit('room:join', { roomCode: ROOM_CODE });
  mobileSocket.emit('room:join', { roomCode: ROOM_CODE });
  await new Promise(r => setTimeout(r, 400));

  // 6. Franchise Claiming
  console.log('🏎️ PC claims CSK, Mobile claims MI...');
  let pcSawMobileClaim = false;
  let mobileSawPcClaim = false;

  pcSocket.on('room:franchiseClaimed', (data) => {
    if (data.franchiseCode === 'MI') pcSawMobileClaim = true;
  });
  mobileSocket.on('room:franchiseClaimed', (data) => {
    if (data.franchiseCode === 'CSK') mobileSawPcClaim = true;
  });

  pcSocket.emit('room:claimFranchise', { roomCode: ROOM_CODE, franchiseCode: 'CSK' });
  mobileSocket.emit('room:claimFranchise', { roomCode: ROOM_CODE, franchiseCode: 'MI' });
  await new Promise(r => setTimeout(r, 600));

  console.log(`   PC saw Mobile claim MI: ${pcSawMobileClaim ? '✅ YES' : '❌ NO'}`);
  console.log(`   Mobile saw PC claim CSK: ${mobileSawPcClaim ? '✅ YES' : '❌ NO'}`);

  // 7. PC Host starts Live Auction
  console.log('\n🔨 PC Host starts live auction...');
  let pcAuctionStarted = false;
  let mobileAuctionStarted = false;

  pcSocket.on('auction:started', () => { pcAuctionStarted = true; });
  mobileSocket.on('auction:started', () => { mobileAuctionStarted = true; });

  pcSocket.emit('auction:start', { roomCode: ROOM_CODE });
  await new Promise(r => setTimeout(r, 800));

  console.log(`   PC received auction:started: ${pcAuctionStarted ? '✅ YES' : '❌ NO'}`);
  console.log(`   Mobile received auction:started: ${mobileAuctionStarted ? '✅ YES' : '❌ NO'}`);

  // 8. Mobile places opening bid (2.00 Cr)
  console.log('\n📲 Mobile places opening bid of ₹2.00 Cr for MI...');
  let pcReceivedMobileBid = false;
  let pcRecordedAmount = 0;

  pcSocket.on('auction:bidPlaced', (data) => {
    pcReceivedMobileBid = true;
    pcRecordedAmount = data.currentBidCr;
  });

  mobileSocket.emit('auction:bid', { roomCode: ROOM_CODE, franchiseCode: 'MI', bidAmountCr: 2.0 });
  await new Promise(r => setTimeout(r, 600));

  console.log(`   PC client received real-time bid: ${pcReceivedMobileBid ? '✅ YES' : '❌ NO'} (Amount: ₹${pcRecordedAmount} Cr)`);

  // 9. PC counter-bids (2.50 Cr)
  console.log('\n💻 PC counter-bids ₹2.50 Cr for CSK...');
  let mobileReceivedPcBid = false;
  let mobileRecordedAmount = 0;

  mobileSocket.on('auction:bidPlaced', (data) => {
    mobileReceivedPcBid = true;
    mobileRecordedAmount = data.currentBidCr;
  });

  pcSocket.emit('auction:bid', { roomCode: ROOM_CODE, franchiseCode: 'CSK', bidAmountCr: 2.5 });
  await new Promise(r => setTimeout(r, 600));

  console.log(`   Mobile client received real-time counter-bid: ${mobileReceivedPcBid ? '✅ YES' : '❌ NO'} (Amount: ₹${mobileRecordedAmount} Cr)`);

  // 10. Wait for countdown & hammer drop
  console.log('\n⏳ Waiting 7s for timer expiration & hammer drop...');
  let pcSawSold = false;
  let mobileSawSold = false;
  let winningFranchise = '';

  pcSocket.on('auction:playerSold', (data) => {
    pcSawSold = true;
    winningFranchise = data.franchiseCode;
  });
  mobileSocket.on('auction:playerSold', () => {
    mobileSawSold = true;
  });

  await new Promise(r => setTimeout(r, 7000));

  console.log(`   PC saw lot sold: ${pcSawSold ? '✅ YES' : '❌ NO'}`);
  console.log(`   Mobile saw lot sold: ${mobileSawSold ? '✅ YES' : '❌ NO'}`);
  console.log(`   Winning Franchise: ${winningFranchise}`);

  // Verification Assertions
  const success = pcSawMobileClaim && mobileSawPcClaim && pcAuctionStarted && mobileAuctionStarted &&
                  pcReceivedMobileBid && mobileReceivedPcBid && pcSawSold && mobileSawSold && (winningFranchise === 'CSK');

  console.log('\n========================================================');
  console.log(`🎯 PC-TO-MOBILE CONCURRENCY TEST RESULT: ${success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('========================================================\n');

  pcSocket.disconnect();
  mobileSocket.disconnect();
  server.close();
  await mongoose.disconnect();

  process.exit(success ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal concurrency error:', err);
  process.exit(1);
});
