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

module.exports = mongoose.model('Player', playerSchema);
