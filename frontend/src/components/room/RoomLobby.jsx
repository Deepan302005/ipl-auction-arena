import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { IPL_TEAMS } from '../../data/teamsData';
import { TeamLogo } from '../common/TeamLogo';
import { MOCK_ROOMS } from '../../data/mockRooms.js';
import { RoomSettingsModal } from './RoomSettingsModal';
import {
  Copy,
  Check,
  Share2,
  Link2,
  Shield,
  Users,
  Settings,
  Play,
  LogOut,
  Clock,
  Layers,
  Sparkles,
  Lock,
  Unlock,
  Radio,
  Zap,
  AlertCircle,
  User,
  ArrowRight,
  Home
} from 'lucide-react';

export const RoomLobby = ({ roomCode, onLeaveRoom, onAuctionStarted }) => {
  const { user, ensureSession } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const codeUpper = (roomCode || '').toUpperCase();
  const initialRoom = MOCK_ROOMS[codeUpper] || null;
  const [room, setRoom] = useState(initialRoom);
  const [loading, setLoading] = useState(!initialRoom);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Sharing states
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Direct joining states
  const [joinName, setJoinName] = useState(user?.name && user.name !== 'Manager' ? user.name : '');
  const [joinPasscode, setJoinPasscode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Host modal state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const currentUserId = user?._id ? String(user._id) : null;
  const hostId = room?.host?._id ? String(room.host._id) : (room?.host ? String(room.host) : null);
  const isHost = Boolean(hostId && currentUserId && hostId === currentUserId);

  // Check if current user is an existing joined participant of the room
  const isParticipant = Boolean(
    isHost || (currentUserId && (room?.participants || []).some((p) => String(p._id || p) === currentUserId))
  );

  // Fetch initial room state
  const loadRoom = async () => {
    setLoading(true);
    setLoadError(null);
    setRoomNotFound(false);

    try {
      const res = await api.getRoom(roomCode);
      if (res.success && res.data) {
        setRoom(res.data);
        if (res.data.status === 'live') {
          onAuctionStarted(roomCode);
        }
      }
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('not found') || msg.includes('404')) {
        setRoomNotFound(true);
      } else {
        setLoadError(msg || 'Error loading room state');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [roomCode]);

  // Update default joinName when user profile changes
  useEffect(() => {
    if (user?.name && user.name !== 'Manager' && !joinName) {
      setJoinName(user.name);
    }
  }, [user]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket || !isConnected || !roomCode) return;

    socket.emit('room:join', { roomCode });

    const handleRoomStateSync = (data) => {
      if (data?.room) {
        setRoom(data.room);
      }
    };

    const handleFranchiseClaimed = (data) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedFranchises = (prev.franchises || []).map((f) => {
          if (f.code.toUpperCase() === data.franchiseCode.toUpperCase()) {
            return {
              ...f,
              claimedBy: data.claimedBy,
              claimedByName: data.claimedByName
            };
          }
          return f;
        });
        return { ...prev, franchises: updatedFranchises };
      });
      toastInfo(`${data.claimedByName} claimed ${data.franchiseCode}!`);
    };

    const handleFranchiseReleased = (data) => {
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedFranchises = (prev.franchises || []).map((f) => {
          if (f.code.toUpperCase() === data.franchiseCode.toUpperCase()) {
            return {
              ...f,
              claimedBy: null,
              claimedByName: ''
            };
          }
          return f;
        });
        return { ...prev, franchises: updatedFranchises };
      });
      toastInfo(`Franchise ${data.franchiseCode} is now available.`);
    };

    const handleAuctionStarted = () => {
      toastSuccess('The IPL Auction has started!');
      onAuctionStarted(roomCode);
    };

    socket.on('room:stateSync', handleRoomStateSync);
    socket.on('auction:stateUpdated', handleRoomStateSync);
    socket.on('room:franchiseClaimed', handleFranchiseClaimed);
    socket.on('room:franchiseReleased', handleFranchiseReleased);
    socket.on('auction:started', handleAuctionStarted);

    return () => {
      socket.emit('room:leave', { roomCode });
      socket.off('room:stateSync', handleRoomStateSync);
      socket.off('auction:stateUpdated', handleRoomStateSync);
      socket.off('room:franchiseClaimed', handleFranchiseClaimed);
      socket.off('room:franchiseReleased', handleFranchiseReleased);
      socket.off('auction:started', handleAuctionStarted);
    };
  }, [socket, isConnected, roomCode]);

  // Dynamic Invitation URL generator using current window origin
  const getInviteUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/rooms/${roomCode}`;
  };

  const handleCopyInviteLink = async () => {
    const url = getInviteUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toastSuccess('Invitation link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (_) {
      toastError('Failed to copy link to clipboard');
    }
  };

  const handleCopyOnlyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      toastSuccess(`Room code ${roomCode} copied!`);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (_) {
      toastError('Failed to copy room code');
    }
  };

  const handleNativeShare = async () => {
    const url = getInviteUrl();
    const title = `IPL Auction Arena: ${room?.roomName || roomCode}`;
    const text = room?.isPrivate
      ? `Join my private IPL Auction Arena room '${room?.roomName}' (Code: ${roomCode}). Ask me for the passcode!`
      : `Join my live IPL Auction Arena room '${room?.roomName}' (Code: ${roomCode})!`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        toastSuccess('Invitation shared!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyInviteLink();
        }
      }
    } else {
      handleCopyInviteLink();
    }
  };

  // Direct joining handler for participants opening invitation links
  const handleDirectJoin = async (e) => {
    e?.preventDefault();
    const nameToUse = (joinName || user?.name || 'Manager').trim();
    if (!nameToUse) {
      setJoinError('Please enter your manager display name');
      return;
    }
    if (room?.isPrivate && !joinPasscode.trim()) {
      setJoinError('This is a private room. Please enter the passcode.');
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      await ensureSession(nameToUse);
      const res = await api.joinRoom(roomCode, joinPasscode.trim() || null, nameToUse);
      if (res.success && res.data) {
        setRoom(res.data);
        toastSuccess(`Joined ${room?.roomName || roomCode} successfully!`);
      }
    } catch (err) {
      setJoinError(err.message || 'Failed to join auction room');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleClaimFranchise = async (franchiseCode) => {
    setActionLoading(true);
    try {
      const res = await api.claimFranchise(roomCode, franchiseCode);
      if (res.success && res.data) {
        setRoom(res.data);
        toastSuccess(`Claimed ${franchiseCode} paddle!`);
      }
    } catch (err) {
      toastError(err.message || `Failed to claim ${franchiseCode}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseFranchise = async (franchiseCode) => {
    setActionLoading(true);
    try {
      const res = await api.releaseFranchise(roomCode, franchiseCode);
      if (res.success && res.data) {
        setRoom(res.data);
        toastInfo(`Released ${franchiseCode}`);
      }
    } catch (err) {
      toastError(err.message || `Failed to release ${franchiseCode}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartAuction = async () => {
    if (!isHost) return;
    setActionLoading(true);
    try {
      if (socket && isConnected) {
        socket.emit('auction:start', { roomCode });
      } else {
        await api.startAuction(roomCode);
      }
    } catch (err) {
      toastError(err.message || 'Failed to start auction');
      setActionLoading(false);
    }
  };

  // State 1: Loading
  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-300">Connecting to auction arena {roomCode}...</p>
      </div>
    );
  }

  // State 2: Room Not Found
  if (roomNotFound || (!room && !loading)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-navy-900/90 border border-navy-800 rounded-3xl text-center shadow-2xl animate-fade-in">
        <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white font-['Teko'] uppercase tracking-wider mb-2">
          Auction Room Not Found
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Room with code <strong className="text-amber-400 font-mono">{roomCode}</strong> does not exist or has already ended.
        </p>
        <button
          onClick={onLeaveRoom}
          className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
        >
          <Home className="w-4 h-4" />
          <span>Browse Available Rooms</span>
        </button>
      </div>
    );
  }

  // State 3: Direct Join Entrance (For participants opening shared invitation links who haven't entered yet)
  if (!isParticipant && room) {
    return (
      <div className="max-w-lg mx-auto my-8 sm:my-14 p-6 sm:p-8 bg-gradient-to-b from-navy-900 to-navy-950 border border-blue-500/30 rounded-3xl shadow-2xl animate-fade-in text-left">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold uppercase tracking-wider mb-3">
            <span>Room Code: {room.roomCode}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-['Teko'] uppercase tracking-wide">
            {room.roomName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Host: <strong className="text-slate-200">{room.hostName || 'Admin'}</strong> • {(room.participants || []).length} Managers Connected
          </p>
        </div>

        {/* Room Privacy Notice */}
        <div className={`p-3.5 rounded-xl border mb-5 flex items-center gap-3 text-xs ${
          room.isPrivate
            ? 'bg-amber-400/10 border-amber-400/20 text-amber-300'
            : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
        }`}>
          {room.isPrivate ? <Lock className="w-5 h-5 shrink-0 text-amber-400" /> : <Unlock className="w-5 h-5 shrink-0 text-blue-400" />}
          <div>
            <div className="font-bold uppercase tracking-wider">{room.isPrivate ? 'Private Room' : 'Public Room'}</div>
            <div className="text-[11px] opacity-90">
              {room.isPrivate ? 'This room requires a passcode to enter.' : 'Direct access enabled. Enter your manager name to join.'}
            </div>
          </div>
        </div>

        {joinError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{joinError}</span>
          </div>
        )}

        <form onSubmit={handleDirectJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Your Manager Display Name *
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                maxLength={30}
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="e.g. MS Dhoni"
                className="w-full bg-navy-950 border border-navy-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {room.isPrivate && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Room Passcode *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={joinPasscode}
                  onChange={(e) => setJoinPasscode(e.target.value)}
                  placeholder="Enter private room passcode"
                  className="w-full bg-navy-950 border border-navy-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={joinLoading}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 shadow-xl shadow-orange-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[46px]"
            >
              <span>{joinLoading ? 'Entering Room...' : 'Enter Auction Room'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={onLeaveRoom}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel & Return Home
          </button>
        </div>
      </div>
    );
  }

  // State 4: Connected Room Lobby
  const userClaimedFranchise = (room.franchises || []).find(
    (f) => f.claimedBy && user?._id && String(f.claimedBy?._id || f.claimedBy) === String(user._id)
  );

  const claimedCount = (room.franchises || []).filter((f) => f.claimedBy).length;

  return (
    <div className="space-y-6 sm:space-y-8 py-4 sm:py-6 animate-fade-in text-left">
      {/* Lobby Header Card */}
      <div className="bg-gradient-to-r from-blue-950/90 via-navy-900 to-indigo-950/90 border border-blue-500/20 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-3 py-1 rounded-lg flex items-center gap-2">
                <span>{room.roomCode}</span>
                <button
                  onClick={handleCopyOnlyCode}
                  className="hover:text-white transition-colors"
                  title="Copy room code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </span>

              {room.isPrivate ? (
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-amber-400/20">
                  <Lock className="w-3 h-3" /> Private Room
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-blue-500/20">
                  <Unlock className="w-3 h-3" /> Public Room
                </span>
              )}

              {isHost && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1 border border-emerald-500/20">
                  You are Host
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white font-['Teko'] uppercase tracking-wide">
              {room.roomName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Host: <strong className="text-slate-200">{room.hostName || 'Admin'}</strong> • {claimedCount} of 10 franchises claimed
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {isHost && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white border border-navy-700 flex items-center gap-1.5 text-xs font-bold transition-all"
                title="Room settings"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            <button
              onClick={onLeaveRoom}
              className="px-3.5 py-2.5 rounded-xl bg-navy-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-navy-800 flex items-center gap-1.5 text-xs font-bold transition-all ml-auto md:ml-0"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Invite Friends & Share Room Section */}
      <div className="bg-gradient-to-r from-navy-900/90 via-navy-900/70 to-blue-950/80 border border-blue-500/30 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-amber-400" />
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                Invite Friends & Managers
              </span>
              {room.isPrivate && (
                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  Passcode Required
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">
              Share this direct invitation link with friends on PC or mobile phone to join this live auction.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Copy Room Code Button */}
            <div className="flex items-center bg-navy-950 border border-navy-700/80 rounded-xl overflow-hidden shadow-inner text-xs">
              <div className="px-3 py-2 text-slate-400 font-mono font-medium border-r border-navy-800">
                CODE: <span className="text-amber-400 font-bold">{room.roomCode}</span>
              </div>
              <button
                onClick={handleCopyOnlyCode}
                className="px-3 py-2 bg-navy-900 hover:bg-navy-800 text-slate-300 hover:text-white flex items-center gap-1.5 font-semibold transition-all active:scale-95"
                title="Copy Room Code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Copy Invitation Link Button */}
            <button
              onClick={handleCopyInviteLink}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95"
              title="Copy Direct Invitation URL"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invitation Link'}</span>
            </button>

            {/* Native Web Share API Button (Mobile & Desktop) */}
            <button
              onClick={handleNativeShare}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-navy-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95"
              title="Share Room with Friends"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Participants & Online Presence */}
      <div className="bg-navy-900/80 border border-navy-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Connected Managers & Spectators ({room.participants?.length || 0})
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Real-time presence</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(room.participants || []).map((p) => {
            const isParticipantHost = String(room.host) === String(p._id);
            return (
              <div
                key={p._id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-950 border border-navy-800 text-xs text-white"
              >
                <span className="relative flex h-2 w-2">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-semibold">{p.name}</span>
                {isParticipantHost && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1 rounded">
                    HOST
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 10 Franchise Slots Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Franchise Paddles (10 IPL Teams)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Claim your franchise paddle to manage purse and bid during the live auction
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
          {(room.franchises || []).map((slot) => {
            const isClaimedByMe = user?._id && slot.claimedBy && String(slot.claimedBy?._id || slot.claimedBy) === String(user._id);
            const isClaimed = !!slot.claimedBy;
            const teamProfile = IPL_TEAMS.find((t) => t.code.toUpperCase() === slot.code.toUpperCase());
            const brand = teamProfile?.brand || {
              primaryColor: '#1E40AF',
              textColor: '#FFFFFF',
              symbol: '🏏'
            };

            return (
              <div
                key={slot.code}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isClaimedByMe
                    ? 'bg-blue-950/40 border-blue-500 shadow-glow-blue'
                    : isClaimed
                    ? 'bg-navy-900/60 border-navy-800/80 opacity-90'
                    : 'bg-navy-900/90 border-navy-800 hover:border-slate-600'
                }`}
              >
                <div>
                  {/* Top code and official franchise logo */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-14 h-14 flex items-center justify-center p-1 bg-navy-950/80 rounded-xl border border-navy-800 shadow-inner">
                      <TeamLogo franchise={slot.code} size="lg" />
                    </div>
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded-md shadow-sm uppercase tracking-wider"
                      style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}
                    >
                      {slot.code}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-white truncate leading-tight">
                    {slot.name}
                  </div>
                  <div className="text-[11px] text-amber-400 font-semibold mt-1">
                    Purse: ₹{slot.totalPurseCr || 120.0} Cr
                  </div>
                </div>

                {/* Manager / Claim Status */}
                <div className="mt-4 pt-3 border-t border-navy-800/80">
                  {isClaimed ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400">
                        Manager:{' '}
                        <span className={`font-bold ${isClaimedByMe ? 'text-amber-400' : 'text-slate-200'}`}>
                          {slot.claimedByName || (isClaimedByMe ? 'You' : 'Claimed')}
                        </span>
                      </div>
                      {isClaimedByMe && (
                        <button
                          onClick={() => handleReleaseFranchise(slot.code)}
                          disabled={actionLoading}
                          className="w-full py-2 px-3 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 transition-all min-h-[38px]"
                        >
                          Release Paddle
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleClaimFranchise(slot.code)}
                      disabled={actionLoading || (userClaimedFranchise && !room.settings?.allowMultipleFranchisesPerUser)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-all min-h-[38px] flex items-center justify-center gap-1.5"
                    >
                      <span>Claim Team</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rules Summary & Host Start Control */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 sm:p-7 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto text-left">
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Lot Timer</div>
            <div className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>{room.settings?.timerSeconds || 10} seconds</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Anti-Sniping</div>
            <div className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>+{room.settings?.bidExtensionSeconds || 5}s extension</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Increments</div>
            <div className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="capitalize">{room.settings?.incrementLadderType || 'official'}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400 uppercase font-semibold">Player Pool</div>
            <div className="text-sm font-bold text-white flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>{room.auctionQueueCount || 0} players</span>
            </div>
          </div>
        </div>

        {/* Start Auction Control */}
        <div className="w-full md:w-auto">
          {isHost ? (
            <button
              onClick={handleStartAuction}
              disabled={actionLoading || claimedCount === 0}
              className="w-full md:w-auto px-8 py-4 rounded-xl font-bold text-base bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 shadow-xl shadow-orange-950/50 transition-all flex items-center justify-center gap-2.5 min-h-[50px] disabled:opacity-50 hover:scale-102"
            >
              <Play className="w-5 h-5 fill-navy-950" />
              <span>Start Live Auction</span>
            </button>
          ) : (
            <div className="text-center md:text-right text-xs text-slate-400">
              <div className="font-semibold text-slate-300">Waiting for Host to start...</div>
              <span>Keep this tab open. Live auction will auto-launch on all devices.</span>
            </div>
          )}
        </div>
      </div>

      {/* Host Settings Modal */}
      {isHost && (
        <RoomSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          room={room}
          onSettingsUpdated={(updatedRoom) => setRoom(updatedRoom)}
        />
      )}
    </div>
  );
};
