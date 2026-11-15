import React from 'react';
import { Gavel, Shield, Trophy, Heart } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-navy-950 border-t border-navy-800 text-slate-400 py-8 px-4 sm:px-6 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm">
        
        {/* Left Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center">
            <Gavel className="w-4 h-4 text-amber-400" />
          </div>
          <span className="font-bold text-slate-200">
            IPL Auction Arena <span className="text-amber-400">2026</span>
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-500 hidden sm:inline">Authoritative Real-Time Multiplayer Bidding</span>
        </div>

        {/* Right Details */}
        <div className="flex items-center gap-4 text-slate-400 text-xs">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>10 Franchises</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Server Authoritative</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
