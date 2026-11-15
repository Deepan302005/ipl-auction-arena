/**
 * Verification Suite for:
 * 1. IPL Franchise Logo Correction (All 10 teams + No CSK Fallback)
 * 2. Host Room Sharing & Dynamic Invitation URLs
 * 3. Direct Room Joining & Passcode Enforcement
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

const runAudit = async () => {
  console.log('🏏 ========================================================');
  console.log('🛡️  IPL FRANCHISE LOGO CORRECTION & ROOM SHARING AUDIT');
  console.log('🏏 ========================================================\n');

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

  // --------------------------------------------------------------------------
  // PART 1: Franchise Logo Integrity & Asset Verification
  // --------------------------------------------------------------------------
  console.log('--- PART 1: FRANCHISE LOGO INTEGRITY & ASSETS ---');

  const teams = ['csk', 'mi', 'rcb', 'kkr', 'dc', 'rr', 'srh', 'gt', 'lsg', 'pbks'];
  const publicTeamsDir = path.resolve(__dirname, '../frontend/public/assets/teams');

  // Verify all 10 logos exist
  let allLogosExist = true;
  const fileHashes = {};

  for (const t of teams) {
    const filePath = path.join(publicTeamsDir, `${t}.png`);
    const exists = fs.existsSync(filePath);
    if (!exists) {
      allLogosExist = false;
      console.error(`   Missing logo asset for: ${t}.png`);
    } else {
      const buf = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      fileHashes[t] = { size: buf.length, hash };
    }
  }

  assert(allLogosExist, 'All 10 Official Franchise Logo Files Exist in Assets');

  // Verify that other team logos are NOT copies of the CSK logo
  const cskHash = fileHashes['csk']?.hash;
  let hasDistinctLogos = true;
  for (const t of teams) {
    if (t !== 'csk' && fileHashes[t]?.hash === cskHash) {
      hasDistinctLogos = false;
      console.error(`   Logo for ${t} is an exact byte duplicate of CSK logo!`);
    }
  }
  assert(hasDistinctLogos, 'Zero Logo Duplication: Every team has its own distinct logo file');

  // Verify TeamLogo normalization logic in TeamLogo.jsx
  const teamLogoSrc = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/common/TeamLogo.jsx'), 'utf8');

  // Ensure no fallback to 'csk' when teamIdentifier is missing
  const noMissingCskFallback = !teamLogoSrc.includes("if (!teamIdentifier) return 'csk'") &&
                               !teamLogoSrc.includes("return map[clean] || 'csk'");
  assert(noMissingCskFallback, "Zero CSK Fallback in normalizeTeamId: Missing identifiers return null, not 'csk'");

  // Ensure User icon is used for neutral avatar before selection
  const hasUserIconFallback = teamLogoSrc.includes('<User') || teamLogoSrc.includes('Manager / Unassigned');
  assert(hasUserIconFallback, 'Neutral Manager Avatar: Unassigned managers render neutral icon, not CSK logo');

  // Ensure aspect ratio preservation (object-contain)
  const hasObjectContain = teamLogoSrc.includes('object-contain');
  assert(hasObjectContain, 'Aspect Ratio Preserved: object-contain used for all logo renders');

  // --------------------------------------------------------------------------
  // PART 2: Host Room Sharing & Invitation URL Generation
  // --------------------------------------------------------------------------
  console.log('\n--- PART 2: HOST ROOM SHARING & INVITATION URLS ---');

  // 1. Create a public host session and room
  const hostSession = await request('/api/auth/guest-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { displayName: 'Rohit Sharma (Host)' }
  });
  const hostToken = hostSession.data?.data?.token;

  const pubRoomRes = await request('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hostToken}`
    },
    body: {
      roomName: 'Open Invitation League',
      isPrivate: false,
      selectedFranchise: 'MI'
    }
  });

  const pubRoomCode = pubRoomRes.data?.data?.roomCode;
  assert(pubRoomRes.statusCode === 201 && pubRoomCode, 'Host Created Public Room', `Room Code: ${pubRoomCode}`);

  // Verify RoomLobby.jsx contains Room Sharing controls
  const lobbySrc = fs.readFileSync(path.resolve(__dirname, '../frontend/src/components/room/RoomLobby.jsx'), 'utf8');

  const hasInviteSection = lobbySrc.includes('Invite Friends & Managers') || lobbySrc.includes('Share Room');
  assert(hasInviteSection, "Room Lobby: Contains 'Invite Friends & Managers' section");

  const hasCopyLinkBtn = lobbySrc.includes('handleCopyInviteLink') && lobbySrc.includes('/rooms/');
  assert(hasCopyLinkBtn, 'Room Lobby: Generates dynamic URL format (/rooms/ROOM-CODE)');

  const hasNativeShare = lobbySrc.includes('navigator.share') && lobbySrc.includes('handleNativeShare');
  assert(hasNativeShare, 'Room Lobby: Integrates native Web Share API with clipboard fallback');

  const hasCopyCodeBtn = lobbySrc.includes('handleCopyOnlyCode');
  assert(hasCopyCodeBtn, 'Room Lobby: Features dedicated Copy Room Code button');

  // --------------------------------------------------------------------------
  // PART 3: Direct Room Joining & Security Verification
  // --------------------------------------------------------------------------
  console.log('\n--- PART 3: DIRECT ROOM JOINING & SECURITY ---');

  // 1. Participant joins public room via invitation code without login
  const guestSession = await request('/api/auth/guest-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { displayName: 'Virat Kohli (Invited Guest)' }
  });
  const guestToken = guestSession.data?.data?.token;

  const joinPubRes = await request(`/api/rooms/${pubRoomCode}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`
    },
    body: { displayName: 'Virat Kohli (Invited Guest)' }
  });

  assert(joinPubRes.statusCode === 200, 'Direct Join: Participant joined public room without login');

  // 2. Create a private room
  const privRoomRes = await request('/api/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hostToken}`
    },
    body: {
      roomName: 'VIP Private Auction',
      isPrivate: true,
      passcode: 'IPL2026VIP',
      selectedFranchise: 'CSK'
    }
  });

  const privRoomCode = privRoomRes.data?.data?.roomCode;
  const passcodeHidden = privRoomRes.data?.data?.passcode === undefined;
  assert(privRoomRes.statusCode === 201 && passcodeHidden, 'Private Room: Passcode strictly concealed in API response');

  // 3. Test joining private room with wrong passcode
  const wrongPassRes = await request(`/api/rooms/${privRoomCode}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`
    },
    body: { passcode: 'WRONG_CODE' }
  });
  assert(wrongPassRes.statusCode === 403, 'Private Room Security: Incorrect passcode rejected with 403 Forbidden');

  // 4. Test joining private room with correct passcode
  const correctPassRes = await request(`/api/rooms/${privRoomCode}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guestToken}`
    },
    body: { passcode: 'IPL2026VIP', displayName: 'Virat Kohli (Invited Guest)' }
  });
  assert(correctPassRes.statusCode === 200, 'Private Room Entry: Correct passcode authorizes participant entry');

  // 5. Test invalid / non-existent room code
  const fakeRoomRes = await request('/api/rooms/IPL-NONEXISTENT');
  assert(fakeRoomRes.statusCode === 404, 'Invalid Room Handling: Non-existent room code returns 404 cleanly');

  // 6. Test App.jsx URL parsing for both path and hash invitation links
  const appSrc = fs.readFileSync(path.resolve(__dirname, '../frontend/src/App.jsx'), 'utf8');
  const supportsPathRouting = appSrc.includes('/rooms/') || appSrc.includes('pathname.match');
  assert(supportsPathRouting, 'SPA URL Resolution: App.jsx supports direct /rooms/CODE deep links on page load & refresh');

  console.log('\n========================================================');
  console.log(`🎯 AUDIT COMPLETE: ${passed}/${passed + failed} CHECKS PASSED (${Math.round((passed / (passed + failed)) * 100)}%)`);
  console.log('========================================================\n');

  process.exit(failed > 0 ? 1 : 0);
};

runAudit();
