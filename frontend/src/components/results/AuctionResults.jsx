import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { IPL_TEAMS } from '../../data/teamsData';
import { TeamLogo } from '../common/TeamLogo';
import { MOCK_ROOMS } from '../../data/mockRooms.js';
import {
  Trophy,
  Users,
  Shield,
  AlertTriangle,
  ArrowLeft,
  DollarSign,
  Award,
  Layers,
  XCircle,
  CheckCircle2
} from 'lucide-react';

export const AuctionResults = ({ roomCode, onBackToDashboard }) => {
  const { toastError } = useToast();
  const codeUpper = (roomCode || '').toUpperCase();
  const initialRoom = MOCK_ROOMS[codeUpper] || null;

  const [room, setRoom] = useState(initialRoom);
  const [loading, setLoading] = useState(!initialRoom);
  const [activeTab, setActiveTab] = useState('squads'); // 'squads' or 'unsold'
  const [selectedFranchiseCode, setSelectedFranchiseCode] = useState('CSK');

  useEffect(() => {
    async function loadResults() {
      try {
        const res = await api.getRoom(roomCode);
        if (res.success && res.data) {
          setRoom(res.data);
          const firstClaimed = res.data.franchises?.find((f) => f.claimedBy);
          if (firstClaimed) {
            setSelectedFranchiseCode(firstClaimed.code);
          }
        }
      } catch (err) {
        toastError('Failed to load auction results');
      } finally {
        setLoading(false);
      }
    }
    loadResults();
  }, [roomCode]);

  if (loading || !room) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-300">Compiling official auction results...</p>
      </div>
    );
  }

  // Calculate summary statistics
  const soldLots = (room.completedLots || []).filter((l) => l.status === 'sold');
  const unsoldLots = (room.completedLots || []).filter((l) => l.status === 'unsold');
  const totalSpentCr = soldLots.reduce((sum, l) => sum + (l.soldPriceCr || 0), 0);

  // Compliance calculations
  const minSquad = room.settings?.minSquadSize || 18;
  const maxSquad = room.settings?.maxSquadSize || 25;
  const maxOverseas = room.settings?.maxOverseas || 8;

  const complianceWarnings = (room.franchises || []).flatMap((f) => {
    if (!f.claimedBy) return [];
    const count = f.squad?.length || 0;
    const overseasCount = (f.squad || []).filter(
      (s) => s.country && s.country.toLowerCase() !== 'india'
    ).length;
    const w = [];
    if (count < minSquad) {
      w.push(`${f.name} (${f.code}) has only ${count} players (Minimum required: ${minSquad})`);
    }
    if (overseasCount > maxOverseas) {
      w.push(`${f.name} (${f.code}) has ${overseasCount} overseas players (Maximum allowed: ${maxOverseas})`);
    }
    return w;
  });

  const selectedFranchise = (room.franchises || []).find(
    (f) => f.code === selectedFranchiseCode
  ) || room.franchises?.[0];

  const teamProfile = IPL_TEAMS.find((t) => t.code === selectedFranchise?.code);

  return (
    <div className="space-y-6 sm:space-y-8 py-4 sm:py-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-950 via-navy-900 to-indigo-950 border border-blue-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 rounded-lg">
              {room.roomCode}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              Auction Completed
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white font-['Teko'] uppercase tracking-tight leading-none">
            {room.roomName} <span className="text-amber-400">Roster & Results</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete team squads, final purse accounts, and compliance audit
          </p>
        </div>

        <button
          onClick={onBackToDashboard}
          className="px-5 py-3 rounded-xl bg-navy-800 hover:bg-navy-700 text-white font-bold text-sm border border-navy-700 flex items-center gap-2 shadow-lg transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Players Sold</div>
          <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
            {soldLots.length}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Across 10 franchises</div>
        </div>

        <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Money Spent</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono mt-1">
            ₹{totalSpentCr.toFixed(2)} Cr
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total auction spend</div>
        </div>

        <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unsold Lots</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-300 font-mono mt-1">
            {unsoldLots.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Available for mini-auction</div>
        </div>

        <div className="bg-navy-900 border border-navy-800 rounded-2xl p-4 shadow-lg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Roster Compliance</div>
          <div className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${
            complianceWarnings.length === 0 ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {complianceWarnings.length === 0 ? '100% OK' : `${complianceWarnings.length} Alerts`}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Squad rules audit</div>
        </div>
      </div>

      {/* Compliance Warnings Banner */}
      {complianceWarnings.length > 0 && (
        <div className="bg-amber-950/60 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span>Squad Compliance Alerts ({complianceWarnings.length})</span>
          </div>
          <div className="text-xs text-slate-300 space-y-1 pl-7">
            {complianceWarnings.map((warning, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>{warning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Franchise Squads vs Unsold Players */}
      <div className="flex rounded-2xl bg-navy-900 p-1 border border-navy-800">
        <button
          onClick={() => setActiveTab('squads')}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'squads' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Franchise Squad Rosters (10 Teams)</span>
        </button>
        <button
          onClick={() => setActiveTab('unsold')}
          className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'unsold' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>Unsold Player Register ({unsoldLots.length})</span>
        </button>
      </div>

      {/* Franchise Squads Tab View */}
      {activeTab === 'squads' && (
        <div className="space-y-6">
          {/* Franchise Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {(room.franchises || []).map((f) => {
              const isSelected = f.code === selectedFranchiseCode;
              const squadCount = f.squad?.length || 0;
              return (
                <button
                  key={f.code}
                  onClick={() => setSelectedFranchiseCode(f.code)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                    isSelected
                      ? 'bg-amber-500 text-navy-950 shadow-md shadow-orange-950/40 font-black'
                      : 'bg-navy-900 hover:bg-navy-800 text-slate-300 border border-navy-800'
                  }`}
                >
                  <TeamLogo franchise={f.code} size="xs" />
                  <span>{f.code}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-navy-950 text-white' : 'bg-navy-800 text-slate-400'
                  }`}>
                    {squadCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected Franchise Squad Roster Details */}
          {selectedFranchise && (
            <div className="bg-navy-900 border border-navy-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-6">
              {/* Franchise Details Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-navy-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 flex items-center justify-center p-1.5 bg-navy-950/80 rounded-2xl border border-navy-800 shadow-md">
                    <TeamLogo franchise={selectedFranchise.code} size="xl" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white font-['Teko'] uppercase">
                      {selectedFranchise.name} ({selectedFranchise.code})
                    </h2>
                    <div className="text-xs text-slate-400">
                      Manager: <strong className="text-white">{selectedFranchise.claimedByName || 'Unclaimed'}</strong> • Venue: {teamProfile?.homeVenue || 'IPL Arena'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Remaining Purse</div>
                    <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                      ₹{selectedFranchise.remainingPurseCr?.toFixed(2)} Cr
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Squad Count</div>
                    <div className="text-lg sm:text-xl font-black text-white font-mono">
                      {selectedFranchise.squad?.length || 0} / {maxSquad}
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad Table / Cards */}
              {selectedFranchise.squad?.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs sm:text-sm">
                  This franchise did not acquire any players during the auction.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedFranchise.squad.map((player, idx) => {
                    const isOverseas = player.country === 'Overseas' || (player.country && player.country !== 'India');
                    return (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 hover:border-slate-700 transition-all flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-sm font-bold text-white truncate">
                            {player.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-semibold uppercase text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                              {player.role || 'Player'}
                            </span>
                            {isOverseas && (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                Overseas
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="font-mono text-xs font-bold text-amber-400">
                            ₹{player.boughtForCr?.toFixed(2)} Cr
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Sold Price
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Unsold Players Tab View */}
      {activeTab === 'unsold' && (
        <div className="bg-navy-900 border border-navy-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-4">
          <div className="text-sm font-bold text-white">
            Unsold Players Pool ({unsoldLots.length} players)
          </div>

          {unsoldLots.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              All players in this auction were successfully sold!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-1">
              {unsoldLots.map((lot, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white truncate">
                      {lot.player?.name || 'Player'}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      {lot.player?.role || 'Uncapped'}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-mono">
                      Base: ₹{lot.player?.basePriceCr || 0.20} Cr
                    </span>
                    <div className="text-[10px] text-red-400">UNSOLD</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
