const http = require('http');
const path = require('path');
const ioClient = require('socket.io-client');
const jwt = require(path.resolve(__dirname, '../backend/node_modules/jsonwebtoken'));

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
  console.log('🛡️  IPL AUCTION ARENA – GUEST SECURITY & MULTIPLAYER AUDIT');
  console.log('🏏 ========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(title, condition, extra = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [TEST ${totalTests}] ${title} ${extra ? `(${extra})` : ''}`);
    } else {
      console.error(`❌ [TEST ${totalTests} FAILED] ${title} ${extra ? `(${extra})` : ''}`);
      throw new Error(`Assertion failed: ${title}`);
    }
  }

  // =========================================================================
  // SECTION A: GUEST IDENTITY SECURITY
  // =========================================================================
  console.log('--- SECTION A: GUEST IDENTITY SECURITY ---');

  // Reset rate limits for test suite start
  await makeRequest('/api/auth/reset-rate-limit', 'POST');

  // Test 1: New Guest Session Issuance with Cryptographic Secret
  const g1Res = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Authorized Host (Alice)',
    favoriteTeam: 'CSK'
  });
  if (g1Res.status !== 200) {
    console.log('g1Res ERROR:', g1Res.status, g1Res.data);
  }
  const g1 = g1Res.data?.data;
  assert(
    'Issuance of guest session with unique guestId, sessionSecret, and token',
    g1Res.status === 200 &&
    typeof g1?.guestId === 'string' &&
    g1.guestId.startsWith('guest_') &&
    typeof g1?.sessionSecret === 'string' &&
    g1.sessionSecret.length === 64 && // 32 bytes hex
    typeof g1?.token === 'string',
    `guestId: ${g1?.guestId}, secretLen: ${g1?.sessionSecret?.length}`
  );

  // Test 2: Guest Impersonation Prevention (Bare guestId without secret)
  const impersonateBare = await makeRequest('/api/auth/guest-session', 'POST', {
    guestId: g1.guestId,
    displayName: 'Malicious Attacker (Eve)'
  });
  assert(
    'Anti-Impersonation: Bare guestId without sessionSecret is rejected with 401',
    impersonateBare.status === 401 && impersonateBare.data?.code === 'UNAUTHORIZED_GUEST_ACCESS',
    `Status: ${impersonateBare.status}`
  );

  // Test 3: Guest Impersonation Prevention (Incorrect sessionSecret)
  const impersonateWrongSecret = await makeRequest('/api/auth/guest-session', 'POST', {
    guestId: g1.guestId,
    sessionSecret: '0000000000000000000000000000000000000000000000000000000000000000',
    displayName: 'Malicious Attacker (Eve)'
  });
  assert(
    'Anti-Impersonation: Wrong sessionSecret is rejected with 401',
    impersonateWrongSecret.status === 401 && impersonateWrongSecret.data?.code === 'UNAUTHORIZED_GUEST_ACCESS',
    `Status: ${impersonateWrongSecret.status}`
  );

  // Test 4: Legitimate Session Restoration (With matching sessionSecret)
  const restoreLegit = await makeRequest('/api/auth/guest-session', 'POST', {
    guestId: g1.guestId,
    sessionSecret: g1.sessionSecret,
    displayName: 'Authorized Host (Alice Updated)'
  });
  assert(
    'Legitimate guest session restoration with matching secret succeeds',
    restoreLegit.status === 200 &&
    restoreLegit.data?.data?._id === g1._id &&
    restoreLegit.data?.data?.guestId === g1.guestId,
    `Restored _id: ${restoreLegit.data?.data?._id}`
  );

  // Test 5: Middleware Rejection of Unauthenticated X-Guest-Id header
  const fakeHeaderReq = await makeRequest('/api/auth/me', 'GET', null, {
    'x-guest-id': g1.guestId // Impersonation attempt via header without token or secret
  });
  assert(
    'Middleware: Bare X-Guest-Id header without cryptographic credentials rejected with 401',
    fakeHeaderReq.status === 401,
    `Status: ${fakeHeaderReq.status}`
  );

  // Test 6: Middleware Acceptance of Cryptographic (x-guest-id + x-guest-secret)
  const legitSecretHeaderReq = await makeRequest('/api/auth/me', 'GET', null, {
    'x-guest-id': g1.guestId,
    'x-guest-secret': g1.sessionSecret
  });
  assert(
    'Middleware: Valid (x-guest-id + x-guest-secret) successfully authenticates',
    legitSecretHeaderReq.status === 200 && legitSecretHeaderReq.data?.data?._id === g1._id,
    `Status: ${legitSecretHeaderReq.status}`
  );

  // Test 7: JWT Tampering & Signature Validation
  const [h, p, s] = g1.token.split('.');
  const forgedToken = `${h}.${p}.TAMPERED_INVALID_SIGNATURE_FORGERY_ATTEMPT`;
  const tamperedReq = await makeRequest('/api/auth/me', 'GET', null, {
    Authorization: `Bearer ${forgedToken}`
  });
  assert(
    'JWT Security: Tampered signature is strictly rejected with 401',
    tamperedReq.status === 401,
    `Status: ${tamperedReq.status}`
  );

  // Create Guest 2 (Player Bob)
  const g2Res = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Player (Bob)',
    favoriteTeam: 'MI'
  });
  const g2 = g2Res.data?.data;

  // Create Guest 3 (Spectator Charlie)
  const g3Res = await makeRequest('/api/auth/guest-session', 'POST', {
    displayName: 'Spectator (Charlie)',
    favoriteTeam: 'RCB'
  });
  const g3 = g3Res.data?.data;

  // Test 8: Rate Limiting on Guest Session Creation
  console.log('   Testing sliding-window rate limiter...');
  let hitRateLimit = false;
  let rateLimitResponse = null;
  for (let i = 0; i < 35; i++) {
    const res = await makeRequest('/api/auth/guest-session', 'POST', {
      displayName: `SpamBot_${i}`
    });
    if (res.status === 429) {
      hitRateLimit = true;
      rateLimitResponse = res;
      break;
    }
  }
  assert(
    'Rate Limiting: Exceeding 30 requests/min returns 429 Too Many Requests',
    hitRateLimit && rateLimitResponse?.status === 429,
    `Status: ${rateLimitResponse?.status}, Retry-After: ${rateLimitResponse?.headers?.['retry-after']}`
  );

  // Reset rate limits for test suite continuation
  await makeRequest('/api/auth/reset-rate-limit', 'POST');

  // =========================================================================
  // SECTION B: MULTIPLAYER SECURITY & PERMISSIONS
  // =========================================================================
  console.log('\n--- SECTION B: MULTIPLAYER SECURITY & PERMISSIONS ---');

  // Test 10: Private Room Passcode Non-Exposure in Public APIs
  const privRoomRes = await makeRequest('/api/rooms', 'POST', {
    roomName: 'VIP Private Auction',
    displayName: g1.name,
    isPrivate: true,
    passcode: 'TOPSECRET_12345'
  }, {
    Authorization: `Bearer ${g1.token}`
  });
  const privRoom = privRoomRes.data?.data;
  const privCode = privRoom?.roomCode;

  // Check room list API
  const listRes = await makeRequest('/api/rooms', 'GET');
  const foundPrivInList = listRes.data?.data?.find(r => r.roomCode === privCode);
  const detailRes = await makeRequest(`/api/rooms/${privCode}`, 'GET');

  assert(
    'Privacy: Room passcode is strictly omitted from create, list, and detail API responses',
    privRoom?.passcode === undefined &&
    foundPrivInList?.passcode === undefined &&
    detailRes.data?.data?.passcode === undefined,
    `Create: ${privRoom?.passcode}, List: ${foundPrivInList?.passcode}, Detail: ${detailRes.data?.data?.passcode}`
  );

  // Test 11: Private Room Passcode Enforcement (Wrong Passcode)
  const joinBadPass = await makeRequest(`/api/rooms/${privCode}/join`, 'POST', {
    passcode: 'WRONG_PASS'
  }, {
    Authorization: `Bearer ${g2.token}`
  });
  assert(
    'Private Room: Incorrect passcode rejected with 403 Forbidden',
    joinBadPass.status === 403,
    `Status: ${joinBadPass.status}`
  );

  // Test 12: Bypassing Passcode via Direct Franchise Claiming Blocked
  const bypassClaim = await makeRequest(`/api/rooms/${privCode}/claim`, 'POST', {
    franchiseCode: 'MI'
  }, {
    Authorization: `Bearer ${g2.token}` // Has not joined private room
  });
  assert(
    'Private Room Security: Direct franchise claim without joining with passcode is blocked (403)',
    bypassClaim.status === 403 && bypassClaim.data?.code === 'PRIVATE_ROOM_NOT_JOINED',
    `Status: ${bypassClaim.status}, Code: ${bypassClaim.data?.code}`
  );

  // Test 13: Private Room Join with Correct Passcode
  const joinGoodPass = await makeRequest(`/api/rooms/${privCode}/join`, 'POST', {
    passcode: 'TOPSECRET_12345'
  }, {
    Authorization: `Bearer ${g2.token}`
  });
  assert(
    'Private Room: Correct passcode allows joining with 200 Success',
    joinGoodPass.status === 200,
    `Status: ${joinGoodPass.status}`
  );

  // Now create standard public auction room for bidding tests
  const pubRoomRes = await makeRequest('/api/rooms', 'POST', {
    roomName: 'Championship Live Arena',
    displayName: g1.name,
    autoClaimTeam: 'CSK',
    isPrivate: false,
    settings: {
      timerSeconds: 5,
      bidExtensionSeconds: 5,
      startingPurseCr: 120,
      incrementLadderType: 'official'
    }
  }, {
    Authorization: `Bearer ${g1.token}`
  });
  const roomCode = pubRoomRes.data?.data?.roomCode;

  // Guest 2 (Bob) joins public room and claims MI
  await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', { displayName: g2.name }, {
    Authorization: `Bearer ${g2.token}`
  });
  await makeRequest(`/api/rooms/${roomCode}/claim`, 'POST', { franchiseCode: 'MI' }, {
    Authorization: `Bearer ${g2.token}`
  });

  // Guest 3 (Charlie) joins public room as spectator (no franchise claimed)
  await makeRequest(`/api/rooms/${roomCode}/join`, 'POST', { displayName: g3.name }, {
    Authorization: `Bearer ${g3.token}`
  });

  // Test 14: Non-Host Settings Update Blocked (REST)
  const nonHostSettings = await makeRequest(`/api/rooms/${roomCode}/settings`, 'PUT', {
    timerSeconds: 30
  }, {
    Authorization: `Bearer ${g2.token}`
  });
  assert(
    'Host Authorization: Non-host updating settings rejected with 403 Forbidden',
    nonHostSettings.status === 403,
    `Status: ${nonHostSettings.status}`
  );

  // Connect WebSockets
  const hostSocket = ioClient(BASE_URL, {
    auth: { token: g1.token, guestId: g1.guestId, sessionSecret: g1.sessionSecret },
    transports: ['websocket']
  });
  const playerSocket = ioClient(BASE_URL, {
    auth: { token: g2.token, guestId: g2.guestId, sessionSecret: g2.sessionSecret },
    transports: ['websocket']
  });
  const spectatorSocket = ioClient(BASE_URL, {
    auth: { token: g3.token, guestId: g3.guestId, sessionSecret: g3.sessionSecret },
    transports: ['websocket']
  });

  await Promise.all([
    new Promise(r => hostSocket.once('connect', r)),
    new Promise(r => playerSocket.once('connect', r)),
    new Promise(r => spectatorSocket.once('connect', r))
  ]);

  hostSocket.emit('room:join', { roomCode });
  playerSocket.emit('room:join', { roomCode });
  spectatorSocket.emit('room:join', { roomCode });
  await delay(400);

  // Test 15: Non-Host Starting Auction via Socket Blocked
  let nonHostStartError = null;
  playerSocket.once('auction:error', (err) => { nonHostStartError = err; });
  playerSocket.emit('auction:start', { roomCode });
  await delay(400);
  assert(
    'Socket Security: Non-host starting auction is blocked',
    nonHostStartError && nonHostStartError.message?.includes('Only the room host'),
    `Msg: ${nonHostStartError?.message}`
  );

  // Verified Host starts auction
  let auctionStarted = false;
  playerSocket.once('auction:started', () => { auctionStarted = true; });
  hostSocket.emit('auction:start', { roomCode });
  await delay(600);
  assert(
    'Host Authorization: Verified host successfully starts the live auction',
    auctionStarted === true
  );

  // Test 16: Non-Host Pausing Auction Blocked
  let nonHostPauseError = null;
  playerSocket.once('auction:error', (err) => { nonHostPauseError = err; });
  playerSocket.emit('auction:pause', { roomCode });
  await delay(400);
  assert(
    'Socket Security: Non-host pausing auction is blocked',
    nonHostPauseError && nonHostPauseError.message?.includes('Only the room host'),
    `Msg: ${nonHostPauseError?.message}`
  );

  // Test 17: Non-Host Ending Auction Blocked
  let nonHostEndError = null;
  playerSocket.once('auction:error', (err) => { nonHostEndError = err; });
  playerSocket.emit('auction:end', { roomCode });
  await delay(400);
  assert(
    'Socket Security: Non-host ending auction is blocked',
    nonHostEndError && nonHostEndError.message?.includes('Only the room host'),
    `Msg: ${nonHostEndError?.message}`
  );

  // Test 18: Spectator Bidding Blocked (No claimed franchise)
  let spectatorBidError = null;
  spectatorSocket.once('auction:bidRejected', (err) => { spectatorBidError = err; });
  spectatorSocket.emit('auction:bid', { roomCode, franchiseCode: 'RCB' });
  await delay(400);
  assert(
    'Bidding Security: Spectator bidding without claimed paddle is rejected',
    spectatorBidError && spectatorBidError.reason?.includes('not the manager'),
    `Reason: ${spectatorBidError?.reason}`
  );

  // Test 19: Bidding for Another Manager\'s Franchise Blocked
  let wrongPaddleBidError = null;
  playerSocket.once('auction:bidRejected', (err) => { wrongPaddleBidError = err; });
  playerSocket.emit('auction:bid', { roomCode, franchiseCode: 'CSK' }); // Bob (MI) attempts to bid as CSK
  await delay(400);
  assert(
    'Bidding Security: Bidding for another franchise paddle is rejected',
    wrongPaddleBidError && wrongPaddleBidError.reason?.includes('not the manager of Chennai Super Kings'),
    `Reason: ${wrongPaddleBidError?.reason}`
  );

  // Test 20: Valid Bid Accepted
  let validBidReceived = null;
  hostSocket.once('auction:bidPlaced', (data) => { validBidReceived = data; });
  playerSocket.emit('auction:bid', { roomCode, franchiseCode: 'MI' }); // Bob bids for MI
  await delay(600);
  assert(
    'Bidding Engine: Legitimate paddle bid for owned franchise is accepted and broadcasted',
    validBidReceived && validBidReceived.currentBidderFranchise === 'MI' && validBidReceived.currentBidCr > 0,
    `Bid: ₹${validBidReceived?.currentBidCr} Cr by ${validBidReceived?.currentBidderFranchise}`
  );

  // Test 21: Consecutive Own-Franchise Outbidding Blocked
  let consecutiveBidError = null;
  playerSocket.once('auction:bidRejected', (err) => { consecutiveBidError = err; });
  playerSocket.emit('auction:bid', { roomCode, franchiseCode: 'MI' }); // Bob tries to bid again while holding top bid
  await delay(400);
  assert(
    'Bidding Integrity: Consecutive outbidding of own franchise is blocked',
    consecutiveBidError && consecutiveBidError.reason?.includes('already holds the highest active bid'),
    `Reason: ${consecutiveBidError?.reason}`
  );

  // Counter-bid by Host (CSK)
  let counterBidReceived = null;
  playerSocket.once('auction:bidPlaced', (data) => { counterBidReceived = data; });
  hostSocket.emit('auction:bid', { roomCode, franchiseCode: 'CSK' });
  await delay(600);
  assert(
    'Bidding Engine: Counter-bid by another manager successfully updates podium',
    counterBidReceived && counterBidReceived.currentBidderFranchise === 'CSK',
    `Counter-bid: ₹${counterBidReceived?.currentBidCr} Cr`
  );

  // Wait for countdown to finish & hammer drop
  console.log('   Waiting for server-authoritative countdown & hammer drop...');
  let soldNotice = null;
  playerSocket.once('auction:playerSold', (data) => { soldNotice = data; });
  await delay(6500);

  assert(
    'Countdown & Hammer Drop: Player successfully sold to top bidder upon countdown completion',
    soldNotice && soldNotice.franchiseCode === 'CSK',
    `Sold to ${soldNotice?.franchiseCode} for ₹${soldNotice?.soldPriceCr} Cr`
  );

  // Test 22: Stable Identity Reconnection (Second Connection / Tab)
  const reconnectSocket = ioClient(BASE_URL, {
    auth: { token: g2.token, guestId: g2.guestId, sessionSecret: g2.sessionSecret },
    transports: ['websocket']
  });
  await new Promise(r => reconnectSocket.once('connect', r));
  reconnectSocket.emit('room:join', { roomCode });
  await delay(400);

  const roomCheck = await makeRequest(`/api/rooms/${roomCode}`, 'GET');
  const participants = roomCheck.data?.data?.participants || [];
  const miSlot = roomCheck.data?.data?.franchises?.find(f => f.code === 'MI');

  assert(
    'Reconnection Security: Reconnecting client retains exact same paddle ownership and prevents duplicate participants',
    participants.length === 3 && miSlot?.claimedBy === g2._id,
    `Total participants: ${participants.length}, MI owner: ${miSlot?.claimedByName}`
  );

  hostSocket.disconnect();
  playerSocket.disconnect();
  spectatorSocket.disconnect();
  reconnectSocket.disconnect();

  console.log('\n========================================================');
  console.log(`🎯 AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('========================================================\n');
}

run().catch((err) => {
  console.error('\n❌ Security audit failed:', err);
  process.exit(1);
});
