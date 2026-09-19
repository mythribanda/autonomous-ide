import React, { useEffect, useState, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldOff, Save, RefreshCw, Info } from 'lucide-react';
import { getProjectPermissions, updateProjectPermissions } from '../../lib/api';
import { AgentPermissionConfig, PermissionLevel } from '../../types/api';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';

interface PermissionEntry {
  level: PermissionLevel;
  label: string;
  description: string;
  danger: 'safe' | 'moderate' | 'high';
}

const PERMISSION_ENTRIES: PermissionEntry[] = [
  {
    level: 'READ_ONLY',
    label: 'Read files',
    description: 'Agent can read any file inside the workspace.',
    danger: 'safe'
  },
  {
    level: 'FILE_WRITE',
    label: 'Write files',
    description: 'Agent can create and modify files inside the workspace.',
    danger: 'moderate'
  },
  {
    level: 'FILE_DELETE',
    label: 'Delete files',
    description: 'Agent can permanently delete files. Requires approval by default.',
    danger: 'high'
  },
  {
    level: 'COMMAND_RUN',
    label: 'Run commands',
    description: 'Agent can execute shell commands (build, test, lint).',
    danger: 'moderate'
  },
  {
    level: 'COMMAND_DANGEROUS',
    label: 'Dangerous commands',
    description: 'Commands that modify system state or install global packages.',
    danger: 'high'
  },
  {
    level: 'GIT_WRITE',
    label: 'Git commits',
    description: 'Agent can stage and commit changes to the local repository.',
    danger: 'moderate'
  },
  {
    level: 'GIT_PUSH',
    label: 'Git push',
    description: 'Agent can push branches to the remote. Requires approval by default.',
    danger: 'high'
  },
  {
    level: 'NETWORK',
    label: 'Network access',
    description: 'Agent can make outbound HTTP requests (e.g. to install packages).',
    danger: 'high'
  }
];

const DangerIcon: React.FC<{ danger: PermissionEntry['danger'] }> = ({ danger }) => {
  if (danger === 'safe') return <ShieldCheck className="w-4 h-4 text-green-400" />;
  if (danger === 'moderate') return <Shield className="w-4 h-4 text-yellow-400" />;
  return <ShieldAlert className="w-4 h-4 text-red-400" />;
};

const dangerLabel: Record<PermissionEntry['danger'], string> = {
  safe: 'Safe',
  moderate: 'Moderate',
  high: 'High risk'
};

const DEFAULT_CONFIG: AgentPermissionConfig = {
  allowed: ['READ_ONLY', 'FILE_WRITE', 'COMMAND_RUN', 'GIT_WRITE'],
  workspace_path: '',
  blocked_paths: [],
  max_files_per_task: 20,
  require_approval_for: ['FILE_DELETE', 'COMMAND_DANGEROUS', 'GIT_PUSH'],
  auto_approve_test_commands: true,
  auto_approve_build_commands: true
};

