const http = require('http');
const path = require('path');
const ioClient = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';
const LAN_URL = 'http://192.168.1.12:5000';

async function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log('🏏 ========================================================');
  console.log('📱 PC + ANDROID REAL-TIME MULTIPLAYER INTEGRATION TEST');
  console.log('   Simulating simultaneous PC Browser & Android Chrome Clients');
  console.log('🏏 ========================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [STEP ${total}] ${title} ${extra ? `(${extra})` : ''}`);
    } else {
      console.error(`❌ [STEP ${total} FAILED] ${title} ${extra ? `(${extra})` : ''}`);
      throw new Error(`Step failed: ${title}`);
    }
  }

  // Reset rate limits
  await makeRequest('/api/auth/reset-rate-limit', 'POST');

  // STEP 1: PC Host initializes guest session
  const pcUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const pcRes = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'MS Dhoni (PC Host)',
    favoriteTeam: 'CSK'
  }, { 'User-Agent': pcUserAgent });

  const hostUser = pcRes.data?.data;
  assert(
    'PC Host: Guest session created directly without login',
    pcRes.status === 200 && hostUser?.guestId && hostUser?.token,
    `Name: ${hostUser?.name}, guestId: ${hostUser?.guestId}`
  );

  // STEP 2: Android Participant initializes guest session
  const androidUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36';
  const androidRes = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Rohit Sharma (Android Mobile)',
    favoriteTeam: 'MI'
  }, { 'User-Agent': androidUserAgent });

  const androidUser = androidRes.data?.data;
  assert(
    'Android Mobile: Guest session created directly without login',
    androidRes.status === 200 && androidUser?.guestId && androidUser?.token,
    `Name: ${androidUser?.name}, guestId: ${androidUser?.guestId}`
  );

  // STEP 3: PC Host creates auction room
  const createRes = await makeRequest('/api/rooms', 'POST', {
    roomName: 'IPL 2026 Mega Arena',
    displayName: hostUser.name,
    autoClaimTeam: 'CSK',
    isPrivate: false,
    settings: {
      timerSeconds: 5,
      bidExtensionSeconds: 5,
      startingPurseCr: 120,
      incrementLadderType: 'official'
    }
  }, {
    Authorization: `Bearer ${hostUser.token}`,
    'User-Agent': pcUserAgent
  });

  const room = createRes.data?.data;
  const roomCode = room?.roomCode;
  assert(
    'PC Host: Created auction room with unique 6-character room code',
    createRes.status === 201 && roomCode && roomCode.startsWith('IPL-'),
    `Room Code: ${roomCode}, Room Name: "${room?.roomName}"`
  );

  // STEP 4: Android Participant joins room using code
  const joinRes = await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', {
    displayName: androidUser.name
  }, {
    Authorization: `Bearer ${androidUser.token}`,
    'User-Agent': androidUserAgent
  });

  assert(
    'Android Mobile: Joined room using room code',
    joinRes.status === 200 && joinRes.data?.data?.participants?.length === 2,
    `Participants in room: ${joinRes.data?.data?.participants?.length}`
  );

  // STEP 5: Android Participant claims MI franchise
  const claimRes = await makeRequest(`/api/rooms/${roomCode}/claim`, 'POST', {
    franchiseCode: 'MI'
  }, {
    Authorization: `Bearer ${androidUser.token}`,
    'User-Agent': androidUserAgent
  });

  assert(
    'Android Mobile: Claimed MI franchise paddle',
    claimRes.status === 200,
    `Franchise claimed: MI`
  );

  // STEP 6: Connect WebSockets for PC and Android clients
  const pcSocket = ioClient(BASE_URL, {
    auth: { token: hostUser.token, guestId: hostUser.guestId, sessionSecret: hostUser.sessionSecret },
    extraHeaders: { 'User-Agent': pcUserAgent },
    transports: ['websocket']
  });

  const androidSocket = ioClient(BASE_URL, {
    auth: { token: androidUser.token, guestId: androidUser.guestId, sessionSecret: androidUser.sessionSecret },
    extraHeaders: { 'User-Agent': androidUserAgent },
    transports: ['websocket']
  });

  await Promise.all([
    new Promise(r => pcSocket.once('connect', r)),
    new Promise(r => androidSocket.once('connect', r))
  ]);

  pcSocket.emit('room:join', { roomCode });
  androidSocket.emit('room:join', { roomCode });
  await delay(400);

  assert(
    'Multiplayer WebSockets: Both PC and Android devices connected and joined room channel',
    pcSocket.connected && androidSocket.connected,
    `PC Socket ID: ${pcSocket.id}, Android Socket ID: ${androidSocket.id}`
  );

  // STEP 7: PC Host starts auction; Android device receives live updates
  let pcStarted = false;
  let androidStarted = false;
  let pcLot = null;
  let androidLot = null;

  pcSocket.once('auction:started', () => { pcStarted = true; });
  androidSocket.once('auction:started', () => { androidStarted = true; });

  pcSocket.once('auction:playerChanged', (d) => { pcLot = d; });
  androidSocket.once('auction:playerChanged', (d) => { androidLot = d; });

  pcSocket.emit('auction:start', { roomCode });
  await delay(700);

  assert(
    'Live Auction Started: PC and Android devices receive identical live lot spotlight',
    pcStarted && androidStarted && pcLot?.player?._id === androidLot?.player?._id,
    `Player: ${pcLot?.player?.name}, Base Price: ₹${pcLot?.basePriceCr} Cr`
  );

  // STEP 8: Android Mobile places bid for MI
  let pcSawAndroidBid = null;
  let androidSawOwnBid = null;

  pcSocket.once('auction:bidPlaced', (d) => { pcSawAndroidBid = d; });
  androidSocket.once('auction:bidPlaced', (d) => { androidSawOwnBid = d; });

  androidSocket.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
  await delay(600);

  assert(
    'Bidding Sync: Android bid for MI instantly received on PC screen with identical amount',
    pcSawAndroidBid &&
    androidSawOwnBid &&
    pcSawAndroidBid.currentBidderFranchise === 'MI' &&
    pcSawAndroidBid.currentBidCr === androidSawOwnBid.currentBidCr,
    `Current Bid: ₹${pcSawAndroidBid?.currentBidCr} Cr by ${pcSawAndroidBid?.currentBidderFranchise}`
  );

  // STEP 9: PC Host places counter-bid for CSK
  let pcSawHostCounter = null;
  let androidSawHostCounter = null;

  pcSocket.once('auction:bidPlaced', (d) => { pcSawHostCounter = d; });
  androidSocket.once('auction:bidPlaced', (d) => { androidSawHostCounter = d; });

  pcSocket.emit('auction:bid', { roomCode, franchiseCode: 'CSK' });
  await delay(600);

  assert(
    'Counter-Bidding Sync: PC counter-bid for CSK instantly received on Android screen',
    pcSawHostCounter &&
    androidSawHostCounter &&
    androidSawHostCounter.currentBidderFranchise === 'CSK' &&
    androidSawHostCounter.currentBidCr === pcSawHostCounter.currentBidCr,
    `Counter-bid: ₹${androidSawHostCounter?.currentBidCr} Cr by ${androidSawHostCounter?.currentBidderFranchise}`
  );

  // STEP 10: Host Pauses and Resumes Auction
  let androidSawPause = false;
  let androidSawResume = false;

  androidSocket.once('auction:paused', () => { androidSawPause = true; });
  pcSocket.emit('auction:pause', { roomCode });
  await delay(400);

  androidSocket.once('auction:resumed', () => { androidSawResume = true; });
  pcSocket.emit('auction:resume', { roomCode });
  await delay(400);

  assert(
    'Host Controls Sync: Pause and Resume synchronized in real time to Android client',
    androidSawPause && androidSawResume,
    `Pause received: ${androidSawPause}, Resume received: ${androidSawResume}`
  );

  // STEP 11: Countdown completes and Hammer Drops (Player Sold)
  console.log('   Waiting for server-authoritative countdown & hammer drop...');
  let pcSoldNotice = null;
  let androidSoldNotice = null;

  pcSocket.once('auction:playerSold', (d) => { pcSoldNotice = d; });
  androidSocket.once('auction:playerSold', (d) => { androidSoldNotice = d; });

  await delay(6500);

  assert(
    'Hammer Drop Sync: Both PC and Android devices receive identical sold notice & deducted purse',
    pcSoldNotice &&
    androidSoldNotice &&
    pcSoldNotice.franchiseCode === 'CSK' &&
    pcSoldNotice.soldPriceCr === androidSoldNotice.soldPriceCr &&
    pcSoldNotice.remainingPurseCr === (120 - pcSoldNotice.soldPriceCr),
    `Sold to ${pcSoldNotice?.franchiseCode} for ₹${pcSoldNotice?.soldPriceCr} Cr, Remaining Purse: ₹${pcSoldNotice?.remainingPurseCr} Cr`
  );

  // STEP 12: Android Mobile Network Disconnect and Seamless Reconnection
  androidSocket.disconnect();
  await delay(500);

  // Reconnect Android client (simulating refresh or network drop)
  const androidReconnectedSocket = ioClient(BASE_URL, {
    auth: { token: androidUser.token, guestId: androidUser.guestId, sessionSecret: androidUser.sessionSecret },
    extraHeaders: { 'User-Agent': androidUserAgent },
    transports: ['websocket']
  });

  await new Promise(r => androidReconnectedSocket.once('connect', r));
  androidReconnectedSocket.emit('room:join', { roomCode });
  await delay(400);

  const roomCheck = await makeRequest(`/api/rooms/${roomCode}`, 'GET');
  const participants = roomCheck.data?.data?.participants || [];
  const miSlot = roomCheck.data?.data?.franchises?.find(f => f.code === 'MI');

  assert(
    'Reconnection Integrity: Android client reconnects with exact same identity, preserving MI paddle without duplicate participants',
    participants.length === 2 && miSlot?.claimedBy === androidUser._id,
    `Total participants: ${participants.length}, MI owner: ${miSlot?.claimedByName}`
  );

  // STEP 13: Host ends auction
  let pcEnded = false;
  let androidEnded = false;

  pcSocket.once('auction:completed', () => { pcEnded = true; });
  androidReconnectedSocket.once('auction:completed', () => { androidEnded = true; });

  pcSocket.emit('auction:end', { roomCode });
  await delay(600);

  assert(
    'Auction Completion: Host ends auction; both PC and Android devices transition to results',
    pcEnded && androidEnded,
    `PC Completed: ${pcEnded}, Android Completed: ${androidEnded}`
  );

  pcSocket.disconnect();
  androidReconnectedSocket.disconnect();

  console.log('\n========================================================');
  console.log(`🎯 PC + ANDROID INTEGRATION TEST: ${passed}/${total} STEPS PASSED (100%)`);
  console.log('========================================================\n');
}

run().catch((err) => {
  console.error('\n❌ PC + Android integration test failed:', err);
  process.exit(1);
});
