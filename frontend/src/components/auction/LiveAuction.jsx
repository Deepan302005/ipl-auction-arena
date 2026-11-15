import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useToast } from '../../context/ToastContext';
import { IPL_TEAMS } from '../../data/teamsData';
import { MOCK_ROOMS } from '../../data/mockRooms.js';
import { TeamLogo } from '../common/TeamLogo';
import { playSound } from '../../utils/audio';
import {
  Gavel,
  Clock,
  Zap,
  Shield,
  Users,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  XCircle,
  Trophy,
  History,
  AlertTriangle,
  Flame,
  Award,
  LogOut,
  Volume2,
  VolumeX,
  ListOrdered,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Globe
} from 'lucide-react';

export const LiveAuction = ({ roomCode, onAuctionEnded, onLeaveRoom }) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { toastSuccess, toastError, toastInfo, toastWarning } = useToast();

  const codeUpper = (roomCode || '').toUpperCase();
  const initialRoom = MOCK_ROOMS[codeUpper] || null;
  const ca = initialRoom?.currentAuction;

  const [room, setRoom] = useState(initialRoom);
  const [currentPlayer, setCurrentPlayer] = useState(ca?.player || null);
  const [currentBidCr, setCurrentBidCr] = useState(ca?.currentBidCr || 0);
  const [currentBidderFranchise, setCurrentBidderFranchise] = useState(ca?.currentBidderFranchise || null);
  const [currentBidderName, setCurrentBidderName] = useState(ca?.currentBidderName || null);
  const [nextMinimumBidCr, setNextMinimumBidCr] = useState(0);
  const [bidHistory, setBidHistory] = useState(ca?.bidHistory || []);

  // Server Authoritative Countdown State
  const [timerSeconds, setTimerSeconds] = useState(ca?.timerRemaining || 10);
  const [totalTimerDuration, setTotalTimerDuration] = useState(ca?.timerDuration || 10);
  const [isPaused, setIsPaused] = useState(false);
  const [lotStatus, setLotStatus] = useState(ca?.status || 'bidding'); // bidding, sold, unsold, paused
  const [soldAnnouncement, setSoldAnnouncement] = useState(null);

  // Sound and UI Tabs
  const [muted, setMuted] = useState(false);
  const [leftTab, setLeftTab] = useState('profile'); // 'profile', 'queue', 'completed'
  const [mobileTab, setMobileTab] = useState('podium'); // 'podium', 'profile', 'franchises', 'history'
  const [biddingInFlight, setBiddingInFlight] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  const expiresAtRef = useRef(null);
  const prevTimerSecRef = useRef(timerSeconds);
  const hostId = room?.host?._id ? String(room.host._id) : (room?.host ? String(room.host) : null);
  const currentUserId = user?._id ? String(user._id) : null;
  const isHost = Boolean(hostId && currentUserId && hostId === currentUserId);

  // User's claimed franchise
  const userFranchise = (room?.franchises || []).find(
    (f) => f.claimedBy && currentUserId && String(f.claimedBy?._id || f.claimedBy) === currentUserId
  );

  // Sync initial state
  const loadInitialState = async () => {
    try {
      const res = await api.getRoom(roomCode);
      if (res.success && res.data) {
        applyRoomState(res.data);
      }
    } catch (e) {
      toastError('Error synchronizing auction state');
    }
  };

  const applyRoomState = (roomData) => {
    setRoom(roomData);
    setIsPaused(roomData.status === 'paused');

    if (roomData.currentAuction) {
      const ca = roomData.currentAuction;
      if (ca.player) {
        setCurrentPlayer(ca.player);
      }
      setCurrentBidCr(ca.currentBidCr || (ca.player?.basePriceCr || 0.20));
      setCurrentBidderFranchise(ca.currentBidderFranchise || null);
      setCurrentBidderName(ca.currentBidderName || null);
      setBidHistory(ca.bidHistory || []);
      setLotStatus(ca.status || 'bidding');
      if (ca.timerDuration) setTotalTimerDuration(ca.timerDuration);

      if (ca.lotExpiresAt) {
        expiresAtRef.current = new Date(ca.lotExpiresAt).getTime();
        const diff = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
        setTimerSeconds(diff);
      }
    }

    if (roomData.status === 'completed') {
      onAuctionEnded(roomCode);
    }
  };

  useEffect(() => {
    loadInitialState();
  }, [roomCode]);

  // Server countdown interpolation (smooth second ticks)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPaused || lotStatus !== 'bidding') return;
      if (expiresAtRef.current) {
        const remaining = Math.max(0, Math.ceil((expiresAtRef.current - Date.now()) / 1000));
        setTimerSeconds(remaining);

        // Urgent audio pip when counting down from 3
        if (remaining <= 3 && remaining > 0 && remaining !== prevTimerSecRef.current) {
          playSound('tick', muted);
        }
        prevTimerSecRef.current = remaining;
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPaused, lotStatus, muted]);

  // Socket.IO real-time event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('room:join', { roomCode });
    socket.emit('auction:getState', { roomCode });

    // 1. Authoritative timer update
    const handleTimerUpdate = (data) => {
      if (data?.expiresAt) {
        expiresAtRef.current = new Date(data.expiresAt).getTime();
      }
      if (data?.secondsRemaining !== undefined) {
        setTimerSeconds(data.secondsRemaining);
      }
    };

    // 2. Player changed on podium
    const handlePlayerChanged = (data) => {
      setSoldAnnouncement(null);
      setLotStatus('bidding');
      if (data.player) {
        setCurrentPlayer(data.player);
      }
      setCurrentBidCr(data.basePriceCr || 0.20);
      setCurrentBidderFranchise(null);
      setCurrentBidderName(null);
      setBidHistory([]);
      if (data.lotExpiresAt) {
        expiresAtRef.current = new Date(data.lotExpiresAt).getTime();
      }
      if (data.timerDuration) {
        setTotalTimerDuration(data.timerDuration);
        setTimerSeconds(data.timerDuration);
      }
      toastInfo(`Next Player: ${data.player?.name} (Base: ₹${data.basePriceCr} Cr)`);
    };

    // 3. Bid accepted & placed
    const handleBidPlaced = (data) => {
      setBiddingInFlight(false);
      setCurrentBidCr(data.currentBidCr);
      setCurrentBidderFranchise(data.currentBidderFranchise);
      setCurrentBidderName(data.currentBidderName);
      if (data.nextMinimumBidCr) {
        setNextMinimumBidCr(data.nextMinimumBidCr);
      }
      if (Array.isArray(data.bidHistory)) {
        setBidHistory(data.bidHistory);
      }
      playSound('bid', muted);
    };

    // 4. Bid rejected
    const handleBidRejected = (data) => {
      setBiddingInFlight(false);
      toastError(data.reason || 'Bid rejected by server');
    };

    // 5. Player Sold (Hammer Drop)
    const handlePlayerSold = (data) => {
      setLotStatus('sold');
      setSoldAnnouncement({
        type: 'sold',
        player: data.player,
        franchiseCode: data.franchiseCode,
        franchiseName: data.franchiseName,
        priceCr: data.soldPriceCr,
        buyerName: data.buyerName
      });
      // Synchronize franchise remaining purse and squad immediately
      setRoom((prev) => {
        if (!prev) return prev;
        const updatedFranchises = (prev.franchises || []).map((f) => {
          if (f.code.toUpperCase() === (data.franchiseCode || '').toUpperCase()) {
            return {
              ...f,
              remainingPurseCr: data.remainingPurseCr !== undefined ? data.remainingPurseCr : Math.max(0, f.remainingPurseCr - (data.soldPriceCr || 0)),
              squad: [...(f.squad || []), { player: data.player, boughtForCr: data.soldPriceCr }]
            };
          }
          return f;
        });
        return { ...prev, franchises: updatedFranchises };
      });
      playSound('sold', muted);
      toastSuccess(`🔨 SOLD! ${data.player?.name} to ${data.franchiseCode} for ₹${data.soldPriceCr} Cr`);
    };

    // 6. Player Unsold
    const handlePlayerUnsold = (data) => {
      setLotStatus('unsold');
      setSoldAnnouncement({
        type: 'unsold',
        player: data.player,
        message: data.message
      });
      playSound('unsold', muted);
      toastWarning(`❌ UNSOLD: ${data.player?.name}`);
    };

    // 7. Full state sync
    const handleStateUpdated = (data) => {
      if (data?.room) {
        applyRoomState(data.room);
      }
    };

    // 8. Auction Paused / Resumed
    const handleAuctionPaused = () => {
      setIsPaused(true);
      toastWarning('Auction PAUSED by Host.');
    };

    const handleAuctionResumed = (data) => {
      setIsPaused(false);
      if (data?.lotExpiresAt) {
        expiresAtRef.current = new Date(data.lotExpiresAt).getTime();
      }
      toastInfo('Auction RESUMED.');
    };

    // 9. Corrected sale
    const handleSaleReversed = (data) => {
      toastWarning(`Sale reversed for ${data.franchiseCode}. Player returned to pool.`);
    };

    // 10. Auction Completed
    const handleAuctionCompleted = () => {
      toastSuccess('The IPL Auction has concluded!');
      onAuctionEnded(roomCode);
    };

    socket.on('auction:timerUpdate', handleTimerUpdate);
    socket.on('auction:playerChanged', handlePlayerChanged);
    socket.on('auction:bidPlaced', handleBidPlaced);
    socket.on('auction:bidRejected', handleBidRejected);
    socket.on('auction:playerSold', handlePlayerSold);
    socket.on('auction:playerUnsold', handlePlayerUnsold);
    socket.on('auction:stateUpdated', handleStateUpdated);
    socket.on('auction:paused', handleAuctionPaused);
    socket.on('auction:resumed', handleAuctionResumed);
    socket.on('auction:saleReversed', handleSaleReversed);
    socket.on('auction:completed', handleAuctionCompleted);

    return () => {
      socket.off('auction:timerUpdate', handleTimerUpdate);
      socket.off('auction:playerChanged', handlePlayerChanged);
      socket.off('auction:bidPlaced', handleBidPlaced);
      socket.off('auction:bidRejected', handleBidRejected);
      socket.off('auction:playerSold', handlePlayerSold);
      socket.off('auction:playerUnsold', handlePlayerUnsold);
      socket.off('auction:stateUpdated', handleStateUpdated);
      socket.off('auction:paused', handleAuctionPaused);
      socket.off('auction:resumed', handleAuctionResumed);
      socket.off('auction:saleReversed', handleSaleReversed);
      socket.off('auction:completed', handleAuctionCompleted);
    };
  }, [socket, isConnected, roomCode, muted]);

  // Bid Increment & Next Minimum Bid Calculations
  const getBidIncrement = (currentBid, ladder = 'official') => {
    const b = Number(currentBid) || 0;
    if (ladder === 'custom') {
      if (b < 1.0) return 0.10;
      if (b < 5.0) return 0.20;
      if (b < 10.0) return 0.25;
      return 0.50;
    }
    // Official IPL slabs
    if (b < 1.0) return 0.20;
    if (b < 2.0) return 0.25;
    return 0.50;
  };

  const hasBidder = !!currentBidderFranchise;
  const ladder = room?.settings?.incrementLadderType || 'official';
  const incrementCr = getBidIncrement(currentBidCr, ladder);
  const nextBidCr = nextMinimumBidCr || (hasBidder ? parseFloat((currentBidCr + incrementCr).toFixed(2)) : (currentPlayer?.basePriceCr || 0.20));
  const incrementLabel = incrementCr >= 1.0 ? `+₹${incrementCr.toFixed(2)} Cr` : `+₹${Math.round(incrementCr * 100)} L`;

  // Place Bid action
  const handlePlaceBid = () => {
    if (!userFranchise) {
      toastError('You must claim a franchise paddle to place bids!');
      return;
    }
    if (lotStatus !== 'bidding' || isPaused) {
      toastError('Bidding is not active for this lot.');
      return;
    }
    if (currentBidderFranchise === userFranchise.code) {
      toastWarning(`${userFranchise.name} already holds the highest bid!`);
      return;
    }
    if (userFranchise.remainingPurseCr < nextBidCr) {
      toastError(`Insufficient purse! Needed: ₹${nextBidCr} Cr, Available: ₹${userFranchise.remainingPurseCr?.toFixed(2)} Cr`);
      return;
    }

    setBiddingInFlight(true);
    socket.emit('auction:bid', {
      roomCode,
      franchiseCode: userFranchise.code
    });
  };

  // Host Action Handlers
  const handleHostPause = () => {
    if (!isHost) return;
    if (isPaused) {
      socket.emit('auction:resume', { roomCode });
    } else {
      socket.emit('auction:pause', { roomCode });
    }
  };

  const handleHostSkip = () => {
    if (!isHost) return;
    socket.emit('auction:skipPlayer', { roomCode });
  };

  const handleHostMarkUnsold = () => {
    if (!isHost) return;
    socket.emit('auction:markUnsold', { roomCode });
  };

  const handleHostReopenUnsold = () => {
    if (!isHost) return;
    socket.emit('auction:reopenUnsold', { roomCode });
  };

  const handleHostCorrectSale = () => {
    if (!isHost) return;
    socket.emit('auction:correctSale', { roomCode });
  };

  const handleHostEndAuction = () => {
    if (!isHost) return;
    socket.emit('auction:end', { roomCode });
    setConfirmEndOpen(false);
  };

  // Auctioneer Callout Status Text based on Timer
  const getAuctioneerCallout = () => {
    if (isPaused) return { text: 'AUCTION PAUSED', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/30' };
    if (lotStatus === 'sold') return { text: '🔨 SOLD!', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' };
    if (lotStatus === 'unsold') return { text: '❌ PASSED UNSOLD', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' };
    if (timerSeconds <= 0) return { text: 'HAMMER FALLING...', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/40' };
    if (timerSeconds === 1) return { text: '🔥 FAIR WARNING! FINAL CALL!', color: 'text-red-400 animate-pulse', bg: 'bg-red-500/25 border-red-500/60' };
    if (timerSeconds <= 3) return { text: '⚡ GOING TWICE...', color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/40' };
    if (timerSeconds <= 5) return { text: '⏳ GOING ONCE...', color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/30' };
    return { text: '🟢 LIVE BIDDING ACTIVE', color: 'text-blue-300', bg: 'bg-blue-500/15 border-blue-500/30' };
  };

  const callout = getAuctioneerCallout();

  // SVG Circular progress math
  const circleRadius = 52;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const progressRatio = Math.max(0, Math.min(1, timerSeconds / (totalTimerDuration || 10)));
  const strokeDashoffset = circleCircumference * (1 - progressRatio);

  const leadingBrand = IPL_TEAMS.find((t) => t.code === currentBidderFranchise)?.brand;

  // Upcoming and completed lots
  const upcomingQueue = Array.isArray(room?.auctionQueue) ? room.auctionQueue : [];
  const completedLots = Array.isArray(room?.completedLots) ? room.completedLots : [];

  return (
    <div className="space-y-4 py-2 sm:py-4 animate-fade-in max-w-7xl mx-auto px-2 sm:px-4">
      {/* TOP HEADER BAR */}
      <div className="bg-navy-900/90 border border-navy-800 rounded-2xl px-3.5 sm:px-5 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 shrink-0">
            {roomCode}
          </span>
          <h1 className="text-xs sm:text-sm font-bold text-white truncate max-w-[120px] sm:max-w-xs">
            {room?.roomName || 'IPL Auction Arena'}
          </h1>
          {isPaused && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse shrink-0">
              PAUSED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Audio toggle button */}
          <button
            onClick={() => setMuted(!muted)}
            className={`p-2 rounded-xl border transition-colors ${
              muted ? 'bg-navy-950 text-slate-500 border-navy-800' : 'bg-navy-950 text-amber-400 border-amber-400/30'
            }`}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* User Franchise Paddle Indicator */}
          {userFranchise ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-950 border border-blue-500/40 text-xs shadow-inner">
              <TeamLogo franchise={userFranchise.code} size="xs" />
              <div>
                <span className="font-bold text-amber-400 mr-1">{userFranchise.code}</span>
                <span className="text-white font-mono font-bold hidden sm:inline">
                  ₹{userFranchise.remainingPurseCr?.toFixed(1)} Cr
                </span>
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-slate-400 bg-navy-950 px-2.5 py-1 rounded-xl border border-navy-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Spectator</span>
            </span>
          )}

          <button
            onClick={onLeaveRoom}
            className="p-2 rounded-xl bg-navy-950 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-navy-800 transition-colors"
            title="Leave auction room"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* HOST CONTROLS TOOLBAR */}
      {isHost && (
        <div className="bg-gradient-to-r from-navy-900 via-indigo-950 to-navy-900 border border-blue-500/30 rounded-2xl p-3 sm:p-3.5 shadow-xl flex items-center justify-between gap-2 overflow-x-auto scrollbar-thin">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
              Host Controls
            </span>
            <button
              onClick={handleHostPause}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isPaused ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              onClick={handleHostSkip}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white border border-navy-700 flex items-center gap-1"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Skip Lot</span>
            </button>
            <button
              onClick={handleHostMarkUnsold}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-slate-300 hover:text-white border border-navy-700 flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pass Unsold</span>
            </button>
            <button
              onClick={handleHostCorrectSale}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-navy-800 hover:bg-navy-700 text-amber-300 hover:text-amber-200 border border-navy-700 flex items-center gap-1"
              title="Undo the last hammer drop and refund the winning franchise"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Correct Sale</span>
            </button>
            {room?.unsoldQueueCount > 0 && (
              <button
                onClick={handleHostReopenUnsold}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-600 text-white flex items-center gap-1"
              >
                <span>Reopen ({room.unsoldQueueCount})</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setConfirmEndOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/30 transition-all shrink-0 ml-auto"
          >
            End Auction
          </button>
        </div>
      )}

      {/* MOBILE NAVIGATION TABS (Visible only below lg) */}
      <div className="flex lg:hidden rounded-xl bg-navy-900 p-1 border border-navy-800 text-xs font-bold">
        <button
          onClick={() => setMobileTab('podium')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            mobileTab === 'podium' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Podium & Bid
        </button>
        <button
          onClick={() => setMobileTab('profile')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            mobileTab === 'profile' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Player & Stats
        </button>
        <button
          onClick={() => setMobileTab('franchises')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            mobileTab === 'franchises' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Teams ({room?.franchises?.length || 10})
        </button>
        <button
          onClick={() => setMobileTab('history')}
          className={`flex-1 py-2 rounded-lg transition-all ${
            mobileTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'
          }`}
        >
          Bids ({bidHistory.length})
        </button>
      </div>

      {/* MAIN 3-COLUMN RESPONSIVE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Player Spotlight & Queue (Desktop col-span-4) */}
        {/* ========================================================= */}
        <div className={`lg:col-span-4 space-y-4 ${
          mobileTab === 'profile' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Sub-tabs for Left Column */}
          <div className="flex rounded-xl bg-navy-900/90 p-1 border border-navy-800 text-xs font-bold">
            <button
              onClick={() => setLeftTab('profile')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                leftTab === 'profile' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Player Profile
            </button>
            <button
              onClick={() => setLeftTab('queue')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                leftTab === 'queue' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Queue ({room?.auctionQueueCount || upcomingQueue.length})
            </button>
            <button
              onClick={() => setLeftTab('completed')}
              className={`flex-1 py-2 rounded-lg transition-all ${
                leftTab === 'completed' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed ({room?.completedLotsCount || completedLots.length})
            </button>
          </div>

          {/* TAB 1: PLAYER PROFILE & DETAILED CAREER STATS */}
          {leftTab === 'profile' && (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 relative overflow-hidden">
              {currentPlayer ? (
                <>
                  {/* Badges: Role and Overseas / Country */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-300 bg-blue-500/15 border border-blue-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <span>🏏</span>
                      <span>{currentPlayer.role || 'Player'}</span>
                    </span>

                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                      currentPlayer.country === 'Overseas' || (currentPlayer.country && currentPlayer.country !== 'India')
                        ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      <Globe className="w-3.5 h-3.5" />
                      <span>{currentPlayer.nationality || currentPlayer.country || 'India'}</span>
                    </span>
                  </div>

                  {/* Player Avatar, Name & Base Price */}
                  <div className="flex items-center gap-4 pt-1">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-amber-500 p-[2px] shrink-0 shadow-xl">
                      <div className="w-full h-full bg-navy-950 rounded-[14px] flex items-center justify-center text-3xl sm:text-4xl font-black text-amber-400">
                        {currentPlayer.name ? currentPlayer.name[0] : '🏏'}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-2xl sm:text-3xl font-black text-white font-['Teko'] uppercase tracking-tight leading-none truncate">
                        {currentPlayer.name}
                      </h2>
                      <div className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                        <span className="text-slate-400">Base Price:</span>
                        <strong className="text-amber-400 font-mono text-sm">₹{currentPlayer.basePriceCr?.toFixed(2) || '0.20'} Cr</strong>
                      </div>
                      {currentPlayer.battingStyle && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          Bat: <span className="text-slate-300">{currentPlayer.battingStyle}</span>
                        </div>
                      )}
                      {currentPlayer.bowlingStyle && (
                        <div className="text-[11px] text-slate-400 truncate">
                          Bowl: <span className="text-slate-300">{currentPlayer.bowlingStyle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Career & IPL Stats Grid */}
                  <div className="pt-3 border-t border-navy-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                      <span>IPL Career Performance</span>
                      <span className="text-[10px] text-blue-400 font-mono font-normal">2008–2026 Archive</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Matches</div>
                        <div className="text-base font-bold text-white font-mono mt-0.5">
                          {currentPlayer.iplStats?.matches ?? '-'}
                        </div>
                      </div>
                      <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Runs</div>
                        <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
                          {currentPlayer.iplStats?.runs ?? '-'}
                        </div>
                      </div>
                      <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold">Wickets</div>
                        <div className="text-base font-bold text-blue-400 font-mono mt-0.5">
                          {currentPlayer.iplStats?.wickets ?? '-'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-navy-950 p-2 rounded-xl border border-navy-800">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Average</div>
                        <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                          {currentPlayer.iplStats?.battingAverage ?? '-'}
                        </div>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-xl border border-navy-800">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Strike Rate</div>
                        <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                          {currentPlayer.iplStats?.strikeRate ?? '-'}
                        </div>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-xl border border-navy-800">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">Economy</div>
                        <div className="text-xs font-bold text-slate-200 font-mono mt-0.5">
                          {currentPlayer.iplStats?.economy ?? '-'}
                        </div>
                      </div>
                      <div className="bg-navy-950 p-2 rounded-xl border border-navy-800">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">100s / 50s</div>
                        <div className="text-xs font-bold text-amber-300 font-mono mt-0.5">
                          {currentPlayer.iplStats?.centuries ?? 0}/{currentPlayer.iplStats?.fifties ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Historical Franchises */}
                  {currentPlayer.franchiseHistory && currentPlayer.franchiseHistory.length > 0 && (
                    <div className="pt-2 border-t border-navy-800/80 text-xs">
                      <span className="text-slate-400 mr-1.5">Previous Franchises:</span>
                      <span className="font-semibold text-slate-200">
                        {currentPlayer.franchiseHistory.join(', ')}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-slate-500">
                  <Gavel className="w-12 h-12 mx-auto mb-3 text-slate-600 animate-pulse" />
                  <p className="text-sm font-semibold text-slate-400">Waiting for next player lot to open...</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPCOMING PLAYERS QUEUE */}
          {leftTab === 'queue' && (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Upcoming Players ({upcomingQueue.length})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Next in line</span>
              </div>

              {upcomingQueue.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No further players in the queue.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {upcomingQueue.map((item, idx) => {
                    const playerObj = typeof item === 'object' && item !== null ? item : null;
                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-navy-950 border border-navy-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-navy-800 text-slate-400 flex items-center justify-center text-[10px] font-mono shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">
                              {playerObj?.name || `Player #${idx + 1}`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {playerObj?.role || 'Player'} • {playerObj?.country || 'India'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-amber-400">
                            ₹{playerObj?.basePriceCr || 0.20} Cr
                          </div>
                          <div className="text-[9px] text-slate-500 uppercase">Base</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: COMPLETED LOTS (SOLD & UNSOLD) */}
          {leftTab === 'completed' && (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-navy-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Completed Lots ({completedLots.length})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">Archive</span>
              </div>

              {completedLots.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No lots finalized yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {[...completedLots].reverse().map((lot, idx) => {
                    const isSold = lot.status === 'sold';
                    const playerName = lot.player?.name || lot.playerName || 'Player';
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                          isSold ? 'bg-navy-950 border-emerald-500/30' : 'bg-navy-950/60 border-navy-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isSold && lot.soldToFranchise && (
                            <TeamLogo franchise={lot.soldToFranchise} size="xs" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate">{playerName}</div>
                            <div className="text-[10px] text-slate-400">
                              {isSold ? `To ${lot.soldToFranchise}` : 'Unsold'}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isSold ? (
                            <span className="font-mono font-bold text-amber-400">
                              ₹{lot.soldPriceCr?.toFixed(2)} Cr
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-400 uppercase">
                              UNSOLD
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN: Live Podium & Giant Paddle (Desktop col-span-5) */}
        {/* ========================================================= */}
        <div className={`lg:col-span-5 space-y-4 ${
          mobileTab === 'podium' ? 'block' : 'hidden lg:block'
        }`}>
          <div className="bg-gradient-to-b from-navy-900 via-navy-950 to-navy-950 border border-navy-800 rounded-3xl p-5 sm:p-7 shadow-2xl relative flex flex-col items-center justify-between text-center min-h-[460px]">
            
            {/* Auctioneer Stage Callout Banner */}
            <div className={`w-full py-1.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-between ${callout.bg}`}>
              <div className="flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5 text-amber-400" />
                <span className={callout.color}>{callout.text}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Lot #{room?.currentAuction?.lotIndex || 1}
              </span>
            </div>

            {/* Giant Authoritative Circular Countdown Ring */}
            <div className="relative my-2 flex items-center justify-center">
              <svg className="w-36 h-36 sm:w-44 sm:h-44 transform -rotate-90">
                {/* Background Track */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={circleRadius}
                  className="stroke-navy-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                {/* Dynamic Urgency Ring */}
                <circle
                  cx="50%"
                  cy="50%"
                  r={circleRadius}
                  className={`transition-all duration-300 ${
                    timerSeconds <= 3
                      ? 'stroke-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                      : timerSeconds <= 5
                      ? 'stroke-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                      : 'stroke-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                  }`}
                  strokeWidth="8"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Centered Digital Countdown Numbers */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className={`text-5xl sm:text-6xl font-black font-mono leading-none tracking-tight transition-transform ${
                    timerSeconds <= 3 ? 'text-red-400 scale-110' : timerSeconds <= 5 ? 'text-amber-400' : 'text-blue-300'
                  }`}
                >
                  {timerSeconds}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                  Seconds
                </span>
              </div>
            </div>

            {/* Current Winning Bid Display Box */}
            <div className="w-full my-3 py-3.5 px-4 rounded-2xl bg-navy-950/90 border border-navy-800 shadow-inner">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Current Winning Bid
              </div>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-black text-amber-400 font-['Teko'] tracking-tight leading-none">
                ₹{currentBidCr?.toFixed(2)} <span className="text-2xl text-slate-400 font-normal">Cr</span>
              </div>

              {/* Leading Franchise Callout with Official Logo */}
              <div className="mt-2.5 flex items-center justify-center gap-2">
                {currentBidderFranchise ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-navy-900 border border-amber-400/40 shadow-md">
                    <TeamLogo franchise={currentBidderFranchise} size="sm" />
                    <span className="font-bold text-white text-xs sm:text-sm">
                      {currentBidderFranchise} ({currentBidderName || 'Manager'})
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      Leading
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">
                    No active bids placed • Opens at Base Price
                  </span>
                )}
              </div>
            </div>

            {/* Hammer Drop Outcome Banner */}
            {soldAnnouncement && (
              <div className={`w-full p-4 rounded-2xl border text-center animate-bounce-short mb-2 ${
                soldAnnouncement.type === 'sold'
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100 shadow-xl'
                  : 'bg-red-950/90 border-red-500/60 text-red-100 shadow-xl'
              }`}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  {soldAnnouncement.type === 'sold' && soldAnnouncement.franchiseCode && (
                    <TeamLogo franchise={soldAnnouncement.franchiseCode} size="md" />
                  )}
                  <span className="text-lg font-black uppercase tracking-wider">
                    {soldAnnouncement.type === 'sold' ? '🔨 SOLD!' : '❌ UNSOLD'}
                  </span>
                </div>
                <div className="text-xs font-semibold">
                  {soldAnnouncement.type === 'sold'
                    ? `${soldAnnouncement.player?.name} acquired by ${soldAnnouncement.franchiseName || soldAnnouncement.franchiseCode} for ₹${soldAnnouncement.priceCr} Cr`
                    : `${soldAnnouncement.player?.name} received no qualifying bids`}
                </div>
              </div>
            )}

            {/* Giant Touch-Friendly Bidding Paddle Button */}
            <div className="w-full pt-2">
              <button
                onClick={handlePlaceBid}
                disabled={
                  biddingInFlight ||
                  lotStatus !== 'bidding' ||
                  isPaused ||
                  !userFranchise ||
                  currentBidderFranchise === userFranchise.code ||
                  (userFranchise.remainingPurseCr < nextBidCr)
                }
                className={`w-full py-4 sm:py-5 px-5 rounded-2xl font-black text-base sm:text-lg lg:text-xl tracking-wider uppercase transition-all shadow-2xl flex items-center justify-center gap-3 min-h-[58px] select-none ${
                  currentBidderFranchise === userFranchise?.code
                    ? 'bg-emerald-700/80 text-white cursor-default border border-emerald-500/40 shadow-emerald-950/50'
                    : 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 shadow-orange-950/70 hover:scale-102 active:scale-98'
                } disabled:opacity-40 disabled:hover:scale-100`}
              >
                {biddingInFlight ? (
                  <span className="w-6 h-6 border-3 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                ) : currentBidderFranchise === userFranchise?.code ? (
                  <>
                    <Award className="w-6 h-6 text-white" />
                    <span>Your Bid is Leading</span>
                  </>
                ) : (
                  <>
                    {userFranchise ? (
                      <TeamLogo franchise={userFranchise.code} size="sm" />
                    ) : (
                      <Gavel className="w-6 h-6 text-navy-950" />
                    )}
                    <span>
                      Raise to ₹{nextBidCr.toFixed(2)} Cr
                    </span>
                    <span className="text-xs font-mono font-bold bg-navy-950/20 px-2 py-0.5 rounded text-navy-950">
                      {incrementLabel}
                    </span>
                  </>
                )}
              </button>

              {/* Ladder & Anti-sniping footer callout */}
              <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between px-2">
                <span>Increment: <strong className="text-slate-200">{incrementLabel}</strong></span>
                <span>Ladder: <strong className="text-slate-200 capitalize">{ladder}</strong></span>
                <span>Anti-sniping: <strong className="text-amber-400">+{room?.settings?.bidExtensionSeconds || 5}s</strong></span>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Franchises & Live Bid Feed (Desktop col-span-3) */}
        {/* ========================================================= */}
        <div className={`lg:col-span-3 space-y-4 ${
          mobileTab === 'franchises' || mobileTab === 'history' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Franchise Budgets & Squad Limits (All 10 Franchises) */}
          {(mobileTab === 'franchises' || window.innerWidth >= 1024) && (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-4 sm:p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                <span>10 Franchise Budgets</span>
                <span className="text-[10px] text-slate-500 font-normal">Max 8 OS</span>
              </h3>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {(room?.franchises || []).map((f) => {
                  const isCurrent = f.code === currentBidderFranchise;
                  const isUserTeam = userFranchise?.code === f.code;
                  const overseasCount = (f.squad || []).filter(
                    (s) => s.country && s.country.toLowerCase() !== 'india'
                  ).length;

                  return (
                    <div
                      key={f.code}
                      className={`p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                        isCurrent
                          ? 'bg-amber-400/10 border-amber-400/50 shadow-sm'
                          : isUserTeam
                          ? 'bg-blue-950/40 border-blue-500/40'
                          : 'bg-navy-950 border-navy-800/80 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TeamLogo franchise={f.code} size="xs" />
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                            <span>{f.code}</span>
                            {isUserTeam && (
                              <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1 rounded">YOU</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {f.squad?.length || 0}/25 p • {overseasCount}/8 OS
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-amber-400">
                          ₹{f.remainingPurseCr?.toFixed(1)} Cr
                        </div>
                        <div className="text-[9px] text-slate-500">Purse</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Chronological Bid Stream Feed */}
          {(mobileTab === 'history' || window.innerWidth >= 1024) && (
            <div className="bg-navy-900/90 border border-navy-800 rounded-3xl p-4 sm:p-5 shadow-xl">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-400" />
                  <span>Live Bid Feed</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">
                  {bidHistory.length} bids
                </span>
              </h3>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {bidHistory.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No bids recorded for this lot yet.
                  </div>
                ) : (
                  [...bidHistory].reverse().map((bid, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-xl bg-navy-950 border border-navy-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <TeamLogo franchise={bid.franchiseCode} size="xs" />
                        <div>
                          <div className="font-bold text-white">{bid.franchiseCode}</div>
                          <div className="text-[10px] text-slate-400">{bid.userName || 'Manager'}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-amber-400">
                          ₹{bid.amountCr?.toFixed(2)} Cr
                        </div>
                        <div className="text-[10px] text-slate-500">
                          +{bid.bidIncrementCr || 0.20}Cr
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* CONFIRMATION MODAL TO CONCLUDE AUCTION */}
      {confirmEndOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-red-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-white">Conclude Auction Early?</h3>
              <p className="text-xs text-slate-400 mt-1">
                This will finalize all remaining lots, audit franchise squads, and transition to the results dashboard.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setConfirmEndOpen(false)}
                className="py-2.5 rounded-xl bg-navy-800 text-slate-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleHostEndAuction}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                End Auction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
