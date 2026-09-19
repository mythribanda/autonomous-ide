import { create } from 'zustand';
import { terminalExecute, getTerminalHistory, ApiError } from '../lib/api';
import { useProjectStore } from '../store/projectStore';
import { TerminalWebSocket, TerminalStreamFrame } from '../lib/terminalWebSocket';
import { TerminalHistoryItem } from '../types/api';

export type TerminalTab = 'terminal' | 'output' | 'problems' | 'tests' | 'logs';

// ─── Line types ───────────────────────────────────────────────────────────────

export interface TerminalLine {
  id: string;
  /** 'input' = user command echo, 'stdout' | 'stderr' = process output, 'system' = IDE message, 'exit' = exit code line */
  type: 'input' | 'stdout' | 'stderr' | 'system' | 'exit' | 'error';
  /** Legacy alias used by older parts of the codebase */
  output?: string;
  content: string;
  timestamp: string;
}

export interface OutputLine {
  id: string;
  /** 'agent' = run by autonomous agent, 'build' = IDE-triggered build, 'test' = test runner output */
  source: 'agent' | 'build' | 'test';
  type: 'command' | 'stdout' | 'stderr' | 'exit' | 'system';
  content: string;
  timestamp: string;
}

// ─── Multi-tab session ────────────────────────────────────────────────────────

