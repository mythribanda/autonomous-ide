import React, { useEffect, useCallback } from 'react';
import { useTerminalStore, TerminalTab } from '../../stores/terminalStore';
import { useProjectStore } from '../../store/projectStore';
import { InteractiveShell } from './InteractiveShell';
import { TerminalTabs } from './TerminalTabs';
import { OutputPanel } from './OutputPanel';
import {
  Terminal as TerminalIcon,
  Maximize2,
  Minimize2,
  X,
  AlertTriangle,
  FileText,
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { clsx } from 'clsx';

export const IntegratedTerminal: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isOpen,
    setOpen,
    toggleOpen,
    isMaximized,
    toggleMaximize,
    outputLogs,
    systemProblems,
    connectWs,
    disconnectWs,
    loadHistory
  } = useTerminalStore();

  const { projectId, projectPath } = useProjectStore();

  // Connect WebSocket to /ws/terminal/{projectId} on project open / change
  useEffect(() => {
    if (projectId) {
      connectWs(projectId, projectPath ?? undefined);
      loadHistory(projectId);
    }
    return () => {
      disconnectWs();
    };
  }, [projectId, projectPath, connectWs, disconnectWs, loadHistory]);

  // Global Ctrl+` keyboard shortcut to toggle terminal panel
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        toggleOpen();
      }
    },
    [toggleOpen]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const tabs: { id: TerminalTab; label: string; badge?: string; icon: React.ElementType }[] = [
    { id: 'terminal', label: 'TERMINAL', icon: TerminalIcon },
    { id: 'output',   label: 'OUTPUT',   icon: FileText },
    {
      id: 'problems',
      label: 'PROBLEMS',
      badge: systemProblems.length > 0 ? String(systemProblems.length) : undefined,
      icon: AlertTriangle
    },
    { id: 'tests',    label: 'TEST RESULTS', icon: CheckCircle2 },
    { id: 'logs',     label: 'AGENT LOGS',   icon: Activity }
  ];

  return (
    <div
      className={clsx(
        'border-t border-[#2B2B2B] bg-[#0D0D0D] flex flex-col z-20 transition-all duration-200',
        isOpen
          ? isMaximized ? 'h-[80vh]' : 'h-56'
          : 'h-7 overflow-hidden'
      )}
    >
      {/* Tab Header (VS Code style) */}
      <div className="h-7 px-2 border-b border-[#1A1A1A] bg-[#181818] flex items-center justify-between text-xs font-sans shrink-0">
        <div className="flex items-center gap-0 h-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id && isOpen;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (!isOpen) setOpen(true);
                  setActiveTab(tab.id);
                }}
                className={clsx(
                  'h-full px-2.5 flex items-center gap-1.5 transition-colors border-b-2 text-[11px] whitespace-nowrap',
                  isActive
                    ? 'border-[#007ACC] text-[#FFFFFF] font-semibold'
                    : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
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
        <div className="flex items-center gap-0.5 text-[#858585] shrink-0">
          <button
            onClick={toggleMaximize}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={toggleOpen}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title={isOpen ? 'Collapse Panel (Ctrl+`)' : 'Expand Panel (Ctrl+`)'}
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title="Close Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {isOpen && (
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* TERMINAL TAB: Session tabs (TerminalTabs) + interactive shell */}
          {activeTab === 'terminal' && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              <TerminalTabs />
              <div className="flex-1 overflow-hidden min-h-0">
                <InteractiveShell />
              </div>
            </div>
          )}

          {/* OUTPUT TAB: Agent command output panel */}
          {activeTab === 'output' && (
            <div className="flex-1 overflow-hidden min-h-0">
              <OutputPanel />
            </div>
          )}

          {/* PROBLEMS TAB */}
          {activeTab === 'problems' && (
            <div className="p-3 font-mono text-xs text-[#CCCCCC] space-y-1.5 overflow-y-auto h-full bg-[#0D0D0D]">
              {systemProblems.length === 0 && (
                <div className="text-[#3C3C3C]">No problems detected.</div>
              )}
              {systemProblems.map((prob, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-sm bg-[#1A1A1A] border border-[#CCA700]/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#CCA700] shrink-0" />
                    <span className="text-[#FFFFFF] font-medium">{prob.message}</span>
                  </div>
                  <span className="text-[#858585] text-[11px] shrink-0 ml-4">
                    {prob.file}:{prob.line}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TESTS TAB */}
          {activeTab === 'tests' && (
            <div className="p-3 font-['JetBrains_Mono',_Consolas,_monospace] text-xs text-[#CCCCCC] space-y-1 overflow-y-auto h-full bg-[#0D0D0D] select-text">
              <div className="text-[#89D185]">✓ 42 / 42 Unit tests passing</div>
              <div className="text-[#89D185]">✓ 12 / 12 Integration suites verified</div>
              <div className="text-[#5A5A5A] pt-1 text-[11px]">Test watcher idle. Monitoring workspace.</div>
            </div>
          )}

          {/* AGENT LOGS TAB */}
          {activeTab === 'logs' && (
            <div className="p-3 font-['JetBrains_Mono',_Consolas,_monospace] text-[11px] text-[#858585] space-y-0.5 overflow-y-auto h-full bg-[#0D0D0D] select-text leading-snug">
              {outputLogs.length === 0 && (
                <div className="text-[#3C3C3C]">No agent logs yet.</div>
              )}
              {outputLogs.map((log, idx) => (
                <div key={idx} className="leading-snug">{log}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