export const PermissionsPanel: React.FC = () => {
  const { projectId } = useProjectStore();
  const { addToast } = useUIStore();
  const [config, setConfig] = useState<AgentPermissionConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const fetched = await getProjectPermissions(projectId);
      setConfig(fetched);
      setDirty(false);
    } catch {
      // use defaults silently — backend may not have permissions configured yet
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const toggleAllowed = (level: PermissionLevel) => {
    setConfig((prev) => {
      const isAllowed = prev.allowed.includes(level);
      const newAllowed = isAllowed
        ? prev.allowed.filter((l) => l !== level)
        : [...prev.allowed, level];
      return { ...prev, allowed: newAllowed };
    });
    setDirty(true);
  };

  const toggleRequireApproval = (level: PermissionLevel) => {
    setConfig((prev) => {
      const requires = prev.require_approval_for.includes(level);
      const newRequireApproval = requires
        ? prev.require_approval_for.filter((l) => l !== level)
        : [...prev.require_approval_for, level];
      return { ...prev, require_approval_for: newRequireApproval };
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      await updateProjectPermissions(projectId, config);
      setDirty(false);
      addToast({ type: 'success', title: 'Permissions saved', message: 'Agent permission config updated.' });
    } catch (err) {
      addToast({ type: 'error', title: 'Save failed', message: 'Could not save permissions. Check console.' });
      console.error('Failed to save permissions:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-[#5A5A5A] text-sm gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading permissions…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#181818]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#0066B8]" />
          <span className="text-[#CCCCCC] text-sm font-semibold">Agent Permissions</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPermissions}
            title="Reload permissions from server"
            className="p-1 rounded text-[#5A5A5A] hover:text-[#9D9D9D] hover:bg-[#2D2D2D] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving || !projectId}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors
              ${dirty && !saving && projectId
                ? 'bg-[#0066B8] text-white hover:bg-[#0077CC]'
                : 'bg-[#2D2D2D] text-[#5A5A5A] cursor-not-allowed'
              }
            `}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Permission list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Column headers */}
        <div className="flex items-center text-[#5A5A5A] text-[10px] uppercase tracking-wider px-2 pb-1 border-b border-[#2B2B2B] mb-2">
          <div className="flex-1">Permission</div>
          <div className="w-16 text-center">Enabled</div>
          <div className="w-20 text-center">Ask first</div>
        </div>

        {PERMISSION_ENTRIES.map(({ level, label, description, danger }) => {
          const isAllowed = config.allowed.includes(level);
          const requiresApproval = config.require_approval_for.includes(level);

          return (
            <div
              key={level}
              className={`
                flex items-center gap-2 px-2 py-2.5 rounded-md group transition-colors
                ${isAllowed ? 'bg-[#1E1E1E] hover:bg-[#252526]' : 'opacity-60 hover:opacity-80'}
              `}
            >
              {/* Danger icon + info */}
              <div className="flex-1 flex items-start gap-2 min-w-0">
                <DangerIcon danger={danger} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#CCCCCC] text-xs font-medium">{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded ${
                        danger === 'safe'
                          ? 'bg-green-500/15 text-green-400'
                          : danger === 'moderate'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {dangerLabel[danger]}
                    </span>
                  </div>
                  <p className="text-[#5A5A5A] text-[10px] leading-tight mt-0.5 truncate" title={description}>
                    {description}
                  </p>
                </div>
              </div>

              {/* Enabled toggle */}
              <div className="w-16 flex justify-center">
                <button
                  onClick={() => toggleAllowed(level)}
                  role="switch"
                  aria-checked={isAllowed}
                  className={`
                    relative w-8 h-4 rounded-full transition-colors duration-200 flex-shrink-0
                    ${isAllowed ? 'bg-[#0066B8]' : 'bg-[#3C3C3C]'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                      ${isAllowed ? 'translate-x-4' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>

              {/* Require approval toggle */}
              <div className="w-20 flex justify-center">
                <button
                  onClick={() => toggleRequireApproval(level)}
                  disabled={!isAllowed}
                  role="checkbox"
                  aria-checked={requiresApproval}
                  title={!isAllowed ? 'Enable this permission first' : 'Require human approval before executing'}
                  className={`
                    relative w-8 h-4 rounded-full transition-colors duration-200 flex-shrink-0
                    ${!isAllowed ? 'opacity-30 cursor-not-allowed' : ''}
                    ${requiresApproval && isAllowed ? 'bg-orange-500' : 'bg-[#3C3C3C]'}
                  `}
                >
                  <span
                    className={`
                      absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                      ${requiresApproval && isAllowed ? 'translate-x-4' : 'translate-x-0'}
                    `}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Auto-approve toggles */}
      <div className="border-t border-[#2B2B2B] px-4 py-3 space-y-2">
        <p className="text-[#5A5A5A] text-[10px] uppercase tracking-wider mb-2">Auto-approve without prompt</p>

        {[
          {
            key: 'auto_approve_test_commands' as const,
            label: 'Test commands',
            desc: 'npm test, pytest, go test, etc.'
          },
          {
            key: 'auto_approve_build_commands' as const,
            label: 'Build commands',
            desc: 'npm run build, tsc, cargo build, etc.'
          }
        ].map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between">
            <div>
              <span className="text-[#CCCCCC] text-xs">{label}</span>
              <p className="text-[#5A5A5A] text-[10px]">{desc}</p>
            </div>
            <button
              onClick={() => {
                setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
                setDirty(true);
              }}
              role="switch"
              aria-checked={config[key]}
              className={`
                relative w-8 h-4 rounded-full transition-colors duration-200 flex-shrink-0
                ${config[key] ? 'bg-[#0066B8]' : 'bg-[#3C3C3C]'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-200
                  ${config[key] ? 'translate-x-4' : 'translate-x-0'}
                `}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Max files */}
      <div className="border-t border-[#2B2B2B] px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="max-files" className="text-[#CCCCCC] text-xs flex items-center gap-1">
            Max files per task
            <span title="Agent will stop and ask if it would exceed this limit">
              <Info className="w-3 h-3 text-[#5A5A5A]" />
            </span>
          </label>
          <span className="text-[#0066B8] text-xs font-mono">{config.max_files_per_task}</span>
        </div>
        <input
          id="max-files"
          type="range"
          min={1}
          max={100}
          value={config.max_files_per_task}
          onChange={(e) => {
            setConfig((prev) => ({ ...prev, max_files_per_task: Number(e.target.value) }));
            setDirty(true);
          }}
          className="w-full h-1 bg-[#3C3C3C] rounded-full appearance-none cursor-pointer accent-[#0066B8]"
        />
      </div>

      {/* No project warning */}
      {!projectId && (
        <div className="mx-3 mb-3 flex items-center gap-1.5 px-3 py-2 rounded bg-yellow-500/10 border border-yellow-500/30">
          <ShieldOff className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          <span className="text-yellow-400 text-xs">Open a project to save permissions</span>
        </div>
      )}
    </div>
  );
};