export interface TerminalSession {
  id: string;
  name: string;
  cwd: string;
  lines: TerminalLine[];
  commandHistory: string[];
  historyIndex: number;
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface TerminalState {
  /** Active panel tab */
  activeTab: TerminalTab;
  isOpen: boolean;
  isMaximized: boolean;

  /** Multi-session state */
  sessions: TerminalSession[];
  activeSessionId: string;

  /** Agent / build output lines */
  outputLines: OutputLine[];

  /** Legacy compat — problems / system logs */
  systemProblems: { file: string; line: number; message: string; severity: 'warning' | 'error' }[];
  isLoading: boolean;
  error: string | null;

  // ─ Actions ─────────────────────────────────────────────────────────────────

  setActiveTab: (tab: TerminalTab) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  toggleMaximize: () => void;

  // Session actions
  addSession: () => void;
  closeSession: (id: string) => void;
  setActiveSession: (id: string) => void;

  // Terminal execution
  executeCommand: (cmd: string, cwd?: string) => Promise<void>;
  clearTerminal: () => void;

  // WebSocket terminal
  connectWs: (projectId: string, cwd?: string) => void;
  disconnectWs: () => void;
  sendCommand: (cmd: string) => void;

  // Output panel
  addOutputLine: (line: Omit<OutputLine, 'id' | 'timestamp'>) => void;
  clearOutput: () => void;

  // History
  loadHistory: (projectId: string) => Promise<void>;

  // Legacy
  addLog: (log: string) => void;
  outputLogs: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let activeWs: TerminalWebSocket | null = null;
let activeWsSessionId: string | null = null;

function makeSessionId() {
  return `sess-${Date.now().toString(36)}`;
}

function nowTs() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function makeSession(name: string, cwd: string, welcomeMsg?: string): TerminalSession {
  const id = makeSessionId();
  return {
    id,
    name,
    cwd,
    commandHistory: [],
    historyIndex: -1,
    lines: [
      {
        id: `${id}-welcome`,
        type: 'system',
        content: welcomeMsg ?? `Terminal ready. Working directory: ${cwd}`,
        timestamp: nowTs()
      }
    ]
  };
}

function appendToSession(sessions: TerminalSession[], id: string, line: TerminalLine): TerminalSession[] {
  return sessions.map((s) =>
    s.id === id ? { ...s, lines: [...s.lines, line] } : s
  );
}

function lineId() {
  return `ln-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialCwd = 'C:\\Projects';
const initialSession = makeSession('bash 1', initialCwd);

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTerminalStore = create<TerminalState>((set, get) => ({
  activeTab: 'terminal',
  isOpen: true,
  isMaximized: false,

  sessions: [initialSession],
  activeSessionId: initialSession.id,

  outputLines: [],
  outputLogs: [],

  systemProblems: [
    {
      file: 'frontend/src/components/ThemeToggle.tsx',
      line: 12,
      message: 'Missing explicit return type on component',
      severity: 'warning'
    }
  ],
  isLoading: false,
  error: null,

  // ─── Panel ────────────────────────────────────────────────────────────────

  setActiveTab: (activeTab) => set({ activeTab, isOpen: true }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (isOpen) => set({ isOpen }),
  toggleMaximize: () => set((s) => ({ isMaximized: !s.isMaximized })),

  // ─── Sessions ─────────────────────────────────────────────────────────────

  addSession: () => {
    const { sessions } = get();
    const projectPath = useProjectStore.getState().projectPath ?? initialCwd;
    const newSession = makeSession(`bash ${sessions.length + 1}`, projectPath);
    set({ sessions: [...sessions, newSession], activeSessionId: newSession.id });
  },

  closeSession: (id) => {
    set((state) => {
      if (state.sessions.length <= 1) return state;
      const filtered = state.sessions.filter((s) => s.id !== id);
      const newActive =
        state.activeSessionId === id
          ? (filtered[filtered.length - 1]?.id ?? filtered[0].id)
          : state.activeSessionId;
      return { sessions: filtered, activeSessionId: newActive };
    });
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  // ─── Execute via HTTP (fallback / legacy) ─────────────────────────────────

  executeCommand: async (cmd: string, cwd?: string) => {
    if (!cmd.trim()) return;

    const { activeSessionId } = get();
    const time = nowTs();

    if (cmd.trim().toLowerCase() === 'clear') {
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === activeSessionId ? { ...s, lines: [] } : s
        ),
        error: null
      }));
      return;
    }

    // Echo command
    set((state) => ({
      sessions: appendToSession(state.sessions, activeSessionId, {
        id: lineId(),
        type: 'input',
        content: cmd,
        timestamp: time
      }),
      isLoading: true,
      error: null
    }));

    // Add to history
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId
          ? { ...s, commandHistory: [...s.commandHistory, cmd], historyIndex: -1 }
          : s
      )
    }));

    const project = useProjectStore.getState().project;
    const projectPath = useProjectStore.getState().projectPath;
    const projectId = useProjectStore.getState().projectId ?? undefined;
    const targetCwd = cwd ?? (project ? projectPath : undefined) ?? undefined;

    try {
      const res = await terminalExecute(cmd, targetCwd, projectId);

      const isSuccess = res.exit_code === 0;

      if (res.stdout) {
        set((state) => ({
          sessions: appendToSession(state.sessions, activeSessionId, {
            id: lineId(),
            type: 'stdout',
            content: res.stdout,
            timestamp: nowTs()
          })
        }));
      }
      if (res.stderr) {
        set((state) => ({
          sessions: appendToSession(state.sessions, activeSessionId, {
            id: lineId(),
            type: 'stderr',
            content: res.stderr,
            timestamp: nowTs()
          })
        }));
      }

      const exitMs = res.execution_time_ms ?? res.duration_ms ?? 0;
      set((state) => ({
        sessions: appendToSession(state.sessions, activeSessionId, {
          id: lineId(),
          type: 'exit',
          content: `[Process exited with code ${res.exit_code} in ${exitMs.toFixed(0)}ms]`,
          timestamp: nowTs()
        }),
        isLoading: false,
        error: isSuccess ? null : `Process exited with code ${res.exit_code}`
      }));
    } catch (err: unknown) {
      let msg = 'Failed to execute command';
      if (err instanceof ApiError) msg = `[${err.code}] ${err.message}`;
      else if (err instanceof Error) msg = err.message;

      set((state) => ({
        sessions: appendToSession(state.sessions, activeSessionId, {
          id: lineId(),
          type: 'error',
          content: msg,
          timestamp: nowTs()
        }),
        isLoading: false,
        error: msg
      }));
    }
  },

  clearTerminal: () => {
    const { activeSessionId } = get();
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId ? { ...s, lines: [] } : s
      ),
      error: null
    }));
  },

  // ─── WebSocket terminal ───────────────────────────────────────────────────

  connectWs: (projectId: string, cwd?: string) => {
    // Disconnect old WS if switching project
    if (activeWs) {
      activeWs.disconnect();
      activeWs = null;
    }

    const { activeSessionId } = get();
    activeWsSessionId = activeSessionId;

    const projectPath = cwd ?? useProjectStore.getState().projectPath ?? initialCwd;

    // Update session cwd
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId ? { ...s, cwd: projectPath } : s
      )
    }));

    const ws = new TerminalWebSocket(projectId);
    ws.setCwd(projectPath);
    activeWs = ws;

    ws.onMessage((frame: TerminalStreamFrame) => {
      const sessId = activeWsSessionId ?? get().activeSessionId;

      if (frame.type === 'clear') {
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === sessId ? { ...s, lines: [] } : s)
        }));
        return;
      }

      if (frame.type === 'system') {
        set((state) => ({
          sessions: appendToSession(state.sessions, sessId, {
            id: lineId(),
            type: 'system',
            content: frame.data,
            timestamp: nowTs()
          })
        }));
        return;
      }

      if (frame.type === 'echo') {
        set((state) => ({
          sessions: appendToSession(state.sessions, sessId, {
            id: lineId(),
            type: 'input',
            content: frame.data,
            timestamp: nowTs()
          })
        }));
        return;
      }

      const lineType =
        frame.type === 'stdout' ? 'stdout' :
        frame.type === 'stderr' ? 'stderr' :
        frame.type === 'exit'   ? 'exit'   :
        'error';

      set((state) => ({
        sessions: appendToSession(state.sessions, sessId, {
          id: lineId(),
          type: lineType,
          content: frame.data,
          timestamp: nowTs()
        })
      }));

      // Also add command output to the output panel (for observability)
      if (frame.type === 'stdout' || frame.type === 'stderr') {
        set((state) => ({
          outputLogs: [...state.outputLogs, frame.data.trimEnd()]
        }));
      }
    });

    ws.connect();
  },

  disconnectWs: () => {
    activeWs?.disconnect();
    activeWs = null;
    activeWsSessionId = null;
  },

  sendCommand: (cmd: string) => {
    const { activeSessionId } = get();
    activeWsSessionId = activeSessionId;

    // Add to history
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === activeSessionId
          ? { ...s, commandHistory: [...s.commandHistory, cmd], historyIndex: -1 }
          : s
      )
    }));

    if (activeWs?.isConnected) {
      activeWs.sendCommand(cmd);
    } else {
      // Fallback to HTTP execute
      get().executeCommand(cmd);
    }
  },

  // ─── Output panel ─────────────────────────────────────────────────────────

  addOutputLine: (line) => {
    set((state) => ({
      outputLines: [
        ...state.outputLines,
        { ...line, id: lineId(), timestamp: nowTs() }
      ]
    }));
  },

  clearOutput: () => set({ outputLines: [] }),

  // ─── History from DB ──────────────────────────────────────────────────────

  loadHistory: async (projectId: string) => {
    try {
      const items: TerminalHistoryItem[] = await getTerminalHistory(projectId);
      const cmds = items.map((h) => h.command);

      const { activeSessionId } = get();
      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === activeSessionId
            ? { ...s, commandHistory: cmds, historyIndex: -1 }
            : s
        )
      }));
    } catch {
      // ignore — history is best-effort
    }
  },

  // ─── Legacy ───────────────────────────────────────────────────────────────

  addLog: (log) => set((state) => ({ outputLogs: [...state.outputLogs, log] }))
}));
