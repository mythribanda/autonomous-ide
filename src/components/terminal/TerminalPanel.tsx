import React from 'react';
import { useTerminalStore, TerminalTab } from '../../stores/terminalStore';
import { InteractiveShell } from './InteractiveShell';
import {
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  X,
  AlertTriangle,
  FileText,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { clsx } from 'clsx';

export const TerminalPanel: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isOpen,
    setOpen,
    isMaximized,
    toggleMaximize,
    outputLogs,
    systemProblems
  } = useTerminalStore();

  if (!isOpen) return null;

  const tabs: { id: TerminalTab; label: string; badge?: string; icon: any }[] = [
    { id: 'terminal', label: 'TERMINAL', icon: TerminalIcon },
    { id: 'output', label: 'OUTPUT', icon: FileText },
    { id: 'problems', label: 'PROBLEMS', badge: systemProblems.length.toString(), icon: AlertTriangle },
    { id: 'tests', label: 'TEST RESULTS', icon: CheckCircle2 },
    { id: 'logs', label: 'AGENT LOGS', icon: Activity }
  ];

  return (
    <div
      className={clsx(
        'border-t border-[#2B2B2B] bg-[#181818] flex flex-col z-20 select-none transition-all',
        isMaximized ? 'h-[80vh]' : 'h-52'
      )}
    >
      {/* Tab Header */}
      <div className="h-7 px-2 border-b border-[#2B2B2B] bg-[#181818] flex items-center justify-between text-xs font-sans">
        <div className="flex items-center gap-1 h-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'h-full px-2.5 flex items-center gap-1.5 transition-colors border-b-2 text-[11px]',
                  isActive
                    ? 'border-[#007ACC] text-[#FFFFFF] font-semibold'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1 text-[9px] font-bold rounded-full bg-[#CCA700]/20 text-[#CCA700]">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Panel controls */}
        <div className="flex items-center gap-1 text-[#858585]">
          <button
            onClick={toggleMaximize}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden bg-[#181818]">
        {activeTab === 'terminal' && <InteractiveShell />}

        {activeTab === 'output' && (
          <div className="p-3 font-mono text-xs text-[#CCCCCC] space-y-1 overflow-y-auto h-full select-text">
            {outputLogs.map((log, idx) => (
              <div key={idx} className="leading-snug">{log}</div>
            ))}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="p-3 font-mono text-xs text-[#CCCCCC] space-y-1.5 overflow-y-auto h-full">
            {systemProblems.map((prob, idx) => (
              <div
                key={idx}
                className="p-2 rounded-sm bg-[#1E1E1E] border border-[#CCA700]/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#CCA700]" />
                  <span className="text-[#FFFFFF] font-medium">{prob.message}</span>
                </div>
                <span className="text-[#858585] text-[11px]">{prob.file}:{prob.line}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="p-3 font-mono text-xs text-[#CCCCCC] space-y-1 overflow-y-auto h-full select-text">
            <div className="text-[#89D185]">✓ 42 / 42 Unit tests passing</div>
            <div className="text-[#89D185]">✓ 12 / 12 Integration suites verified</div>
            <div className="text-[#858585] pt-1 text-[11px]">Test watcher idle. Monitoring workspace.</div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="p-3 font-mono text-xs text-[#858585] space-y-1 overflow-y-auto h-full select-text">
            <div>[AI-AGENT] Subagent process connected to workspace EduSim</div>
            <div>[AI-AGENT] AST analyzer indexed 48 modules in 28ms</div>
            <div>[AI-AGENT] Local Ollama model Qwen 3 4B heartbeat OK</div>
          </div>
        )}
      </div>
    </div>
  );
};
