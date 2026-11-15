import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PlusCircle, Search, Users, Trophy, Lock, Unlock, ArrowRight, Gavel, RefreshCw, Zap } from 'lucide-react';
import { TeamLogo } from '../common/TeamLogo';

export const DashboardPage = ({ onOpenCreateRoom, onJoinRoom }) => {
  const { user } = useAuth();
  const { toastError, toastSuccess } = useToast();

  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [quickCode, setQuickCode] = useState('');
  const [quickPasscode, setQuickPasscode] = useState('');
  const [showPasscodeInput, setShowPasscodeInput] = useState(false);
  const [joining, setJoining] = useState(false);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await api.listRooms();
      if (res.success && Array.isArray(res.data)) {
        setRooms(res.data);
      }
    } catch (e) {
      toastError('Could not refresh rooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickJoin = async (e) => {
    e.preventDefault();
    const code = quickCode.trim().toUpperCase();
    if (!code) {
      toastError('Enter a room code');
      return;
    }
    setJoining(true);
    try {
      const res = await api.joinRoom(code, quickPasscode || null, user?.name || 'Manager');
      if (res.success) {
        toastSuccess(`Joined ${code}!`);
        onJoinRoom(code);
      }
    } catch (err) {
      if ((err.status === 401 || err.status === 403) && err.message?.toLowerCase().includes('passcode')) {
        setShowPasscodeInput(true);
        toastError('Private room: please enter passcode');
      } else {
        toastError(err.message || 'Failed to join');
      }
    } finally {
      setJoining(false);
    }
  };

  const filteredRooms = rooms.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.roomCode.toLowerCase().includes(q) ||
      (r.roomName && r.roomName.toLowerCase().includes(q)) ||
      (r.hostName && r.hostName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 sm:space-y-8 py-4 sm:py-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-950/80 via-navy-900 to-indigo-950/80 border border-blue-500/20 rounded-3xl p-5 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center font-bold text-xl text-blue-300 shrink-0">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Welcome, {user?.name || 'Manager'}
              </h1>
              {user?.favoriteTeam ? (
                <span className="text-xs font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2.5 py-1 rounded-full uppercase tracking-wider font-mono flex items-center gap-1.5 shadow-sm">
                  <TeamLogo franchise={user.favoriteTeam} size="xs" />
                  <span>{user.favoriteTeam}</span>
                </span>
              ) : (
                <span className="text-xs text-slate-400 bg-navy-950 border border-navy-800 px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select a team</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Command your IPL franchise paddle, claim superstar players and manage your purse.
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCreateRoom}
          className="w-full md:w-auto px-5 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 min-h-[46px] shrink-0"
        >
          <PlusCircle className="w-4 h-4 text-navy-950" />
          Create New Room
        </button>
      </div>

      {/* Quick Join and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quick Join Card */}
        <div className="md:col-span-1 bg-navy-900/90 border border-navy-800 rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Quick Join by Code
          </div>
          <form onSubmit={handleQuickJoin} className="space-y-2.5">
            <input
              type="text"
              maxLength={10}
              value={quickCode}
              onChange={(e) => {
                setQuickCode(e.target.value.toUpperCase());
                setShowPasscodeInput(false);
              }}
              placeholder="e.g. IPL-9K2M"
              className="w-full bg-navy-950 border border-navy-700 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest text-amber-400 uppercase placeholder-slate-600 focus:outline-none focus:border-amber-400"
            />
            {showPasscodeInput && (
              <input
                type="text"
                value={quickPasscode}
                onChange={(e) => setQuickPasscode(e.target.value)}
                placeholder="Passcode required"
                className="w-full bg-navy-950 border border-amber-500/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400 animate-fade-in"
              />
            )}
            <button
              type="submit"
              disabled={joining || !quickCode.trim()}
              className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 disabled:opacity-50 min-h-[42px]"
            >
              {joining ? 'Joining...' : 'Enter Room'}
            </button>
          </form>
        </div>

        {/* Search & Refresh */}
        <div className="md:col-span-2 bg-navy-900/90 border border-navy-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Explore Public Auction Rooms
              </span>
              <button
                onClick={fetchRooms}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 p-1"
                title="Refresh rooms"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by room name, code or host..."
                className="w-full bg-navy-950 border border-navy-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Showing {filteredRooms.length} of {rooms.length} available auction rooms
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
          Active Auction Rooms
        </h2>

        {loading && rooms.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            Loading live auction rooms...
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="py-14 text-center rounded-2xl border border-dashed border-navy-800 bg-navy-950/40 text-slate-400">
            <Gavel className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <div className="text-sm font-semibold">No auction rooms found</div>
            <div className="text-xs text-slate-500 mt-1">
              {search ? 'Try adjusting your search terms' : 'Create the first room and invite managers to join!'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRooms.map((r) => (
              <div
                key={r.roomCode}
                onClick={() => onJoinRoom(r.roomCode)}
                className="bg-navy-900 border border-navy-800 hover:border-blue-500/60 rounded-2xl p-4 sm:p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {r.roomCode}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {r.isPrivate ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded">
                          <Unlock className="w-3 h-3" /> Public
                        </span>
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        r.status === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {r.status}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors truncate">
                    {r.roomName}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    Host: <span className="text-slate-200">{r.hostName || 'Admin'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-navy-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>{r.claimedFranchisesCount || 0}/10 Franchises</span>
                  </div>
                  <div className="flex items-center gap-1 text-blue-400 font-bold group-hover:translate-x-1 transition-transform">
                    <span>Enter Lobby</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
