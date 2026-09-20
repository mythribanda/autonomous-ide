import { create } from 'zustand';
import { AutonomyLevel, AuditLogEntry, SystemSettings } from '../types';
import { MOCK_AUDIT_LOGS } from '../services/mockData';
import { getSystemSettings, saveSystemSettings } from '../lib/api';

export interface FlatSettings {
  // 1. AI & Models
  ollamaUrl: string;
  model: string;
  planningModel: string;
  codingModel: string;
  diagnosisModel: string;
  summarizationModel: string;
  temperature: number;
  maxTokens: number;

  // 2. Agent Permissions
  autonomyLevel: AutonomyLevel;
  permissionProfile: 'safe' | 'standard' | 'full';
  maxFilesPerTask: number;
  autoApproveTests: boolean;
  autoApproveBuilds: boolean;
  permissions: {
    readFile: boolean;
    writeFile: boolean;
    runTests: boolean;
    runDevCommands: boolean;
    gitStatus: boolean;
    gitDiff: boolean;
    gitCommit: boolean;
    deleteFiles: boolean;
    gitPush: boolean;
    createPR: boolean;
    deployApp: boolean;
  };

  // 3. GitHub
  githubConnected: boolean;
  githubUsername: string;
  defaultCloneDirectory: string;

  // 4. Appearance
  editorFontSize: number;
  terminalFontSize: number;
  fontFamily: string;
  theme: string;

  // 5. Terminal
  defaultShell: string;
  tabSize: number;
  scrollbackBuffer: number;

  // 6. Keyboard Shortcuts
  shortcuts: Record<string, string>;

  // 7. Project Settings
  projectName: string;
  excludedPaths: string;
  preRunCommand: string;
  testCommandOverride: string;

  // 8. About / Research
  appVersion: string;
  researchMode: boolean;
  telemetry: boolean;
  notifications: boolean;
}

export interface SettingsStoreState {
  settings: FlatSettings;
  auditLogs: AuditLogEntry[];
  isSettingsOpen: boolean;
  isHydrated: boolean;
  isSaving: boolean;

  // Actions
  hydrate: () => Promise<void>;
  save: () => void;
  updateSettings: (partial: Partial<FlatSettings>) => void;
  applyProfile: (profile: 'safe' | 'standard' | 'full') => void;
  togglePermission: (key: keyof FlatSettings['permissions']) => void;
  setAutonomyLevel: (level: AutonomyLevel) => void;
  openSettings: () => void;
  closeSettings: () => void;
  addAuditLog: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
}

export const DEFAULT_SETTINGS: FlatSettings = {
  // 1. AI & Models
  ollamaUrl: 'http://localhost:11434',
  model: 'llama3.2:latest',
  planningModel: 'llama3.2:latest',
  codingModel: 'codellama:13b',
  diagnosisModel: 'llama3.2:latest',
  summarizationModel: 'llama3.2:latest',
  temperature: 0.2,
  maxTokens: 2000,

  // 2. Permissions
  autonomyLevel: 'autonomous',
  permissionProfile: 'standard',
  maxFilesPerTask: 15,
  autoApproveTests: true,
  autoApproveBuilds: true,
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

  // 3. GitHub
  githubConnected: false,
  githubUsername: '',
  defaultCloneDirectory: 'C:\\Projects',

  // 4. Appearance
  editorFontSize: 14,
  terminalFontSize: 13,
  fontFamily: 'JetBrains Mono',
  theme: 'dark-developer',

  // 5. Terminal
  defaultShell: 'pwsh',
  tabSize: 2,
  scrollbackBuffer: 2000,

  // 6. Shortcuts
  shortcuts: {
    'command_palette': 'Ctrl+Shift+P',
    'toggle_terminal': 'Ctrl+`',
    'new_task': 'Ctrl+K',
    'search_files': 'Ctrl+P',
    'open_settings': 'Ctrl+,',
    'save_file': 'Ctrl+S',
    'toggle_git': 'Ctrl+Shift+G'
  },

  // 7. Project
  projectName: 'Autonomous IDE',
  excludedPaths: 'node_modules, dist, .git, build, .venv',
  preRunCommand: '',
  testCommandOverride: '',

  // 8. About
  appVersion: '1.0.0',
  researchMode: true,
  telemetry: false,
  notifications: true
};

