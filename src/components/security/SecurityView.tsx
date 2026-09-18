import React from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { AutonomyLevel } from '../../types';
import { AuditLogTable } from './AuditLogTable';
import { Badge } from '../common/Badge';
import {
  ShieldCheck,
  Lock,
  CheckSquare,
  Square,
  Sliders,
  FolderLock,
  AlertOctagon
} from 'lucide-react';
import { clsx } from 'clsx';

export const SecurityView: React.FC = () => {
  const { settings, togglePermission, setAutonomyLevel } = useSettingsStore();
  const { projectPath } = useProjectStore();
  const { addToast } = useUIStore();

  const autonomyLevels: { level: AutonomyLevel; title: string; desc: string }[] = [
    {
      level: 'assist',
      title: 'Assist Mode',
      desc: 'Suggests changes and diffs; waits for user to trigger writes and tests.'
    },
    {
      level: 'guided',
      title: 'Guided Mode',
      desc: 'Plans tasks automatically; requests approval for file writes and executions.'
    },
    {
      level: 'autonomous',
      title: 'Autonomous Mode',
      desc: 'Autonomous plan execution, AST code edits, test runs, and self-recovery inside workspace sandbox.'
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 select-none font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <ShieldCheck size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                AUTONOMY & SECURITY
              </h1>
              <Badge variant="emerald" size="xs">
                Sandbox Active
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Granular permission boundaries and sandbox path containment.
            </p>
          </div>
        </div>
      </div>

      {/* Autonomy Level Selector */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
        <div className="flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
          <Sliders size={14} className="text-[#007ACC]" />
          <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
            AGENT AUTONOMY LEVEL
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {autonomyLevels.map((item) => {
            const isSelected = settings.autonomyLevel === item.level;

            return (
              <div
                key={item.level}
                onClick={() => {
                  setAutonomyLevel(item.level);
                  addToast({
                    type: 'info',
                    title: `Autonomy Level: ${item.title}`,
                    message: item.desc
                  });
                }}
                className={clsx(
                  'p-3 rounded-sm border cursor-pointer transition-all space-y-1.5',
                  isSelected
                    ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                    : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#FFFFFF] font-mono">{item.title}</span>
                  {isSelected && <Badge variant="blue" size="xs">Active</Badge>}
                </div>
                <p className={`text-[11px] font-sans leading-relaxed ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workspace Boundary Box */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2.5">
        <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-1.5">
            <FolderLock size={14} className="text-[#89D185]" />
            <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              WORKSPACE BOUNDARY
            </h3>
          </div>
          <Badge variant="emerald" size="xs">
            Path Lock Active
          </Badge>
        </div>

        <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
          <div>
            <span className="text-[#858585] text-[10px] uppercase">Active Sandbox Root:</span>
            <div className="text-[#007ACC] font-bold text-xs mt-0.5">{projectPath}</div>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-[#F14C4C]/10 border border-[#F14C4C]/30 text-[#F14C4C] text-xs font-semibold">
            <AlertOctagon size={13} />
            <span>AI access outside workspace: BLOCKED</span>
          </div>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-1.5">
            <Lock size={14} className="text-[#007ACC]" />
            <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              PERMISSIONS & APPROVAL GATES
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Autonomous Permissions */}
          <div className="space-y-2 p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-xs font-semibold text-[#89D185] font-mono block mb-1.5">
              ✓ Granted Autonomous Permissions
            </span>
            {[
              { key: 'readFile', label: 'Read project files & AST parsing' },
              { key: 'writeFile', label: 'Write project files within workspace' },
              { key: 'runTests', label: 'Execute unit and integration tests' },
              { key: 'runDevCommands', label: 'Run local dev commands (npm, pytest)' },
              { key: 'gitStatus', label: 'Inspect git working tree & branch state' },
              { key: 'gitDiff', label: 'Generate git diff patches' },
              { key: 'gitCommit', label: 'Create local git safe checkpoints' }
            ].map((p) => (
              <div
                key={p.key}
                onClick={() => togglePermission(p.key as any)}
                className="flex items-center gap-2 text-xs text-[#CCCCCC] cursor-pointer hover:text-[#FFFFFF]"
              >
                {settings.permissions[p.key as keyof typeof settings.permissions] ? (
                  <CheckSquare size={14} className="text-[#89D185]" />
                ) : (
                  <Square size={14} className="text-[#858585]" />
                )}
                <span>{p.label}</span>
              </div>
            ))}
          </div>

          {/* Require Human Approval */}
          <div className="space-y-2 p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
            <span className="text-xs font-semibold text-[#CCA700] font-mono block mb-1.5">
              ⚠ Require Explicit Human Approval
            </span>
            {[
              { key: 'deleteFiles', label: 'Delete files from disk' },
              { key: 'gitPush', label: 'Push commits to remote GitHub repository' },
              { key: 'createPR', label: 'Create GitHub Pull Request' },
              { key: 'deployApp', label: 'Deploy application to cloud / staging' }
            ].map((p) => (
              <div
                key={p.key}
                onClick={() => togglePermission(p.key as any)}
                className="flex items-center gap-2 text-xs text-[#CCCCCC] cursor-pointer hover:text-[#FFFFFF]"
              >
                {!settings.permissions[p.key as keyof typeof settings.permissions] ? (
                  <CheckSquare size={14} className="text-[#CCA700]" />
                ) : (
                  <Square size={14} className="text-[#858585]" />
                )}
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <AuditLogTable />
    </div>
  );
};
