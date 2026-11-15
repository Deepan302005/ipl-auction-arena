import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export const ConnectionBanner = () => {
  const { isConnected, isReconnecting, connectionError } = useSocket();

  if (isConnected) return null;

  return (
    <div className="bg-amber-600/95 text-white px-4 py-2.5 shadow-md flex items-center justify-center gap-2.5 text-xs sm:text-sm font-semibold tracking-wide border-b border-amber-500 z-50 sticky top-0 backdrop-blur-md">
      {isReconnecting ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          <span>Reconnecting to live auction server... Live updates temporarily paused.</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Connection to auction server lost. {connectionError ? `(${connectionError})` : 'Reconnecting...'}</span>
        </>
      )}
    </div>
  );
};
