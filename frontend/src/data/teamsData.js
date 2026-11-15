/**
 * Official data and branding profiles for all 10 IPL Franchises
 * Applied strictly according to franchise identities without uniform generic colors
 */
export const IPL_TEAMS = [
  {
    id: 'csk',
    code: 'CSK',
    name: 'Chennai Super Kings',
    shortName: 'Chennai',
    tagline: 'Whistle Podu',
    trophies: 5,
    trophyYears: [2010, 2011, 2018, 2021, 2023],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'M. A. Chidambaram Stadium, Chennai',
    captain: 'Ruturaj Gaikwad',
    brand: {
      primaryColor: '#FDB913',
      secondaryColor: '#0081E9',
      accentColor: '#E2A109',
      textColor: '#0B132B',
      badgeBg: 'bg-amber-400',
      badgeText: 'text-navy-950',
      borderClass: 'border-yellow-400/50 hover:border-yellow-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(253,185,19,0.35)]',
      gradient: 'from-[#FDB913]/20 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950',
      symbol: '🦁'
    }
  },
  {
    id: 'mi',
    code: 'MI',
    name: 'Mumbai Indians',
    shortName: 'Mumbai',
    tagline: 'Duniya Hila Denge',
    trophies: 5,
    trophyYears: [2013, 2015, 2017, 2019, 2020],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Wankhede Stadium, Mumbai',
    captain: 'Hardik Pandya',
    brand: {
      primaryColor: '#004BA0',
      secondaryColor: '#D1AB3E',
      accentColor: '#0078FF',
      textColor: '#FFFFFF',
      badgeBg: 'bg-blue-600',
      badgeText: 'text-white',
      borderClass: 'border-blue-500/50 hover:border-blue-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(0,75,160,0.4)]',
      gradient: 'from-[#004BA0]/30 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white',
      symbol: '🌀'
    }
  },
  {
    id: 'rcb',
    code: 'RCB',
    name: 'Royal Challengers Bengaluru',
    shortName: 'Bengaluru',
    tagline: 'Ee Sala Cup Namde',
    trophies: 0,
    trophyYears: [],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'M. Chinnaswamy Stadium, Bengaluru',
    captain: 'Faf du Plessis',
    brand: {
      primaryColor: '#EC1C24',
      secondaryColor: '#000000',
      accentColor: '#C9922C',
      textColor: '#FFFFFF',
      badgeBg: 'bg-red-600',
      badgeText: 'text-white',
      borderClass: 'border-red-600/50 hover:border-red-500',
      glowClass: 'hover:shadow-[0_0_20px_rgba(236,28,36,0.35)]',
      gradient: 'from-[#EC1C24]/25 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-red-600 to-rose-700 text-white',
      symbol: '👑'
    }
  },
  {
    id: 'kkr',
    code: 'KKR',
    name: 'Kolkata Knight Riders',
    shortName: 'Kolkata',
    tagline: 'Korbo Lorbo Jeetbo',
    trophies: 3,
    trophyYears: [2012, 2014, 2024],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Eden Gardens, Kolkata',
    captain: 'Shreyas Iyer',
    brand: {
      primaryColor: '#3A225D',
      secondaryColor: '#ECC542',
      accentColor: '#8E44AD',
      textColor: '#FFFFFF',
      badgeBg: 'bg-purple-700',
      badgeText: 'text-amber-300',
      borderClass: 'border-purple-500/50 hover:border-purple-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(142,68,173,0.35)]',
      gradient: 'from-[#3A225D]/40 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-purple-800 to-indigo-700 text-amber-300',
      symbol: '⚔️'
    }
  },
  {
    id: 'dc',
    code: 'DC',
    name: 'Delhi Capitals',
    shortName: 'Delhi',
    tagline: 'Roar Macha',
    trophies: 0,
    trophyYears: [],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Arun Jaitley Stadium, New Delhi',
    captain: 'Rishabh Pant',
    brand: {
      primaryColor: '#004C97',
      secondaryColor: '#DC143C',
      accentColor: '#1E90FF',
      textColor: '#FFFFFF',
      badgeBg: 'bg-sky-600',
      badgeText: 'text-white',
      borderClass: 'border-sky-500/50 hover:border-sky-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(0,76,151,0.4)]',
      gradient: 'from-[#004C97]/30 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-sky-700 to-red-600 text-white',
      symbol: '🐯'
    }
  },
  {
    id: 'rr',
    code: 'RR',
    name: 'Rajasthan Royals',
    shortName: 'Rajasthan',
    tagline: 'Halla Bol',
    trophies: 1,
    trophyYears: [2008],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Sawai Mansingh Stadium, Jaipur',
    captain: 'Sanju Samson',
    brand: {
      primaryColor: '#EA1A85',
      secondaryColor: '#004B8C',
      accentColor: '#FF409E',
      textColor: '#FFFFFF',
      badgeBg: 'bg-pink-600',
      badgeText: 'text-white',
      borderClass: 'border-pink-500/50 hover:border-pink-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(234,26,133,0.35)]',
      gradient: 'from-[#EA1A85]/25 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-pink-600 to-pink-500 text-white',
      symbol: '🏰'
    }
  },
  {
    id: 'srh',
    code: 'SRH',
    name: 'Sunrisers Hyderabad',
    shortName: 'Hyderabad',
    tagline: 'Orange Army',
    trophies: 1,
    trophyYears: [2016],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Rajiv Gandhi Intl Stadium, Hyderabad',
    captain: 'Pat Cummins',
    brand: {
      primaryColor: '#F26522',
      secondaryColor: '#000000',
      accentColor: '#FF8533',
      textColor: '#FFFFFF',
      badgeBg: 'bg-orange-600',
      badgeText: 'text-white',
      borderClass: 'border-orange-500/50 hover:border-orange-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(242,101,34,0.4)]',
      gradient: 'from-[#F26522]/25 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-orange-600 to-amber-600 text-white',
      symbol: '🦅'
    }
  },
  {
    id: 'gt',
    code: 'GT',
    name: 'Gujarat Titans',
    shortName: 'Gujarat',
    tagline: 'Aava De',
    trophies: 1,
    trophyYears: [2022],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'Narendra Modi Stadium, Ahmedabad',
    captain: 'Shubman Gill',
    brand: {
      primaryColor: '#1B2133',
      secondaryColor: '#C9A74E',
      accentColor: '#34495E',
      textColor: '#FFFFFF',
      badgeBg: 'bg-slate-700',
      badgeText: 'text-amber-400',
      borderClass: 'border-amber-400/40 hover:border-amber-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(201,167,78,0.3)]',
      gradient: 'from-[#1B2133]/80 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-slate-800 to-amber-700 text-amber-300',
      symbol: '⚡'
    }
  },
  {
    id: 'lsg',
    code: 'LSG',
    name: 'Lucknow Super Giants',
    shortName: 'Lucknow',
    tagline: 'Ab Apni Baari Hai',
    trophies: 0,
    trophyYears: [],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'BRSABV Ekana Stadium, Lucknow',
    captain: 'Nicholas Pooran',
    brand: {
      primaryColor: '#0057E7',
      secondaryColor: '#F46C38',
      accentColor: '#4CA1AF',
      textColor: '#FFFFFF',
      badgeBg: 'bg-cyan-600',
      badgeText: 'text-white',
      borderClass: 'border-cyan-500/50 hover:border-cyan-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(0,87,231,0.35)]',
      gradient: 'from-[#0057E7]/25 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white',
      symbol: '🪶'
    }
  },
  {
    id: 'pbks',
    code: 'PBKS',
    name: 'Punjab Kings',
    shortName: 'Punjab',
    tagline: 'Sadda Punjab',
    trophies: 0,
    trophyYears: [],
    totalPurseCr: 120.0,
    remainingPurseCr: 120.0,
    homeVenue: 'PCA Stadium, Mohali / Mullanpur',
    captain: 'Sam Curran',
    brand: {
      primaryColor: '#D71920',
      secondaryColor: '#C9A74E',
      accentColor: '#FF4757',
      textColor: '#FFFFFF',
      badgeBg: 'bg-rose-700',
      badgeText: 'text-amber-300',
      borderClass: 'border-rose-500/50 hover:border-rose-400',
      glowClass: 'hover:shadow-[0_0_20px_rgba(215,25,32,0.35)]',
      gradient: 'from-[#D71920]/25 via-[#0B132B] to-[#070C18]',
      headerBadge: 'bg-gradient-to-r from-rose-700 to-red-800 text-amber-300',
      symbol: '🛡️'
    }
  }
].map((t) => ({
  ...t,
  logoUrl: `/assets/teams/${t.id}.png`
}));

export const getFranchiseLogo = (codeOrId) => {
  if (!codeOrId) return '/icon-192.svg';
  const clean = String(codeOrId).toLowerCase().trim();
  const valid = ['csk', 'mi', 'rcb', 'kkr', 'srh', 'rr', 'dc', 'pbks', 'gt', 'lsg'];
  if (valid.includes(clean)) {
    return `/assets/teams/${clean}.png`;
  }
  const match = IPL_TEAMS.find((t) => t.code.toLowerCase() === clean || t.name.toLowerCase().includes(clean));
  return match ? match.logoUrl : `/assets/teams/csk.png`;
};
