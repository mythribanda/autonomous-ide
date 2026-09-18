import { create } from 'zustand';
import { AutonomousAPI } from '../services/api';

export type TerminalTab = 'terminal' | 'output' | 'problems' | 'tests' | 'logs';

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

interface TerminalState {
  activeTab: TerminalTab;
  isOpen: boolean;
  isMaximized: boolean;
  commandHistory: string[];
  lines: TerminalLine[];
  outputLogs: string[];
  systemProblems: { file: string; line: number; message: string; severity: 'warning' | 'error' }[];
  
  // Actions
  setActiveTab: (tab: TerminalTab) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  toggleMaximize: () => void;
  executeCommand: (cmd: string) => Promise<void>;
  clearTerminal: () => void;
  addLog: (log: string) => void;
}

const initialLines: TerminalLine[] = [
  {
    id: 'tl-1',
    type: 'system',
    content: 'AutonomousDev Shell v1.0.0 [Ready] — Project Workspace: C:\\Projects\\EduSim',
    timestamp: '10:30:00'
  },
  {
    id: 'tl-2',
    type: 'input',
    content: 'npm test',
    timestamp: '10:32:15'
  },
  {
    id: 'tl-3',
    type: 'output',
    content: `Running tests...\n\n ✓ Login\n ✓ Dashboard\n ✓ Formula Lab\n ✓ AI Tutor\n ✓ Theme\n\n42 passed\n0 failed`,
    timestamp: '10:32:16'
  }
];

export const useTerminalStore = create<TerminalState>((set, get) => ({
  activeTab: 'terminal',
  isOpen: true,
  isMaximized: false,
  commandHistory: ['npm test', 'git status', 'pytest'],
  lines: initialLines,
  outputLogs: [
    '[INFO 10:32:04] AI Agent attached to workspace EduSim',
    '[INFO 10:32:06] AST parser indexed 48 components in 32ms',
    '[INFO 10:32:12] File created: frontend/src/services/theme.ts',
    '[SUCCESS 10:32:16] Vitest test runner exited with status 0'
  ],
  systemProblems: [
    {
      file: 'frontend/src/components/ThemeToggle.tsx',
      line: 12,
      message: 'Missing explicit return type on component',
      severity: 'warning'
    }
  ],

  setActiveTab: (activeTab) => set({ activeTab, isOpen: true }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  toggleMaximize: () => set((state) => ({ isMaximized: !state.isMaximized })),

  executeCommand: async (cmd: string) => {
    if (!cmd.trim()) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    if (cmd.trim().toLowerCase() === 'clear') {
      set({ lines: [] });
      return;
    }

    const inputLine: TerminalLine = {
      id: `line-${Date.now()}-in`,
      type: 'input',
      content: cmd,
      timestamp: time
    };

    set((state) => ({
      lines: [...state.lines, inputLine],
      commandHistory: [...state.commandHistory, cmd]
    }));

    const res = await AutonomousAPI.executeTerminal({ command: cmd });
    const outputLine: TerminalLine = {
      id: `line-${Date.now()}-out`,
      type: res.exitCode === 0 ? 'output' : 'error',
      content: res.stdout || res.stderr,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    set((state) => ({
      lines: [...state.lines, outputLine]
    }));
  },

  clearTerminal: () => set({ lines: [] }),
  addLog: (log) => set((state) => ({ outputLogs: [...state.outputLogs, log] }))
}));
