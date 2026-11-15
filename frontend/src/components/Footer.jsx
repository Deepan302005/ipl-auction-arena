import React from 'react';
import { Gavel, Heart, Shield, Code2, Database, Globe } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="mt-20 border-t border-navy-800 bg-navy-950/90 text-slate-400 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy-800 border border-blue-500/30 flex items-center justify-center">
              <Gavel className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <span className="text-white font-bold tracking-wide font-['Teko'] text-xl">
                IPL AUCTION ARENA
              </span>
              <p className="text-xs text-slate-500">
                Production-Oriented Real-Time Auction Game
              </p>
            </div>
          </div>

          {/* Tech Stack Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium">
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-blue-300">
              React + Vite
            </span>
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-cyan-300">
              Tailwind CSS
            </span>
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-amber-300">
              Express.js
            </span>
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-emerald-300">
              MongoDB Atlas
            </span>
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-orange-300">
              Socket.IO
            </span>
            <span className="px-2.5 py-1 rounded-md bg-navy-900 border border-navy-800 text-purple-300">
              JWT Ready
            </span>
          </div>

          <div className="text-xs text-slate-500 text-center md:text-right">
            Designed for 10 IPL Franchises • ₹120 Cr Official Cap
          </div>

        </div>
      </div>
    </footer>
  );
};
