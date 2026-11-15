const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    primaryColor: {
      type: String,
      required: [true, 'Primary color is required'],
      trim: true
    },
    secondaryColor: {
      type: String,
      default: '#FFFFFF',
      trim: true
    },
    accentColor: {
      type: String,
      default: '#FDB913',
      trim: true
    },
    textColor: {
      type: String,
      default: '#FFFFFF',
      trim: true
    },
    symbol: {
      type: String,
      default: '🏏'
    },
    badgeBg: {
      type: String,
      default: 'bg-blue-600'
    },
    gradient: {
      type: String,
      default: ''
    },
    logoUrl: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    franchiseId: {
      type: String,
      required: [true, 'Franchise ID is required (e.g. csk, mi)'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Franchise full name is required'],
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Team code is required (e.g. CSK, MI)'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    shortName: {
      type: String,
      required: true,
      trim: true
    },
    tagline: {
      type: String,
      default: ''
    },
    trophies: {
      type: Number,
      default: 0,
      min: 0
    },
    trophyYears: [
      {
        type: Number
      }
    ],
    homeVenue: {
      type: String,
      required: true
    },
    captain: {
      type: String,
      default: 'TBD'
    },
    totalPurseCr: {
      type: Number,
      default: 120.0,
      min: 0
    },
    brand: {
      type: brandSchema,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Team', teamSchema);
