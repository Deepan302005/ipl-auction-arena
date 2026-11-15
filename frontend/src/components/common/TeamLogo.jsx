import React, { useState } from 'react';
import { User, Shield } from 'lucide-react';
import { IPL_TEAMS } from '../../data/teamsData';

/**
 * Normalizes any team code, id, or name to a standard franchise ID (e.g., 'csk', 'mi', 'rcb')
 * Returns null if identifier is missing or unrecognized. Never falls back to 'csk'.
 */
export const normalizeTeamId = (teamIdentifier) => {
  if (!teamIdentifier) return null;
  const clean = String(teamIdentifier).trim().toLowerCase();
  if (!clean) return null;

  const map = {
    csk: 'csk',
    'chennai super kings': 'csk',
    chennai: 'csk',
    mi: 'mi',
    'mumbai indians': 'mi',
    mumbai: 'mi',
    rcb: 'rcb',
    'royal challengers bengaluru': 'rcb',
    'royal challengers bangalore': 'rcb',
    bengaluru: 'rcb',
    bangalore: 'rcb',
    kkr: 'kkr',
    'kolkata knight riders': 'kkr',
    kolkata: 'kkr',
    srh: 'srh',
    'sunrisers hyderabad': 'srh',
    hyderabad: 'srh',
    rr: 'rr',
    'rajasthan royals': 'rr',
    rajasthan: 'rr',
    dc: 'dc',
    'delhi capitals': 'dc',
    'delhi daredevils': 'dc',
    delhi: 'dc',
    pbks: 'pbks',
    'punjab kings': 'pbks',
    'kings xi punjab': 'pbks',
    punjab: 'pbks',
    gt: 'gt',
    'gujarat titans': 'gt',
    gujarat: 'gt',
    lsg: 'lsg',
    'lucknow super giants': 'lsg',
    lucknow: 'lsg'
  };

  return map[clean] || null;
};

export const getTeamLogoUrl = (teamIdentifier) => {
  const id = normalizeTeamId(teamIdentifier);
  if (!id) return null;
  return `/assets/teams/${id}.png`;
};

export const TeamLogo = ({
  code,
  franchise,
  team: teamProp,
  teamCode,
  size = 'md',
  className = '',
  showGlow = false,
  alt = ''
}) => {
  const [imgError, setImgError] = useState(false);

  // Accept franchise, code, team, or teamCode interchangeably
  const rawIdentifier = franchise || code || teamProp || teamCode;
  const teamId = normalizeTeamId(rawIdentifier);

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28'
  };

  const containerSize = sizeClasses[size] || sizeClasses.md;

  // Case 1: No team specified -> Neutral Manager Avatar (Never fallback to CSK)
  if (!teamId) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-navy-800/80 border border-navy-700/80 text-amber-400 shrink-0 select-none shadow-sm ${containerSize} ${className}`}
        title={alt || 'Manager / Unassigned'}
      >
        <User className="w-1/2 h-1/2 text-amber-400/90" />
      </div>
    );
  }

  // Find franchise profile from master data
  const team = IPL_TEAMS.find(
    (t) => t.id === teamId || t.code.toUpperCase() === String(rawIdentifier).toUpperCase()
  );

  const logoSrc = getTeamLogoUrl(teamId);
  const displayName = alt || team?.name || String(rawIdentifier).toUpperCase();

  // Case 2: Image loading error -> Stylish team badge with official code & colors (Never fallback to CSK)
  if (imgError || !logoSrc) {
    if (team) {
      return (
        <div
          className={`inline-flex items-center justify-center rounded-xl font-black font-['Teko'] text-center uppercase tracking-wider shrink-0 select-none shadow-md ${containerSize} ${className}`}
          style={{
            backgroundColor: team.brand.primaryColor,
            color: team.brand.textColor || '#FFFFFF',
            border: `1.5px solid ${team.brand.accentColor || '#FFFFFF'}`
          }}
          title={displayName}
        >
          <span className="leading-none text-xs sm:text-sm font-bold">{team.code}</span>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-navy-800 border border-navy-700 text-slate-400 shrink-0 select-none ${containerSize} ${className}`}
        title={displayName}
      >
        <Shield className="w-1/2 h-1/2 text-slate-400" />
      </div>
    );
  }

  // Case 3: Proper Logo Display with aspect-ratio preservation
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${containerSize} ${
        showGlow ? 'filter drop-shadow-[0_0_8px_rgba(253,185,19,0.3)]' : ''
      } ${className}`}
      title={displayName}
    >
      <img
        src={logoSrc}
        alt={displayName}
        onError={() => setImgError(true)}
        className="w-full h-full object-contain filter drop-shadow-md select-none transition-transform duration-200"
        loading="lazy"
      />
    </div>
  );
};