let saveDebounceTimer: any = null;

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  auditLogs: MOCK_AUDIT_LOGS,
  isSettingsOpen: false,
  isHydrated: false,
  isSaving: false,

  hydrate: async () => {
    try {
      // 1. Try Electron API
      if (typeof window !== 'undefined' && window.electronAPI?.loadSettings) {
        const loaded = await window.electronAPI.loadSettings();
        if (loaded && typeof loaded === 'object') {
          set((state) => ({
            settings: { ...state.settings, ...loaded },
            isHydrated: true
          }));
          return;
        }
      }

      // 2. Try Backend API
      try {
        const serverSettings = await getSystemSettings();
        if (serverSettings && Object.keys(serverSettings).length > 0) {
          // Map snake_case to camelCase where appropriate
          const mapped: Partial<FlatSettings> = {};
          if (serverSettings.ollama_url) mapped.ollamaUrl = serverSettings.ollama_url;
          if (serverSettings.model) mapped.model = serverSettings.model;
          if (serverSettings.planning_model) mapped.planningModel = serverSettings.planning_model;
          if (serverSettings.coding_model) mapped.codingModel = serverSettings.coding_model;
          if (serverSettings.diagnosis_model) mapped.diagnosisModel = serverSettings.diagnosis_model;
          if (serverSettings.summarization_model) mapped.summarizationModel = serverSettings.summarization_model;
          if (serverSettings.temperature !== undefined) mapped.temperature = serverSettings.temperature;
          if (serverSettings.max_tokens !== undefined) mapped.maxTokens = serverSettings.max_tokens;
          if (serverSettings.permissions) mapped.permissions = serverSettings.permissions;
          if (serverSettings.autonomy_level) mapped.autonomyLevel = serverSettings.autonomy_level;
          if (serverSettings.default_shell) mapped.defaultShell = serverSettings.default_shell;
          if (serverSettings.editor_font_size) mapped.editorFontSize = serverSettings.editor_font_size;
          if (serverSettings.terminal_font_size) mapped.terminalFontSize = serverSettings.terminal_font_size;
          if (serverSettings.font_family) mapped.fontFamily = serverSettings.font_family;

          set((state) => ({
            settings: { ...state.settings, ...mapped },
            isHydrated: true
          }));
          return;
        }
      } catch {
        // Backend not yet reachable, fallback
      }

      // 3. Fallback to localStorage
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('auto_ide_settings');
        if (local) {
          const parsed = JSON.parse(local);
          set((state) => ({
            settings: { ...state.settings, ...parsed },
            isHydrated: true
          }));
          return;
        }
      }
    } catch (e) {
      console.warn('Hydration error:', e);
    } finally {
      set({ isHydrated: true });
    }
  },

  save: () => {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
    }

    set({ isSaving: true });
    saveDebounceTimer = setTimeout(async () => {
      const current = get().settings;
      try {
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('auto_ide_settings', JSON.stringify(current));
        }

        // Save to Electron
        if (typeof window !== 'undefined' && window.electronAPI?.saveSettings) {
          await window.electronAPI.saveSettings(current);
        }

        // Save to Backend API
        try {
          await saveSystemSettings({
            ollama_url: current.ollamaUrl,
            model: current.model,
            planning_model: current.planningModel,
            coding_model: current.codingModel,
            diagnosis_model: current.diagnosisModel,
            summarization_model: current.summarizationModel,
            temperature: current.temperature,
            max_tokens: current.maxTokens,
            permissions: current.permissions,
            autonomy_level: current.autonomyLevel,
            permission_profile: current.permissionProfile,
            max_files_per_task: current.maxFilesPerTask,
            auto_approve_tests: current.autoApproveTests,
            auto_approve_builds: current.autoApproveBuilds,
            default_shell: current.defaultShell,
            editor_font_size: current.editorFontSize,
            terminal_font_size: current.terminalFontSize,
            font_family: current.fontFamily,
            theme: current.theme,
            project_name: current.projectName,
            excluded_paths: current.excludedPaths,
            pre_run_command: current.preRunCommand,
            test_command_override: current.testCommandOverride,
            research_mode: current.researchMode
          });
        } catch {
          // Backend may be offline
        }
      } catch (err) {
        console.error('Failed to persist settings:', err);
      } finally {
        set({ isSaving: false });
      }
    }, 500);
  },

  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial }
    }));
    get().save();
  },

  applyProfile: (profile) => {
    set((state) => {
      let perms = { ...state.settings.permissions };
      let autoLevel: AutonomyLevel = 'guided';

      if (profile === 'safe') {
        autoLevel = 'assist';
        perms = {
          readFile: true,
          writeFile: false,
          runTests: true,
          runDevCommands: false,
          gitStatus: true,
          gitDiff: true,
          gitCommit: false,
          deleteFiles: false,
          gitPush: false,
          createPR: false,
          deployApp: false
        };
      } else if (profile === 'standard') {
        autoLevel = 'guided';
        perms = {
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
        };
      } else if (profile === 'full') {
        autoLevel = 'autonomous';
        perms = {
          readFile: true,
          writeFile: true,
          runTests: true,
          runDevCommands: true,
          gitStatus: true,
          gitDiff: true,
          gitCommit: true,
          deleteFiles: true,
          gitPush: true,
          createPR: true,
          deployApp: false
        };
      }

      return {
        settings: {
          ...state.settings,
          permissionProfile: profile,
          autonomyLevel: autoLevel,
          permissions: perms
        }
      };
    });
    get().save();
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
    get().save();
  },

  setAutonomyLevel: (autonomyLevel) => {
    set((state) => ({
      settings: { ...state.settings, autonomyLevel }
    }));
    get().save();
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

// Automatically hydrate on application start
if (typeof window !== 'undefined') {
  useSettingsStore.getState().hydrate();
}
