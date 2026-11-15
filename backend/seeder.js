const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const Team = require('./models/Team');
const Player = require('./models/Player');
const seedTeams = require('./data/seedTeams');
const seedPlayers = require('./data/seedPlayers');

/**
 * Seed Database with Official 10 IPL Franchises and Initial Player Pool
 */
const importData = async () => {
  try {
    await connectDB();

    console.log('\n🧹 Clearing existing Teams and Players...');
    await Team.deleteMany({});
    await Player.deleteMany({});

    console.log('🏏 Seeding 10 Official IPL Franchises...');
    const createdTeams = await Team.insertMany(seedTeams);
    console.log(`✅ Successfully seeded ${createdTeams.length} IPL Franchises!`);

    console.log('🌟 Seeding Marquee & Core IPL Players Pool...');
    const createdPlayers = await Player.insertMany(seedPlayers);
    console.log(`✅ Successfully seeded ${createdPlayers.length} Cricket Players!`);

    console.log('\n🎉 [Database Seeding Complete]: ipl_auction_arena is ready for auction gameplay!\n');
    process.exit(0);
  } catch (error) {
    console.error(`❌ [Seeder Error]: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Destroy Data
 */
const destroyData = async () => {
  try {
    await connectDB();

    console.log('⚠️ Purging Teams and Players...');
    await Team.deleteMany({});
    await Player.deleteMany({});

    console.log('🗑️ Data destroyed!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ [Destroy Error]: ${error.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === '-d') {
  destroyData();
} else {
  importData();
}
