import React from 'react';
import { useGitStore } from '../../stores/gitStore';
import { useTestStore } from '../../stores/testStore';
import { useAgentStore } from '../../stores/agentStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { useUIStore } from '../../stores/uiStore';
import {
  GitBranch,
  Check,
  CheckCircle2,
  Terminal,
  Bot,
  AlertCircle
} from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { currentBranch, changes } = useGitStore();
  const { testSummary } = useTestStore();
  const { currentTask } = useAgentStore();
  const { toggleOpen: toggleTerminal, isOpen: isTerminalOpen } = useTerminalStore();
  const { setActiveView } = useUIStore();

  const stagedCount = changes.filter((c) => c.staged).length;
  const unstagedCount = changes.filter((c) => !c.staged).length;

  return (
    <footer className="h-5.5 bg-[#007ACC] px-2 flex items-center justify-between text-[11px] font-sans select-none text-[#FFFFFF] z-20">
      {/* Left items */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveView('git')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-white/15 rounded-xs transition-colors"
        >
          <GitBranch size={12} />
          <span className="font-mono">{currentBranch}*</span>
        </button>

        <button
          onClick={() => setActiveView('git')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-white/15 rounded-xs transition-colors"
        >
          {changes.length > 0 ? (
            <span>
              {stagedCount + unstagedCount} pending changes
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Check size={11} /> Clean
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveView('verification')}
          className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-white/15 rounded-xs transition-colors"
        >
          {testSummary.overall === 'PASSED' ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 size={11} /> {testSummary.unit.passed} tests passed
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertCircle size={11} /> 1 failing test
            </span>
          )}
        </button>
      </div>

      {/* Right items */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveView('explorer')}
          className="px-1.5 py-0.5 hover:bg-white/15 rounded-xs transition-colors"
        >
          <span>TypeScript React</span>
        </button>

        <span className="px-1.5 py-0.5">UTF-8</span>
        <span className="px-1.5 py-0.5">Spaces: 2</span>
        <span className="px-1.5 py-0.5 font-mono">Ln 42, Col 8</span>

        <button
          onClick={toggleTerminal}
          className={`flex items-center gap-1 px-1.5 py-0.5 hover:bg-white/15 rounded-xs transition-colors ${
            isTerminalOpen ? 'bg-white/20' : ''
          }`}
        >
          <Terminal size={11} />
          <span>Terminal</span>
        </button>

        <button
          onClick={() => setActiveView('agent')}
          className="flex items-center gap-1 px-2 py-0.5 bg-black/20 hover:bg-black/30 rounded-xs transition-colors font-medium"
        >
          <Bot size={12} />
          <span>
            {currentTask.status === 'executing'
              ? 'Agent Active'
              : currentTask.status === 'paused'
              ? 'Agent Paused'
              : 'AI Ready'}
          </span>
        </button>
      </div>
    </footer>
  );
};
