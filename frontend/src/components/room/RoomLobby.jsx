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
  AlertCircle
} from 'lucide-react';

export const RoomLobby = ({ roomCode, onLeaveRoom, onAuctionStarted }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toastSuccess, toastError, toastInfo } = useToast();

  const codeUpper = (roomCode || '').toUpperCase();
  const initialRoom = MOCK_ROOMS[codeUpper] || null;
  const [room, setRoom] = useState(initialRoom);
  const [loading, setLoading] = useState(!initialRoom);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const hostId = room?.host?._id ? String(room.host._id) : (room?.host ? String(room.host) : null);
  const currentUserId = user?._id ? String(user._id) : null;
  const isHost = Boolean(hostId && currentUserId && hostId === currentUserId);

  // Fetch initial room state
  const loadRoom = async () => {
    try {
      const res = await api.getRoom(roomCode);
      if (res.success && res.data) {
        setRoom(res.data);
        if (res.data.status === 'live') {
          onAuctionStarted(roomCode);
        }
      }
    } catch (err) {
      toastError(err.message || 'Error loading room state');
      onLeaveRoom();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [roomCode]);

  // Socket.IO event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Join room room socket channel
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

  const handleCopyCode = () => {
    const inviteLink = `${window.location.origin}#room/${roomCode}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toastSuccess('Invitation link copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
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
      // Trigger via socket or REST
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

  if (loading || !room) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-slate-300">Connecting to auction lobby {roomCode}...</p>
      </div>
    );
  }

  const userClaimedFranchise = (room.franchises || []).find(
    (f) => f.claimedBy && user?._id && String(f.claimedBy?._id || f.claimedBy) === String(user._id)
  );

  const claimedCount = (room.franchises || []).filter((f) => f.claimedBy).length;

  return (
    <div className="space-y-6 sm:space-y-8 py-4 sm:py-6 animate-fade-in">
      {/* Lobby Header Card */}
      <div className="bg-gradient-to-r from-blue-950/90 via-navy-900 to-indigo-950/90 border border-blue-500/20 rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-mono text-xs sm:text-sm font-bold text-amber-400 bg-amber-400/15 border border-amber-400/30 px-3 py-1 rounded-lg flex items-center gap-2">
                <span>{room.roomCode}</span>
                <button
                  onClick={handleCopyCode}
                  className="hover:text-white transition-colors"
                  title="Copy share link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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
