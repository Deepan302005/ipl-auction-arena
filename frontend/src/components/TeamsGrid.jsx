import React, { useState } from 'react';
import { IPL_TEAMS } from '../data/teamsData';
import { TeamCard } from './TeamCard';
import { ShieldCheck, Trophy, Sparkles, Filter } from 'lucide-react';

export const TeamsGrid = ({ onSelectTeam }) => {
  const [filter, setFilter] = useState('all'); // all, champions, new
  const [selectedFranchise, setSelectedFranchise] = useState(null);

  const filteredTeams = IPL_TEAMS.filter((t) => {
    if (filter === 'champions') return t.trophies > 0;
    if (filter === 'contenders') return t.trophies === 0;
    return true;
  });

  const handleCardClick = (team) => {
    setSelectedFranchise(team);
    if (onSelectTeam) onSelectTeam(team);
  };

  return (
    <section className="mt-10">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-black text-white uppercase tracking-wider font-['Teko'] text-3xl">
              Official IPL Franchises
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
              10 Teams
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Each franchise operates with distinct squad allocations, authentic team branding, and a ₹120.00 Cr purse.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-navy-900/80 p-1 rounded-xl border border-navy-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            All 10 Franchises
          </button>
          <button
            onClick={() => setFilter('champions')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${filter === 'champions' ? 'bg-amber-500 text-navy-950 font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            <Trophy className="w-3 h-3" />
            Champions ({IPL_TEAMS.filter(t => t.trophies > 0).length})
          </button>
          <button
            onClick={() => setFilter('contenders')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${filter === 'contenders' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Challengers ({IPL_TEAMS.filter(t => t.trophies === 0).length})
          </button>
        </div>
      </div>

      {/* Grid of 10 Teams */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {filteredTeams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            isSelected={selectedFranchise?.id === team.id}
            onSelect={handleCardClick}
          />
        ))}
      </div>

      {/* Interactive Detail Modal / Flyout when a team is clicked */}
      {selectedFranchise && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-md animate-fadeIn">
          <div 
            className="bg-navy-900 border-2 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden"
            style={{ borderColor: selectedFranchise.brand.primaryColor }}
          >
            <div className="flex items-center justify-between pb-4 border-b border-navy-800">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl font-['Teko'] shadow"
                  style={{
                    backgroundColor: selectedFranchise.brand.primaryColor,
                    color: selectedFranchise.brand.textColor
                  }}
                >
                  {selectedFranchise.code}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedFranchise.name}</h3>
                  <p className="text-xs text-slate-400">{selectedFranchise.homeVenue}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFranchise(null)}
                className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 text-slate-400 hover:text-white flex items-center justify-center font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
                  <span className="text-xs text-slate-400 block">Total Purse</span>
                  <span className="text-lg font-black text-white font-mono">₹{selectedFranchise.totalPurseCr} Cr</span>
                </div>
                <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
                  <span className="text-xs text-slate-400 block">IPL Trophies</span>
                  <span className="text-lg font-black text-amber-400 flex items-center gap-1 font-mono">
                    <Trophy className="w-4 h-4" /> {selectedFranchise.trophies} Titles
                  </span>
                </div>
              </div>

              {selectedFranchise.trophyYears.length > 0 && (
                <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
                  <span className="text-xs text-slate-400 block mb-1.5">Championship Winning Years:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFranchise.trophyYears.map(year => (
                      <span key={year} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                        🏆 {year}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-navy-950/70 border border-navy-800">
                <span className="text-xs text-slate-400 block">Franchise Anthem & Motto</span>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">"{selectedFranchise.tagline}"</p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setSelectedFranchise(null)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition"
                >
                  Close Franchise Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
