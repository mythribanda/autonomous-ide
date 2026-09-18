import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useConnectionStore } from './store/connectionStore';

export function App() {
  const {
    backendStatus,
    ollamaStatus,
    ollamaModels,
    checkConnections,
    stopPolling
  } = useConnectionStore();

  useEffect(() => {
    checkConnections();
    return () => {
      stopPolling();
    };
  }, [checkConnections, stopPolling]);

  const activeModelName = ollamaModels && ollamaModels.length > 0 ? ollamaModels[0] : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#1E1E1E]">
      {/* Backend Error Banner */}
      {backendStatus === 'error' && (
        <div className="bg-red-950/95 border-b border-red-800 text-red-200 px-4 py-1.5 text-xs flex items-center justify-between z-50 shrink-0 select-none shadow-md">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium">
              Backend not running — start it with:{' '}
              <code className="bg-black/50 px-2 py-0.5 rounded font-mono text-red-100 border border-red-800/60">
                npm run start:backend
              </code>
            </span>
          </div>
          <button
            onClick={() => checkConnections()}
            className="text-[11px] px-2 py-0.5 bg-red-900/60 hover:bg-red-800 rounded text-red-100 border border-red-700/50 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Main Workspace Application Shell */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AppShell />
      </div>

      {/* Bottom Connection Status Indicator Bar */}
      <div className="h-6 bg-[#181818] border-t border-[#2D2D2D] px-3 flex items-center justify-between text-[11px] font-sans select-none text-[#AAAAAA] z-30 shrink-0">
        <div className="flex items-center gap-4">
          {/* Backend Status Indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                  : backendStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
              }`}
            />
            <span className="text-zinc-300 font-medium">Backend:</span>
            <span
              className={
                backendStatus === 'connected'
                  ? 'text-emerald-400'
                  : backendStatus === 'connecting'
                  ? 'text-amber-300'
                  : 'text-rose-400'
              }
            >
              {backendStatus === 'connected'
                ? 'Connected (http://localhost:8000)'
                : backendStatus === 'connecting'
                ? 'Connecting...'
                : 'Offline'}
            </span>
          </div>

          <span className="text-[#3A3A3A]">|</span>

          {/* Ollama Status Indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                ollamaStatus === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                  : ollamaStatus === 'unavailable'
                  ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]'
                  : ollamaStatus === 'connecting'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]'
              }`}
            />
            <span className="text-zinc-300 font-medium">Ollama:</span>
            {ollamaStatus === 'connected' ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span>Connected</span>
                {activeModelName && (
                  <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded text-[10px] font-mono">
                    {activeModelName}
                  </span>
                )}
              </span>
            ) : ollamaStatus === 'unavailable' ? (
              <span className="text-amber-400">Unavailable</span>
            ) : ollamaStatus === 'connecting' ? (
              <span className="text-amber-300">Checking...</span>
            ) : (
              <span className="text-rose-400">Error</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-zinc-500">
          <span>FastAPI</span>
          <span>•</span>
          <span>aiosqlite</span>
          <span>•</span>
          <span>WebSocket</span>
        </div>
      </div>
    </div>
  );
}

export default App;
