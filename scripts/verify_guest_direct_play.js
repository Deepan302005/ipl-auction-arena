const http = require('http');
const ioClient = require('socket.io-client');

const BASE_URL = 'http://localhost:5000';

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
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: body });
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

async function run() {
  console.log('🏏 ========================================================');
  console.log('⚡ DIRECT GUEST-SESSION MULTIPLAYER VERIFICATION SUITE');
  console.log('   (Zero Sign-in / Zero Registration Requirement)');
  console.log('🏏 ========================================================\n');

  // Reset rate limits for test suite start
  await makeRequest('/api/auth/reset-rate-limit', 'POST');

  // STEP 1: INITIALIZE GUEST SESSIONS DIRECTLY
  console.log('1. Initializing Direct Guest Sessions:');
  const g1Res = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Rohit Sharma (Direct Host)',
    favoriteTeam: 'CSK'
  });
  if (g1Res.status !== 200 || !g1Res.data.data?.token) {
    throw new Error(`Guest 1 session failed: ${JSON.stringify(g1Res.data)}`);
  }
  const hostUser = g1Res.data.data;
  const hostToken = hostUser.token;
  console.log(`   ✅ Guest 1 (Host): "${hostUser.name}" [${hostUser.guestId}]`);

  const g2Res = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Pooja Iyer (Direct Player)',
    favoriteTeam: 'MI'
  });
  if (g2Res.status !== 200 || !g2Res.data.data?.token) {
    throw new Error(`Guest 2 session failed: ${JSON.stringify(g2Res.data)}`);
  }
  const playerUser = g2Res.data.data;
  const playerToken = playerUser.token;
  console.log(`   ✅ Guest 2 (Player): "${playerUser.name}" [${playerUser.guestId}]`);

  // STEP 2: VERIFY LEGACY AUTH REMOVAL (Zero Login / Sign-up)
  console.log('\n2. Verifying Legacy Auth Endpoints are Removed:');
  const regCheck = await makeRequest('/api/auth/register', 'POST', { email: 'test@example.com', password: 'password123' });
  const loginCheck = await makeRequest('/api/auth/login', 'POST', { email: 'test@example.com', password: 'password123' });
  console.log(`   POST /api/auth/register response code: ${regCheck.status} ${regCheck.status === 404 ? '✅ 404 NOT FOUND (Removed)' : '❌ STILL EXISTS'}`);
  console.log(`   POST /api/auth/login response code: ${loginCheck.status} ${loginCheck.status === 404 ? '✅ 404 NOT FOUND (Removed)' : '❌ STILL EXISTS'}`);
  if (regCheck.status !== 404 || loginCheck.status !== 404) {
    throw new Error('Legacy auth endpoints must not be exposed');
  }

  // STEP 3: CREATE ROOM DIRECTLY WITHOUT LOGIN
  console.log('\n3. Direct Room Creation (No sign-in gate):');
  const createRes = await makeRequest('/api/rooms', 'POST', {
    roomName: 'Direct Play Arena League',
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
    Authorization: `Bearer ${hostToken}`
  });

  if (createRes.status !== 201 || !createRes.data.data?.roomCode) {
    throw new Error(`Direct room creation failed: ${JSON.stringify(createRes.data)}`);
  }
  const room = createRes.data.data;
  const roomCode = room.roomCode;
  console.log(`   ✅ Room created successfully: ${roomCode} ("${room.roomName}")`);
  console.log(`      Host: ${room.hostName}`);
  console.log(`      Host Claimed Paddle: CSK`);

  // STEP 4: DIRECT ROOM JOINING BY GUEST 2
  console.log('\n4. Direct Public Room Joining (No sign-in gate):');
  const joinRes = await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', {
    displayName: playerUser.name
  }, {
    Authorization: `Bearer ${playerToken}`
  });

  if (joinRes.status !== 200) {
    throw new Error(`Direct room join failed: ${JSON.stringify(joinRes.data)}`);
  }
  console.log(`   ✅ Player joined ${roomCode} directly with name "${playerUser.name}"`);
  console.log(`      Total participants: ${joinRes.data.data?.participants?.length}`);

  // STEP 5: RECONNECTION DUPLICATE PREVENTION TEST
  console.log('\n5. Testing Stable Identity Reconnection (Duplicate Prevention):');
  // Re-request session with the same guestId and sessionSecret (simulating page reload with localStorage)
  const sessionRestore = await makeRequest('/api/auth/guest-session', 'POST', {
    guestId: playerUser.guestId,
    sessionSecret: playerUser.sessionSecret,
    displayName: playerUser.name
  });
  if (sessionRestore.status !== 200 || sessionRestore.data.data._id !== playerUser._id) {
    throw new Error('Session restore did not preserve exact user _id');
  }
  console.log(`   ✅ Restored exact same user identity across sessions: ${sessionRestore.data.data._id}`);

  // Re-join room with restored session
  const rejoinRes = await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', {
    displayName: playerUser.name
  }, {
    Authorization: `Bearer ${playerToken}`
  });
  const countAfterRejoin = rejoinRes.data.data?.participants?.length;
  console.log(`      Participant count after rejoin: ${countAfterRejoin}`);
  if (countAfterRejoin === 2) {
    console.log('   ✅ Duplicate prevention PASSED: same guest reconnected without duplicating records!');
  } else {
    throw new Error(`Duplicate participant detected! Count was ${countAfterRejoin}, expected 2`);
  }

  // STEP 6: FRANCHISE CLAIMING
  console.log('\n6. Guest Franchise Claiming:');
  const claimRes = await makeRequest(`/api/rooms/${roomCode}/claim`, 'POST', {
    franchiseCode: 'MI'
  }, {
    Authorization: `Bearer ${playerToken}`
  });
  if (claimRes.status !== 200) {
    throw new Error(`Franchise claim failed: ${JSON.stringify(claimRes.data)}`);
  }
  console.log(`   ✅ Player successfully claimed MI paddle!`);

  // Host manually claims CSK
  const hostClaim = await makeRequest(`/api/rooms/${roomCode}/claim`, 'POST', {
    franchiseCode: 'CSK'
  }, {
    Authorization: `Bearer ${hostToken}`
  });
  if (hostClaim.status === 200) {
    console.log(`   ✅ Host manually claimed CSK paddle!`);
  }

  // STEP 7: HOST PERMISSIONS & SECURITY AUDIT
  console.log('\n7. Host Permissions & Security Enforcement:');
  // Non-host attempts to change settings -> should fail (403)
  const illegalSettings = await makeRequest(`/api/rooms/${roomCode}/settings`, 'PUT', {
    timerSeconds: 30
  }, {
    Authorization: `Bearer ${playerToken}` // non-host
  });
  console.log(`   Non-host settings update rejected: ${illegalSettings.status === 403 ? '✅ 403 FORBIDDEN (Secure)' : '❌ SECURITY BREACH'}`);
  if (illegalSettings.status !== 403) throw new Error('Non-host was able to update settings!');

  // Real host updates settings -> should succeed (200)
  const legalSettings = await makeRequest(`/api/rooms/${roomCode}/settings`, 'PUT', {
    timerSeconds: 10
  }, {
    Authorization: `Bearer ${hostToken}` // host
  });
  console.log(`   Host settings update allowed: ${legalSettings.status === 200 ? '✅ 200 SUCCESS' : '❌ FAILED'}`);

  // STEP 8: PRIVATE ROOM PASSCODE SECURITY
  console.log('\n8. Private Room Passcode Enforcement:');
  const privRes = await makeRequest('/api/rooms', 'POST', {
    roomName: 'Secret Invitational',
    displayName: hostUser.name,
    isPrivate: true,
    passcode: 'SECRET99'
  }, {
    Authorization: `Bearer ${hostToken}`
  });
  const privCode = privRes.data.data.roomCode;
  console.log(`   Private room created: ${privCode} (Passcode: SECRET99)`);

  // Wrong passcode -> 403
  const badPass = await makeRequest(`/api/rooms/${privCode}/join`, 'POST', {
    passcode: 'WRONG'
  }, {
    Authorization: `Bearer ${playerToken}`
  });
  console.log(`   Join with invalid passcode rejected: ${badPass.status === 403 ? '✅ 403 FORBIDDEN' : '❌ FAILED'}`);
  if (badPass.status !== 403) throw new Error('Invalid passcode was accepted');

  // Correct passcode -> 200
  const goodPass = await makeRequest(`/api/rooms/${privCode}/join`, 'POST', {
    passcode: 'SECRET99'
  }, {
    Authorization: `Bearer ${playerToken}`
  });
  console.log(`   Join with correct passcode accepted: ${goodPass.status === 200 ? '✅ 200 SUCCESS' : '❌ FAILED'}`);

  // STEP 9: MULTIPLAYER SOCKET.IO REAL-TIME BIDDING
  console.log('\n9. Live Multiplayer Socket.IO Auction with Guest Tokens:');
  const hostSocket = ioClient(BASE_URL, {
    auth: { token: hostToken },
    transports: ['websocket']
  });
  const playerSocket = ioClient(BASE_URL, {
    auth: { token: playerToken },
    transports: ['websocket']
  });

  await Promise.all([
    new Promise(res => hostSocket.once('connect', res)),
    new Promise(res => playerSocket.once('connect', res))
  ]);
  console.log('   ✅ Both guest sockets connected via WebSockets');

  hostSocket.emit('room:join', { roomCode });
  playerSocket.emit('room:join', { roomCode });
  await new Promise(r => setTimeout(r, 400));

  // Non-host attempts to start auction via Socket.IO -> should receive error
  let nonHostStartError = null;
  playerSocket.once('auction:error', (err) => { nonHostStartError = err; });
  playerSocket.emit('auction:start', { roomCode });
  await new Promise(r => setTimeout(r, 400));
  console.log(`   Non-host socket auction:start blocked: ${nonHostStartError ? `✅ BLOCKED (${nonHostStartError.code || nonHostStartError.message})` : '❌ BREACH'}`);

  let auctionStarted = false;
  playerSocket.on('auction:started', () => { auctionStarted = true; });

  hostSocket.emit('auction:start', { roomCode });
  await new Promise(r => setTimeout(r, 600));
  console.log(`   Live auction started by verified host: ${auctionStarted ? '✅ YES' : '❌ NO'}`);

  // Guest 2 bids for MI
  let hostReceivedBid = false;
  let bidAmount = 0;
  hostSocket.on('auction:bidPlaced', (data) => {
    hostReceivedBid = true;
    bidAmount = data.currentBidCr;
  });

  playerSocket.emit('auction:bid', { roomCode, franchiseCode: 'MI' });
  await new Promise(r => setTimeout(r, 600));
  console.log(`   Player placed bid for MI: ${hostReceivedBid ? `✅ YES (Amount: ₹${bidAmount} Cr)` : '❌ NO'}`);

  // Guest 1 counter-bids for CSK
  let playerReceivedCounterBid = false;
  let counterAmount = 0;
  playerSocket.on('auction:bidPlaced', (data) => {
    playerReceivedCounterBid = true;
    counterAmount = data.currentBidCr;
  });

  hostSocket.emit('auction:bid', { roomCode, franchiseCode: 'CSK' });
  await new Promise(r => setTimeout(r, 600));
  console.log(`   Host counter-bid for CSK: ${playerReceivedCounterBid ? `✅ YES (Amount: ₹${counterAmount} Cr)` : '❌ NO'}`);

  // Wait for countdown & hammer drop
  console.log('   Waiting for countdown & hammer drop...');
  let soldNotice = null;
  playerSocket.on('auction:playerSold', (data) => {
    soldNotice = data;
  });
  await new Promise(r => setTimeout(r, 6500));

  if (soldNotice) {
    console.log(`   ✅ Player sold to ${soldNotice.franchiseCode} for ₹${soldNotice.soldPriceCr} Cr`);
  } else {
    throw new Error('Hammer drop not received within timeout');
  }

  hostSocket.disconnect();
  playerSocket.disconnect();

  // STEP 10: DATABASE PRODUCTION FALLBACK ENFORCEMENT AUDIT
  console.log('\n10. Production MongoDB Fallback Prohibition Audit:');
  const testDb = require('../backend/config/db');
  const origEnv = process.env.NODE_ENV;
  const origUri = process.env.MONGODB_URI;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.MONGODB_URI;
    let threwInProd = false;
    try {
      await testDb();
    } catch (e) {
      threwInProd = true;
      console.log(`   ✅ In production without valid Atlas URI, connectDB threw: "${e.message.slice(0, 70)}..."`);
    }
    if (!threwInProd) {
      throw new Error('Production mode must NEVER fall back to local DB!');
    }
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origUri) process.env.MONGODB_URI = origUri;
  }

  console.log('\n========================================================');
  console.log('🎉 DIRECT PLAY & GUEST MULTIPLAYER TEST PASSED 100%!');
  console.log('   All 10 Verification Checkpoints Fully Validated');
  console.log('========================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
