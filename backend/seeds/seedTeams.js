const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const Team = require('../models/Team');

const officialFranchises = [
  {
    franchiseId: 'csk',
    name: 'Chennai Super Kings',
    code: 'CSK',
    shortName: 'Chennai',
    tagline: 'Whistle Podu',
    trophies: 5,
    trophyYears: [2010, 2011, 2018, 2021, 2023],
    homeVenue: 'M. A. Chidambaram Stadium, Chennai',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#FDB913',
      secondaryColor: '#0081E9',
      accentColor: '#E2A109',
      textColor: '#0B132B',
      symbol: '🦁',
      badgeBg: 'bg-amber-400',
      gradient: 'from-[#FDB913]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'mi',
    name: 'Mumbai Indians',
    code: 'MI',
    shortName: 'Mumbai',
    tagline: 'Duniya Hila Denge',
    trophies: 5,
    trophyYears: [2013, 2015, 2017, 2019, 2020],
    homeVenue: 'Wankhede Stadium, Mumbai',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#004BA0',
      secondaryColor: '#D1AB3E',
      accentColor: '#0078FF',
      textColor: '#FFFFFF',
      symbol: '🌀',
      badgeBg: 'bg-blue-600',
      gradient: 'from-[#004BA0]/30 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'rcb',
    name: 'Royal Challengers Bengaluru',
    code: 'RCB',
    shortName: 'Bengaluru',
    tagline: 'Play Bold',
    trophies: 0,
    trophyYears: [],
    homeVenue: 'M. Chinnaswamy Stadium, Bengaluru',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#EC1C24',
      secondaryColor: '#000000',
      accentColor: '#C9922C',
      textColor: '#FFFFFF',
      symbol: '👑',
      badgeBg: 'bg-red-600',
      gradient: 'from-[#EC1C24]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'kkr',
    name: 'Kolkata Knight Riders',
    code: 'KKR',
    shortName: 'Kolkata',
    tagline: 'Korbo Lorbo Jeetbo',
    trophies: 3,
    trophyYears: [2012, 2014, 2024],
    homeVenue: 'Eden Gardens, Kolkata',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#3A225D',
      secondaryColor: '#ECC542',
      accentColor: '#8E44AD',
      textColor: '#FFFFFF',
      symbol: '⚔️',
      badgeBg: 'bg-purple-700',
      gradient: 'from-[#3A225D]/40 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'srh',
    name: 'Sunrisers Hyderabad',
    code: 'SRH',
    shortName: 'Hyderabad',
    tagline: 'Orange Army',
    trophies: 1,
    trophyYears: [2016],
    homeVenue: 'Rajiv Gandhi Intl Cricket Stadium, Hyderabad',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#F26522',
      secondaryColor: '#000000',
      accentColor: '#FF8533',
      textColor: '#FFFFFF',
      symbol: '🦅',
      badgeBg: 'bg-orange-600',
      gradient: 'from-[#F26522]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'rr',
    name: 'Rajasthan Royals',
    code: 'RR',
    shortName: 'Rajasthan',
    tagline: 'Halla Bol',
    trophies: 1,
    trophyYears: [2008],
    homeVenue: 'Sawai Mansingh Stadium, Jaipur',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#EA1A85',
      secondaryColor: '#004B8C',
      accentColor: '#FF409E',
      textColor: '#FFFFFF',
      symbol: '🏰',
      badgeBg: 'bg-pink-600',
      gradient: 'from-[#EA1A85]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'dc',
    name: 'Delhi Capitals',
    code: 'DC',
    shortName: 'Delhi',
    tagline: 'Roar Macha',
    trophies: 0,
    trophyYears: [],
    homeVenue: 'Arun Jaitley Stadium, New Delhi',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#004C97',
      secondaryColor: '#DC143C',
      accentColor: '#1E90FF',
      textColor: '#FFFFFF',
      symbol: '🐯',
      badgeBg: 'bg-sky-600',
      gradient: 'from-[#004C97]/30 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'pbks',
    name: 'Punjab Kings',
    code: 'PBKS',
    shortName: 'Punjab',
    tagline: 'Sadda Punjab',
    trophies: 0,
    trophyYears: [],
    homeVenue: 'PCA New Stadium, Mullanpur',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#D71920',
      secondaryColor: '#C9A74E',
      accentColor: '#FF4757',
      textColor: '#FFFFFF',
      symbol: '🛡️',
      badgeBg: 'bg-rose-700',
      gradient: 'from-[#D71920]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'gt',
    name: 'Gujarat Titans',
    code: 'GT',
    shortName: 'Gujarat',
    tagline: 'Aava De',
    trophies: 1,
    trophyYears: [2022],
    homeVenue: 'Narendra Modi Stadium, Ahmedabad',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#1B2133',
      secondaryColor: '#C9A74E',
      accentColor: '#34495E',
      textColor: '#FFFFFF',
      symbol: '⚡',
      badgeBg: 'bg-slate-700',
      gradient: 'from-[#1B2133]/80 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  },
  {
    franchiseId: 'lsg',
    name: 'Lucknow Super Giants',
    code: 'LSG',
    shortName: 'Lucknow',
    tagline: 'Ab Apni Baari Hai',
    trophies: 0,
    trophyYears: [],
    homeVenue: 'BRSABV Ekana Stadium, Lucknow',
    totalPurseCr: 120.0,
    brand: {
      primaryColor: '#0057E7',
      secondaryColor: '#F46C38',
      accentColor: '#4CA1AF',
      textColor: '#FFFFFF',
      symbol: '🪶',
      badgeBg: 'bg-cyan-600',
      gradient: 'from-[#0057E7]/25 via-[#0B132B] to-[#070C18]'
    },
    isActive: true
  }
];

/**
 * Idempotent seeder function using upsert
 */
const seedTeams = async () => {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await connectDB();

    console.log('Upserting 10 official IPL franchises...');
    const operations = officialFranchises.map((team) => ({
      updateOne: {
        filter: { code: team.code },
        update: { $set: team },
        upsert: true
      }
    }));

    const result = await Team.bulkWrite(operations);
    console.log(`✅ Franchises bulkWrite finished: Matched: ${result.matchedCount}, Upserted: ${result.upsertedCount}, Modified: ${result.modifiedCount}`);

    const count = await Team.countDocuments();
    console.log(`📊 Total franchises in database: ${count}`);

    return { success: true, count, result };
  } catch (error) {
    console.error('❌ Error seeding teams:', error.message);
    throw error;
  }
};

// Allow direct CLI execution
if (require.main === module) {
  seedTeams()
    .then(() => {
      console.log('Team seeding finished successfully.');
      process.exit(0);
    })
    .catch(() => process.exit(1));
}

module.exports = { seedTeams, officialFranchises };
