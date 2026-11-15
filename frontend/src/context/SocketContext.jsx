import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { getBackendUrl } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const backendUrl = getBackendUrl();
    const guestId = typeof window !== 'undefined' ? localStorage.getItem('ipl_guest_id') : null;
    const sessionSecret = typeof window !== 'undefined' ? localStorage.getItem('ipl_guest_secret') : null;

    const socketInstance = io(backendUrl, {
      auth: {
        token: token || undefined,
        guestId: guestId || undefined,
        sessionSecret: sessionSecret || undefined
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
      timeout: 8000
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionError(null);

      // Measure round-trip ping
      const start = Date.now();
      socketInstance.emit('client:ping', { sentAt: start });
    });

    socketInstance.on('server:pong', (payload) => {
      if (payload && payload.payload && payload.payload.sentAt) {
        setLatency(Date.now() - payload.payload.sentAt);
      }
    });

    socketInstance.on('disconnect', (reason) => {
      setIsConnected(false);
      setLatency(null);
      if (reason === 'io server disconnect') {
        // Server rejected authentication, attempt reconnect
        socketInstance.connect();
      } else {
        setIsReconnecting(true);
      }
    });

    socketInstance.on('connect_error', (err) => {
      setConnectionError(err.message || 'Connection error');
      setIsReconnecting(true);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        connectionError,
        latency
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
