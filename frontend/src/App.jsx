import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ConnectionBanner } from './components/common/ConnectionBanner';
import { CreateRoomModal } from './components/room/CreateRoomModal';
import { HomePage } from './components/home/HomePage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { RoomLobby } from './components/room/RoomLobby';
import { LiveAuction } from './components/auction/LiveAuction';
import { AuctionResults } from './components/results/AuctionResults';

function parseRoute() {
  if (typeof window === 'undefined') return { view: 'home', roomCode: null };

  // 1. Check path-based URLs (e.g. /rooms/IPL-5175, /room/IPL-5175, /auction/IPL-5175, /results/IPL-5175)
  const pathname = window.location.pathname || '';
  const pathMatch = pathname.match(/^\/(rooms?|auction|results)\/([A-Za-z0-9-]+)/i);
  if (pathMatch) {
    const rawView = pathMatch[1].toLowerCase();
    const view = rawView.startsWith('room') ? 'room' : rawView;
    return { view, roomCode: pathMatch[2].toUpperCase() };
  }

  // 2. Check hash-based URLs (e.g. #room/IPL-5175, #rooms/IPL-5175, #auction/IPL-5175)
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (hash.startsWith('room/') || hash.startsWith('rooms/')) {
    const code = hash.replace(/^rooms?\//, '').split(/[?#&/]/)[0];
    if (code) return { view: 'room', roomCode: code.toUpperCase() };
  }
  if (hash.startsWith('auction/')) {
    const code = hash.replace(/^auction\//, '').split(/[?#&/]/)[0];
    if (code) return { view: 'auction', roomCode: code.toUpperCase() };
  }
  if (hash.startsWith('results/')) {
    const code = hash.replace(/^results\//, '').split(/[?#&/]/)[0];
    if (code) return { view: 'results', roomCode: code.toUpperCase() };
  }
  if (hash === 'dashboard') {
    return { view: 'dashboard', roomCode: null };
  }
  return { view: 'home', roomCode: null };
}

function AppContent() {
  const initialRoute = parseRoute();
  const [currentView, setCurrentView] = useState(initialRoute.view);
  const [activeRoomCode, setActiveRoomCode] = useState(initialRoute.roomCode);
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);

  // Parse Path and Hash URL on mount and handle navigation
  useEffect(() => {
    const handleUrlChange = () => {
      const route = parseRoute();
      setCurrentView(route.view);
      setActiveRoomCode(route.roomCode);
    };

    handleUrlChange();
    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const navigateTo = (view, roomCode = null) => {
    setCurrentView(view);
    if (roomCode) {
      setActiveRoomCode(roomCode);
      const targetHash = `${view}/${roomCode}`;
      if (window.location.hash !== `#${targetHash}`) {
        window.location.hash = targetHash;
      }
    } else {
      setActiveRoomCode(null);
      window.location.hash = view === 'home' ? '' : view;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCreateRoom = () => {
    setCreateRoomModalOpen(true);
  };

  const handleJoinRoom = (code) => {
    navigateTo('room', code);
  };

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Persistent Connection Status Banner */}
      <ConnectionBanner />

      {/* Main Responsive Navigation Bar */}
      <Navbar
        currentView={currentView}
        onNavigate={(view) => navigateTo(view)}
        onOpenCreateRoom={handleOpenCreateRoom}
      />

      {/* Main Application Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
        {currentView === 'home' && (
          <HomePage
            onOpenCreateRoom={handleOpenCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentView === 'dashboard' && (
          <DashboardPage
            onOpenCreateRoom={handleOpenCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {currentView === 'room' && activeRoomCode && (
          <RoomLobby
            roomCode={activeRoomCode}
            onLeaveRoom={() => navigateTo('home')}
            onAuctionStarted={(code) => navigateTo('auction', code)}
          />
        )}

        {currentView === 'auction' && activeRoomCode && (
          <LiveAuction
            roomCode={activeRoomCode}
            onAuctionEnded={(code) => navigateTo('results', code)}
            onLeaveRoom={() => navigateTo('room', activeRoomCode)}
          />
        )}

        {currentView === 'results' && activeRoomCode && (
          <AuctionResults
            roomCode={activeRoomCode}
            onBackToDashboard={() => navigateTo('dashboard')}
          />
        )}
      </main>

      {/* Responsive Footer */}
      <Footer />

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={createRoomModalOpen}
        onClose={() => setCreateRoomModalOpen(false)}
        onRoomCreated={(code) => navigateTo('room', code)}
      />
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
export default App;
