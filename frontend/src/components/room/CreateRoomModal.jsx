import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PlusCircle, Lock, Unlock, Clock, Zap, DollarSign, Layers, Shield, Sparkles, User } from 'lucide-react';
import { IPL_TEAMS } from '../../data/teamsData';
import { TeamLogo } from '../common/TeamLogo';

export const CreateRoomModal = ({ isOpen, onClose, onRoomCreated }) => {
  const { user, ensureSession } = useAuth();
  const [managerName, setManagerName] = useState(user?.name || '');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [autoClaimTeam, setAutoClaimTeam] = useState('CSK');
  const [timerSeconds, setTimerSeconds] = useState(10);
  const [bidExtensionSeconds, setBidExtensionSeconds] = useState(5);
  const [incrementLadderType, setIncrementLadderType] = useState('official');
  const [startingPurseCr, setStartingPurseCr] = useState(120);
  const [poolType, setPoolType] = useState('all-time');
  const [loading, setLoading] = useState(false);

  const { toastSuccess, toastError } = useToast();

  useEffect(() => {
    if (user?.name && !managerName) {
      setManagerName(user.name);
    }
  }, [user]);

  const handleClose = () => {
    setRoomName('');
    setIsPrivate(false);
    setPasscode('');
    onClose();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      toastError('Please enter a room name');
      return;
    }
    if (isPrivate && !passcode.trim()) {
      toastError('Please specify a passcode for private room');
      return;
    }

    const nameToUse = (managerName || user?.name || 'Manager').trim();

    setLoading(true);
    try {
      await ensureSession(nameToUse, autoClaimTeam);
      const res = await api.createRoom({
        roomName: roomName.trim(),
        displayName: nameToUse,
        hostName: nameToUse,
        isPrivate,
        passcode: isPrivate ? passcode.trim() : undefined,
        autoClaimTeam: autoClaimTeam || undefined,
        settings: {
          timerSeconds: Number(timerSeconds),
          bidExtensionSeconds: Number(bidExtensionSeconds),
          incrementLadderType,
          startingPurseCr: Number(startingPurseCr),
          poolType
        }
      });

      if (res.success && res.data) {
        toastSuccess(`Room created! Room Code: ${res.data.roomCode}`);
        onRoomCreated(res.data.roomCode);
        handleClose();
      }
    } catch (err) {
      toastError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create IPL Auction Room"
      subtitle="Host a real-time live auction with custom rules and timers"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleCreate} className="space-y-4 sm:space-y-5">
        {/* Host / Manager Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
            <span>Your Manager Name *</span>
            <span className="text-[10px] text-slate-400 font-normal">Displayed to all participants</span>
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              required
              maxLength={30}
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="e.g. Rohit Sharma"
              className="w-full bg-navy-950 border border-navy-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Room Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Room Name *
          </label>
          <input
            type="text"
            required
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g. Mega Auction 2026 League"
            className="w-full bg-navy-950 border border-navy-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Private Room Toggle & Passcode */}
        <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-blue-400" />}
              <div>
                <div className="text-sm font-bold text-white">Private Auction Room</div>
                <div className="text-xs text-slate-400">Require participants to enter a passcode to join</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                isPrivate ? 'bg-amber-500' : 'bg-navy-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  isPrivate ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {isPrivate && (
            <div className="pt-2 border-t border-navy-800">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Room Passcode *
              </label>
              <input
                type="text"
                required={isPrivate}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="e.g. IPL2026"
                className="w-full bg-navy-950 border border-navy-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        {/* Auto-Claim Franchise */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
            Auto-Claim Franchise (Your Paddle)
          </label>
          <div className="flex items-center gap-2.5">
            {autoClaimTeam ? (
              <div className="w-12 h-12 rounded-xl bg-navy-950 border border-navy-700/80 flex items-center justify-center shrink-0 p-1.5 shadow-inner">
                <TeamLogo franchise={autoClaimTeam} size="sm" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-navy-950 border border-navy-700/80 flex items-center justify-center shrink-0 text-slate-500">
                <Shield className="w-5 h-5" />
              </div>
            )}
            <select
              value={autoClaimTeam}
              onChange={(e) => setAutoClaimTeam(e.target.value)}
              className="w-full bg-navy-950 border border-navy-700/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">None (Claim later in lobby)</option>
              {IPL_TEAMS.map((t) => (
                <option key={t.code} value={t.code} className="bg-navy-900 text-white">
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
          {/* Quick Franchise Chips */}
          <div className="grid grid-cols-5 gap-1.5 mt-2.5">
            {IPL_TEAMS.map((t) => {
              const isSelected = autoClaimTeam === t.code;
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setAutoClaimTeam(t.code)}
                  className={`p-1.5 rounded-lg flex items-center justify-center border transition-all ${
                    isSelected
                      ? 'bg-blue-600/30 border-amber-400 ring-1 ring-amber-400'
                      : 'bg-navy-950/60 border-navy-800 hover:border-slate-600'
                  }`}
                  title={t.name}
                >
                  <TeamLogo franchise={t.code} size="xs" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Rules & Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Timer Seconds */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase">Countdown Timer</span>
            </div>
            <select
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value={5}>5 seconds (Fast / Blitz)</option>
              <option value={10}>10 seconds (Standard)</option>
              <option value={15}>15 seconds</option>
              <option value={20}>20 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>60 seconds (Deliberate)</option>
            </select>
          </div>

          {/* Anti-Sniping Bid Extension */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300 uppercase">Anti-Sniping Extension</span>
            </div>
            <select
              value={bidExtensionSeconds}
              onChange={(e) => setBidExtensionSeconds(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value={3}>+3 seconds if bid placed near expiry</option>
              <option value={5}>+5 seconds (Recommended)</option>
              <option value={10}>+10 seconds</option>
              <option value={0}>0 seconds (No extension)</option>
            </select>
          </div>
        </div>

        {/* Bid Increment Schedule */}
        <div className="bg-navy-950/60 border border-navy-800 rounded-xl p-3.5">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-amber-400" />
            Bid Increment Schedule
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setIncrementLadderType('official')}
              className={`p-3 rounded-xl border text-left transition-all ${
                incrementLadderType === 'official'
                  ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                  : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold text-blue-300 mb-0.5">Official Modern IPL Slabs</div>
              <div className="text-[11px] text-slate-300 leading-tight">
                Verified modern slabs: 20L (&lt;1Cr), 25L (1-2Cr), 50L (≥2Cr)
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIncrementLadderType('custom')}
              className={`p-3 rounded-xl border text-left transition-all ${
                incrementLadderType === 'custom'
                  ? 'bg-amber-600/20 border-amber-500 text-white shadow-md'
                  : 'bg-navy-900/60 border-navy-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-bold text-amber-300 mb-0.5">Custom Arena Slabs</div>
              <div className="text-[11px] text-slate-300 leading-tight">
                Micro-step ladder: 10L (&lt;1Cr), 20L (1-5Cr), 25L (5-10Cr), 50L
              </div>
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 shadow-lg shadow-orange-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
          ) : (
            <>
              <PlusCircle className="w-4 h-4 text-navy-950" />
              Launch Auction Room
            </>
          )}
        </button>
      </form>
    </Modal>
  );
};
