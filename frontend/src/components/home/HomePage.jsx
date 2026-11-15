import React, { useState, useEffect } from 'react';
import { Gavel, PlusCircle, ArrowRight, Lock, Users, Shield, Trophy, Zap, Clock, Sparkles, CheckCircle2, UserCheck } from 'lucide-react';
import { IPL_TEAMS } from '../../data/teamsData';
import { TeamLogo } from '../common/TeamLogo';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const HomePage = ({ onOpenCreateRoom, onJoinRoom }) => {
  const { user, ensureSession, updateDisplayName } = useAuth();
  const { toastError, toastSuccess } = useToast();

  const [managerName, setManagerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [publicRooms, setPublicRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joining, setJoining] = useState(false);

  // Sync manager name when user session loads
  useEffect(() => {
    if (user?.name && !managerName) {
      setManagerName(user.name);
    }
  }, [user]);

  // Fetch active public rooms
  useEffect(() => {
    let isMounted = true;
    async function loadPublicRooms() {
      setLoadingRooms(true);
      try {
        const res = await api.listRooms();
        if (isMounted && res.success && Array.isArray(res.data)) {
          setPublicRooms(res.data);
        }
      } catch (e) {
        // silent fallback
      } finally {
        if (isMounted) setLoadingRooms(false);
      }
    }
    loadPublicRooms();
    const interval = setInterval(loadPublicRooms, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      toastError('Please enter a room code (e.g. IPL-XXXX)');
      return;
    }

    const nameToUse = (managerName || user?.name || 'Manager').trim();

    setJoining(true);
    try {
      // Ensure guest session has chosen manager name
      await ensureSession(nameToUse);
      const res = await api.joinRoom(code, joinPasscode || null, nameToUse);
      if (res.success) {
        toastSuccess(`Joined ${code}! Entering lobby...`);
        onJoinRoom(code);
      }
    } catch (err) {
      if (err.status === 403 || (err.message && err.message.toLowerCase().includes('passcode'))) {
        setRequiresPasscode(true);
        toastError('This room is private. Please enter the passcode.');
      } else {
        toastError(err.message || `Unable to join room ${code}`);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleQuickJoinPublic = async (roomCode) => {
    const nameToUse = (managerName || user?.name || 'Manager').trim();
    try {
      await ensureSession(nameToUse);
      const res = await api.joinRoom(roomCode, null, nameToUse);
      if (res.success) {
        onJoinRoom(roomCode);
      }
    } catch (err) {
      if (err.status === 403 || (err.message && err.message.toLowerCase().includes('passcode'))) {
        setJoinCode(roomCode);
        setRequiresPasscode(true);
        document.getElementById('join-section')?.scrollIntoView({ behavior: 'smooth' });
        toastError('Passcode required to enter this room.');
      } else {
        toastError(err.message || `Unable to join ${roomCode}`);
      }
    }
  };

  return (
    <div className="space-y-10 sm:space-y-14 py-4 sm:py-8">
      {/* Hero Section */}
      <div className="relative rounded-3xl bg-gradient-to-br from-blue-950/80 via-navy-900 to-indigo-950/80 border border-blue-500/20 p-6 sm:p-12 shadow-2xl overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Direct Multiplayer Auction Arena • No Sign-In Needed
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white font-['Teko'] uppercase tracking-tight leading-[0.95] mb-4">
            Command Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-300">Franchise</span>, Bid in Real-Time
          </h1>

          <p className="text-sm sm:text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl font-normal">
            Play directly without any registration. Enter your manager name, create a custom room or join a live auction with friends on PC and mobile simultaneously.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <button
              onClick={onOpenCreateRoom}
              className="px-6 py-4 rounded-xl font-bold text-sm sm:text-base tracking-wide bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 shadow-xl shadow-orange-950/40 transition-all flex items-center justify-center gap-2.5 min-h-[48px] hover:scale-102"
            >
              <PlusCircle className="w-5 h-5 text-navy-950" />
              Create Auction Room
            </button>

            <a
              href="#join-section"
              className="px-6 py-4 rounded-xl font-bold text-sm sm:text-base text-slate-300 hover:text-white bg-navy-900/90 hover:bg-navy-800 border border-navy-700/80 transition-all flex items-center justify-center gap-2 min-h-[48px]"
            >
              Join Room by Code
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </a>

            <a
              href="#rooms-section"
              className="px-6 py-4 rounded-xl font-bold text-sm sm:text-base text-blue-300 hover:text-white bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 transition-all flex items-center justify-center gap-2 min-h-[48px]"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              Browse Live Rooms
            </a>
          </div>
        </div>
      </div>

      {/* Quick Join By Code Section */}
      <div id="join-section" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-navy-900/90 border border-navy-800 rounded-2xl p-6 sm:p-7 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Join Auction Room</h2>
              <p className="text-xs text-slate-400">Enter a room code to join instantly</p>
            </div>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-3.5">
            {/* Manager Name Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Your Manager Name
              </label>
              <input
                type="text"
                maxLength={30}
                required
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                placeholder="e.g. Rohit Sharma"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Room Code */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Room Code
              </label>
              <input
                type="text"
                maxLength={10}
                required
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setRequiresPasscode(false);
                }}
                placeholder="e.g. IPL-4X7B"
                className="w-full bg-navy-950 border border-navy-700 rounded-xl px-4 py-3 text-sm font-mono font-bold tracking-widest text-amber-400 placeholder-slate-600 focus:outline-none focus:border-amber-400 uppercase"
              />
            </div>

            {/* Passcode (if private) */}
            {requiresPasscode && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  Passcode Required
                </label>
                <input
                  type="text"
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  placeholder="Enter room passcode"
                  className="w-full bg-navy-950 border border-amber-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[46px]"
            >
              {joining ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Enter Room</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Public Rooms List */}
        <div id="rooms-section" className="lg:col-span-2 bg-navy-900/90 border border-navy-800 rounded-2xl p-6 sm:p-7 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Live Public Rooms</h2>
                  <p className="text-xs text-slate-400">Join active auction rooms open to anyone</p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {publicRooms.length} {publicRooms.length === 1 ? 'room' : 'rooms'} active
              </span>
            </div>

            {loadingRooms && publicRooms.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
                Scanning active rooms...
              </div>
            ) : publicRooms.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm border border-dashed border-navy-800 rounded-xl bg-navy-950/40">
                <Gavel className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                No public auction rooms currently open.
                <div className="mt-2 text-xs text-slate-500">
                  Click <strong>Create Auction Room</strong> to host one!
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[260px] overflow-y-auto pr-1">
                {publicRooms.map((room) => (
                  <div
                    key={room.roomCode}
                    onClick={() => handleQuickJoinPublic(room.roomCode)}
                    className="p-3.5 rounded-xl bg-navy-950 border border-navy-800 hover:border-blue-500/60 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                          {room.roomCode}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          room.status === 'live' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {room.status}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white group-hover:text-blue-300 truncate transition-colors">
                        {room.roomName}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-3 mt-2 border-t border-navy-900">
                      <span>Host: {room.hostName || 'Host'}</span>
                      <span className="flex items-center gap-1 text-slate-300 font-semibold">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        {room.claimedFranchisesCount || 0}/10 teams
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 10 Official Franchises Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-['Teko'] uppercase tracking-wide">
              The 10 Official <span className="text-amber-400">IPL Franchises</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Each franchise starts with ₹120.0 Crore purse and custom authentic branding
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {IPL_TEAMS.map((team) => (
            <div
              key={team.code}
              className="p-3.5 sm:p-4 rounded-2xl bg-navy-900/80 border border-navy-800 hover:border-slate-600 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-12 h-12 flex items-center justify-center p-0.5">
                    <TeamLogo franchise={team.code} size="lg" className="drop-shadow-md group-hover:scale-105 transition-transform" />
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider font-mono"
                    style={{ backgroundColor: team.brand.primaryColor, color: team.brand.textColor }}
                  >
                    {team.code}
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-bold text-white truncate leading-tight">
                  {team.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  {team.tagline}
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-navy-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Purse:</span>
                <span className="font-bold text-amber-400">₹{team.totalPurseCr} Cr</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-navy-900/60 border border-navy-800 rounded-3xl p-6 sm:p-10 shadow-xl space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-['Teko'] uppercase tracking-wide">
            How The Live <span className="text-amber-400">Auction Works</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Rules, timers, and real-time live bidding mechanics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-navy-950/70 border border-navy-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
              1
            </div>
            <h3 className="text-base font-bold text-white">Create or Join a Room</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No account required. Enter your manager name, create a room, or share the room code with friends to join together.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-950/70 border border-navy-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              2
            </div>
            <h3 className="text-base font-bold text-white">Claim Your Franchise Paddle</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Claim CSK, MI, RCB or any of the 10 franchises. Manage your ₹120 Cr budget and maximum 8 overseas player slots.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-navy-950/70 border border-navy-800 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              3
            </div>
            <h3 className="text-base font-bold text-white">Bid Live in Real-Time</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Raise paddles in real-time. Experience anti-sniping timer extensions, hammer drop animations, and comprehensive career stats.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
