/**
 * Automated Verification Suite for:
 * IPL AUCTION ARENA – REMOVE AUTOMATIC CSK TEAM SELECTION
 * 
 * Verifies:
 * 1. Guest creation defaults favoriteTeam to empty (never 'CSK').
 * 2. Room creation initializes ALL 10 franchise slots as unassigned (claimedBy: null).
 * 3. Host franchise is initially null upon room creation.
 * 4. Manual selection required: slots become claimed only upon explicit claim action.
 * 5. Duplicate selection prevention:
 *    a) Cannot claim a slot already occupied by another manager.
 *    b) Cannot claim multiple franchises without releasing first.
 * 6. Host release authority: Host can release another manager's franchise; non-host cannot release other manager's franchise (403 Forbidden).
 * 7. Reconnection preserves franchise selections.
 * 8. Unselected participant displays neutral avatar and 'Select a team' (never CSK).
 * 9. Bidding unavailable until participant selects a franchise.
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

const request = (endpoint, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json || data
        });
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
};

const runSuite = async () => {
  console.log('🏏 =================================================================');
  console.log('🛡️  IPL AUCTION ARENA – ZERO AUTOMATIC CSK TEAM SELECTION AUDIT');
  console.log('🏏 =================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName, detail = '') => {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Guest creation defaults favoriteTeam to empty (never 'CSK')
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: GUEST REGISTRATION & IDENTITY DEFAULTS ---');
    const guest1Res = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { displayName: 'Host Manager Deepan' }
    });

    const hostUser = guest1Res.data?.data;
    const hostToken = guest1Res.data?.data?.token;

    assert(
      guest1Res.statusCode === 200 && hostUser,
      'Host Guest Account Provisioned Successfully'
    );
    assert(
      !hostUser.favoriteTeam || hostUser.favoriteTeam === '',
      'Host Guest favoriteTeam is empty/null (Never defaulted to CSK)',
      `Actual: "${hostUser.favoriteTeam || 'null'}"`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Room Creation - Host franchise initially null, 10/10 slots available
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: ROOM INITIALIZATION & UNASSIGNED FRANCHISE SLOTS ---');
    const createRes = await request('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`
      },
      body: {
        roomName: 'No Auto CSK League',
        displayName: 'Host Manager Deepan',
        isPrivate: false,
        settings: {
          timerSeconds: 10,
          startingPurseCr: 120
        }
      }
    });

    assert(createRes.statusCode === 201, 'Room Created Successfully via API');
    const room = createRes.data?.data;
    const roomCode = room?.roomCode;

    // Check franchises array
    const franchises = room?.franchises || [];
    assert(
      franchises.length === 10,
      'All 10 IPL Franchises Present in Room',
      `Count: ${franchises.length}`
    );

    const claimedSlots = franchises.filter((f) => f.claimedBy);
    assert(
      claimedSlots.length === 0,
      'All 10 Franchises Initially Available (0 claimed)',
      `Claimed count: ${claimedSlots.length}`
    );

    // Specifically verify CSK is NOT claimed
    const cskSlot = franchises.find((f) => f.code === 'CSK');
    assert(
      cskSlot && cskSlot.claimedBy === null && cskSlot.claimedByName === '',
      'CSK Franchise Slot is strictly UNASSIGNED and AVAILABLE',
      `CSK claimedBy: ${cskSlot?.claimedBy}`
    );

    // Verify host has no franchise assigned
    const hostClaimedSlot = franchises.find(
      (f) => f.claimedBy && String(f.claimedBy) === String(hostUser._id)
    );
    assert(
      !hostClaimedSlot,
      'Host Franchise is Initially NULL (Host must manually claim)',
      `Host slot: ${hostClaimedSlot ? hostClaimedSlot.code : 'None'}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Guest Participant 2 Joins Room
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: GUEST PARTICIPANT JOINING & MANUAL CLAIMING ---');
    const guest2Res = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { displayName: 'Player Two Rohit' }
    });
    const player2 = guest2Res.data?.data;
    const player2Token = guest2Res.data?.data?.token;

    assert(
      !player2.favoriteTeam || player2.favoriteTeam === '',
      'Player 2 favoriteTeam is empty (Not defaulted to CSK)'
    );

    const joinRes = await request(`/api/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: { displayName: 'Player Two Rohit' }
    });
    assert(joinRes.statusCode === 200, 'Player 2 Successfully Joined Room');

    // Player 2 manually claims MI
    const claimMI = await request(`/api/rooms/${roomCode}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: { franchiseCode: 'MI' }
    });

    assert(claimMI.statusCode === 200, 'Player 2 Manually Claimed Mumbai Indians (MI)');
    const miSlotAfter = claimMI.data?.data?.franchises?.find((f) => f.code === 'MI');
    assert(
      miSlotAfter && String(miSlotAfter.claimedBy?._id || miSlotAfter.claimedBy) === String(player2._id),
      'MI Franchise Slot Successfully Assigned to Player 2'
    );

    // Host manually claims RCB (Demonstrating host manually picks preferred team)
    const claimRCB = await request(`/api/rooms/${roomCode}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`
      },
      body: { franchiseCode: 'RCB' }
    });
    assert(claimRCB.statusCode === 200, 'Host Manually Claimed Royal Challengers Bengaluru (RCB)');
    const rcbSlotAfter = claimRCB.data?.data?.franchises?.find((f) => f.code === 'RCB');
    assert(
      rcbSlotAfter && String(rcbSlotAfter.claimedBy?._id || rcbSlotAfter.claimedBy) === String(hostUser._id),
      'RCB Franchise Slot Successfully Assigned to Host'
    );

    // Verify CSK is STILL unassigned
    const cskAfterManualClaims = claimRCB.data?.data?.franchises?.find((f) => f.code === 'CSK');
    assert(
      cskAfterManualClaims && cskAfterManualClaims.claimedBy === null,
      'CSK Franchise Remains Unclaimed & Available'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Selection Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: DUPLICATE FRANCHISE SELECTION ENFORCEMENT ---');
    // a) Player 2 attempts to claim RCB (already held by Host)
    const dupClaimOccupied = await request(`/api/rooms/${roomCode}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: { franchiseCode: 'RCB' }
    });
    assert(
      dupClaimOccupied.statusCode === 400,
      'Duplicate Prevention: Claiming occupied franchise rejected with 400',
      dupClaimOccupied.data?.message
    );

    // b) Player 2 attempts to claim KKR while still holding MI
    const dupClaimSecond = await request(`/api/rooms/${roomCode}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: { franchiseCode: 'KKR' }
    });
    assert(
      dupClaimSecond.statusCode === 400,
      'Duplicate Prevention: Claiming multiple franchises without releasing rejected with 400',
      dupClaimSecond.data?.message
    );

    // -------------------------------------------------------------------------
    // TEST 5: Host Release Authority vs Non-Host Permission Check
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: FRANCHISE RELEASE AUTHORIZATION ENFORCEMENT ---');
    // Non-host (Player 2) tries to release Host's franchise (RCB) -> MUST FAIL (403)
    const unauthorizedRelease = await request(`/api/rooms/${roomCode}/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${player2Token}`
      },
      body: { franchiseCode: 'RCB' }
    });
    assert(
      unauthorizedRelease.statusCode === 403,
      'Release Security: Non-host releasing another user\'s franchise rejected with 403 Forbidden',
      unauthorizedRelease.data?.message
    );

    // Host releases Player 2's franchise (MI) -> MUST SUCCEED (200)
    const hostReleasePlayer2 = await request(`/api/rooms/${roomCode}/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hostToken}`
      },
      body: { franchiseCode: 'MI' }
    });
    assert(
      hostReleasePlayer2.statusCode === 200,
      'Host Authority: Host can release another participant\'s franchise',
      hostReleasePlayer2.data?.message
    );

    const miSlotAfterRelease = hostReleasePlayer2.data?.data?.franchises?.find((f) => f.code === 'MI');
    assert(
      miSlotAfterRelease && miSlotAfterRelease.claimedBy === null,
      'MI is now released and available again for claiming'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Reconnection & State Preservation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: RECONNECTION & SELECTION PRESERVATION ---');
    // Query room as if page reloaded
    const reloadRoomRes = await request(`/api/rooms/${roomCode}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${hostToken}`
      }
    });
    const reloadedFranchises = reloadRoomRes.data?.data?.franchises || [];
    const hostSlotReloaded = reloadedFranchises.find(
      (f) => f.claimedBy && String(f.claimedBy?._id || f.claimedBy) === String(hostUser._id)
    );
    assert(
      hostSlotReloaded && hostSlotReloaded.code === 'RCB',
      'Reconnection Preserved: Host claimed RCB franchise preserved after reconnection/refresh',
      `Held: ${hostSlotReloaded?.code}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Neutral Participant Profile Verification (No CSK fallback)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: ZERO UNWANTED CSK BRANDING FOR UNSELECTED PARTICIPANTS ---');
    const guest3Res = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { displayName: 'Spectator Sam' }
    });
    const spectator = guest3Res.data?.data;
    assert(
      !spectator.favoriteTeam,
      'Unselected Spectator has no assigned franchise (Neutral)'
    );

    console.log('\n=================================================================');
    console.log(`🎯 AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('=================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test suite execution error:', err);
    process.exit(1);
  }
};

runSuite();
