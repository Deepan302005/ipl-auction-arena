import React from 'react';
import { Trophy, Coins, MapPin, UserCheck, Shield } from 'lucide-react';
import { TeamLogo } from './common/TeamLogo';

export const TeamCard = ({ team, isSelected, onSelect }) => {
  const { brand } = team;

  return (
    <div
      onClick={() => onSelect && onSelect(team)}
      className={`group relative rounded-2xl bg-gradient-to-b ${brand.gradient} border ${brand.borderClass} ${brand.glowClass} p-5 transition-all duration-300 transform hover:-translate-y-1.5 cursor-pointer shadow-lg overflow-hidden flex flex-col justify-between`}
      style={{
        borderTopColor: brand.primaryColor,
        borderTopWidth: '3px'
      }}
    >
      {/* Background Franchise Monogram Watermark */}
      <div 
        className="absolute -right-3 -bottom-4 text-7xl font-black font-['Teko'] select-none pointer-events-none opacity-[0.07] transition-opacity group-hover:opacity-[0.14]"
        style={{ color: brand.primaryColor }}
      >
        {team.code}
      </div>

      <div>
        {/* Top Header: Badge, Code & Trophy count */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Custom Franchise Logo */}
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center p-1 shadow-md bg-navy-950/80 border"
              style={{
                borderColor: brand.secondaryColor || '#ffffff33'
              }}
            >
              <TeamLogo franchise={team.code} size="sm" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors leading-tight">
                {team.name}
              </h3>
              <p className="text-[11px] font-medium text-slate-400 italic">
                "{team.tagline}"
              </p>
            </div>
          </div>

          {/* Trophies */}
          <div className="flex items-center gap-1 bg-navy-950/80 px-2.5 py-1 rounded-lg border border-navy-700/80 shrink-0">
            <Trophy className={`w-3.5 h-3.5 ${team.trophies > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
            <span className={`text-xs font-bold ${team.trophies > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
              {team.trophies}
            </span>
          </div>
        </div>

        {/* Stadium & Captain info */}
        <div className="mt-4 space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-1.5 text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{team.homeVenue}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <UserCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Captain: <strong className="text-slate-200">{team.captain}</strong></span>
          </div>
        </div>
      </div>

      {/* Purse & Budget Bar */}
      <div className="mt-5 pt-3.5 border-t border-navy-800/80">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400 flex items-center gap-1 font-medium">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            Purse Available
          </span>
          <span className="font-bold text-white font-mono">
            ₹{team.remainingPurseCr.toFixed(2)} Cr
          </span>
        </div>

        {/* Progress Bar with Team Primary Accent */}
        <div className="w-full h-2 rounded-full bg-navy-950 overflow-hidden border border-navy-800">
          <div 
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(team.remainingPurseCr / team.totalPurseCr) * 100}%`,
              backgroundColor: brand.primaryColor
            }}
          ></div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-blue-400" />
            Squad: 0 / 25
          </span>
          <span 
            className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${brand.primaryColor}25`,
              color: brand.primaryColor,
              border: `1px solid ${brand.primaryColor}50`
            }}
          >
            {team.shortName}
          </span>
        </div>
      </div>
    </div>
  );
};
