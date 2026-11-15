const mongoose = require('mongoose');

const franchiseRecordSchema = new mongoose.Schema(
  {
    franchiseCode: { type: String, required: true },
    franchiseName: { type: String, required: true },
    seasons: [{ type: Number }]
  },
  { _id: false }
);

const seasonStatSchema = new mongoose.Schema(
  {
    season: { type: Number, required: true, index: true },
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    oversBowled: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 },
    economy: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    bestBowling: { type: String, default: '0/0' },
    fifties: { type: Number, default: 0 },
    hundreds: { type: Number, default: 0 },
    fourWickets: { type: Number, default: 0 },
    fiveWickets: { type: Number, default: 0 },
    teams: [{ type: String }]
  },
  { _id: false }
);

const auctionParticipationSchema = new mongoose.Schema(
  {
    auctionYear: { type: Number, required: true, index: true },
    iplSeason: { type: Number, required: true },
    registrationStatus: {
      type: String,
      enum: ['registered', 'shortlisted', 'accelerated', 'retained', 'drafted', 'replacement'],
      default: 'shortlisted'
    },
    finalShortlistStatus: { type: Boolean, default: true, index: true },
    auctionSet: { type: String, default: 'General' },
    basePriceCr: { type: Number, default: 0.20 },
    auctionResult: {
      type: String,
      enum: ['sold', 'unsold', 'withdrawn', 'retained', 'drafted', 'registered_only'],
      default: 'sold',
      index: true
    },
    winningFranchise: { type: String, default: null },
    winningPriceCr: { type: Number, default: null },
    sourceReference: { type: String, default: 'Official IPL/BCCI Auction Records' },
    verificationStatus: {
      type: String,
      enum: ['verified', 'archived', 'official'],
      default: 'verified'
    }
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Player name is required'],
      trim: true,
      index: true
    },
    aliases: [
      {
        type: String,
        trim: true,
        index: true
      }
    ],
    role: {
      type: String,
      required: [true, 'Player role is required'],
      enum: ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'],
      default: 'All-Rounder',
      index: true
    },
    country: {
      type: String,
      required: [true, 'Country category is required'],
      enum: ['India', 'Overseas'],
      default: 'India',
      index: true
    },
    nationality: {
      type: String,
      required: true,
      default: 'India'
    },
    battingStyle: {
      type: String,
      default: 'Right-hand bat'
    },
    bowlingStyle: {
      type: String,
      default: 'Right-arm medium'
    },
    basePriceCr: {
      type: Number,
      required: [true, 'Base price in Crores is required'],
      min: [0.20, 'Base price cannot be lower than 0.20 Cr (20 Lakh)'],
      default: 2.0
    },
    category: {
      type: String,
      default: 'Marquee Set 1',
      index: true
    },
    iplDebutYear: {
      type: Number,
      default: 2008,
      index: true
    },
    seasonsPlayed: [
      {
        type: Number,
        index: true
      }
    ],
    franchiseHistory: [franchiseRecordSchema],
    iplStats: {
      matches: { type: Number, default: 0 },
      runs: { type: Number, default: 0 },
      ballsFaced: { type: Number, default: 0 },
      wickets: { type: Number, default: 0 },
      oversBowled: { type: Number, default: 0 },
      runsConceded: { type: Number, default: 0 },
      strikeRate: { type: Number, default: 0 },
      economy: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      bestBowling: { type: String, default: '0/0' },
      fifties: { type: Number, default: 0 },
      hundreds: { type: Number, default: 0 },
      fourWickets: { type: Number, default: 0 },
      fiveWickets: { type: Number, default: 0 }
    },
    seasonStats: [seasonStatSchema],
    isCapped: {
      type: Boolean,
      default: true
    },
    isCustom: {
      type: Boolean,
      default: false,
      index: true
    },
    isRetired: {
      type: Boolean,
      default: false,
      index: true
    },
    isAuctionEligible: {
      type: Boolean,
      default: true,
      index: true
    },
    image: {
      type: String,
      default: ''
    },
    dataSource: {
      type: String,
      default: 'Cricsheet (ODC-By v1.0, 2008-2026)'
    },
    dateOfBirth: {
      type: String,
      default: null
    },
    isIndian: {
      type: Boolean,
      default: true,
      index: true
    },
    isUncapped: {
      type: Boolean,
      default: false,
      index: true
    },
    isYoungPlayer: {
      type: Boolean,
      default: false,
      index: true
    },
    hasPlayedIPL: {
      type: Boolean,
      default: true,
      index: true
    },
    auctionHistory: [auctionParticipationSchema],
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for fast search
playerSchema.index({ name: 'text', nationality: 'text', category: 'text' });
playerSchema.index({ isUncapped: 1, isYoungPlayer: 1 });
playerSchema.index({ hasPlayedIPL: 1, isAuctionEligible: 1 });

module.exports = mongoose.model('Player', playerSchema);
