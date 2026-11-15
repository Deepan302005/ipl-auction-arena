const fs = require('fs');
const path = require('path');
const readline = require('readline');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Player = require('../models/Player');

/**
 * Standard team name mapping to official codes
 */
const TEAM_NAME_TO_CODE = {
  'Chennai Super Kings': 'CSK',
  'Mumbai Indians': 'MI',
  'Royal Challengers Bangalore': 'RCB',
  'Royal Challengers Bengaluru': 'RCB',
  'Kolkata Knight Riders': 'KKR',
  'Delhi Daredevils': 'DD',
  'Delhi Capitals': 'DC',
  'Rajasthan Royals': 'RR',
  'Sunrisers Hyderabad': 'SRH',
  'Deccan Chargers': 'DEC',
  'Kings XI Punjab': 'KXIP',
  'Punjab Kings': 'PBKS',
  'Gujarat Titans': 'GT',
  'Gujarat Lions': 'GL',
  'Lucknow Super Giants': 'LSG',
  'Rising Pune Supergiant': 'RPS',
  'Rising Pune Supergiants': 'RPS',
  'Pune Warriors': 'PWI',
  'Kochi Tuskers Kerala': 'KTK'
};

const TEAM_CODE_TO_NAME = {
  'CSK': 'Chennai Super Kings',
  'MI': 'Mumbai Indians',
  'RCB': 'Royal Challengers Bengaluru',
  'KKR': 'Kolkata Knight Riders',
  'DC': 'Delhi Capitals',
  'DD': 'Delhi Daredevils',
  'RR': 'Rajasthan Royals',
  'SRH': 'Sunrisers Hyderabad',
  'DEC': 'Deccan Chargers',
  'PBKS': 'Punjab Kings',
  'KXIP': 'Kings XI Punjab',
  'GT': 'Gujarat Titans',
  'GL': 'Gujarat Lions',
  'LSG': 'Lucknow Super Giants',
  'RPS': 'Rising Pune Supergiant',
  'PWI': 'Pune Warriors India',
  'KTK': 'Kochi Tuskers Kerala'
};

const KNOWN_WICKETKEEPERS = new Set([
  'MS Dhoni', 'Rishabh Pant', 'Sanju Samson', 'KL Rahul', 'Dinesh Karthik',
  'Wriddhiman Saha', 'Quinton de Kock', 'Jos Buttler', 'Heinrich Klaasen',
  'Nicholas Pooran', 'Ishan Kishan', 'Robin Uthappa', 'Parthiv Patel',
  'Adam Gilchrist', 'Kumar Sangakkara', 'Brendon McCullum', 'Jonny Bairstow',
  'AB de Villiers', 'Philip Salt', 'Jitesh Sharma', 'Anuj Rawat', 'Dhruv Jurel'
]);

/**
 * Parse CSV line correctly handling commas within quoted fields
 */
function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Build name dictionary from Cricsheet names.csv and people.csv
 */
