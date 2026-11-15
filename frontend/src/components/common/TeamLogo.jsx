import React, { useState } from 'react';
import { IPL_TEAMS } from '../../data/teamsData';

/**
 * Normalizes any team code, id, or name to a standard franchise ID (e.g., 'csk', 'mi')
 */
export const normalizeTeamId = (teamIdentifier) => {
  if (!teamIdentifier) return 'csk';
  const clean = String(teamIdentifier).trim().toLowerCase();
  
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

  return map[clean] || 'csk';
};

export const getTeamLogoUrl = (teamIdentifier) => {
  const id = normalizeTeamId(teamIdentifier);
  return `/assets/teams/${id}.png`;
};

export const TeamLogo = ({
  code,
  size = 'md',
  className = '',
  showGlow = false,
  alt = ''
}) => {
  const [imgError, setImgError] = useState(false);
  const teamId = normalizeTeamId(code);
  const team = IPL_TEAMS.find((t) => t.id === teamId || t.code === String(code).toUpperCase()) || IPL_TEAMS[0];

  const sizeClasses = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
    '2xl': 'w-28 h-28'
  };

  const containerSize = sizeClasses[size] || sizeClasses.md;
  const logoSrc = getTeamLogoUrl(teamId);
  const displayName = alt || team.name;

  if (imgError) {
    // Sensible fallback: stylish badge with team code on team primary color
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
