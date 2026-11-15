import React, { useState, useEffect } from 'react';
import { Gavel, Clock, Users, DollarSign, Award, ArrowUpRight, Flame, CheckCircle, Shield } from 'lucide-react';

export const AuctionPreview = () => {
  const [timer, setTimer] = useState(14);
  const [currentBidCr, setCurrentBidCr] = useState(14.50);
  const [leadingTeam, setLeadingTeam] = useState('CSK');
  const [bidCount, setBidCount] = useState(18);

  // Demo countdown tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 1 ? prev - 1 : 15));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulateBid = (amountCr, teamCode) => {
    setCurrentBidCr((prev) => parseFloat((prev + amountCr).toFixed(2)));
    setLeadingTeam(teamCode);
    setBidCount((prev) => prev + 1);
    setTimer(15);
  };

  return (
    <section className="mt-12 bg-navy-900/90 rounded-2xl border border-navy-800 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
            <span className="text-xs uppercase font-extrabold tracking-widest text-orange-400">
              Live Auction Simulation Chamber
            </span>
          </div>
          <h2 className="text-2xl font-black text-white font-['Teko'] text-3xl tracking-wide mt-1">
            Real-Time Auction Pod & Room Arena
          </h2>
          <p className="text-xs text-slate-400">
            Interactive preview of the real-time multiplayer bidding room coming in Stage 2
          </p>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-navy-950 px-4 py-2 rounded-xl border border-blue-500/30 flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-slate-400">Room Code:</span>
            <strong className="text-amber-400 font-mono tracking-wider font-bold text-sm">#IPL-ARENA-2026</strong>
          </div>
        </div>
      </div>

      {/* Main Auction Floor Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        
        {/* Player Spotlight Card (7 cols) */}
        <div className="lg:col-span-7 bg-navy-950/70 rounded-2xl border border-navy-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Marquee Set 1 • All-Rounder
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-2">
                  Jasprit Bumrah
                </h3>
                <p className="text-xs text-slate-400">
                  Right-arm fast bowler • India • Base Price: ₹2.00 Cr
                </p>
              </div>

              {/* Countdown Timer */}
              <div className="flex flex-col items-center bg-navy-900 border border-orange-500/40 rounded-xl px-4 py-2 shrink-0">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase font-semibold">
                  <Clock className="w-3 h-3 text-orange-400" /> Timer
                </div>
                <span className={`text-2xl font-black font-mono ${timer <= 5 ? 'text-red-400 animate-pulse' : 'text-orange-400'}`}>
                  00:{timer < 10 ? `0${timer}` : timer}
                </span>
              </div>
            </div>

            {/* Current Highest Bid Banner */}
            <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-950/90 via-navy-900 to-indigo-950/90 border border-blue-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Current Leading Bid</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black text-white font-mono">
                    ₹{currentBidCr.toFixed(2)} Cr
                  </span>
                  <span className="text-xs text-slate-400">
                    ({bidCount} bids placed)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Leading Franchise</span>
                  <span className="text-base font-extrabold text-amber-300">
                    {leadingTeam === 'CSK' ? 'Chennai Super Kings' : leadingTeam === 'MI' ? 'Mumbai Indians' : 'Royal Challengers'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-navy-950 font-black font-['Teko'] text-lg flex items-center justify-center shadow">
                  {leadingTeam}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Bid Simulation Buttons */}
          <div className="mt-6 pt-4 border-t border-navy-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2.5">
              Simulate Franchise Paddle Bid (Test Interactive Action):
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => handleSimulateBid(0.25, 'MI')}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-blue-600/30"
              >
                <Gavel className="w-3.5 h-3.5" /> +₹25 Lakh (MI)
              </button>
              <button
                onClick={() => handleSimulateBid(0.50, 'CSK')}
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-navy-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-amber-500/30"
              >
                <Gavel className="w-3.5 h-3.5" /> +₹50 Lakh (CSK)
              </button>
              <button
                onClick={() => handleSimulateBid(1.00, 'RCB')}
                className="py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-md shadow-orange-600/30"
              >
                <Flame className="w-3.5 h-3.5" /> +₹1.00 Cr (RCB)
              </button>
            </div>
          </div>
        </div>

        {/* Live Feed & Auction Features (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="bg-navy-950/70 rounded-2xl border border-navy-800 p-5">
            <h4 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              Engine Architecture Highlights
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Multi-Room Support:</strong> Host private auction chambers with custom passcode room-codes.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Sub-50ms Socket Sync:</strong> Real-time broadcast of every bid and hammer drop.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Purse Enforcement:</strong> Automatic rejection if bid exceeds remaining ₹120 Cr purse limit.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Dynamic Squad Caps:</strong> Max 25 players, min 18, maximum 8 overseas spots strictly enforced.</span>
              </li>
            </ul>
          </div>

          {/* Quick Stats Pill Banner */}
          <div className="p-4 rounded-xl bg-navy-950/80 border border-blue-500/20 text-xs">
            <div className="flex items-center justify-between text-slate-300 mb-1">
              <span>Franchise Seats In Room</span>
              <strong className="text-blue-400 font-mono">10 / 10 Franchises Active</strong>
            </div>
            <div className="w-full bg-navy-900 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-amber-400 h-full w-full rounded-full"></div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
