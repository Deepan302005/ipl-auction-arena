/**
 * Automated Verification Test Suite for:
 * IPL Auction Arena – Complete Historical Auction Nominee Database (2008–2026)
 *
 * Verifies:
 * 1. Total canonical player profiles & flat auction records count across 19 editions (2008–2026).
 * 2. Young player verification with verified DOB (age <= 23 cutoff on auction date).
 * 3. Uncapped player classification (Indian and overseas uncapped).
 * 4. Non-debutant auction nominees (cricketers with hasPlayedIPL: false).
 * 5. GET /api/players/auction-records query filtering (year, result, uncapped, young).
 * 6. GET /api/players/:id/auctions player auction history retrieval.
 * 7. POST /api/rooms/preview-pool auction pool filtering.
 * 8. Host room queue creation and deduplication with auction filters.
 */

const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            raw: data
          });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🏏 ============================================================');
  console.log('🧪 IPL AUCTION ARENA – HISTORICAL AUCTION DATABASE AUDIT');
  console.log('🏏 ============================================================\n');

  let passed = 0;
  const total = 14;

  // STEP 1: Verify Master Database Counts
  console.log('📊 STEP 1: Verifying Master Database Counts & Model Integrity...');
  const playersRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players?limit=1',
    method: 'GET'
  });

  assert.strictEqual(playersRes.status, 200, 'Players API must return 200');
  const totalProfiles = playersRes.body?.pagination?.totalCount || 0;
  console.log(`   Found ${totalProfiles} canonical player profiles in database.`);
  assert(totalProfiles >= 884, `Expected at least 884 player profiles, got ${totalProfiles}`);
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Canonical Player Profile Count Verified (>= 884)`);

  // STEP 2: Query All-Time Auction Records & Coverage across 2008-2026
  console.log('\n📅 STEP 2: Verifying Historical Auction Records (2008–2026 Coverage)...');
  const auctionRecordsRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?limit=10',
    method: 'GET'
  });

  assert.strictEqual(auctionRecordsRes.status, 200, 'Auction records API must return 200');
  const totalAuctionRecords = auctionRecordsRes.body?.pagination?.totalCount || 0;
  console.log(`   Found ${totalAuctionRecords} flat historical auction records.`);
  assert(totalAuctionRecords >= 300, `Expected at least 300 auction records, got ${totalAuctionRecords}`);

  // Verify coverage includes 2008 and 2026
  const byYear = auctionRecordsRes.body?.summary?.byYear || {};
  const yearsPresent = Object.keys(byYear).map(Number);
  console.log(`   Auction Years Present in Archive: ${yearsPresent.join(', ')}`);
  assert(yearsPresent.includes(2008), 'Auction records must include 2008');
  assert(yearsPresent.includes(2025), 'Auction records must include 2025');
  assert(yearsPresent.includes(2026), 'Auction records must include 2026');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: 2008–2026 Historical Auction Edition Coverage Verified`);

  // STEP 3: Test Auction Records Filtering by Year (e.g. 2024 Dubai Auction)
  console.log('\n🔍 STEP 3: Testing Auction Records API Filtering (Year 2024)...');
  const year2024Res = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?year=2024&limit=50',
    method: 'GET'
  });
  assert.strictEqual(year2024Res.status, 200);
  assert(year2024Res.body.data.length > 0, 'Year 2024 must return records');
  const hasStarc2024 = year2024Res.body.data.some(r => r.playerName.includes('Starc'));
  assert(hasStarc2024, '2024 auction records must include Mitchell Starc record buy');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Specific Auction Year Query (2024 Dubai Auction) Verified`);

  // STEP 4: Test Auction Records Filtering by Result (Sold vs Unsold)
  console.log('\n⚖️ STEP 4: Testing Sold vs Unsold Auction Records Filter...');
  const soldRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?result=sold&limit=20',
    method: 'GET'
  });
  assert.strictEqual(soldRes.status, 200);
  assert(soldRes.body.data.every(r => r.auctionResult === 'sold'), 'All records must be sold');

  const unsoldRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?result=unsold&limit=20',
    method: 'GET'
  });
  assert.strictEqual(unsoldRes.status, 200);
  assert(unsoldRes.body.data.every(r => r.auctionResult === 'unsold'), 'All records must be unsold');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Sold and Unsold Status Filtering Verified`);

  // STEP 5: Test Young Player Classification (DOB & Age <= 23)
  console.log('\n🌟 STEP 5: Testing Young Emerging Player Filter (≤23 with DOB)...');
  const youngRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?isYoung=true&limit=30',
    method: 'GET'
  });
  assert.strictEqual(youngRes.status, 200);
  assert(youngRes.body.data.length > 0, 'Must return young players');
  for (const yr of youngRes.body.data) {
    assert.strictEqual(yr.isYoungPlayer, true, `Player ${yr.playerName} must have isYoungPlayer: true`);
    assert(yr.dateOfBirth, `Young player ${yr.playerName} must have verified dateOfBirth`);
    assert(yr.ageAtAuction <= 23, `Young player ${yr.playerName} age at auction must be <= 23`);
  }
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Young Player Verification (DOB & Age <= 23) Strictly Enforced`);

  // STEP 6: Test Uncapped Players Filter
  console.log('\n⚡ STEP 6: Testing Uncapped Player Nominee Filter...');
  const uncappedRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?isUncapped=true&limit=30',
    method: 'GET'
  });
  assert.strictEqual(uncappedRes.status, 200);
  assert(uncappedRes.body.data.length > 0, 'Must return uncapped player records');
  assert(uncappedRes.body.data.every(r => r.isUncapped === true), 'All records must be uncapped');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Uncapped Nominees Successfully Filtered`);

  // STEP 7: Test Non-Debutants (Cricketers who never played an IPL match)
  console.log('\n📋 STEP 7: Testing Non-Debutants (Auction Nominees Who Never Played IPL)...');
  const nonDebutantsRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/auction-records?nonDebutantsOnly=true&limit=30',
    method: 'GET'
  });
  assert.strictEqual(nonDebutantsRes.status, 200);
  assert(nonDebutantsRes.body.data.length > 0, 'Must return non-debutant records');
  assert(nonDebutantsRes.body.data.every(r => r.hasPlayedIPL === false), 'All returned must have hasPlayedIPL: false');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Non-Debutant Auction Nominees Correctly Retained with hasPlayedIPL: false`);

  // STEP 8: Test Player Auction History Endpoint
  console.log('\n📜 STEP 8: Testing GET /api/players/:id/auctions...');
  const pantHistoryRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/players/Rishabh%20Pant/auctions',
    method: 'GET'
  });
  assert.strictEqual(pantHistoryRes.status, 200);
  assert.strictEqual(pantHistoryRes.body.player.name, 'Rishabh Pant');
  assert(Array.isArray(pantHistoryRes.body.auctionHistory), 'Must return auctionHistory array');
  assert(pantHistoryRes.body.auctionHistory.length >= 2, 'Rishabh Pant should have multiple auction appearances (2016, 2025)');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Player Historical Auction Appearances Endpoint Verified`);

  // STEP 9: Test Preview Pool API with Auction Pool Filter (young-uncapped)
  console.log('\n🎯 STEP 9: Testing POST /api/rooms/preview-pool with auctionPoolFilter: young-uncapped...');
  const previewYoungRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/rooms/preview-pool',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    settings: {
      seasonMode: 'all-time',
      auctionPoolFilter: 'young-uncapped'
    }
  });
  assert.strictEqual(previewYoungRes.status, 200);
  assert(previewYoungRes.body.breakdown.total > 0, 'Must return young uncapped players in preview');
  assert(previewYoungRes.body.players.every(p => p.isUncapped && p.isYoungPlayer), 'All preview players must be young and uncapped');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Preview Pool with young-uncapped Filter Verified`);

  // STEP 10: Test Preview Pool API with auctionPoolFilter: nominees-only
  console.log('\n🎯 STEP 10: Testing POST /api/rooms/preview-pool with auctionPoolFilter: nominees-only...');
  const previewNomineesRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/rooms/preview-pool',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    settings: {
      seasonMode: 'all-time',
      auctionPoolFilter: 'nominees-only'
    }
  });
  assert.strictEqual(previewNomineesRes.status, 200);
  assert(previewNomineesRes.body.breakdown.total > 0, 'Must return non-debutant nominees');
  assert(previewNomineesRes.body.players.every(p => p.hasPlayedIPL === false), 'All preview players must have hasPlayedIPL: false');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Preview Pool with nominees-only Filter Verified`);

  // STEP 11: Create Host Session & Room with Custom Auction Filters
  console.log('\n🏠 STEP 11: Creating Room with Custom Auction Nominee Settings...');
  const hostSessionRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/auth/guest-session',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'AuctionMaster' });

  assert.strictEqual(hostSessionRes.status, 200);
  const hostToken = hostSessionRes.body?.data?.token || hostSessionRes.body?.token;
  assert(hostToken, 'Host token must exist');

  const createRoomRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/rooms',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hostToken}`
    }
  }, {
    roomName: 'Historical Mega Auction Arena',
    settings: {
      auctionPoolFilter: 'young-uncapped',
      filterYoungOnly: true,
      maxQueueSize: 50
    }
  });

  assert.strictEqual(createRoomRes.status, 201, 'Room must be created with 201');
  const roomCode = createRoomRes.body.data.roomCode;
  const queueCount = createRoomRes.body.data.auctionQueueCount;
  console.log(`   Created Room: ${roomCode} with queue count: ${queueCount}`);
  assert(queueCount > 0, 'Queue count must be > 0');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Room Creation with Custom Auction Nominee Filters Verified`);

  // STEP 12: Verify Queue Deduplication (Each player ObjectId unique)
  console.log('\n🔄 STEP 12: Verifying In-Room Queue Deduplication...');
  const getRoomRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: `/api/rooms/${roomCode}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${hostToken}` }
  });

  assert.strictEqual(getRoomRes.status, 200);
  const rawQueue = getRoomRes.body.data.auctionQueue;
  const queueIds = Array.isArray(rawQueue) ? rawQueue.map(p => (p._id || p).toString()) : [];
  const uniqueQueueIds = new Set(queueIds);
  assert.strictEqual(queueIds.length, uniqueQueueIds.size, 'Queue must not contain duplicate player IDs');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Zero Queue Duplication Verified (${queueIds.length}/${uniqueQueueIds.size} unique)`);

  // STEP 13: Test Eligible Players API with Uncapped & Young Flags
  console.log('\n🔍 STEP 13: Testing GET /api/rooms/:roomCode/eligible-players with flags...');
  const eligibleRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: `/api/rooms/${roomCode}/eligible-players?uncapped=true&young=true`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${hostToken}` }
  });

  assert.strictEqual(eligibleRes.status, 200);
  assert(eligibleRes.body.data.length > 0, 'Must return eligible players');
  for (const ep of eligibleRes.body.data) {
    assert.strictEqual(ep.isUncapped, true, `${ep.name} must be uncapped`);
    assert.strictEqual(ep.isYoungPlayer, true, `${ep.name} must be young`);
  }
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Room Eligible Players API with Query Flags Verified`);

  // STEP 14: Non-Host Protection & Update Room Settings
  console.log('\n🔒 STEP 14: Testing Host-Only Protection for Auction Pool Modifications...');
  const guestSessionRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: '/api/auth/guest-session',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'UnauthorizedGuest' });

  const guestToken = guestSessionRes.body?.data?.token || guestSessionRes.body?.token;

  // Non-host attempts to modify settings
  const nonHostUpdateRes = await httpRequest({
    host: '127.0.0.1',
    port: 5000,
    path: `/api/rooms/${roomCode}/settings`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${guestToken}`
    }
  }, {
    settings: { auctionPoolFilter: 'all' }
  });

  assert.strictEqual(nonHostUpdateRes.status, 403, 'Non-host must be rejected with 403 Forbidden');
  passed++;
  console.log(`✅ [${passed}/${total}] Passed: Host-Only Security Protection Verified (403 Forbidden on Unauthorized Access)`);

  console.log('\n============================================================');
  console.log(`🏁 AUDIT COMPLETE: ${passed}/${total} TESTS PASSED (100%)!`);
  console.log('============================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
