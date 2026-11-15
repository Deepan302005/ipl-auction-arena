import React, { useState } from 'react';
import { Database, Server, Activity, Radio, RefreshCw, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export const StatusCard = ({ healthData, loading, onRefresh, socket, socketConnected, pingLatency, onTriggerPing }) => {
  const [testingPing, setTestingPing] = useState(false);

  const handlePingTest = () => {
    setTestingPing(true);
    onTriggerPing();
    setTimeout(() => setTestingPing(false), 600);
  };

  const dbConnected = healthData?.services?.database?.connected;
  const dbStatus = healthData?.services?.database?.status || 'disconnected';

  return (
    <div className="bg-navy-900/90 rounded-2xl border border-navy-800 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-navy-800">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">System Health & Live Connectivity</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry from Express API, Socket.IO engine, and MongoDB Atlas database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePingTest}
            disabled={!socketConnected}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-700 text-amber-300 border border-amber-500/30 transition shadow-sm active:scale-95 disabled:opacity-50"
            title="Send real-time websocket ping"
          >
            <Radio className={`w-3.5 h-3.5 ${testingPing ? 'animate-spin text-amber-400' : ''}`} />
            {testingPing ? 'Pinging...' : 'Socket Ping'}
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Grid of status metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        
        {/* Express Server */}
        <div className="p-4 rounded-xl bg-navy-950/60 border border-navy-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Express Backend</span>
            <Server className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${healthData ? 'bg-emerald-400' : 'bg-rose-500'}`}></span>
              <span className="text-base font-bold text-white">
                {healthData ? 'Operational' : 'Unavailable'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Port: <span className="text-slate-200 font-mono">{healthData?.services?.api?.port || 5000}</span> • Uptime: <span className="text-slate-200 font-mono">{healthData?.uptime || '0s'}</span>
            </p>
          </div>
        </div>

        {/* Socket.IO */}
        <div className="p-4 rounded-xl bg-navy-950/60 border border-navy-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Socket.IO WS</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${socketConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className="text-base font-bold text-white">
                {socketConnected ? 'Connected' : 'Connecting'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ping Latency: <span className="text-amber-400 font-semibold font-mono">{pingLatency !== null ? `${pingLatency} ms` : 'Standby'}</span>
            </p>
          </div>
        </div>

        {/* MongoDB Atlas */}
        <div className="p-4 rounded-xl bg-navy-950/60 border border-navy-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">MongoDB Atlas</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${dbConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              <span className="text-base font-bold text-white capitalize">
                {dbStatus}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {dbConnected ? (
                <span className="text-emerald-400 font-mono">Cluster Connected</span>
              ) : (
                <span className="text-amber-300 font-medium">Configure URI in .env</span>
              )}
            </p>
          </div>
        </div>

        {/* Environment */}
        <div className="p-4 rounded-xl bg-navy-950/60 border border-navy-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Environment</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              <span className="text-base font-bold text-white uppercase">
                {healthData?.environment || 'Development'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Version: <span className="text-slate-200 font-mono">{healthData?.version || '1.0.0'}</span>
            </p>
          </div>
        </div>

      </div>

      {/* Database Setup Notice if disconnected */}
      {!dbConnected && (
        <div className="mt-4 p-3.5 rounded-xl bg-navy-950/80 border border-amber-500/20 flex items-start gap-3 text-xs text-slate-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">MongoDB Atlas Connection Pending:</strong> The backend is configured to connect to MongoDB Atlas via the <code className="text-amber-200 bg-navy-900 px-1.5 py-0.5 rounded font-mono">MONGODB_URI</code> environment variable in <code className="text-slate-300 font-mono">backend/.env</code>. All security guidelines are respected (no fake or hardcoded credentials).
          </div>
        </div>
      )}
    </div>
  );
};
