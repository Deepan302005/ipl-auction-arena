const fs = require('fs');
const path = require('path');
const http = require('http');

const TEAMS = ['csk', 'mi', 'rcb', 'kkr', 'srh', 'rr', 'dc', 'pbks', 'gt', 'lsg'];

async function makeRequest(url, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
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
  console.log('====================================================');
  console.log('🧪 IPL AUCTION ARENA - STAGE 7 VERIFICATION SUITE');
  console.log('====================================================\n');

  // STEP 1: VERIFY ALL 10 LOGOS
  console.log('1. Checking 10 Official IPL Franchise Logo Assets:');
  const teamsDir = path.resolve(__dirname, '../frontend/public/assets/teams');
  let missingLogos = 0;
  for (const team of TEAMS) {
    const filePath = path.join(teamsDir, `${team}.png`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`   ✅ ${team.toUpperCase().padEnd(5)}: Exists (${(stats.size / 1024).toFixed(1)} KB) -> assets/teams/${team}.png`);
    } else {
      console.log(`   ❌ ${team.toUpperCase().padEnd(5)}: MISSING`);
      missingLogos++;
    }
  }

  if (missingLogos > 0) {
    console.error(`\n❌ Failed: ${missingLogos} logos missing!`);
    process.exit(1);
  }
  console.log('   -> All 10 official franchise logos verified on disk.\n');

  // STEP 2: HEALTH CHECK
  console.log('2. Checking Backend Server Health:');
  try {
    const health = await makeRequest('http://localhost:5000/api/health');
    console.log(`   ✅ Health check: Status ${health.status}, Response:`, health.data);
  } catch (err) {
    console.error('   ❌ Server health check failed:', err.message);
    process.exit(1);
  }

  // STEP 3: REGISTRATION TEST (NO "Failed to fetch")
  console.log('\n3. Testing User Registration (Real Database):');
  const testEmail = `manager_${Date.now()}@arena.com`;
  const registerPayload = {
    name: 'Arena Manager Test',
    email: testEmail,
    password: 'password123',
    favoriteTeam: 'CSK'
  };

  let token = null;
  let userId = null;
  try {
    const regRes = await makeRequest('http://localhost:5000/api/auth/register', 'POST', registerPayload);
    console.log(`   Status: ${regRes.status}`);
    if (regRes.status === 201 && regRes.data.success) {
      const data = regRes.data.data;
      token = data.token;
      userId = data._id || data.user?._id;
      console.log('   ✅ Registration succeeded!');
      console.log(`      User ID: ${userId}`);
      console.log(`      Name: ${data.name || data.user?.name}`);
      console.log(`      Email: ${data.email || data.user?.email}`);
      console.log(`      Favorite Team: ${data.favoriteTeam || data.user?.favoriteTeam}`);
      console.log(`      JWT Token: ${token.substring(0, 24)}...`);
      console.log(`      Password omitted: ${data.password === undefined ? 'YES (Secure)' : 'NO'}`);
    } else {
      console.error('   ❌ Registration failed:', regRes.data);
      process.exit(1);
    }
  } catch (err) {
    console.error('   ❌ Error in registration request:', err.message);
    process.exit(1);
  }

  // STEP 4: LOGIN TEST
  console.log('\n4. Testing User Login:');
  try {
    const loginRes = await makeRequest('http://localhost:5000/api/auth/login', 'POST', {
      email: testEmail,
      password: 'password123'
    });
    console.log(`   Status: ${loginRes.status}`);
    if (loginRes.status === 200 && loginRes.data.success) {
      const data = loginRes.data.data;
      console.log('   ✅ Login verified with valid credentials!');
      console.log(`      JWT Token received: ${data.token.substring(0, 24)}...`);
    } else {
      console.error('   ❌ Login failed:', loginRes.data);
      process.exit(1);
    }
  } catch (err) {
    console.error('   ❌ Error in login request:', err.message);
    process.exit(1);
  }

  // STEP 5: PROTECTED PROFILE (GET /api/auth/me)
  console.log('\n5. Testing Protected Profile (GET /api/auth/me):');
  try {
    const meRes = await makeRequest('http://localhost:5000/api/auth/me', 'GET', null, {
      Authorization: `Bearer ${token}`
    });
    console.log(`   Status: ${meRes.status}`);
    if (meRes.status === 200 && meRes.data.success) {
      const user = meRes.data.data;
      console.log('   ✅ Authenticated profile retrieved:');
      console.log(`      Name: ${user.name}`);
      console.log(`      Email: ${user.email}`);
      console.log(`      Favorite: ${user.favoriteTeam}`);
      console.log(`      Password omitted: ${user.password === undefined ? 'YES' : 'NO'}`);
    } else {
      console.error('   ❌ Profile retrieval failed:', meRes.data);
      process.exit(1);
    }
  } catch (err) {
    console.error('   ❌ Error in profile request:', err.message);
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('🎉 ALL BACKEND CONNECTION & AUTH TESTS PASSED 100%');
  console.log('====================================================');
}

run().catch(console.error);
