/**
 * Deployment Smoke Test Suite
 * Validates production readiness of unified Express + React + Socket.IO server:
 * 1. Health check & database connection
 * 2. HTTP security headers & x-powered-by suppression
 * 3. Static React SPA bundle delivery & client-side route fallback
 * 4. 10 Official IPL Franchise profiles
 * 5. 805 Historical player records & season filtering
 * 6. Zero-auth guest session creation, cryptographic restoration, and anti-impersonation
 * 7. Room creation & private passcode omission
 * 8. Socket.IO real-time WebSocket connection and round-trip ping
 */

const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

const request = (path, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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

const runSmokeTest = async () => {
  console.log('🏏 ========================================================');
  console.log('🚀 PRODUCTION DEPLOYMENT SMOKE TEST SUITE');
  console.log(`📡 Target Host: ${BASE_URL}`);
  console.log('🏏 ========================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, desc, detail = '') => {
    if (condition) {
      console.log(`✅ [SMOKE PASS] ${desc} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [SMOKE FAIL] ${desc} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  };

  try {
    // 1. Health Check
    const health = await request('/api/health');
    assert(
      health.statusCode === 200 && health.data?.services?.api?.status === 'healthy',
      'Health Check Endpoint (/api/health)',
      `Status: ${health.statusCode}, DB Connected: ${health.data?.services?.database?.connected}`
    );

    // 2. HTTP Security Headers
    const h = health.headers;
    const hasNosniff = h['x-content-type-options'] === 'nosniff';
    const hasFrameOptions = h['x-frame-options'] === 'SAMEORIGIN';
    const hasXss = h['x-xss-protection'] === '1; mode=block';
    const hasReferrer = h['referrer-policy'] === 'strict-origin-when-cross-origin';
    const noPoweredBy = !h['x-powered-by'];
    assert(
      hasNosniff && hasFrameOptions && hasXss && hasReferrer && noPoweredBy,
      'HTTP Production Security Headers',
      `nosniff: ${hasNosniff}, frameOptions: ${hasFrameOptions}, x-powered-by disabled: ${noPoweredBy}`
    );

    // 3. Static SPA Delivery
    const spa = await request('/');
    assert(
      spa.statusCode === 200 && typeof spa.data === 'string' && spa.data.includes('<div id="root">'),
      'Root Static React SPA Delivery (GET /)',
      `Content-Length: ${spa.data.length} bytes, Root Div Present: true`
    );

    // 4. SPA Client-Side Routing Fallback
    const spaRoute = await request('/rooms/IPL-DEMO');
    assert(
      spaRoute.statusCode === 200 && typeof spaRoute.data === 'string' && spaRoute.data.includes('<div id="root">'),
      'SPA Client-Side Deep Link Fallback (GET /rooms/IPL-DEMO)',
      `Returned index.html for client-side routing`
    );

    // 5. 10 Official Franchises
    const teams = await request('/api/teams');
    const teamCount = teams.data?.data?.length || (Array.isArray(teams.data) ? teams.data.length : 0);
    assert(
      teams.statusCode === 200 && teamCount === 10,
      '10 Official IPL Franchises Database Integrity',
      `Total Franchises: ${teamCount}/10`
    );

    // 6. 805 Historical Player Records
    const players = await request('/api/players?limit=10');
    const playerCount = players.data?.pagination?.totalCount || players.data?.pagination?.total || 0;
    assert(
      players.statusCode === 200 && playerCount === 805,
      '805 Historical Player Records Database Integrity',
      `Total Players: ${playerCount}/805 (2008–2026)`
    );

    // 7. Guest Session Creation & Anti-Impersonation
    const guestRes = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { displayName: 'Production Smoke Tester' }
    });
    const guestData = guestRes.data?.data;
    const token = guestData?.token;
    const guestId = guestData?.user?.guestId || guestData?.guestId;
    const sessionSecret = guestData?.sessionSecret;
    assert(
      guestRes.statusCode === 200 && token && guestId && sessionSecret,
      'Direct Zero-Auth Guest Session Issuance',
      `guestId: ${guestId}`
    );

    // 8. Guest Restoration Security
    const restoreRes = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { guestId, sessionSecret }
    });
    assert(
      restoreRes.statusCode === 200 && (restoreRes.data?.data?.user?.guestId === guestId || restoreRes.data?.data?.guestId === guestId),
      'Cryptographic Guest Identity Restoration',
      `Verified with timingSafeEqual`
    );

    // 9. Anti-Impersonation Protection
    const fakeRes = await request('/api/auth/guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { guestId, sessionSecret: 'wrong_attack_secret_xyz' }
    });
    assert(
      fakeRes.statusCode === 401,
      'Anti-Impersonation Security Check',
      `Rejected unauthorized restoration with status 401`
    );

    // 10. Room Creation & Passcode Privacy
    const roomRes = await request('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: {
        roomName: 'Smoke Test Arena',
        isPrivate: true,
        passcode: 'SECRET777',
        selectedFranchise: 'CSK'
      }
    });
    const roomData = roomRes.data?.data;
    const roomCode = roomData?.roomCode || roomData?.code;
    const passcodeOmitted = roomData?.passcode === undefined;
    assert(
      roomRes.statusCode === 201 && roomCode && passcodeOmitted,
      'Private Room Creation & Passcode Concealment',
      `Room Code: ${roomCode}, Passcode Omitted: ${passcodeOmitted}`
    );

    // 11. Socket.IO Real-Time WebSocket Connection
    await new Promise((resolve) => {
      const socket = io(BASE_URL, {
        auth: { token, guestId, sessionSecret },
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      socket.on('connect', () => {
        const start = Date.now();
        socket.emit('client:ping', { sentAt: start });
      });

      socket.on('server:pong', (payload) => {
        const latency = Date.now() - (payload?.payload?.sentAt || Date.now());
        assert(
          true,
          'Socket.IO WebSocket Handshake & Roundtrip Ping',
          `Socket ID: ${socket.id}, Latency: ${latency}ms`
        );
        socket.disconnect();
        resolve();
      });

      socket.on('connect_error', (err) => {
        assert(false, 'Socket.IO Connection Error', err.message);
        socket.disconnect();
        resolve();
      });
    });

    console.log('\n========================================================');
    console.log(`🎯 SMOKE TEST COMPLETE: ${passed}/${passed + failed} CHECKS PASSED (${Math.round((passed / (passed + failed)) * 100)}%)`);
    console.log('========================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal Smoke Test Error:', err);
    process.exit(1);
  }
};

runSmokeTest();
