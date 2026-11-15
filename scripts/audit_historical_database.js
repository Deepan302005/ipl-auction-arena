const mongoose = require('../backend/node_modules/mongoose');
const Player = require('../backend/models/Player');
const AuctionRecord = require('../backend/models/AuctionRecord');
const fs = require('fs');
const path = require('path');

async function audit() {
  await mongoose.connect('mongodb://127.0.0.1:27017/ipl_auction_arena');

  const playerCount = await Player.countDocuments();
  const auctionCount = await AuctionRecord.countDocuments();
  console.log('MongoDB Player count:', playerCount);
  console.log('MongoDB AuctionRecord count:', auctionCount);

  // Load JSON file counts
  const jsonPlayersPath = path.join(__dirname, '../backend/data/historical_players_expanded.json');
  const jsonAuctionsPath = path.join(__dirname, '../backend/data/historical_auction_records.json');
  const jsonPlayers = JSON.parse(fs.readFileSync(jsonPlayersPath, 'utf8'));
  const jsonAuctions = JSON.parse(fs.readFileSync(jsonAuctionsPath, 'utf8'));
  console.log('JSON historical_players_expanded.json count:', jsonPlayers.length);
  console.log('JSON historical_auction_records.json count:', jsonAuctions.length);

  // Breakdown by year
  const yearStats = await AuctionRecord.aggregate([
    {
      $group: {
        _id: '$auctionYear',
        total: { $sum: 1 },
        sold: { $sum: { $cond: [{ $eq: ['$auctionResult', 'sold'] }, 1, 0] } },
        unsold: { $sum: { $cond: [{ $eq: ['$auctionResult', 'unsold'] }, 1, 0] } },
        retained: { $sum: { $cond: [{ $eq: ['$auctionResult', 'retained'] }, 1, 0] } },
        shortlisted: { $sum: { $cond: [{ $eq: ['$auctionResult', 'shortlisted'] }, 1, 0] } },
        registered_only: { $sum: { $cond: [{ $eq: ['$auctionResult', 'registered_only'] }, 1, 0] } },
        uncapped: { $sum: { $cond: ['$isUncapped', 1, 0] } },
        young: { $sum: { $cond: ['$isYoungPlayer', 1, 0] } },
        nonDebutants: { $sum: { $cond: [{ $eq: ['$hasPlayedIPL', false] }, 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  console.log('\n--- BREAKDOWN BY YEAR ---');
  console.table(yearStats);

  // Distinct players in AuctionRecord
  const distinctPlayersInAuctions = await AuctionRecord.distinct('playerName');
  console.log('\nUnique player names in AuctionRecord:', distinctPlayersInAuctions.length);

  // Players with vs without auctionHistory
  const playersWithAuction = await Player.countDocuments({ 'auctionHistory.0': { $exists: true } });
  const playersWithoutAuction = await Player.countDocuments({
    $or: [
      { auctionHistory: { $size: 0 } },
      { auctionHistory: { $exists: false } }
    ]
  });
  console.log('Canonical players WITH auctionHistory:', playersWithAuction);
  console.log('Canonical players WITHOUT auctionHistory:', playersWithoutAuction);

  // Check the 22 non-debutants
  const nonDebutants = await Player.find({ hasPlayedIPL: false }).select('name role country isUncapped isYoungPlayer dateOfBirth auctionHistory seasonsPlayed iplStats').lean();
  console.log('\n--- NON-DEBUTANTS (hasPlayedIPL: false, Total: ' + nonDebutants.length + ') ---');
  console.table(nonDebutants.map(p => ({
    name: p.name,
    role: p.role,
    country: p.country,
    uncapped: p.isUncapped,
    dob: p.dateOfBirth,
    seasons: (p.seasonsPlayed || []).join(','),
    matches: p.iplStats?.matches || 0,
    auctionCount: (p.auctionHistory || []).length
  })));

  // Check Cricsheet match deliveries for non-debutants to verify they really never played
  const cricsheetCsvPath = path.join(__dirname, '../backend/data/cricsheet/all_matches.csv');
  console.log('\n--- VERIFYING NON-DEBUTANTS AGAINST CRICSHEET MATCH ARCHIVE ---');
  if (fs.existsSync(cricsheetCsvPath)) {
    const csvContent = fs.readFileSync(cricsheetCsvPath, 'utf8');
    for (const nd of nonDebutants) {
      const appearedInCsv = csvContent.includes(nd.name);
      console.log(`   ${nd.name}: ${appearedInCsv ? '⚠️ FOUND in match balls!' : '✅ ZERO match appearances (Verified Non-Debutant)'}`);
    }
  }

  // Uncapped player analysis
  const uncappedInPlayer = await Player.find({ isUncapped: true }).select('name role country isCapped hasPlayedIPL dateOfBirth auctionHistory').lean();
  console.log('\nTotal players in Player collection with isUncapped=true:', uncappedInPlayer.length);
  const uncappedWithAuction = uncappedInPlayer.filter(p => p.auctionHistory && p.auctionHistory.length > 0);
  console.log('Uncapped players with verified auction history:', uncappedWithAuction.length);
  const uncappedWithoutAuction = uncappedInPlayer.filter(p => !p.auctionHistory || p.auctionHistory.length === 0);
  console.log('Uncapped players without auction history (derived from Cricsheet uncapped flag):', uncappedWithoutAuction.length);

  process.exit(0);
}

audit().catch(err => {
  console.error(err);
  process.exit(1);
});
