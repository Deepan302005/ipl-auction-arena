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

function getInitialRoute() {
  if (typeof window === 'undefined') return { view: 'home', roomCode: null };
  const hash = (window.location.hash || '').replace(/^#\/?/, '');
  if (hash.startsWith('room/')) {
    return { view: 'room', roomCode: hash.split('/')[1]?.toUpperCase() || null };
  }
  if (hash.startsWith('auction/')) {
    return { view: 'auction', roomCode: hash.split('/')[1]?.toUpperCase() || null };
  }
  if (hash.startsWith('results/')) {
    return { view: 'results', roomCode: hash.split('/')[1]?.toUpperCase() || null };
  }
  if (hash === 'dashboard') {
    return { view: 'dashboard', roomCode: null };
  }
  return { view: 'home', roomCode: null };
}

function AppContent() {
  const initialRoute = getInitialRoute();
  const [currentView, setCurrentView] = useState(initialRoute.view);
  const [activeRoomCode, setActiveRoomCode] = useState(initialRoute.roomCode);
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);

  // Parse Hash URL on mount and handle navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.startsWith('room/')) {
        const code = hash.split('/')[1]?.toUpperCase();
        if (code) {
          setActiveRoomCode(code);
          setCurrentView('room');
          return;
        }
      } else if (hash.startsWith('auction/')) {
        const code = hash.split('/')[1]?.toUpperCase();
        if (code) {
          setActiveRoomCode(code);
          setCurrentView('auction');
          return;
        }
      } else if (hash.startsWith('results/')) {
        const code = hash.split('/')[1]?.toUpperCase();
        if (code) {
          setActiveRoomCode(code);
          setCurrentView('results');
          return;
        }
      } else if (hash === 'dashboard') {
        setCurrentView('dashboard');
        return;
      }
      // Default to home if no valid route
      setCurrentView('home');
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view, roomCode = null) => {
    setCurrentView(view);
    if (roomCode) {
      setActiveRoomCode(roomCode);
      window.location.hash = `${view}/${roomCode}`;
    } else {
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