const buildNameResolver = async () => {
  const resolver = new Map();
  const idToFullName = new Map();

  const namesPath = path.join(__dirname, '../data/cricsheet/names.csv');
  if (fs.existsSync(namesPath)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(namesPath),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const id = parts[0].trim();
        const name = parts.slice(1).join(',').trim();
        if (!idToFullName.has(id) || name.length > idToFullName.get(id).length) {
          idToFullName.set(id, name);
        }
      }
    }
  }

  // Load people.csv for unique_name
  const peoplePath = path.join(__dirname, '../data/cricsheet/people.csv');
  if (fs.existsSync(peoplePath)) {
    const rl = readline.createInterface({
      input: fs.createReadStream(peoplePath),
      crlfDelay: Infinity
    });
    let isHeader = true;
    for await (const line of rl) {
      if (isHeader) { isHeader = false; continue; }
      const parts = line.split(',');
      if (parts.length >= 3) {
        const id = parts[0]?.trim();
        const shortName = parts[1]?.trim();
        const uniqueName = parts[2]?.trim();
        const bestName = uniqueName || idToFullName.get(id) || shortName;
        if (shortName) resolver.set(shortName, bestName);
        if (uniqueName) resolver.set(uniqueName, bestName);
      }
    }
  }

  // Curated canonical overrides: resolves short-name collisions, IPL aliases & starter pairs
  const overrides = {
    // Critical Collision Fix: RK Singh in Cricsheet IPL matches is Rinku Singh (Cricinfo 723105)
    'RK Singh': 'Rinku Singh',
    'Rinku Singh': 'Rinku Singh',

    // Nine Starter Duplicate Pairs (Resolve abbreviated Cricsheet tokens to full canonical names)
    'PJ Cummins': 'Pat Cummins',
    'PA Cummins': 'Pat Cummins',
    'Pat Cummins': 'Pat Cummins',
    'SM Curran': 'Sam Curran',
    'Sam Curran': 'Sam Curran',
    'MP Stoinis': 'Marcus Stoinis',
    'Marcus Stoinis': 'Marcus Stoinis',
    'N Pooran': 'Nicholas Pooran',
    'Nicholas Pooran': 'Nicholas Pooran',
    'PD Salt': 'Phil Salt',
    'Phil Salt': 'Phil Salt',
    'M Pathirana': 'Matheesha Pathirana',
    'Matheesha Pathirana': 'Matheesha Pathirana',
    'M Theekshana': 'Maheesh Theekshana',
    'Maheesh Theekshana': 'Maheesh Theekshana',
    'AR Patel': 'Axar Patel',
    'Axar Patel': 'Axar Patel',

    // Disambiguated IPL Collisions from people.csv collision report
    'A Chopra': 'Aakash Chopra',
    'DR Smith': 'Dwayne Smith',
    'CJ Anderson': 'Corey Anderson',
    'MM Patel': 'Munaf Patel',
    'J Botha': 'Johan Botha',
    'RP Singh': 'RP Singh',
    'Rashid Khan': 'Rashid Khan',
    'A Mishra': 'Amit Mishra',
    'SB Wagh': 'Shrikant Wagh',
    'A Tomar': 'Ankit Tomar',
    'Harmeet Singh': 'Harmeet Singh',
    'Mandeep Singh': 'Mandeep Singh',
    'Mohsin Khan': 'Mohsin Khan',
    'Arshad Khan': 'Arshad Khan',
    'Sumit Kumar': 'Sumit Kumar',
    'Yuvraj Singh': 'Yuvraj Singh',
    'Abdul Samad': 'Abdul Samad',
    'S Rana': 'Shashank Rana',
    'Kamran Khan': 'Kamran Khan',
    'GS Sandhu': 'Gurinder Sandhu',
    'Gagandeep Singh': 'Gagandeep Singh',
    'Jaskaran Singh': 'Jaskaran Singh',
    'Mohammad Asif': 'Mohammad Asif',
    'R Sharma': 'Rohit Sharma',
    'S Arora': 'Salil Arora',
    'Shahid Afridi': 'Shahid Afridi',
    'Shivam Sharma': 'Shivam Sharma',

    // Additional common IPL cricketer abbreviations to canonical names
    'V Kohli': 'Virat Kohli',
    'RG Sharma': 'Rohit Sharma',
    'JJ Bumrah': 'Jasprit Bumrah',
    'MS Dhoni': 'MS Dhoni',
    'AB de Villiers': 'AB de Villiers',
    'CH Gayle': 'Chris Gayle',
    'SK Raina': 'Suresh Raina',
    'DA Warner': 'David Warner',
    'S Dhawan': 'Shikhar Dhawan',
    'KL Rahul': 'KL Rahul',
    'RA Jadeja': 'Ravindra Jadeja',
    'SP Narine': 'Sunil Narine',
    'AD Russell': 'Andre Russell',
    'GJ Maxwell': 'Glenn Maxwell',
    'HH Pandya': 'Hardik Pandya',
    'KA Pollard': 'Kieron Pollard',
    'DJ Bravo': 'Dwayne Bravo',
    'SL Malinga': 'Lasith Malinga',
    'B Kumar': 'Bhuvneshwar Kumar',
    'YS Chahal': 'Yuzvendra Chahal',
    'PP Chawla': 'Piyush Chawla',
    'R Ashwin': 'Ravichandran Ashwin',
    'SV Samson': 'Sanju Samson',
    'RR Pant': 'Rishabh Pant',
    'SA Yadav': 'Suryakumar Yadav',
    'Shubman Gill': 'Shubman Gill',
    'YBK Jaiswal': 'Yashasvi Jaiswal',
    'F du Plessis': 'Faf du Plessis',
    'JC Buttler': 'Jos Buttler',
    'Q de Kock': 'Quinton de Kock',
    'MA Starc': 'Mitchell Starc',
    'H Klaasen': 'Heinrich Klaasen',
    'TM Head': 'Travis Head',
    'Arshdeep Singh': 'Arshdeep Singh',
    'Mohammed Shami': 'Mohammed Shami',
    'Mohammed Siraj': 'Mohammed Siraj',
    'K Rabada': 'Kagiso Rabada',
    'TA Boult': 'Trent Boult',
    'Kuldeep Yadav': 'Kuldeep Yadav',
    'CV Varun': 'Varun Chakravarthy',
    'Ravi Bishnoi': 'Ravi Bishnoi',
    'RD Gaikwad': 'Ruturaj Gaikwad',
    'SR Tendulkar': 'Sachin Tendulkar',
    'SC Ganguly': 'Sourav Ganguly',
    'R Dravid': 'Rahul Dravid',
    'V Sehwag': 'Virender Sehwag',
    'G Gambhir': 'Gautam Gambhir',
    'Z Khan': 'Zaheer Khan',
    'Harbhajan Singh': 'Harbhajan Singh',
    'A Kumble': 'Anil Kumble',
    'A Badoni': 'Ayush Badoni',
    'A Manohar': 'Abhinav Manohar',
    'P Simran Singh': 'Prabhsimran Singh',
    'DA Miller': 'David Miller',
    'SO Hetmyer': 'Shimron Hetmyer',
    'LS Livingstone': 'Liam Livingstone',
    'JM Bairstow': 'Jonny Bairstow',
    'Avesh Khan': 'Avesh Khan',
    'Mukesh Kumar': 'Mukesh Kumar',
    'T Natarajan': 'T Natarajan',
    'Umran Malik': 'Umran Malik',
    'Harshit Rana': 'Harshit Rana',
    'Mayank Yadav': 'Mayank Yadav',
    'N Tilak Varma': 'Tilak Varma',
    'RK Bhui': 'Ricky Bhui',
    'KS Bharat': 'Srikar Bharat',
    'Jitesh Sharma': 'Jitesh Sharma',
    'Dhruv Jurel': 'Dhruv Jurel',
    'Shahrukh Khan': 'Shahrukh Khan',
    'R Tewatia': 'Rahul Tewatia',
    'A Ashish Reddy': 'Ashish Reddy',
    'A Chandila': 'Ajit Chandila',
    'A Choudhary': 'Aniket Choudhary',
    'A Dananjaya': 'Akila Dananjaya',
    'A Flintoff': 'Andrew Flintoff',
    'A Kamboj': 'Anshul Kamboj',
    'A Mithun': 'Abhimanyu Mithun',
    'A Mukund': 'Abhinav Mukund',
    'A Nehra': 'Ashish Nehra',
    'A Nortje': 'Anrich Nortje',
    'A Rayudu': 'Ambati Rayudu',
    'A Raghuvanshi': 'Angkrish Raghuvanshi',
    'A Rawat': 'Anuj Rawat',
    'A Roy': 'Anukul Roy',
    'A Symonds': 'Andrew Symonds',
    'A Zampa': 'Adam Zampa'
  };

  for (const [k, v] of Object.entries(overrides)) {
    resolver.set(k, v);
  }

  return resolver;
};

