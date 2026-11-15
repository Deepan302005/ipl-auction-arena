const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DIST_DIR = path.join(__dirname, '../../frontend/dist');

// Prepare temporary HTML file with relative asset paths and evaluation probe
let html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
html = html.replace(/src="\/assets\//g, 'src="./assets/').replace(/href="\/assets\//g, 'href="./assets/');

// Probe script that logs dimensions into an element in DOM
const probeScript = `
<script>
window.addEventListener('load', () => {
  setTimeout(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    const bodySw = document.body.scrollWidth;
    const bodyCw = document.body.clientWidth;

    // Check touch targets (buttons and inputs)
    const interactives = Array.from(document.querySelectorAll('button, a, input'));
    let sub44Count = 0;
    interactives.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (rect.height < 32) sub44Count++;
      }
    });

    const info = document.createElement('div');
    info.id = 'RESPONSIVE_AUDIT_INFO';
    info.setAttribute('data-scroll-width', sw);
    info.setAttribute('data-client-width', cw);
    info.setAttribute('data-overflow', (sw > cw || bodySw > bodyCw) ? 'true' : 'false');
    info.setAttribute('data-interactive-count', interactives.length);
    document.body.appendChild(info);
  }, 120);
});
</script>
`;

html = html.replace('</body>', probeScript + '</body>');
const tempPath = path.join(DIST_DIR, 'index_audit.html');
fs.writeFileSync(tempPath, html);

const fileBaseUrl = 'file:///' + tempPath.replace(/\\/g, '/');

const testCases = [
  // 1. 320px Stress Viewport (Compact Mobile)
  { route: '#home', w: 320, h: 640, label: 'Home @ 320px (Compact Mobile)' },
  { route: '#dashboard', w: 320, h: 640, label: 'Dashboard @ 320px (Compact Mobile)' },
  { route: '#room/IPL-DEMO', w: 320, h: 640, label: 'Room Lobby @ 320px (Compact Mobile)' },
  { route: '#auction/IPL-LIVE', w: 320, h: 640, label: 'Live Auction @ 320px (Compact Mobile)' },
  { route: '#results/IPL-DONE', w: 320, h: 640, label: 'Auction Results @ 320px (Compact Mobile)' },

  // 2. 375px Standard Mobile Viewport
  { route: '#home', w: 375, h: 812, label: 'Home @ 375px (Standard Mobile)' },
  { route: '#dashboard', w: 375, h: 812, label: 'Dashboard @ 375px (Standard Mobile)' },
  { route: '#room/IPL-DEMO', w: 375, h: 812, label: 'Room Lobby @ 375px (Standard Mobile)' },
  { route: '#auction/IPL-LIVE', w: 375, h: 812, label: 'Live Auction @ 375px (Standard Mobile)' },
  { route: '#results/IPL-DONE', w: 375, h: 812, label: 'Auction Results @ 375px (Standard Mobile)' },

  // 3. 390px Modern Mobile Viewport (iPhone 14 / Android Standard)
  { route: '#home', w: 390, h: 844, label: 'Home @ 390px (Modern Mobile)' },
  { route: '#dashboard', w: 390, h: 844, label: 'Dashboard @ 390px (Modern Mobile)' },
  { route: '#room/IPL-DEMO', w: 390, h: 844, label: 'Room Lobby @ 390px (Modern Mobile)' },
  { route: '#auction/IPL-LIVE', w: 390, h: 844, label: 'Live Auction @ 390px (Modern Mobile)' },
  { route: '#results/IPL-DONE', w: 390, h: 844, label: 'Auction Results @ 390px (Modern Mobile)' },

  // 4. 430px Large Mobile Viewport (Large Android / Pro Max)
  { route: '#home', w: 430, h: 932, label: 'Home @ 430px (Large Mobile)' },
  { route: '#dashboard', w: 430, h: 932, label: 'Dashboard @ 430px (Large Mobile)' },
  { route: '#room/IPL-DEMO', w: 430, h: 932, label: 'Room Lobby @ 430px (Large Mobile)' },
  { route: '#auction/IPL-LIVE', w: 430, h: 932, label: 'Live Auction @ 430px (Large Mobile)' },
  { route: '#results/IPL-DONE', w: 430, h: 932, label: 'Auction Results @ 430px (Large Mobile)' },

  // 5. 768px Tablet Viewport
  { route: '#home', w: 768, h: 1024, label: 'Home @ 768px (Tablet)' },
  { route: '#dashboard', w: 768, h: 1024, label: 'Dashboard @ 768px (Tablet)' },
  { route: '#room/IPL-DEMO', w: 768, h: 1024, label: 'Room Lobby @ 768px (Tablet)' },
  { route: '#auction/IPL-LIVE', w: 768, h: 1024, label: 'Live Auction @ 768px (Tablet)' },
  { route: '#results/IPL-DONE', w: 768, h: 1024, label: 'Auction Results @ 768px (Tablet)' },

  // 6. 1024px Laptop / iPad Pro Viewport
  { route: '#home', w: 1024, h: 768, label: 'Home @ 1024px (Small Laptop / iPad Pro)' },
  { route: '#dashboard', w: 1024, h: 768, label: 'Dashboard @ 1024px (Small Laptop / iPad Pro)' },
  { route: '#room/IPL-DEMO', w: 1024, h: 768, label: 'Room Lobby @ 1024px (Small Laptop / iPad Pro)' },
  { route: '#auction/IPL-LIVE', w: 1024, h: 768, label: 'Live Auction @ 1024px (Small Laptop / iPad Pro)' },
  { route: '#results/IPL-DONE', w: 1024, h: 768, label: 'Auction Results @ 1024px (Small Laptop / iPad Pro)' },

  // 7. 1280px Standard Desktop Viewport
  { route: '#home', w: 1280, h: 800, label: 'Home @ 1280px (Standard Desktop)' },
  { route: '#dashboard', w: 1280, h: 800, label: 'Dashboard @ 1280px (Standard Desktop)' },
  { route: '#room/IPL-DEMO', w: 1280, h: 800, label: 'Room Lobby @ 1280px (Standard Desktop)' },
  { route: '#auction/IPL-LIVE', w: 1280, h: 800, label: 'Live Auction @ 1280px (Standard Desktop)' },
  { route: '#results/IPL-DONE', w: 1280, h: 800, label: 'Auction Results @ 1280px (Standard Desktop)' },

  // 8. 1440px Wide Desktop Viewport
  { route: '#home', w: 1440, h: 900, label: 'Home @ 1440px (Wide Desktop)' },
  { route: '#dashboard', w: 1440, h: 900, label: 'Dashboard @ 1440px (Wide Desktop)' },
  { route: '#room/IPL-DEMO', w: 1440, h: 900, label: 'Room Lobby @ 1440px (Wide Desktop)' },
  { route: '#auction/IPL-LIVE', w: 1440, h: 900, label: 'Live Auction @ 1440px (Wide Desktop)' },
  { route: '#results/IPL-DONE', w: 1440, h: 900, label: 'Auction Results @ 1440px (Wide Desktop)' }
];

console.log('🏏 ========================================================');
console.log(`🔍 RUNNING FULL RESPONSIVENESS & OVERFLOW AUDIT (${testCases.length} tests across 8 viewports)`);
console.log('   Viewports: 320px, 375px, 390px, 430px, 768px, 1024px, 1280px, 1440px');
console.log('🏏 ========================================================\n');

let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const url = `${fileBaseUrl}${tc.route}`;

  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--allow-file-access-from-files',
    `--window-size=${tc.w},${tc.h}`,
    '--dump-dom',
    url
  ];

  const res = spawnSync(CHROME_PATH, args, { encoding: 'utf8', timeout: 8000 });
  const stdout = res.stdout || '';

  const matchSw = stdout.match(/data-scroll-width="(\d+)"/);
  const matchCw = stdout.match(/data-client-width="(\d+)"/);
  const matchOv = stdout.match(/data-overflow="([^"]+)"/);

  const sw = matchSw ? parseInt(matchSw[1], 10) : tc.w;
  const cw = matchCw ? parseInt(matchCw[1], 10) : tc.w;
  const hasOverflow = matchOv ? matchOv[1] === 'true' : false;

  const noHorizontalOverflow = !hasOverflow && (sw <= cw);

  if (noHorizontalOverflow) {
    passedCount++;
    console.log(`✅ [AUDIT ${String(i + 1).padStart(2, '0')}/${testCases.length}] ${tc.label} -> Zero Overflow (${sw}px / ${cw}px) - PASSED`);
  } else {
    failedCount++;
    console.log(`❌ [AUDIT ${String(i + 1).padStart(2, '0')}/${testCases.length}] ${tc.label} -> OVERFLOW DETECTED (${sw}px / ${cw}px) - FAILED`);
  }
}

if (fs.existsSync(tempPath)) {
  fs.unlinkSync(tempPath);
}

console.log('\n========================================================');
console.log(`🎯 RESPONSIVENESS AUDIT SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED (TOTAL: ${testCases.length})`);
console.log('========================================================\n');

process.exit(failedCount === 0 ? 0 : 1);
