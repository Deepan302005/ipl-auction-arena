const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCREENSHOTS_DIR = 'C:\\Users\\ADMIN\\.gemini\\antigravity\\brain\\e345f6b7-75a0-4387-ade9-1ecddfdab996\\screenshots';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIST_DIR = path.join(__dirname, '../../frontend/dist');

// Ensure output directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Prepare index_file.html with relative asset references
let html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
html = html.replace(/src="\/assets\//g, 'src="./assets/').replace(/href="\/assets\//g, 'href="./assets/');
const tempHtmlPath = path.join(DIST_DIR, 'index_file.html');
fs.writeFileSync(tempHtmlPath, html);

const fileBaseUrl = 'file:///' + tempHtmlPath.replace(/\\/g, '/');

const targets = [
  // 1. Home Page
  { name: 'home_desktop_1440.png', route: '#home', w: 1440, h: 900, label: 'Home (Desktop 1440px)' },
  { name: 'home_laptop_1024.png', route: '#home', w: 1024, h: 768, label: 'Home (Laptop 1024px)' },
  { name: 'home_tablet_768.png', route: '#home', w: 768, h: 1024, label: 'Home (Tablet 768px)' },
  { name: 'home_mobile_375.png', route: '#home', w: 375, h: 812, label: 'Home (Mobile 375px)' },
  { name: 'home_mobile_320.png', route: '#home', w: 320, h: 640, label: 'Home (Mobile 320px Stress)' },

  // 2. Dashboard
  { name: 'dashboard_desktop_1440.png', route: '#dashboard', w: 1440, h: 900, label: 'Dashboard (Desktop 1440px)' },
  { name: 'dashboard_mobile_375.png', route: '#dashboard', w: 375, h: 812, label: 'Dashboard (Mobile 375px)' },
  { name: 'dashboard_mobile_320.png', route: '#dashboard', w: 320, h: 640, label: 'Dashboard (Mobile 320px)' },

  // 3. Room Lobby (IPL-DEMO)
  { name: 'room_lobby_desktop_1440.png', route: '#room/IPL-DEMO', w: 1440, h: 900, label: 'Lobby (Desktop 1440px)' },
  { name: 'room_lobby_mobile_375.png', route: '#room/IPL-DEMO', w: 375, h: 812, label: 'Lobby (Mobile 375px)' },

  // 4. Live Auction (IPL-LIVE)
  { name: 'live_auction_desktop_1440.png', route: '#auction/IPL-LIVE', w: 1440, h: 900, label: 'Live Auction (Desktop 1440px)' },
  { name: 'live_auction_mobile_375.png', route: '#auction/IPL-LIVE', w: 375, h: 812, label: 'Live Auction (Mobile 375px)' },

  // 5. Auction Results (IPL-DONE)
  { name: 'auction_results_desktop_1440.png', route: '#results/IPL-DONE', w: 1440, h: 900, label: 'Results (Desktop 1440px)' },
  { name: 'auction_results_mobile_375.png', route: '#results/IPL-DONE', w: 375, h: 812, label: 'Results (Mobile 375px)' }
];

console.log('🏏 ========================================================');
console.log(`📸 COMMENCING HIGH-FIDELITY SCREENSHOT CAPTURE (${targets.length} targets)`);
console.log('🏏 ========================================================\n');

const results = [];

for (const t of targets) {
  const outPath = path.join(SCREENSHOTS_DIR, t.name);
  const targetUrl = `${fileBaseUrl}${t.route}`;
  process.stdout.write(`⏳ Capturing ${t.label} (${t.w}x${t.h})... `);

  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--run-all-compositor-stages-before-draw',
    `--window-size=${t.w},${t.h}`,
    `--screenshot=${outPath}`,
    targetUrl
  ];

  const t0 = Date.now();
  const res = spawnSync(CHROME_PATH, args, { encoding: 'utf8', timeout: 10000 });
  const ms = Date.now() - t0;

  if (fs.existsSync(outPath)) {
    const stats = fs.statSync(outPath);
    const kb = Math.round(stats.size / 1024);
    console.log(`✅ SAVED (${kb} KB in ${ms}ms)`);
    results.push({ ...t, status: 'SUCCESS', sizeKb: kb, outPath });
  } else {
    console.log(`❌ FAILED (Exit code: ${res.status})`);
    if (res.stderr) console.error('   stderr:', res.stderr.slice(0, 200));
    results.push({ ...t, status: 'FAILED' });
  }
}

// Clean up temp html file
if (fs.existsSync(tempHtmlPath)) {
  fs.unlinkSync(tempHtmlPath);
}

console.log('\n========================================================');
console.log(`🎯 CAPTURE COMPLETE: ${results.filter(r => r.status === 'SUCCESS').length} / ${results.length} SUCCESSFUL`);
console.log('========================================================\n');
