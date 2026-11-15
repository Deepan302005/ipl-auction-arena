import React, { useState } from 'react';
import { Gavel, PlusCircle, Compass, Menu, X, Edit3, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { TeamLogo } from './TeamLogo';

export const Navbar = ({ currentView, onNavigate, onOpenCreateRoom }) => {
  const { user, updateDisplayName } = useAuth();
  const { isConnected, latency } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const handleNav = (view) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  const handleStartEditName = () => {
    setTempName(user?.name || 'Manager');
    setEditingName(true);
  };

  const handleSaveName = (e) => {
    e.preventDefault();
    if (tempName.trim()) {
      updateDisplayName(tempName.trim());
    }
    setEditingName(false);
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-navy-950/95 border-b border-navy-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <div
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-amber-500 p-[2px] shadow-glow-blue transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-navy-900 rounded-[10px] flex items-center justify-center">
                <Gavel className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 transform -rotate-12" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-wider text-white font-['Teko'] uppercase leading-none">
                  IPL Auction <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-amber-200">Arena</span>
                </span>
                <span className="hidden xs:inline-block text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  2026
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Direct Multiplayer Cricket Auction
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              onClick={() => handleNav('home')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                currentView === 'home'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              Home
            </button>
            <button
              onClick={() => handleNav('dashboard')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
                currentView === 'dashboard'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-navy-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Rooms & Arena
            </button>

            {/* Direct Create Room Button */}
            <button
              onClick={onOpenCreateRoom}
              className="px-3.5 py-2 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-navy-950 flex items-center gap-1.5 shadow-md shadow-orange-950/40 transition-all hover:scale-102"
            >
              <PlusCircle className="w-3.5 h-3.5 text-navy-950" />
              Create Room
            </button>
          </nav>

          {/* Right Header Status & Manager Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Live Socket Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-navy-900 border border-navy-700/80 text-[11px] sm:text-xs">
              <span className="relative flex h-2 w-2">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                )}
              </span>
              <span className="text-slate-300 font-medium hidden sm:inline">
                {isConnected ? `${latency !== null ? `${latency}ms` : 'Live'}` : 'Connecting'}
              </span>
            </div>

            {/* Manager Display Name Pill */}
            <div className="flex items-center gap-2">
              {editingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-1">
                  <input
                    type="text"
                    maxLength={30}
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    autoFocus
                    className="bg-navy-900 border border-amber-400 rounded-lg px-2 py-1 text-xs text-white focus:outline-none w-28 sm:w-36"
                    placeholder="Manager Name"
                  />
                  <button
                    type="submit"
                    className="p-1 rounded bg-amber-500 text-navy-950 hover:bg-amber-400"
                    title="Save name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div
                  onClick={handleStartEditName}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-navy-900 border border-navy-700/80 hover:border-slate-500 transition-colors cursor-pointer group"
                  title="Click to change your manager display name"
                >
                  <div className="w-6 h-6 rounded-lg bg-navy-950 flex items-center justify-center p-0.5 border border-navy-800">
                    <TeamLogo franchise={user?.favoriteTeam || null} size="xs" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-white truncate max-w-[100px] sm:max-w-[130px] leading-tight flex items-center gap-1">
                      <span>{user?.name || 'Manager'}</span>
                      <Edit3 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors shrink-0" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-navy-900 md:hidden text-slate-300 hover:text-white border border-navy-700/80"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-navy-800 bg-navy-950 px-4 pt-3 pb-5 space-y-2 animate-slide-in">
          {/* Manager profile card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900/90 border border-navy-700/80 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-navy-950 flex items-center justify-center p-1 border border-navy-800">
                <TeamLogo franchise={user?.favoriteTeam || null} size="sm" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">{user?.name || 'Manager'}</div>
                <div className="text-xs text-slate-400">
                  {user?.favoriteTeam ? `${user.favoriteTeam} Manager` : 'Select a team'}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleStartEditName();
              }}
              className="p-1.5 rounded-lg bg-navy-800 text-slate-300 hover:text-white"
              title="Edit name"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => handleNav('home')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              currentView === 'home' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-slate-300 hover:bg-navy-900'
            }`}
          >
            Home
          </button>
          <button
            onClick={() => handleNav('dashboard')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              currentView === 'dashboard' ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30' : 'text-slate-300 hover:bg-navy-900'
            }`}
          >
            <Compass className="w-4 h-4 text-amber-400" />
            Rooms & Arena
          </button>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenCreateRoom();
            }}
            className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-navy-950 flex items-center gap-2 shadow-md"
          >
            <PlusCircle className="w-4 h-4 text-navy-950" />
            Create Auction Room
          </button>
        </div>
      )}
    </header>
  );
};
