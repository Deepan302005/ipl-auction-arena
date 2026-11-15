const mongoose = require('mongoose');

const auctionRecordSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true
    },
    playerName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    auctionYear: {
      type: Number,
      required: true,
      index: true
    },
    iplSeason: {
      type: Number,
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'],
      default: 'All-Rounder'
    },
    country: {
      type: String,
      enum: ['India', 'Overseas'],
      default: 'India'
    },
    nationality: {
      type: String,
      default: 'India'
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
      default: false,
      index: true
    },
    dateOfBirth: {
      type: String,
      default: null
    },
    ageAtAuction: {
      type: Number,
      default: null
    },
    registrationStatus: {
      type: String,
      enum: ['registered', 'shortlisted', 'accelerated', 'retained', 'drafted', 'replacement'],
      default: 'shortlisted',
      index: true
    },
    finalShortlistStatus: {
      type: Boolean,
      default: true,
      index: true
    },
    auctionSet: {
      type: String,
      default: 'General',
      index: true
    },
    basePriceCr: {
      type: Number,
      default: 0.20
    },
    auctionResult: {
      type: String,
      enum: ['sold', 'unsold', 'withdrawn', 'retained', 'drafted', 'registered_only'],
      default: 'sold',
      index: true
    },
    winningFranchise: {
      type: String,
      default: null,
      index: true
    },
    winningPriceCr: {
      type: Number,
      default: null
    },
    sourceReference: {
      type: String,
      default: 'Official IPL/BCCI Auction Records'
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'archived', 'official'],
      default: 'verified'
    }
  },
  {
    timestamps: true
  }
);

// High-performance indexes for auction queries
auctionRecordSchema.index({ auctionYear: 1, auctionResult: 1 });
auctionRecordSchema.index({ auctionYear: 1, isUncapped: 1 });
auctionRecordSchema.index({ auctionYear: 1, isYoungPlayer: 1 });
auctionRecordSchema.index({ hasPlayedIPL: 1, isUncapped: 1 });
auctionRecordSchema.index({ playerName: 'text', auctionSet: 'text' });

module.exports = mongoose.model('AuctionRecord', auctionRecordSchema);
