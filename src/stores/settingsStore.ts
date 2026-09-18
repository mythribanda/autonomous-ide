import { create } from 'zustand';
import { SystemSettings, AuditLogEntry, AutonomyLevel } from '../types';
import { MOCK_AUDIT_LOGS } from '../services/mockData';

// TODO: Out of scope for 'project-intelligence' branch.
// Settings are maintained as local client-side preferences. Connect auditLogs to backend
// audit/telemetry endpoints (e.g. backend/routers/audit.py) when server audit synchronization is implemented.


interface SettingsState {
  settings: SystemSettings;
  auditLogs: AuditLogEntry[];
  isSettingsOpen: boolean;
  
  // Actions
  updateSettings: (partial: Partial<SystemSettings>) => void;
  togglePermission: (key: keyof SystemSettings['permissions']) => void;
  setAutonomyLevel: (level: AutonomyLevel) => void;
  openSettings: () => void;
  closeSettings: () => void;
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
}

const defaultSettings: SystemSettings = {
  aiProvider: 'local',
  localRuntime: 'Ollama',
  model: 'Qwen 3 4B',
  contextLimit: 32768,
  ramEstimateGb: 4.8,
  autonomyLevel: 'autonomous',
  workspacePath: 'C:\\Projects\\EduSim',
  permissions: {
    readFile: true,
    writeFile: true,
    runTests: true,
    runDevCommands: true,
    gitStatus: true,
    gitDiff: true,
    gitCommit: true,
    deleteFiles: false,
    gitPush: false,
    createPR: false,
    deployApp: false
  },
  theme: 'dark-developer',
  telemetry: false,
  notifications: true
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: defaultSettings,
  auditLogs: MOCK_AUDIT_LOGS,
  isSettingsOpen: false,

  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial }
    }));
  },

  togglePermission: (key) => {
    set((state) => ({
      settings: {
        ...state.settings,
        permissions: {
          ...state.settings.permissions,
          [key]: !state.settings.permissions[key]
        }
      }
    }));
  },

  setAutonomyLevel: (autonomyLevel) => {
    set((state) => ({
      settings: { ...state.settings, autonomyLevel }
    }));
  },

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  addAuditLog: (entry) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    set((state) => ({
      auditLogs: [newEntry, ...state.auditLogs]
    }));
  }
}));
