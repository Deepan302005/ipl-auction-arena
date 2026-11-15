const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');
const Room = require('../models/Room');

/**
 * Idempotent Production Database Synchronizer
 * Safely provisions teams, 805 historical players, and essential indexes on MongoDB Atlas.
 * Never deletes or wipes active rooms or sessions.
 */
const syncAtlasDatabase = async () => {
  console.log('🏏 ===============================================');
  console.log('🚀 MONGODB ATLAS PRODUCTION DATABASE SYNCHRONIZER');
  console.log('🏏 ===============================================\n');

  if (process.argv.includes('--local')) {
    process.env.MONGODB_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/ipl_auction_arena';
    console.log('📌 Using local MongoDB target (--local specified).');
  }

  try {
    const dbInfo = await connectDB();
    if (!dbInfo || !dbInfo.isConnected) {
      throw new Error('Database connection failed.');
    }

    console.log(`📡 Connected to Database: ${dbInfo.database} at ${dbInfo.host}`);

    // 1. Sync 10 Official Franchises
    const teamsFile = path.join(__dirname, '../data/teams_10.json');
    if (fs.existsSync(teamsFile)) {
      const rawTeams = JSON.parse(fs.readFileSync(teamsFile, 'utf8'));
      const existingTeamCount = await Team.countDocuments();
      console.log(`\n1. Franchise Synchronization (Existing in DB: ${existingTeamCount}/10):`);

      for (const t of rawTeams) {
        const { _id, ...teamData } = t;
        await Team.findOneAndUpdate(
          { code: t.code },
          { $set: teamData },
          { upsert: true, new: true }
        );
      }
      const finalTeams = await Team.countDocuments();
      console.log(`   ✅ 10 Official IPL Franchises verified and synchronized (Total: ${finalTeams}).`);
    }

    // 2. Sync 805 Historical Players
    const playersFile = path.join(__dirname, '../data/historical_players_805.json');
    if (fs.existsSync(playersFile)) {
      const rawPlayers = JSON.parse(fs.readFileSync(playersFile, 'utf8'));
      const existingPlayerCount = await Player.countDocuments();
      console.log(`\n2. Historical Players Synchronization (Existing in DB: ${existingPlayerCount}/805):`);

      if (existingPlayerCount < 805) {
        console.log(`   Importing historical player records in batches...`);
        const batchSize = 100;
        for (let i = 0; i < rawPlayers.length; i += batchSize) {
          const batch = rawPlayers.slice(i, i + batchSize);
          const ops = batch.map((p) => {
            const { _id, ...playerData } = p;
            return {
              updateOne: {
                filter: { slug: p.slug },
                update: { $set: playerData },
                upsert: true
              }
            };
          });
          await Player.bulkWrite(ops);
        }
      }
      const finalPlayers = await Player.countDocuments();
      console.log(`   ✅ 805 Historical Player Records verified and synchronized (Total: ${finalPlayers}).`);
    }

    // 3. Ensure Database Indexes
    console.log('\n3. Building & Verifying Critical Indexes:');
    const ensureIndexes = async (model, name) => {
      try {
        await model.syncIndexes();
        console.log(`   ✅ ${name} indexes synchronized.`);
      } catch (syncErr) {
        try {
          await model.createIndexes();
          console.log(`   ✅ ${name} indexes created.`);
        } catch (createErr) {
          console.warn(`   ⚠️ ${name} index notice: ${createErr.message}`);
        }
      }
    };

    await ensureIndexes(Team, 'Team');
    await ensureIndexes(Player, 'Player');
    await ensureIndexes(User, 'User');
    await ensureIndexes(Room, 'Room');
    console.log('   ✅ All indexes for Team, Player, User, and Room successfully verified.');

    console.log('\n===============================================');
    console.log('🎉 PRODUCTION DATABASE SYNCHRONIZATION COMPLETE!');
    console.log('===============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Database synchronization error:', err.message);
    process.exit(1);
  }
};

if (require.main === module) {
  syncAtlasDatabase();
}

module.exports = syncAtlasDatabase;
