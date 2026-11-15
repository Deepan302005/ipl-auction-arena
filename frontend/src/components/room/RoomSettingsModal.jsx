import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Settings, Clock, Zap, DollarSign, Users, Globe, Layers, RefreshCw } from 'lucide-react';

export const RoomSettingsModal = ({ isOpen, onClose, room, onSettingsUpdated }) => {
  const currentSettings = room?.settings || {};

  const [timerSeconds, setTimerSeconds] = useState(currentSettings.timerSeconds || 10);
  const [bidExtensionSeconds, setBidExtensionSeconds] = useState(currentSettings.bidExtensionSeconds ?? 5);
  const [incrementLadderType, setIncrementLadderType] = useState(currentSettings.incrementLadderType || 'official');
  const [startingPurseCr, setStartingPurseCr] = useState(currentSettings.startingPurseCr || 120);
  const [minSquadSize, setMinSquadSize] = useState(currentSettings.minSquadSize || 18);
  const [maxSquadSize, setMaxSquadSize] = useState(currentSettings.maxSquadSize || 25);
  const [maxOverseas, setMaxOverseas] = useState(currentSettings.maxOverseas || 8);
  const [rebuildQueue, setRebuildQueue] = useState(false);
  const [loading, setLoading] = useState(false);

  const { toastSuccess, toastError } = useToast();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!room) return;

    setLoading(true);
    try {
      const res = await api.updateRoomSettings(room.roomCode, {
        settings: {
          timerSeconds: Number(timerSeconds),
          bidExtensionSeconds: Number(bidExtensionSeconds),
          incrementLadderType,
          startingPurseCr: Number(startingPurseCr),
          minSquadSize: Number(minSquadSize),
          maxSquadSize: Number(maxSquadSize),
          maxOverseas: Number(maxOverseas)
        },
        rebuildQueue
      });

      if (res.success) {
        toastSuccess('Auction room settings saved successfully!');
        if (onSettingsUpdated) {
          onSettingsUpdated(res.data);
        }
        onClose();
      }
    } catch (err) {
      toastError(err.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Host Auction Configuration"
      subtitle={`Configure live bidding rules and squad constraints for ${room?.roomName || 'Room'}`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Timer & Extension */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-navy-950 p-3 rounded-xl border border-navy-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase mb-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Lot Timer</span>
            </div>
            <select
              value={timerSeconds}
              onChange={(e) => setTimerSeconds(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              {[5, 10, 15, 20, 30, 45, 60].map((s) => (
                <option key={s} value={s}>{s} seconds</option>
              ))}
            </select>
          </div>

          <div className="bg-navy-950 p-3 rounded-xl border border-navy-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Bid Extension</span>
            </div>
            <select
              value={bidExtensionSeconds}
              onChange={(e) => setBidExtensionSeconds(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value={0}>0s (Off)</option>
              <option value={3}>+3 seconds</option>
              <option value={5}>+5 seconds</option>
              <option value={10}>+10 seconds</option>
            </select>
          </div>
        </div>

        {/* Increment Ladder Selection */}
        <div className="bg-navy-950 p-3.5 rounded-xl border border-navy-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase mb-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Bidding Increment Slabs</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIncrementLadderType('official')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                incrementLadderType === 'official'
                  ? 'bg-blue-600/20 border-blue-500 text-white'
                  : 'bg-navy-900 border-navy-800 text-slate-400'
              }`}
            >
              <div className="text-xs font-bold text-blue-300">Official IPL Slabs</div>
              <div className="text-[10px] text-slate-400">20L (&lt;1Cr), 25L (1-2Cr), 50L (≥2Cr)</div>
            </button>
            <button
              type="button"
              onClick={() => setIncrementLadderType('custom')}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                incrementLadderType === 'custom'
                  ? 'bg-amber-600/20 border-amber-500 text-white'
                  : 'bg-navy-900 border-navy-800 text-slate-400'
              }`}
            >
              <div className="text-xs font-bold text-amber-300">Custom Arena Slabs</div>
              <div className="text-[10px] text-slate-400">10L (&lt;1Cr), 20L (1-5Cr), 25L (5-10Cr), 50L</div>
            </button>
          </div>
        </div>

        {/* Squad Constraints */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Min Squad</div>
            <input
              type="number"
              min={10}
              max={25}
              value={minSquadSize}
              onChange={(e) => setMinSquadSize(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
            />
          </div>
          <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Max Squad</div>
            <input
              type="number"
              min={15}
              max={30}
              value={maxSquadSize}
              onChange={(e) => setMaxSquadSize(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
            />
          </div>
          <div className="bg-navy-950 p-2.5 rounded-xl border border-navy-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1">Max Overseas</div>
            <input
              type="number"
              min={2}
              max={10}
              value={maxOverseas}
              onChange={(e) => setMaxOverseas(Number(e.target.value))}
              className="w-full bg-navy-900 border border-navy-700 rounded-lg px-2.5 py-1.5 text-sm text-white"
            />
          </div>
        </div>

        {/* Rebuild Queue Option (Only if auction not live) */}
        {room?.status === 'waiting' && (
          <label className="flex items-center gap-2 p-3 rounded-xl bg-navy-950 border border-navy-800 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={rebuildQueue}
              onChange={(e) => setRebuildQueue(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 bg-navy-900 border-navy-700"
            />
            <span>Re-shuffle and rebuild player queue with updated settings</span>
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
        >
          {loading ? (
            <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Save Auction Settings'
          )}
        </button>
      </form>
    </Modal>
  );
};
