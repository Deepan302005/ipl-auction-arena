const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TEAMS = [
  { code: 'csk', query: 'Chennai Super Kings Logo.svg' },
  { code: 'mi', query: 'Mumbai Indians Logo.svg' },
  { code: 'rcb', query: 'Royal Challengers Bengaluru Logo.svg' },
  { code: 'kkr', query: 'Kolkata Knight Riders Logo.svg' },
  { code: 'srh', query: 'Sunrisers Hyderabad Logo.svg' },
  { code: 'rr', query: 'This is the logo for Rajasthan Royals, a cricket team playing in the Indian Premier League (IPL).svg' },
  { code: 'dc', query: 'Delhi Capitals.svg' },
  { code: 'pbks', query: 'Punjab Kings Logo.svg' },
  { code: 'gt', query: 'Gujarat Titans Logo.svg' },
  { code: 'lsg', query: 'Lucknow Super Giants Logo.svg' }
];

const TARGET_DIR = path.join(__dirname, '../../frontend/public/assets/teams');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

async function fetchWikiInfo(filename) {
  return new Promise((resolve) => {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url|thumburl&iiurlwidth=500&format=json`;
    const req = https.get(url, { headers: { 'User-Agent': 'IPLAuctionArena/1.0 (contact@iplarena.com)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const pages = json.query?.pages || {};
          const page = Object.values(pages)[0];
          const info = page?.imageinfo?.[0];
          resolve(info ? { url: info.url, thumburl: info.thumburl } : null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith('https') ? https : http;

    const request = client.get(url, { headers: { 'User-Agent': 'IPLAuctionArena/1.0 (contact@iplarena.com)' } }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`Status code ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });

    request.on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  console.log('🏏 Commencing authentic IPL team logos download...');
  for (const t of TEAMS) {
    const info = await fetchWikiInfo(t.query);
    if (!info || !info.thumburl) {
      console.error(`❌ Could not get URL for ${t.code.toUpperCase()}`);
      continue;
    }

    const dest = path.join(TARGET_DIR, `${t.code}.png`);
    try {
      await downloadFile(info.thumburl, dest);
      const stats = fs.statSync(dest);
      console.log(`✅ Saved ${t.code.toUpperCase()} logo -> ${t.code}.png (${Math.round(stats.size / 1024)} KB)`);
    } catch (err) {
      console.error(`❌ Failed to download ${t.code.toUpperCase()}:`, err.message);
    }
  }

  console.log('\n🏁 Team logos download process complete.');
}

main();
