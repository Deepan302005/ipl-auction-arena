import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { SeasonSelectionControl } from './SeasonSelectionControl';
import {
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  RotateCcw,
  CheckSquare,
  Lock,
  Sparkles,
  ShieldAlert,
  Loader2
} from 'lucide-react';

export const PlayerPoolModal = ({
  isOpen,
  onClose,
  room,
  isHost,
  onPoolUpdated
}) => {
  const { toastSuccess, toastError, toastInfo } = useToast();

  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [totalEligible, setTotalEligible] = useState(room?.auctionQueueCount || 0);

  // Season selection settings
  const settings = room?.settings || {};
  const isAuctionLive = room?.status !== 'waiting';

  const loadPlayers = async () => {
    if (!room?.roomCode) return;
    setLoading(true);
    try {
      const res = await api.getRoomEligiblePlayers(room.roomCode, {
        search,
        role: roleFilter,
        country: countryFilter
      });
      if (res.success) {
        setPlayers(res.data || []);
        if (res.totalEligible !== undefined) {
          setTotalEligible(res.totalEligible);
        }
      }
    } catch (err) {
      toastError(err.message || 'Failed to load player pool');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPlayers();
    }
  }, [isOpen, room?.roomCode, search, roleFilter, countryFilter]);

  const handleSeasonChange = async (seasonPayload) => {
    if (!isHost || isAuctionLive) return;
    try {
      const res = await api.updateRoomSettings(room.roomCode, {
        settings: seasonPayload,
        rebuildQueue: true
      });
      if (res.success) {
        toastSuccess('Season settings updated. Player pool regenerated!');
        if (onPoolUpdated) onPoolUpdated(res.data);
        loadPlayers();
      }
    } catch (err) {
      toastError(err.message || 'Failed to update season settings');
    }
  };

  const handleToggleIncludeExclude = async (player) => {
    if (!isHost) {
      toastError('Only the room host can customize player pool');
      return;
    }
    if (isAuctionLive) {
      toastError('Player pool is locked during live auction');
      return;
    }

    const playerId = player._id;
    const isCurrentlyExcluded = player.isCustomExcluded || !player.isEligible;
    const nextAction = isCurrentlyExcluded ? 'include' : 'exclude';

    setActionLoadingId(playerId);
    try {
      const res = await api.updateRoomPlayerPool(room.roomCode, {
        action: nextAction,
        playerId
      });
      if (res.success) {
        toastSuccess(
          nextAction === 'include'
            ? `Included ${player.name} in auction pool`
            : `Excluded ${player.name} from auction pool`
        );
        if (onPoolUpdated) onPoolUpdated(res.data);
        loadPlayers();
      }
    } catch (err) {
      toastError(err.message || 'Failed to update player status');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSelectAll = async () => {
    if (!isHost || isAuctionLive) return;
    setLoading(true);
    try {
      const res = await api.updateRoomPlayerPool(room.roomCode, {
        action: 'selectAll'
      });
      if (res.success) {
        toastSuccess('All eligible players included in pool!');
        if (onPoolUpdated) onPoolUpdated(res.data);
        loadPlayers();
      }
    } catch (err) {
      toastError(err.message || 'Failed to select all players');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!isHost || isAuctionLive) return;
    setLoading(true);
    try {
      const res = await api.updateRoomPlayerPool(room.roomCode, {
        resetDefaults: true
      });
      if (res.success) {
        toastInfo('Player pool restored to season defaults');
        if (onPoolUpdated) onPoolUpdated(res.data);
        loadPlayers();
      }
    } catch (err) {
      toastError(err.message || 'Failed to restore default pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Auction Player Pool & Seasons"
      subtitle={`Configure seasons, customize pool, and manage eligible cricketers (${totalEligible} currently in auction)`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5 text-left">
        {/* Status Notification if Auction Live */}
        {isAuctionLive && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Auction is currently active or completed. Player pool is locked from modifications.</span>
          </div>
        )}

        {!isHost && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Viewing as participant/spectator. Only the room host ({room?.hostName || 'Admin'}) can modify seasons and player inclusions.</span>
          </div>
        )}

        {/* 1. Host Season Selection Control */}
        <div className="bg-navy-950/70 border border-navy-800 rounded-2xl p-4 sm:p-5">
          <SeasonSelectionControl
            seasonMode={settings.seasonMode || 'all-time'}
            selectedStartSeason={settings.selectedStartSeason || 2008}
            selectedEndSeason={settings.selectedEndSeason || 2026}
            selectedSeasons={settings.selectedSeasons || []}
            onChange={handleSeasonChange}
            disabled={!isHost || isAuctionLive}
          />
        </div>

        {/* 2. Search, Filter, and Bulk Actions Toolbar */}
        <div className="bg-navy-950/50 border border-navy-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search player by full name..."
                className="w-full bg-navy-900 border border-navy-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-navy-900 border border-navy-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="Batter">Batters</option>
              <option value="Bowler">Bowlers</option>
              <option value="All-Rounder">All-Rounders</option>
              <option value="Wicketkeeper">Wicketkeepers</option>
            </select>

            {/* Country Filter */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-navy-900 border border-navy-700/80 rounded-xl px-3 py-2.5 text-xs font-semibold text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Nationalities</option>
              <option value="India">🇮🇳 Indian Only</option>
              <option value="Overseas">✈️ Overseas Only</option>
            </select>
          </div>

          {/* Bulk Action Buttons (Host Only) */}
          {isHost && !isAuctionLive && (
            <div className="flex items-center justify-between pt-2 border-t border-navy-800/80 flex-wrap gap-2 text-xs">
              <span className="text-slate-400">
                Found <strong className="text-white">{players.length}</strong> matching cricketers
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 font-semibold flex items-center gap-1.5 transition-all"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white border border-navy-700 font-semibold flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3. Players Table / List */}
        <div className="bg-navy-950/80 border border-navy-800 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span className="text-xs">Loading eligible cricketers...</span>
            </div>
          ) : players.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No players found matching current search and filter criteria.
            </div>
          ) : (
            <div className="divide-y divide-navy-800/60">
              {players.map((p) => {
                const isIncluded = !p.isCustomExcluded && (p.isInQueue || p.isEligible);
                const isBusy = actionLoadingId === p._id;

                return (
                  <div
                    key={p._id}
                    className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isIncluded ? 'hover:bg-navy-900/60' : 'bg-red-950/15 opacity-60 hover:opacity-80'
                    }`}
                  >
                    {/* Player Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm truncate">{p.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-navy-900 border border-navy-700 text-blue-300">
                          {p.role}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          p.country === 'Overseas'
                            ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        }`}>
                          {p.country === 'Overseas' ? `✈️ ${p.nationality || 'Overseas'}` : '🇮🇳 India'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                        <span>Base: <strong className="text-amber-400">₹{p.basePriceCr} Cr</strong></span>
                        <span>Seasons: <strong className="text-slate-200">{(p.seasonsPlayed || []).slice(0, 4).join(', ')}{(p.seasonsPlayed || []).length > 4 ? '...' : ''}</strong></span>
                        {p.iplStats?.runs > 0 && <span>Runs: <strong>{p.iplStats.runs}</strong></span>}
                        {p.iplStats?.wickets > 0 && <span>Wkts: <strong>{p.iplStats.wickets}</strong></span>}
                      </div>
                    </div>

                    {/* Inclusion Toggle Button (Host Only) */}
                    {isHost && !isAuctionLive ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleIncludeExclude(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                          isIncluded
                            ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isIncluded ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Included</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span>Excluded</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                        isIncluded ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-navy-900'
                      }`}>
                        {isIncluded ? 'Eligible' : 'Excluded'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
};
