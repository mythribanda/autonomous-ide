import React, { useState, useEffect } from 'react';
import { type LucideIcon } from 'lucide-react';
import { useSettingsStore, FlatSettings } from '../../store/settingsStore';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useGitHubStore } from '../../store/githubStore';
import { ModelSettings } from './ModelSettings';
import {
  Cpu,
  ShieldCheck,
  GitBranch,
  Palette,
  Terminal,
  Keyboard,
  FolderCog,
  Info,
  X,
  Check,
  Save,
  Download,
  ExternalLink,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sliders,
  Sparkles,
  Layers,
  Database,
  Search,
  Lock,
  Square,
  CheckSquare
} from 'lucide-react';
import { clsx } from 'clsx';

type SettingsSectionId =
  | 'ai'
  | 'permissions'
  | 'github'
  | 'appearance'
  | 'terminal'
  | 'shortcuts'
  | 'project'
  | 'about';

interface SectionNavItem {
  id: SettingsSectionId;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

const SECTIONS: SectionNavItem[] = [
  { id: 'ai', label: 'AI & Models', icon: Cpu },
  { id: 'permissions', label: 'Agent Permissions', icon: ShieldCheck },
  { id: 'github', label: 'GitHub', icon: GitBranch },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard },
  { id: 'project', label: 'Project Settings', icon: FolderCog },
  { id: 'about', label: 'About & Research', icon: Info }
];

