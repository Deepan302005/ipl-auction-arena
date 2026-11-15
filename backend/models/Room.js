const mongoose = require('mongoose');

const squadMemberSchema = new mongoose.Schema(
  {
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true
    },
    name: { type: String, required: true },
    role: { type: String, required: true },
    country: { type: String, required: true },
    boughtForCr: { type: Number, required: true },
    boughtAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const franchiseSlotSchema = new mongoose.Schema(
  {
    franchiseId: { type: String, required: true }, // e.g., 'csk'
    name: { type: String, required: true },        // 'Chennai Super Kings'
    code: { type: String, required: true },        // 'CSK'
    tagline: { type: String, default: '' },
    brand: {
      primaryColor: { type: String, required: true },
      secondaryColor: { type: String, default: '#FFFFFF' },
      accentColor: { type: String, default: '#FDB913' },
      textColor: { type: String, default: '#FFFFFF' },
      symbol: { type: String, default: '🏏' }
    },
    totalPurseCr: { type: Number, default: 120.0 },
    remainingPurseCr: { type: Number, default: 120.0 },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    claimedByName: { type: String, default: '' },
    squad: [squadMemberSchema]
  },
  { _id: false }
);

const bidEntrySchema = new mongoose.Schema(
  {
    franchiseCode: { type: String, required: true },
    franchiseName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    amountCr: { type: Number, required: true },
    bidIncrementCr: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    roomName: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [50, 'Room name cannot exceed 50 characters']
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    hostName: {
      type: String,
      required: true
    },
    passcode: {
      type: String,
      default: null,
      select: false
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['waiting', 'ready', 'live', 'paused', 'completed'],
      default: 'waiting',
      index: true
    },
    settings: {
      timerSeconds: {
        type: Number,
        default: 10,
        enum: [5, 10, 15, 20, 30, 45, 60]
      },
      bidExtensionSeconds: {
        type: Number,
        default: 5,
        enum: [0, 3, 5, 10]
      },
      auctionMode: {
        type: String,
        enum: ['standard', 'fast', 'marquee-first'],
        default: 'standard'
      },
      startingPurseCr: {
        type: Number,
        default: 120.0,
        min: 20,
        max: 250
      },
      minSquadSize: {
        type: Number,
        default: 18,
        min: 10,
        max: 25
      },
      maxSquadSize: {
        type: Number,
        default: 25,
        min: 15,
        max: 30
      },
      maxOverseas: {
        type: Number,
        default: 8,
        min: 2,
        max: 10
      },
      poolType: {
        type: String,
        enum: ['all-time', 'season', 'multi-season', 'custom-only', 'curated'],
        default: 'all-time'
      },
      seasonMode: {
        type: String,
        enum: ['all-time', '2008-2015', '2016-2020', '2021-2026', 'range', 'individual'],
        default: 'all-time'
      },
      selectedStartSeason: {
        type: Number,
        default: 2008
      },
      selectedEndSeason: {
        type: Number,
        default: 2026
      },
      selectedSeasons: [{ type: Number }],
      customIncludedPlayers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      customExcludedPlayers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }],
      selectedCategories: {
        type: [String],
        default: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper']
      },
      includeRetired: { type: Boolean, default: true },
      includeCustom: { type: Boolean, default: true },
      maxQueueSize: {
        type: Number,
        default: 100,
        min: 10,
        max: 300
      },
      allowMultipleFranchisesPerUser: {
        type: Boolean,
        default: false
      },
      incrementLadderType: {
        type: String,
        enum: ['official', 'custom'],
        default: 'official'
      }
    },
    franchises: [franchiseSlotSchema],
    currentAuction: {
      player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player',
        default: null
      },
      currentBidCr: { type: Number, default: 0 },
      currentBidderFranchise: { type: String, default: null },
      currentBidderName: { type: String, default: null },
      currentBidderUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      lotIndex: { type: Number, default: 0 },
      lotStartedAt: { type: Date, default: null },
      lotExpiresAt: { type: Date, default: null },
      timerDuration: { type: Number, default: 10 },
      timerRemaining: { type: Number, default: 10 },
      bidCount: { type: Number, default: 0 },
      bidHistory: [bidEntrySchema],
      status: {
        type: String,
        enum: ['idle', 'ready', 'bidding', 'finalizing', 'sold', 'unsold', 'paused'],
        default: 'idle'
      }
    },
    auctionQueue: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }
    ],
    unsoldQueue: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Player'
      }
    ],
    completedLots: [
      {
        player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        status: { type: String, enum: ['sold', 'unsold', 'reversed'], default: 'sold' },
        soldToFranchise: { type: String, default: null },
        soldPriceCr: { type: Number, default: 0 },
        buyerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        buyerName: { type: String, default: '' },
        completedAt: { type: Date, default: Date.now },
        reversedAt: { type: Date, default: null }
      }
    ],
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Room', roomSchema);
