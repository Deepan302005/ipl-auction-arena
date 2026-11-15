const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const dotenv = require('../backend/node_modules/dotenv');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5000';

async function req(urlPath, method = 'GET', body = null, token = null) {
  const url = new URL(urlPath, BASE_URL);
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, body: json });
        } catch (_) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function runTests() {
  console.log('🏏 ============================================================');
  console.log('🧪 IPL AUCTION ARENA – EXPANDED DATABASE & SEASON POOL VERIFICATION');
  console.log('🏏 ============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [${total}/12] Passed: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [${total}/12] Failed: ${name}\n   Error: ${err.message}`);
    }
  }

  // 1. Expanded Database Verification
  console.log('📋 STEP 1: Expanded Database Verification...');
  const expandedPath = path.join(__dirname, '../backend/data/historical_players_expanded.json');
  const rawExpanded = JSON.parse(fs.readFileSync(expandedPath, 'utf8'));

  test('Expanded Database Record Count >= 811 verified players', () => {
    assert(rawExpanded.length >= 811, `Expected >= 811 players, found ${rawExpanded.length}`);
  });

  test('Verified Debutants and Modern Players Exist with Full Schema', () => {
    const checkNames = [
      'Mayank Yadav',
      'Nitish Kumar Reddy',
      'Jake Fraser-McGurk',
      'Rachin Ravindra',
      'Gerald Coetzee',
      'Vaibhav Suryavanshi',
      'Kamran Akmal',
      'Sohail Tanvir',
      'Shane Watson',
      'Ajinkya Rahane'
    ];

    for (const name of checkNames) {
      const p = rawExpanded.find(x => x.name === name);
      assert(p, `Player ${name} must exist in expanded database`);
      assert(p.role, `${name} must have playing role`);
      assert(p.country === 'India' || p.country === 'Overseas', `${name} country must be India or Overseas`);
      assert(Array.isArray(p.seasonsPlayed) && p.seasonsPlayed.length > 0, `${name} must have seasonsPlayed`);
      assert(p.basePriceCr >= 0.20, `${name} must have valid base price`);
    }
  });

  // Create Guest Host and Participant Sessions
  console.log('\n👤 STEP 2: Creating Test Guest Sessions...');
  const hostSession = await req('/api/auth/guest-session', 'POST', { displayName: 'Host Manager' });
  const hostToken = hostSession.body?.data?.token || hostSession.body?.token;
  assert(hostSession.status === 200 && hostToken, 'Failed to create host guest session');

  const partSession = await req('/api/auth/guest-session', 'POST', { displayName: 'Participant Manager' });
  const partToken = partSession.body?.data?.token || partSession.body?.token;
  assert(partSession.status === 200 && partToken, 'Failed to create participant session');

  // 2. Pool Preview API Verification
  console.log('\n📊 STEP 3: Preview Player Pool API Checks...');
  const previewAllTime = await req('/api/rooms/preview-pool', 'POST', {
    settings: { seasonMode: 'all-time' }
  });

  test('All-Time Pool Preview returns total count >= 800', () => {
    assert.strictEqual(previewAllTime.status, 200);
    assert(previewAllTime.body.breakdown.total >= 800, `Expected >= 800 players, got ${previewAllTime.body.breakdown.total}`);
    assert(previewAllTime.body.breakdown.indian > 0, 'Indian count > 0');
    assert(previewAllTime.body.breakdown.overseas > 0, 'Overseas count > 0');
  });

  const previewClassic = await req('/api/rooms/preview-pool', 'POST', {
    settings: { seasonMode: '2008-2015' }
  });

  test('2008-2015 Classic Era Pool Filter', () => {
    assert.strictEqual(previewClassic.status, 200);
    assert(previewClassic.body.breakdown.total > 200, 'Classic era total > 200');
    assert(previewClassic.body.breakdown.total < previewAllTime.body.breakdown.total, 'Classic era total is subset of all-time');
    assert.deepStrictEqual(previewClassic.body.effectiveSeasons, [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015]);
  });

  const previewModern = await req('/api/rooms/preview-pool', 'POST', {
    settings: { seasonMode: '2021-2026' }
  });

  test('2021-2026 Modern IPL Pool Filter', () => {
    assert.strictEqual(previewModern.status, 200);
    assert(previewModern.body.breakdown.total > 200, 'Modern era total > 200');
    assert.deepStrictEqual(previewModern.body.effectiveSeasons, [2021, 2022, 2023, 2024, 2025, 2026]);
  });

  const previewRange = await req('/api/rooms/preview-pool', 'POST', {
    settings: { seasonMode: 'range', selectedStartSeason: 2012, selectedEndSeason: 2018 }
  });

  test('Custom Season Range Filter (2012–2018)', () => {
    assert.strictEqual(previewRange.status, 200);
    assert.deepStrictEqual(previewRange.body.effectiveSeasons, [2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  });

  const previewIndividual = await req('/api/rooms/preview-pool', 'POST', {
    settings: { seasonMode: 'individual', selectedSeasons: [2018, 2024, 2025] }
  });

  test('Multiple Individual Seasons Filter (2018, 2024, 2025)', () => {
    assert.strictEqual(previewIndividual.status, 200);
    assert.deepStrictEqual(previewIndividual.body.effectiveSeasons, [2018, 2024, 2025]);
  });

  // 3. Room Creation with Custom Season Mode
  console.log('\n🏠 STEP 4: Room Creation & Queue Deduplication...');
  const createRes = await req('/api/rooms', 'POST', {
    roomName: 'Season Test Arena',
    displayName: 'Host Manager',
    hostName: 'Host Manager',
    isPrivate: false,
    settings: {
      seasonMode: '2021-2026',
      timerSeconds: 10,
      startingPurseCr: 120.0,
      maxQueueSize: 200
    }
  }, hostToken);

  const roomCode = createRes.body?.data?.roomCode;
  assert(roomCode, 'Room creation failed');

  test('Room Created with seasonMode 2021-2026 and Queue Built', () => {
    assert.strictEqual(createRes.status, 201);
    const room = createRes.body.data;
    assert.strictEqual(room.settings.seasonMode, '2021-2026');
    assert(room.auctionQueueCount > 0, 'Auction queue must be populated');
  });

  // 4. Player Deduplication Test in Queue
  test('Player Deduplication in Queue (Each Player Appears Exactly Once)', () => {
    const queue = createRes.body.data.auctionQueue || [];
    const seen = new Set();
    for (const id of queue) {
      const idStr = id.toString();
      assert(!seen.has(idStr), `Duplicate player ObjectId detected in auctionQueue: ${idStr}`);
      seen.add(idStr);
    }
  });

  // 5. Eligible Players List API with Search & Role Filter
  console.log('\n🔍 STEP 5: Eligible Players API & Search/Filter Controls...');
  const eligibleRes = await req(`/api/rooms/${roomCode}/eligible-players?search=Kohli`, 'GET', null, hostToken);

  test('Eligible Players Search & Filter for Room', () => {
    assert.strictEqual(eligibleRes.status, 200);
    assert(Array.isArray(eligibleRes.body.data), 'Eligible players must be an array');
    const match = eligibleRes.body.data.find(p => p.name.includes('Kohli'));
    assert(match, 'Virat Kohli should be found in eligible players search');
  });

  // 6. Host-Only Custom Player Pool Include/Exclude & Permissions
  console.log('\n🔒 STEP 6: Host Permissions & Player Pool Customization...');
  const kohliId = eligibleRes.body.data.find(p => p.name.includes('Kohli'))?._id;
  assert(kohliId, 'Player ID for Kohli required');

  // Test Non-Host exclusion (Must return 403 Forbidden)
  const nonHostExclusion = await req(`/api/rooms/${roomCode}/player-pool`, 'PUT', {
    action: 'exclude',
    playerId: kohliId
  }, partToken);

  test('Security Check: Non-Host cannot customize player pool (403 Forbidden)', () => {
    assert.strictEqual(nonHostExclusion.status, 403);
  });

  // Test Host exclusion
  const hostExclusion = await req(`/api/rooms/${roomCode}/player-pool`, 'PUT', {
    action: 'exclude',
    playerId: kohliId
  }, hostToken);

  test('Host Can Exclude a Player from Auction Pool', () => {
    assert.strictEqual(hostExclusion.status, 200);
    const excludedList = hostExclusion.body.data.settings.customExcludedPlayers || [];
    assert(excludedList.some(id => String(id) === String(kohliId)), 'Kohli should be in customExcludedPlayers');
  });

  // Test Host Reset Defaults
  const hostReset = await req(`/api/rooms/${roomCode}/player-pool`, 'PUT', {
    resetDefaults: true
  }, hostToken);

  test('Host Can Reset Player Pool to Defaults', () => {
    assert.strictEqual(hostReset.status, 200);
    const excludedList = hostReset.body.data.settings.customExcludedPlayers || [];
    assert.strictEqual(excludedList.length, 0, 'Excluded list should be empty after resetDefaults');
  });

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed}/${total} TESTS PASSED!`);
  console.log('============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