export const SettingsModal: React.FC = () => {
  const {
    settings,
    isSettingsOpen,
    closeSettings,
    updateSettings,
    applyProfile,
    togglePermission,
    setAutonomyLevel,
    isSaving
  } = useSettingsStore();

  const {
    currentProject,
    projectId,
    projectPath,
    scanResult,
    knowledgeGraph,
    project
  } = useProjectStore();

  const { addToast } = useUIStore();
  const { connected: isGitHubConnected, username: githubUsername, disconnect: disconnectGitHub } = useGitHubStore();

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('ai');
  const [shortcutSearch, setShortcutSearch] = useState<string>('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  // Export Project Data as JSON
  const handleExportProjectData = () => {
    try {
      const payload = {
        exported_at: new Date().toISOString(),
        project: {
          id: projectId,
          name: settings.projectName || currentProject,
          path: projectPath,
          metadata: project
        },
        scan_result: scanResult,
        knowledge_graph: knowledgeGraph,
        settings: settings
      };

      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(settings.projectName || 'project').toLowerCase().replace(/\s+/g, '-')}-data-export.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Project Data Exported',
        message: 'Successfully exported project analysis and settings to JSON.'
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: err?.message || 'Failed to generate project JSON export.'
      });
    }
  };

  const keyboardShortcutsList = [
    { key: 'command_palette', desc: 'Open Command Palette', combo: settings.shortcuts.command_palette || 'Ctrl+Shift+P' },
    { key: 'toggle_terminal', desc: 'Toggle Integrated Terminal', combo: settings.shortcuts.toggle_terminal || 'Ctrl+`' },
    { key: 'new_task', desc: 'New Autonomous Agent Task', combo: settings.shortcuts.new_task || 'Ctrl+K' },
    { key: 'search_files', desc: 'Quick Open / Search Files', combo: settings.shortcuts.search_files || 'Ctrl+P' },
    { key: 'open_settings', desc: 'Open Settings Dialog', combo: settings.shortcuts.open_settings || 'Ctrl+,' },
    { key: 'save_file', desc: 'Save Active File', combo: settings.shortcuts.save_file || 'Ctrl+S' },
    { key: 'toggle_git', desc: 'Show Source Control View', combo: settings.shortcuts.toggle_git || 'Ctrl+Shift+G' },
    { key: 'diff_view', desc: 'Toggle Side-by-Side Diff View', combo: 'Alt+D' },
    { key: 'run_tests', desc: 'Run Workspace Tests', combo: 'Ctrl+Shift+T' },
    { key: 'security_scan', desc: 'Trigger Security & Secret Audit', combo: 'Ctrl+Shift+S' }
  ];

  const filteredShortcuts = keyboardShortcutsList.filter(
    (s) =>
      s.desc.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.combo.toLowerCase().includes(shortcutSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 select-none font-sans text-xs">
      <div className="bg-[#181818] border border-[#2B2B2B] rounded-xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top App Header */}
        <div className="px-5 py-3.5 border-b border-[#2B2B2B] bg-[#1E1E1E] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#007ACC] flex items-center justify-center text-white font-bold text-xs shadow-sm">
              <Sliders size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-100 font-mono tracking-wide">
                  SETTINGS
                </h2>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                  v{settings.appVersion}
                </span>
                {isSaving && (
                  <span className="text-[10px] font-mono text-[#007ACC] flex items-center gap-1 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" />
                    Auto-saving...
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Configure runtime models, sandbox autonomy, GitHub integration, and interface preferences.
              </p>
            </div>
          </div>

          <button
            onClick={closeSettings}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#2B2B2B] transition-colors"
            title="Close Settings (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body: Sidebar + Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-56 border-r border-[#2B2B2B] bg-[#141414] p-3 flex flex-col space-y-1 shrink-0 overflow-y-auto">
            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase px-2 py-1 tracking-wider">
              Preferences
            </span>
            {SECTIONS.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={clsx(
                    'w-full text-left px-3 py-2 rounded-md font-mono text-xs flex items-center justify-between transition-colors',
                    isActive
                      ? 'bg-[#252526] text-white font-bold border-l-2 border-[#007ACC]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1E1E1E]'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isActive ? 'text-[#007ACC]' : 'text-zinc-500'} />
                    <span>{sec.label}</span>
                  </div>
                  {sec.badge && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      {sec.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-[#181818] space-y-6">
            {/* SECTION 1: AI & MODELS */}
            {activeSection === 'ai' && (
              <div className="space-y-4 max-w-4xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <Cpu size={16} className="text-[#007ACC]" />
                    <span>AI & MODEL CONFIGURATION</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Local Ollama runtime connection, multi-model role routing, temperature, and tokens.
                  </p>
                </div>
                <ModelSettings />
              </div>
            )}

            {/* SECTION 2: AGENT PERMISSIONS */}
            {activeSection === 'permissions' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-400" />
                    <span>AGENT PERMISSIONS & AUTONOMY GATES</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Control what the autonomous agent is permitted to execute without human intervention.
                  </p>
                </div>

                {/* Pre-configured Profiles */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono uppercase text-zinc-400 font-semibold block">
                    Permission Profiles
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'safe',
                        title: 'Safe Mode',
                        desc: 'Read files and run tests only. All writes and commands require approval.'
                      },
                      {
                        id: 'standard',
                        title: 'Standard (Recommended)',
                        desc: 'Autonomous file edits, test runs, and checkpoints. Destructive actions blocked.'
                      },
                      {
                        id: 'full',
                        title: 'Full Autonomy',
                        desc: 'Full workspace freedom including file deletions, git pushes, and PR creation.'
                      }
                    ].map((prof) => (
                      <div
                        key={prof.id}
                        onClick={() => applyProfile(prof.id as any)}
                        className={clsx(
                          'p-3 rounded-lg border cursor-pointer transition-all space-y-1',
                          settings.permissionProfile === prof.id
                            ? 'bg-[#252526] border-[#007ACC] text-white shadow-sm'
                            : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#222222] text-zinc-400'
                        )}
                      >
                        <div className="flex items-center justify-between font-mono font-bold text-xs">
                          <span className={settings.permissionProfile === prof.id ? 'text-[#007ACC]' : 'text-zinc-200'}>
                            {prof.title}
                          </span>
                          {settings.permissionProfile === prof.id && (
                            <span className="w-2 h-2 rounded-full bg-[#007ACC]" />
                          )}
                        </div>
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          {prof.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Max Files Per Task Slider */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-zinc-200">Max Files Modified Per Task</span>
                    <span className="text-[#007ACC] font-bold">{settings.maxFilesPerTask} files</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={1}
                    value={settings.maxFilesPerTask}
                    onChange={(e) => updateSettings({ maxFilesPerTask: Number(e.target.value) })}
                    className="w-full accent-[#007ACC]"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Limits blast radius by halting task execution if the agent attempts to modify more files than permitted.
                  </span>
                </div>

                {/* Auto-Approve Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => updateSettings({ autoApproveTests: !settings.autoApproveTests })}
                    className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between cursor-pointer hover:bg-[#222222] transition-colors"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-zinc-200 font-mono text-xs block">
                        Auto-Approve Test Commands
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        Permit pytest, vitest, and jest executions without approval prompts.
                      </span>
                    </div>
                    {settings.autoApproveTests ? (
                      <CheckSquare size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Square size={16} className="text-zinc-600 shrink-0" />
                    )}
                  </div>

                  <div
                    onClick={() => updateSettings({ autoApproveBuilds: !settings.autoApproveBuilds })}
                    className="p-3.5 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between cursor-pointer hover:bg-[#222222] transition-colors"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-zinc-200 font-mono text-xs block">
                        Auto-Approve Build Tasks
                      </span>
                      <span className="text-[11px] text-zinc-500 block">
                        Permit build/compilation commands (tsc, vite build, cargo build).
                      </span>
                    </div>
                    {settings.autoApproveBuilds ? (
                      <CheckSquare size={16} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Square size={16} className="text-zinc-600 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Individual Permission Checkboxes */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-3">
                  <span className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block border-b border-[#2B2B2B] pb-1.5">
                    Granular Permission Gates
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'readFile', label: 'Read files & parse AST' },
                      { key: 'writeFile', label: 'Write & patch project files' },
                      { key: 'runTests', label: 'Execute unit and integration tests' },
                      { key: 'runDevCommands', label: 'Run local dev commands (npm, pytest)' },
                      { key: 'gitStatus', label: 'Inspect git working tree & status' },
                      { key: 'gitDiff', label: 'Generate git diff patches' },
                      { key: 'gitCommit', label: 'Create local safe checkpoints' },
                      { key: 'deleteFiles', label: 'Delete files from workspace disk' },
                      { key: 'gitPush', label: 'Push commits to remote GitHub' },
                      { key: 'createPR', label: 'Open Pull Request on GitHub' },
                      { key: 'deployApp', label: 'Deploy application to cloud' }
                    ].map((p) => {
                      const isChecked = settings.permissions[p.key as keyof typeof settings.permissions];
                      return (
                        <div
                          key={p.key}
                          onClick={() => togglePermission(p.key as any)}
                          className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-white"
                        >
                          {isChecked ? (
                            <CheckSquare size={15} className="text-emerald-400" />
                          ) : (
                            <Square size={15} className="text-zinc-600" />
                          )}
                          <span>{p.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: GITHUB */}
            {activeSection === 'github' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <GitBranch size={16} className="text-white" />
                    <span>GITHUB INTEGRATION</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Connect account to clone, push commits, and create Pull Requests.
                  </p>
                </div>

                {/* Account Status Card */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-white">
                      <GitBranch size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-100 text-xs font-mono">
                          {isGitHubConnected ? (githubUsername || 'Connected User') : 'Not Connected'}
                        </span>
                        {isGitHubConnected ? (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                            Authorized
                          </span>
                        ) : (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-400">
                            Disconnected
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {isGitHubConnected
                          ? 'OAuth token active with repo and workflow scope.'
                          : 'Connect to browse your GitHub repositories and synchronize changes.'}
                      </p>
                    </div>
                  </div>

                  {isGitHubConnected ? (
                    <button
                      onClick={disconnectGitHub}
                      className="px-3 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-medium text-xs transition-colors"
                    >
                      Disconnect Account
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        window.open('http://localhost:8000/api/github/auth/start', '_blank');
                      }}
                      className="px-4 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <GitBranch size={13} />
                      <span>Connect GitHub</span>
                    </button>
                  )}
                </div>

                {/* Default Clone Directory */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Default Clone Directory
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={settings.defaultCloneDirectory}
                      onChange={(e) => updateSettings({ defaultCloneDirectory: e.target.value })}
                      placeholder="C:\Projects"
                      className="flex-1 bg-[#141414] border border-[#333333] rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                    />
                    <button
                      onClick={async () => {
                        if (window.electronAPI?.openFolder) {
                          const folder = await window.electronAPI.openFolder();
                          if (folder) updateSettings({ defaultCloneDirectory: folder });
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] text-xs flex items-center gap-1.5 transition-colors"
                    >
                      <FolderOpen size={13} />
                      <span>Browse</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Repositories cloned from GitHub will be initialized into this root folder.
                  </span>
                </div>
              </div>
            )}

            {/* SECTION 4: APPEARANCE */}
            {activeSection === 'appearance' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <Palette size={16} className="text-[#007ACC]" />
                    <span>APPEARANCE & TYPOGRAPHY</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Customize editor typography, terminal fonts, and interface styling.
                  </p>
                </div>

                {/* Font Family Selection */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Monospace Font Family
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas'].map((font) => (
                      <button
                        key={font}
                        onClick={() => updateSettings({ fontFamily: font })}
                        className={clsx(
                          'p-2.5 rounded-md border text-center font-mono text-xs transition-colors',
                          settings.fontFamily === font
                            ? 'bg-[#252526] border-[#007ACC] text-white font-bold'
                            : 'bg-[#141414] border-[#2B2B2B] text-zinc-400 hover:text-zinc-200 hover:bg-[#1E1E1E]'
                        )}
                        style={{ fontFamily: font }}
                      >
                        {font}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Editor Font Size */}
                  <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-zinc-200">Editor Font Size</span>
                      <span className="text-[#007ACC] font-bold">{settings.editorFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={24}
                      step={1}
                      value={settings.editorFontSize}
                      onChange={(e) => updateSettings({ editorFontSize: Number(e.target.value) })}
                      className="w-full accent-[#007ACC]"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Applies to Monaco Editor and diff inspectors.
                    </span>
                  </div>

                  {/* Terminal Font Size */}
                  <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-zinc-200">Terminal Font Size</span>
                      <span className="text-[#007ACC] font-bold">{settings.terminalFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={22}
                      step={1}
                      value={settings.terminalFontSize}
                      onChange={(e) => updateSettings({ terminalFontSize: Number(e.target.value) })}
                      className="w-full accent-[#007ACC]"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      Applies to integrated terminal and live log viewers.
                    </span>
                  </div>
                </div>

                {/* UI Theme */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Interface Theme
                  </label>
                  <div className="p-3 rounded-md bg-[#141414] border border-[#007ACC]/50 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-bold text-zinc-100 font-mono text-xs">Dark Developer (Active)</span>
                      <p className="text-[11px] text-zinc-400">
                        Default high-contrast developer theme with custom VS Code palette.
                      </p>
                    </div>
                    <CheckCircle2 size={16} className="text-[#007ACC]" />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: TERMINAL */}
            {activeSection === 'terminal' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <Terminal size={16} className="text-[#007ACC]" />
                    <span>TERMINAL SETTINGS</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Configure shell runtime, tab width, and output buffer depth.
                  </p>
                </div>

                {/* Default Shell */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Default Shell Runtime
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {['pwsh', 'powershell', 'bash', 'cmd'].map((sh) => (
                      <button
                        key={sh}
                        onClick={() => updateSettings({ defaultShell: sh })}
                        className={clsx(
                          'p-2.5 rounded-md border text-center font-mono text-xs uppercase transition-colors',
                          settings.defaultShell === sh
                            ? 'bg-[#252526] border-[#007ACC] text-white font-bold'
                            : 'bg-[#141414] border-[#2B2B2B] text-zinc-400 hover:text-zinc-200 hover:bg-[#1E1E1E]'
                        )}
                      >
                        {sh}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-500 block">
                    Detected system platform: Windows x64 (Default shell: {settings.defaultShell})
                  </span>
                </div>

                {/* Tab Size & Buffer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tab Size */}
                  <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                    <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                      Tab Indentation Size
                    </label>
                    <div className="flex gap-2">
                      {[2, 4].map((size) => (
                        <button
                          key={size}
                          onClick={() => updateSettings({ tabSize: size })}
                          className={clsx(
                            'flex-1 py-1.5 rounded border text-center font-mono text-xs font-semibold transition-colors',
                            settings.tabSize === size
                              ? 'bg-[#007ACC] text-white border-[#007ACC]'
                              : 'bg-[#141414] text-zinc-400 border-[#2B2B2B] hover:bg-[#252526]'
                          )}
                        >
                          {size} Spaces
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollback Buffer */}
                  <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-semibold text-zinc-200">Scrollback Buffer</span>
                      <span className="text-[#007ACC] font-bold">{settings.scrollbackBuffer} lines</span>
                    </div>
                    <input
                      type="range"
                      min={1000}
                      max={10000}
                      step={500}
                      value={settings.scrollbackBuffer}
                      onChange={(e) => updateSettings({ scrollbackBuffer: Number(e.target.value) })}
                      className="w-full accent-[#007ACC]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 6: KEYBOARD SHORTCUTS */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-4 max-w-4xl">
                <div className="border-b border-[#2B2B2B] pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                      <Keyboard size={16} className="text-[#007ACC]" />
                      <span>KEYBOARD SHORTCUTS</span>
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Quick reference and keybinding mappings for common commands.
                    </p>
                  </div>

                  <div className="relative w-64">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={shortcutSearch}
                      onChange={(e) => setShortcutSearch(e.target.value)}
                      placeholder="Search shortcuts..."
                      className="w-full bg-[#141414] border border-[#333333] rounded pl-8 pr-3 py-1 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none focus:border-[#007ACC]"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-[#2B2B2B] bg-[#1E1E1E] overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#2B2B2B] bg-[#252526]/50 text-[10px] text-zinc-400 uppercase">
                        <th className="py-2.5 px-4">Action / Command</th>
                        <th className="py-2.5 px-4 text-right">Keybinding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2B2B2B] text-zinc-300">
                      {filteredShortcuts.map((s) => (
                        <tr key={s.key} className="hover:bg-[#252526]/40 transition-colors">
                          <td className="py-2.5 px-4 font-sans text-xs text-zinc-200">
                            {s.desc}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="px-2 py-1 rounded bg-[#141414] border border-[#333333] text-zinc-300 font-mono text-[11px] shadow-inner">
                              {s.combo}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SECTION 7: PROJECT SETTINGS */}
            {activeSection === 'project' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <FolderCog size={16} className="text-[#007ACC]" />
                    <span>PROJECT SETTINGS ({settings.projectName || currentProject || 'Active Workspace'})</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Per-project build overrides, custom scanner exclusions, and lifecycle commands.
                  </p>
                </div>

                {/* Project Name */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Project Display Name
                  </label>
                  <input
                    type="text"
                    value={settings.projectName}
                    onChange={(e) => updateSettings({ projectName: e.target.value })}
                    className="w-full bg-[#141414] border border-[#333333] rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                </div>

                {/* Excluded Paths */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Scanner Excluded Paths (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={settings.excludedPaths}
                    onChange={(e) => updateSettings({ excludedPaths: e.target.value })}
                    placeholder="node_modules, dist, .git, build, .venv"
                    className="w-full bg-[#141414] border border-[#333333] rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    These patterns are bypassed by the AST analyzer and dependency knowledge graph scanner.
                  </span>
                </div>

                {/* Pre-run Command */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Custom Pre-Run Command
                  </label>
                  <input
                    type="text"
                    value={settings.preRunCommand}
                    onChange={(e) => updateSettings({ preRunCommand: e.target.value })}
                    placeholder="e.g. npm install, or pip install -r requirements.txt"
                    className="w-full bg-[#141414] border border-[#333333] rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                  <span className="text-[10px] text-zinc-500 block">
                    Executed automatically before starting a new autonomous plan execution.
                  </span>
                </div>

                {/* Custom Test Command Override */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <label className="text-xs font-semibold font-mono text-zinc-200 uppercase tracking-wider block">
                    Custom Test Command Override
                  </label>
                  <input
                    type="text"
                    value={settings.testCommandOverride}
                    onChange={(e) => updateSettings({ testCommandOverride: e.target.value })}
                    placeholder="e.g. npm test -- --coverage, or pytest -v"
                    className="w-full bg-[#141414] border border-[#333333] rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-[#007ACC]"
                  />
                </div>
              </div>
            )}

            {/* SECTION 8: ABOUT / RESEARCH */}
            {activeSection === 'about' && (
              <div className="space-y-5 max-w-3xl">
                <div className="border-b border-[#2B2B2B] pb-2">
                  <h3 className="text-sm font-bold text-zinc-100 font-mono flex items-center gap-2">
                    <Info size={16} className="text-[#007ACC]" />
                    <span>ABOUT & RESEARCH MODE</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Software version details, research telemetry evaluation toggles, and data export.
                  </p>
                </div>

                {/* Version Card */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-zinc-100">Autonomous IDE Desktop</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-[#007ACC]/20 text-[#007ACC] border border-[#007ACC]/40">
                      v{settings.appVersion}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    AI-native desktop development environment powered by local LLMs, AST knowledge graphs, self-recovery loops, and granular security sandboxing.
                  </p>
                  <div className="flex items-center gap-3 pt-2 text-[11px] font-mono text-[#007ACC]">
                    <a
                      href="https://github.com/mythribanda/autonomous-ide"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      <GitBranch size={12} />
                      <span>GitHub Repository</span>
                    </a>
                    <span>•</span>
                    <a
                      href="https://github.com/mythribanda/autonomous-ide#readme"
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      <ExternalLink size={12} />
                      <span>Documentation</span>
                    </a>
                  </div>
                </div>

                {/* Research Mode Toggle */}
                <div
                  onClick={() => updateSettings({ researchMode: !settings.researchMode })}
                  className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex items-center justify-between cursor-pointer hover:bg-[#222222] transition-colors"
                >
                  <div className="space-y-0.5">
                    <span className="font-bold text-zinc-100 font-mono text-xs flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-400" />
                      <span>B.Tech Project Research & Evaluation Mode</span>
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      When enabled, renders the comprehensive Research & Evaluation panel in the Activity Bar (Task Completion Rate, Recovery Rate, Model Latencies, Empirical Summary).
                    </p>
                  </div>
                  {settings.researchMode ? (
                    <CheckSquare size={18} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Square size={18} className="text-zinc-600 shrink-0" />
                  )}
                </div>

                {/* Data Export Action */}
                <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-bold text-zinc-100 font-mono text-xs block">
                      Export Complete Project State
                    </span>
                    <p className="text-[11px] text-zinc-400">
                      Download current workspace metadata, AST graph, impact analysis, and settings as a standalone JSON report.
                    </p>
                  </div>

                  <button
                    onClick={handleExportProjectData}
                    className="px-4 py-2 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <Download size={13} />
                    <span>Export All Project Data (JSON)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