/**
 * Normalizes season string to exact official IPL calendar year
 * Mapping rules:
 * - '2007/08' -> 2008 (Inaugural IPL season: April - June 2008)
 * - '2009'    -> 2009 (IPL in South Africa: April - May 2009)
 * - '2009/10' -> 2010 (IPL 3: March - April 2010)
 * - '2020/21' -> 2020 (IPL in UAE: September - November 2020)
 * - All other seasons map directly to integer calendar year (2008-2026)
 */
const normalizeSeason = (seasonStr) => {
  if (!seasonStr) return 2008;
  const str = seasonStr.toString().trim();
  if (str === '2007/08') return 2008;
  if (str === '2009/10') return 2010;
  if (str === '2020/21') return 2020;
  if (str.includes('/')) {
    const parts = str.split('/');
    const y2 = parseInt(parts[1], 10);
    if (y2 < 100) return 2000 + y2;
    return parseInt(parts[0], 10);
  }
  return parseInt(str, 10) || 2008;
};

/**
 * Process all historical deliveries into player season and career metrics
 */
const processHistoricalIPLData = async () => {
  console.log('🔄 Initializing Cricsheet Historical IPL Processor (2008-2026)...');
  const nameResolver = await buildNameResolver();
  console.log(`✅ Loaded ${nameResolver.size} player name mappings.`);

  const csvPath = path.join(__dirname, '../data/cricsheet/all_matches.csv');
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Master dataset not found at: ${csvPath}`);
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  // Map of canonicalName -> playerAggregate
  const playerMap = new Map();

  const KNOWN_NON_PLAYERS = new Set([
    ...Object.keys(TEAM_NAME_TO_CODE),
    'Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bangalore', 'Royal Challengers Bengaluru',
    'Kolkata Knight Riders', 'Delhi Daredevils', 'Delhi Capitals', 'Rajasthan Royals', 'Sunrisers Hyderabad',
    'Deccan Chargers', 'Kings XI Punjab', 'Punjab Kings', 'Gujarat Titans', 'Gujarat Lions',
    'Lucknow Super Giants', 'Rising Pune Supergiant', 'Rising Pune Supergiants', 'Pune Warriors',
    'Kochi Tuskers Kerala', 'IPL'
  ]);

  const getPlayer = (rawName) => {
    if (!rawName) return null;
    const cleanRaw = rawName.replace(/"/g, '').trim();
    if (!cleanRaw || cleanRaw.length === 0) return null;
    if (/^\d+(\.\d+)?$/.test(cleanRaw)) return null;
    if (KNOWN_NON_PLAYERS.has(cleanRaw)) return null;

    const canonicalName = nameResolver.get(cleanRaw) || cleanRaw;
    if (KNOWN_NON_PLAYERS.has(canonicalName)) return null;

    if (!playerMap.has(canonicalName)) {
      playerMap.set(canonicalName, {
        name: canonicalName,
        aliases: new Set([cleanRaw]),
        seasons: new Set(),
        matchIds: new Set(),
        teams: new Set(),
        runs: 0,
        ballsFaced: 0,
        fifties: 0,
        hundreds: 0,
        highestScore: 0,
        inningsBatting: new Map(),
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        fourWickets: 0,
        fiveWickets: 0,
        bestWickets: 0,
        bestRunsConceded: 999,
        matchBowling: new Map(),
        seasonData: new Map()
      });
    }
    const entry = playerMap.get(canonicalName);
    entry.aliases.add(cleanRaw);
    return entry;
  };

  const getSeasonEntry = (player, season) => {
    if (!player.seasonData.has(season)) {
      player.seasonData.set(season, {
        season,
        matches: new Set(),
        runs: 0,
        ballsFaced: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        highestScore: 0,
        bestWickets: 0,
        bestRunsConceded: 999,
        fifties: 0,
        hundreds: 0,
        fourWickets: 0,
        fiveWickets: 0,
        teams: new Set(),
        matchBatting: new Map(),
        matchBowling: new Map()
      });
    }
    return player.seasonData.get(season);
  };

  let isHeader = true;
  let deliveryCount = 0;

  console.log('⚡ Processing 295,000+ ball-by-ball delivery records with strict CSV quoting parser...');

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    deliveryCount++;

    const parts = parseCSVLine(line);
    if (parts.length < 22) continue;

    const matchId = parts[0]?.trim();
    const season = normalizeSeason(parts[1]);
    const battingTeam = parts[7]?.trim();
    const bowlingTeam = parts[8]?.trim();
    const striker = parts[9]?.trim();
    const nonStriker = parts[10]?.trim();
    const bowler = parts[11]?.trim();
    const runsOffBat = parseInt(parts[12], 10) || 0;
    const extras = parseInt(parts[13], 10) || 0;
    const wides = parseInt(parts[14], 10) || 0;
    const noballs = parseInt(parts[15], 10) || 0;
    const wicketType = parts[20]?.trim();
    const playerDismissed = parts[21]?.trim();

    const battingTeamCode = TEAM_NAME_TO_CODE[battingTeam] || (battingTeam && battingTeam.length <= 4 ? battingTeam : 'IPL');
    const bowlingTeamCode = TEAM_NAME_TO_CODE[bowlingTeam] || (bowlingTeam && bowlingTeam.length <= 4 ? bowlingTeam : 'IPL');

    // 1. Process Striker (Batting)
    if (striker) {
      const p = getPlayer(striker);
      if (p) {
        p.seasons.add(season);
        p.matchIds.add(matchId);
        if (battingTeamCode !== 'IPL') p.teams.add(battingTeamCode);
        p.runs += runsOffBat;
        if (wides === 0) p.ballsFaced += 1;

        const curScore = (p.inningsBatting.get(matchId) || 0) + runsOffBat;
        p.inningsBatting.set(matchId, curScore);

        const s = getSeasonEntry(p, season);
        s.matches.add(matchId);
        if (battingTeamCode !== 'IPL') s.teams.add(battingTeamCode);
        s.runs += runsOffBat;
        if (wides === 0) s.ballsFaced += 1;
        const curSeasonScore = (s.matchBatting.get(matchId) || 0) + runsOffBat;
        s.matchBatting.set(matchId, curSeasonScore);
      }
    }

    // 2. Process Non-Striker (Appearance in match)
    if (nonStriker) {
      const p = getPlayer(nonStriker);
      if (p) {
        p.seasons.add(season);
        p.matchIds.add(matchId);
        if (battingTeamCode !== 'IPL') p.teams.add(battingTeamCode);
        const s = getSeasonEntry(p, season);
        s.matches.add(matchId);
        if (battingTeamCode !== 'IPL') s.teams.add(battingTeamCode);
      }
    }

    // 3. Process Bowler (Bowling)
    if (bowler) {
      const p = getPlayer(bowler);
      if (p) {
        p.seasons.add(season);
        p.matchIds.add(matchId);
        if (bowlingTeamCode !== 'IPL') p.teams.add(bowlingTeamCode);

        const isLegalBall = wides === 0 && noballs === 0;
        if (isLegalBall) p.ballsBowled += 1;

        const bowlerRuns = runsOffBat + wides + noballs;
        p.runsConceded += bowlerRuns;

        const isBowlerWicket = wicketType && !['run out', 'retired hurt', 'obstructing the field', 'retired out'].includes(wicketType);
        const wicketInc = isBowlerWicket ? 1 : 0;
        if (isBowlerWicket) p.wickets += 1;

        const matchBowl = p.matchBowling.get(matchId) || { wickets: 0, runs: 0 };
        matchBowl.wickets += wicketInc;
        matchBowl.runs += bowlerRuns;
        p.matchBowling.set(matchId, matchBowl);

        const s = getSeasonEntry(p, season);
        s.matches.add(matchId);
        if (bowlingTeamCode !== 'IPL') s.teams.add(bowlingTeamCode);
        if (isLegalBall) s.ballsBowled += 1;
        s.runsConceded += bowlerRuns;
        if (isBowlerWicket) s.wickets += 1;

        const sMatchBowl = s.matchBowling.get(matchId) || { wickets: 0, runs: 0 };
        sMatchBowl.wickets += wicketInc;
        sMatchBowl.runs += bowlerRuns;
        s.matchBowling.set(matchId, sMatchBowl);
      }
    }
  }

  console.log(`✅ Deliveries processed: ${deliveryCount}. Total unique players found: ${playerMap.size}`);
  console.log('📊 Calculating career and season-by-season milestones...');

  const compiledPlayers = [];

  for (const [name, p] of playerMap.entries()) {
    // 1. Batting milestones
    for (const score of p.inningsBatting.values()) {
      if (score > p.highestScore) p.highestScore = score;
      if (score >= 100) p.hundreds++;
      else if (score >= 50) p.fifties++;
    }

    // 2. Bowling milestones
    for (const b of p.matchBowling.values()) {
      if (b.wickets > p.bestWickets || (b.wickets === p.bestWickets && b.runs < p.bestRunsConceded)) {
        p.bestWickets = b.wickets;
        p.bestRunsConceded = b.runs;
      }
      if (b.wickets >= 5) p.fiveWickets++;
      else if (b.wickets === 4) p.fourWickets++;
    }

    const oversBowled = parseFloat((Math.floor(p.ballsBowled / 6) + (p.ballsBowled % 6) / 10).toFixed(1));
    const strikeRate = p.ballsFaced > 0 ? parseFloat(((p.runs / p.ballsFaced) * 100).toFixed(2)) : 0;
    const economy = p.ballsBowled > 0 ? parseFloat(((p.runsConceded / (p.ballsBowled / 6))).toFixed(2)) : 0;
    const bestBowling = p.bestWickets > 0 ? `${p.bestWickets}/${p.bestRunsConceded === 999 ? 0 : p.bestRunsConceded}` : '0/0';

    // 3. Process Season Stats
    const seasonStatsList = [];
    for (const [seasonYear, s] of p.seasonData.entries()) {
      for (const score of s.matchBatting.values()) {
        if (score > s.highestScore) s.highestScore = score;
        if (score >= 100) s.hundreds++;
        else if (score >= 50) s.fifties++;
      }
      for (const b of s.matchBowling.values()) {
        if (b.wickets > s.bestWickets || (b.wickets === s.bestWickets && b.runs < s.bestRunsConceded)) {
          s.bestWickets = b.wickets;
          s.bestRunsConceded = b.runs;
        }
        if (b.wickets >= 5) s.fiveWickets++;
        else if (b.wickets === 4) s.fourWickets++;
      }

      const sOvers = parseFloat((Math.floor(s.ballsBowled / 6) + (s.ballsBowled % 6) / 10).toFixed(1));
      const sSR = s.ballsFaced > 0 ? parseFloat(((s.runs / s.ballsFaced) * 100).toFixed(2)) : 0;
      const sEcon = s.ballsBowled > 0 ? parseFloat(((s.runsConceded / (s.ballsBowled / 6))).toFixed(2)) : 0;

      seasonStatsList.push({
        season: seasonYear,
        matches: s.matches.size,
        runs: s.runs,
        ballsFaced: s.ballsFaced,
        wickets: s.wickets,
        oversBowled: sOvers,
        runsConceded: s.runsConceded,
        strikeRate: sSR,
        economy: sEcon,
        highestScore: s.highestScore,
        bestBowling: s.bestWickets > 0 ? `${s.bestWickets}/${s.bestRunsConceded === 999 ? 0 : s.bestRunsConceded}` : '0/0',
        fifties: s.fifties,
        hundreds: s.hundreds,
        fourWickets: s.fourWickets,
        fiveWickets: s.fiveWickets,
        teams: Array.from(s.teams)
      });
    }

    seasonStatsList.sort((a, b) => a.season - b.season);

    const seasonsPlayed = Array.from(p.seasons).sort((a, b) => a - b);
    const iplDebutYear = seasonsPlayed.length > 0 ? seasonsPlayed[0] : 2008;

    // 4. Franchise history
    const franchiseHistory = Array.from(p.teams).map(code => ({
      franchiseCode: code,
      franchiseName: TEAM_CODE_TO_NAME[code] || code,
      seasons: seasonsPlayed.filter(s => p.seasonData.get(s)?.teams.has(code))
    }));

    // 5. Determine Role
    let role = 'All-Rounder';
    if (KNOWN_WICKETKEEPERS.has(name)) {
      role = 'Wicketkeeper';
    } else if (p.runs >= 1000 && p.wickets < 10) {
      role = 'Batsman';
    } else if (p.wickets >= 25 && p.runs < 400) {
      role = 'Bowler';
    } else if (p.runs >= 500 && p.wickets >= 15) {
      role = 'All-Rounder';
    } else if (p.ballsBowled > p.ballsFaced * 2) {
      role = 'Bowler';
    } else {
      role = 'Batsman';
    }

    // 6. Nationality & Overseas status
    const overseasList = [
      'David Warner', 'AB de Villiers', 'Chris Gayle', 'Lasith Malinga', 'Kieron Pollard',
      'Dwayne Bravo', 'Shane Watson', 'Faf du Plessis', 'Jos Buttler', 'Glenn Maxwell',
      'Andre Russell', 'Sunil Narine', 'Rashid Khan', 'Quinton de Kock', 'Pat Cummins',
      'Mitchell Starc', 'Heinrich Klaasen', 'Travis Head', 'Kagiso Rabada', 'Trent Boult',
      'Sam Curran', 'Nicholas Pooran', 'Marcus Stoinis', 'Adam Gilchrist', 'Brendon McCullum',
      'Jacques Kallis', 'Dale Steyn', 'Michael Hussey', 'Shaun Marsh', 'Matthew Hayden',
      'Muttiah Muralitharan', 'Steve Smith', 'Kane Williamson', 'David Miller', 'Shimron Hetmyer',
      'Lockie Ferguson', 'Tim Southee', 'Anrich Nortje', 'Wanindu Hasaranga', 'Maheesh Theekshana',
      'Noor Ahmad', 'Fazalhaq Farooqi', 'Alzarri Joseph', 'Jason Holder', 'Moeen Ali', 'Liam Livingstone'
    ];
    const isOverseas = overseasList.some(o => name.toLowerCase().includes(o.toLowerCase()));
    const country = isOverseas ? 'Overseas' : 'India';

    // 7. Base price calculation
    let basePriceCr = 0.50;
    if (p.runs >= 3000 || p.wickets >= 100 || name === 'MS Dhoni' || name === 'Virat Kohli') {
      basePriceCr = 2.0;
    } else if (p.runs >= 2000 || p.wickets >= 75) {
      basePriceCr = 1.5;
    } else if (p.runs >= 1000 || p.wickets >= 40) {
      basePriceCr = 1.0;
    } else if (p.runs >= 500 || p.wickets >= 20) {
      basePriceCr = 0.75;
    } else if (p.matchIds.size >= 15) {
      basePriceCr = 0.50;
    } else {
      basePriceCr = 0.30;
    }

    // 8. Auction Category
    let category = 'Uncapped / Reserve';
    const marqueeCandidates = ['Virat Kohli', 'Rohit Sharma', 'Jasprit Bumrah', 'MS Dhoni', 'AB de Villiers', 'David Warner', 'Chris Gayle', 'Suresh Raina', 'Lasith Malinga', 'Sunil Narine', 'Andre Russell', 'Ravindra Jadeja', 'Hardik Pandya', 'Rashid Khan', 'KL Rahul', 'Heinrich Klaasen', 'Pat Cummins'];
    if (marqueeCandidates.includes(name)) {
      category = 'Marquee Players';
    } else if (role === 'Batsman') {
      category = 'Batsmen';
    } else if (role === 'Wicketkeeper') {
      category = 'Wicketkeepers';
    } else if (role === 'All-Rounder') {
      category = 'All-Rounders';
    } else if (role === 'Bowler') {
      category = economy < 7.5 ? 'Spinners' : 'Fast Bowlers';
    }

    compiledPlayers.push({
      name,
      aliases: Array.from(p.aliases),
      role,
      country,
      nationality: isOverseas ? 'Overseas' : 'India',
      battingStyle: 'Right-hand bat',
      bowlingStyle: 'Right-arm medium',
      basePriceCr,
      category,
      iplDebutYear,
      seasonsPlayed,
      franchiseHistory,
      iplStats: {
        matches: p.matchIds.size,
        runs: p.runs,
        ballsFaced: p.ballsFaced,
        wickets: p.wickets,
        oversBowled,
        runsConceded: p.runsConceded,
        strikeRate,
        economy,
        highestScore: p.highestScore,
        bestBowling,
        fifties: p.fifties,
        hundreds: p.hundreds,
        fourWickets: p.fourWickets,
        fiveWickets: p.fiveWickets
      },
      seasonStats: seasonStatsList,
      isCapped: p.matchIds.size >= 5,
      isCustom: false,
      isRetired: seasonsPlayed.length > 0 && Math.max(...seasonsPlayed) < 2022,
      isAuctionEligible: true,
      image: '',
      dataSource: 'Cricsheet (ODC-By v1.0, 2008-2026)',
      lastUpdated: new Date()
    });
  }

  compiledPlayers.sort((a, b) => b.iplStats.runs + b.iplStats.wickets * 20 - (a.iplStats.runs + a.iplStats.wickets * 20));

  console.log(`\n🎉 Compiled ${compiledPlayers.length} clean historical IPL player profiles!`);

  const outPath = path.join(__dirname, '../data/historical_players.json');
  fs.writeFileSync(outPath, JSON.stringify(compiledPlayers, null, 2), 'utf8');
  console.log(`💾 Saved historical players archive to: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);

  return compiledPlayers;
};

if (require.main === module) {
  processHistoricalIPLData()
    .then((players) => {
      console.log(`\n✅ Finished compiling ${players.length} players from 2008-2026.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Processing failed:', err);
      process.exit(1);
    });
}

module.exports = { processHistoricalIPLData };
