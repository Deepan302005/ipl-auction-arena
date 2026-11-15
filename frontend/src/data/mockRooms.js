import { IPL_TEAMS } from './teamsData.js';

const baseFranchises = IPL_TEAMS.map((t) => ({
  franchiseId: t.id,
  name: t.name,
  code: t.code,
  tagline: t.tagline,
  brand: {
    primaryColor: t.brand.primaryColor,
    secondaryColor: t.brand.secondaryColor,
    accentColor: t.brand.accentColor,
    textColor: t.brand.textColor,
    symbol: t.brand.symbol
  },
  totalPurseCr: 120.0,
  remainingPurseCr: 120.0,
  claimedBy: null,
  claimedByName: '',
  squad: []
}));

export const MOCK_ROOMS = {
  'IPL-DEMO': {
    roomCode: 'IPL-DEMO',
    roomName: 'IPL 2026 Mega Auction - Grand Lobby',
    host: 'user_host_1',
    hostName: 'Vikram Singhania',
    isPrivate: false,
    status: 'waiting',
    participants: [
      { _id: 'user_host_1', name: 'Vikram Singhania', email: 'host@iplarena.com', favoriteTeam: 'CSK', isOnline: true },
      { _id: 'user_p1_2', name: 'Ananya Sharma', email: 'p1@iplarena.com', favoriteTeam: 'MI', isOnline: true },
      { _id: 'user_p2_3', name: 'Rohan Verma', email: 'p2@iplarena.com', favoriteTeam: 'RCB', isOnline: true }
    ],
    franchises: baseFranchises.map((f) => {
      if (f.code === 'CSK') return { ...f, claimedBy: 'user_host_1', claimedByName: 'Vikram Singhania' };
      if (f.code === 'MI') return { ...f, claimedBy: 'user_p1_2', claimedByName: 'Ananya Sharma' };
      if (f.code === 'RCB') return { ...f, claimedBy: 'user_p2_3', claimedByName: 'Rohan Verma' };
      return f;
    }),
    settings: {
      timerSeconds: 15,
      bidExtensionSeconds: 10,
      auctionMode: 'marquee-first',
      startingPurseCr: 120.0,
      minSquadSize: 18,
      maxSquadSize: 25,
      maxOverseas: 8,
      incrementLadderType: 'official'
    },
    auctionQueueCount: 120,
    unsoldQueueCount: 0,
    completedLotsCount: 0
  },

  'IPL-LIVE': {
    roomCode: 'IPL-LIVE',
    roomName: 'IPL 2026 Live Arena - Marquee Set',
    host: 'user_host_1',
    hostName: 'Vikram Singhania',
    isPrivate: false,
    status: 'live',
    participants: [
      { _id: 'user_host_1', name: 'Vikram Singhania', email: 'host@iplarena.com', favoriteTeam: 'CSK', isOnline: true },
      { _id: 'user_p1_2', name: 'Ananya Sharma', email: 'p1@iplarena.com', favoriteTeam: 'MI', isOnline: true },
      { _id: 'user_p2_3', name: 'Rohan Verma', email: 'p2@iplarena.com', favoriteTeam: 'RCB', isOnline: true }
    ],
    franchises: baseFranchises.map((f) => {
      if (f.code === 'CSK') return { ...f, claimedBy: 'user_host_1', claimedByName: 'Vikram Singhania' };
      if (f.code === 'MI') return { ...f, claimedBy: 'user_p1_2', claimedByName: 'Ananya Sharma' };
      if (f.code === 'RCB') return { ...f, claimedBy: 'user_p2_3', claimedByName: 'Rohan Verma', remainingPurseCr: 104.5 };
      return f;
    }),
    currentAuction: {
      player: {
        _id: 'player_vk_18',
        name: 'Virat Kohli',
        role: 'Batter',
        category: 'Batsman',
        country: 'India',
        nationality: 'Indian',
        isOverseas: false,
        battingStyle: 'Right-hand bat',
        bowlingStyle: 'Right-arm medium',
        basePriceCr: 2.0,
        iplStats: {
          matches: 252,
          runs: 8004,
          highestScore: 113,
          strikeRate: 131.97,
          fifties: 55,
          centuries: 8,
          fours: 705,
          sixes: 272
        }
      },
      currentBidCr: 15.5,
      currentBidderFranchise: 'RCB',
      currentBidderName: 'Rohan Verma',
      currentBidderUser: 'user_p2_3',
      lotIndex: 1,
      timerDuration: 15,
      timerRemaining: 9,
      bidCount: 6,
      status: 'bidding',
      bidHistory: [
        { franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', userName: 'Vikram Singhania', amountCr: 2.0, timestamp: new Date(Date.now() - 28000) },
        { franchiseCode: 'MI', franchiseName: 'Mumbai Indians', userName: 'Ananya Sharma', amountCr: 5.0, timestamp: new Date(Date.now() - 22000) },
        { franchiseCode: 'RCB', franchiseName: 'Royal Challengers Bengaluru', userName: 'Rohan Verma', amountCr: 8.0, timestamp: new Date(Date.now() - 17000) },
        { franchiseCode: 'CSK', franchiseName: 'Chennai Super Kings', userName: 'Vikram Singhania', amountCr: 12.0, timestamp: new Date(Date.now() - 12000) },
        { franchiseCode: 'MI', franchiseName: 'Mumbai Indians', userName: 'Ananya Sharma', amountCr: 14.0, timestamp: new Date(Date.now() - 8000) },
        { franchiseCode: 'RCB', franchiseName: 'Royal Challengers Bengaluru', userName: 'Rohan Verma', amountCr: 15.5, timestamp: new Date(Date.now() - 3000) }
      ]
    },
    settings: {
      timerSeconds: 15,
      bidExtensionSeconds: 10,
      auctionMode: 'marquee-first',
      startingPurseCr: 120.0,
      minSquadSize: 18,
      maxSquadSize: 25,
      maxOverseas: 8,
      incrementLadderType: 'official'
    },
    auctionQueueCount: 119,
    unsoldQueueCount: 0,
    completedLotsCount: 0
  },

  'IPL-DONE': {
    roomCode: 'IPL-DONE',
    roomName: 'IPL 2026 Concluded Auction',
    host: 'user_host_1',
    hostName: 'Vikram Singhania',
    isPrivate: false,
    status: 'completed',
    participants: [
      { _id: 'user_host_1', name: 'Vikram Singhania', email: 'host@iplarena.com', favoriteTeam: 'CSK', isOnline: true }
    ],
    franchises: baseFranchises.map((f) => {
      if (f.code === 'CSK') {
        return {
          ...f,
          claimedBy: 'user_host_1',
          claimedByName: 'Vikram Singhania',
          remainingPurseCr: 94.0,
          squad: [
            { player: 'p_bumrah', name: 'Jasprit Bumrah', role: 'Bowler', country: 'India', boughtForCr: 16.0 },
            { player: 'p_rohit', name: 'Rohit Sharma', role: 'Batter', country: 'India', boughtForCr: 10.0 }
          ]
        };
      }
      if (f.code === 'RCB') {
        return {
          ...f,
          claimedBy: 'user_p2_3',
          claimedByName: 'Rohan Verma',
          remainingPurseCr: 104.5,
          squad: [
            { player: 'p_virat', name: 'Virat Kohli', role: 'Batter', country: 'India', boughtForCr: 15.5 }
          ]
        };
      }
      return f;
    }),
    completedLots: [
      { player: { name: 'Virat Kohli', role: 'Batter', country: 'India' }, status: 'sold', soldToFranchise: 'RCB', soldPriceCr: 15.5, buyerName: 'Rohan Verma' },
      { player: { name: 'Jasprit Bumrah', role: 'Bowler', country: 'India' }, status: 'sold', soldToFranchise: 'CSK', soldPriceCr: 16.0, buyerName: 'Vikram Singhania' },
      { player: { name: 'Rohit Sharma', role: 'Batter', country: 'India' }, status: 'sold', soldToFranchise: 'CSK', soldPriceCr: 10.0, buyerName: 'Vikram Singhania' },
      { player: { name: 'Steve Smith', role: 'Batter', country: 'Australia' }, status: 'unsold', soldToFranchise: null, soldPriceCr: 0, buyerName: '' }
    ],
    settings: {
      timerSeconds: 15,
      bidExtensionSeconds: 10,
      startingPurseCr: 120.0,
      minSquadSize: 18,
      maxSquadSize: 25,
      maxOverseas: 8,
      incrementLadderType: 'official'
    },
    auctionQueueCount: 0,
    unsoldQueueCount: 1,
    completedLotsCount: 4
  }
};
