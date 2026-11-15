import React from 'react';
import { Gavel, Radio, ShieldCheck, Zap } from 'lucide-react';

export const Navbar = ({ serverStatus, socketConnected, pingLatency }) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-navy-950/90 border-b border-navy-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-amber-500 p-[2px] shadow-glow-blue">
              <div className="w-full h-full bg-navy-900 rounded-[10px] flex items-center justify-center">
                <Gavel className="w-6 h-6 text-amber-400 transform -rotate-12" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-wider text-white font-['Teko'] uppercase">
                  IPL Auction <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">Arena</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Season 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-Time Multi-User Cricket Auction Simulation
              </p>
            </div>
          </div>

          {/* Real-time Status Badges */}
          <div className="flex items-center gap-3">
            {/* Express API Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900/80 border border-navy-700 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                {serverStatus === 'online' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
                )}
              </span>
              <span className="text-slate-300 font-medium">
                API: <strong className={serverStatus === 'online' ? 'text-emerald-400' : 'text-amber-400'}>
                  {serverStatus === 'online' ? 'Connected' : 'Connecting...'}
                </strong>
              </span>
            </div>

            {/* Socket.IO Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900/80 border border-navy-700 text-xs">
              <Zap className={`w-3.5 h-3.5 ${socketConnected ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="text-slate-300 font-medium hidden md:inline">
                Socket: <strong className={socketConnected ? 'text-amber-300' : 'text-slate-400'}>
                  {socketConnected ? (pingLatency ? `${pingLatency}ms` : 'Active') : 'Standby'}
                </strong>
              </span>
            </div>

            {/* Stage Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-900/50 to-indigo-900/50 border border-blue-500/40 text-xs text-blue-200">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="font-semibold">Stage 1: Core Architecture</span>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
};
