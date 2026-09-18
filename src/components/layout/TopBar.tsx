import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUIStore } from '../../stores/uiStore';
import { useGitStore } from '../../stores/gitStore';
import {
  Cpu,
  GitBranch,
  ChevronDown,
  Settings,
  Bell,
  Check,
  FolderGit2,
  Sparkles,
  Command
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const TopBar: React.FC = () => {
  const { currentProject, setProject, openProjectWithDialog } = useProjectStore();
  const { settings, openSettings } = useSettingsStore();
  const { setCommandPaletteOpen, addToast } = useUIStore();
  const { currentBranch } = useGitStore();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const projects = [
    { name: 'EduSim', path: 'C:\\Projects\\EduSim', desc: 'Classroom simulation platform' },
    { name: 'InsightFlow', path: 'C:\\Projects\\InsightFlow', desc: 'Realtime streaming analytics' },
    { name: 'StudLyf', path: 'C:\\Projects\\StudLyf', desc: 'Student campus life mobile API' }
  ];

  return (
    <header className="h-9 border-b border-[#2B2B2B] bg-[#181818] px-3 flex items-center justify-between text-xs select-none z-30">
      {/* Left: Logo & Brand */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-semibold text-[#FFFFFF] tracking-tight">
          <div className="w-4 h-4 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <Sparkles size={11} />
          </div>
          <span className="font-semibold text-xs tracking-tight text-[#FFFFFF]">AutonomousDev</span>
        </div>
        <span className="hidden lg:inline text-[10px] text-[#858585] font-mono tracking-wide px-1.5 py-0.2 rounded-sm bg-[#252526] border border-[#2B2B2B]">
          Autonomous Software Engineering
        </span>
      </div>

      {/* Center: Project Switcher & Branch */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] transition-colors"
          >
            <FolderGit2 size={13} className="text-[#007ACC]" />
            <span className="font-medium text-xs text-[#FFFFFF]">{currentProject}</span>
            <ChevronDown size={12} className="text-[#858585] ml-0.5" />
          </button>

          {projectDropdownOpen && (
            <div
              className="absolute top-full mt-1 left-0 w-64 bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm shadow-2xl py-1 z-50 animate-in fade-in duration-100"
              onMouseLeave={() => setProjectDropdownOpen(false)}
            >
              <div className="px-3 py-1 text-[10px] font-mono text-[#858585] uppercase tracking-wider">
                Switch Workspace
              </div>
              {projects.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    setProject(p.name, p.path);
                    setProjectDropdownOpen(false);
                    addToast({
                      type: 'info',
                      title: `Switched project to ${p.name}`,
                      message: `Loaded workspace from ${p.path}`
                    });
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-[#2A2D2E] transition-colors ${
                    p.name === currentProject ? 'bg-[#264F78] text-[#FFFFFF]' : 'text-[#CCCCCC]'
                  }`}
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-[10px] text-[#858585] font-mono">{p.desc}</div>
                  </div>
                  {p.name === currentProject && <Check size={14} className="text-[#FFFFFF]" />}
                </button>
              ))}

              <div className="pt-1 mt-1 border-t border-[#2B2B2B]">
                <button
                  onClick={async () => {
                    setProjectDropdownOpen(false);
                    await openProjectWithDialog();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#58A6FF] hover:bg-[#2A2D2E] flex items-center gap-2 transition-colors font-medium"
                >
                  <FolderGit2 size={13} />
                  <span>Open Folder from Disk...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[#CCCCCC] font-mono text-[11px]">
          <GitBranch size={12} className="text-[#007ACC]" />
          <span>{currentBranch}</span>
        </div>

        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#858585] hover:text-[#CCCCCC] transition-colors text-[11px] font-mono"
        >
          <Command size={11} />
          <span>Cmd+K</span>
        </button>
      </div>

      {/* Right: Local AI Status, Context, Settings */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-[#252526] border border-[#2B2B2B]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#89D185]" />
          <span className="text-[11px] font-mono font-medium text-[#CCCCCC]">{settings.model}</span>
          <span className="text-[10px] text-[#858585] font-mono hidden sm:inline">• Local AI</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-[#858585] px-2 py-0.5 rounded-sm bg-[#252526] border border-[#2B2B2B]">
          <Cpu size={12} className="text-[#007ACC]" />
          <span className="text-[#CCCCCC]">8.2k</span>
          <span className="text-[#858585]">/ 32k</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors relative"
            title="Notifications"
          >
            <Bell size={14} />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#007ACC] rounded-full" />
          </button>

          {showNotifications && (
            <div
              className="absolute right-0 top-full mt-1 w-72 bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm shadow-2xl p-3 z-50 text-xs"
              onMouseLeave={() => setShowNotifications(false)}
            >
              <div className="font-semibold text-[#FFFFFF] mb-2 flex items-center justify-between pb-1.5 border-b border-[#2B2B2B]">
                <span>Notifications</span>
                <Badge variant="blue" size="xs">Live</Badge>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="p-2 rounded-sm bg-[#252526] border border-[#2B2B2B]">
                  <div className="text-[#FFFFFF] font-medium">Test Suite Passed</div>
                  <div className="text-[#858585] text-[10px] mt-0.5">42 unit tests verified in 1.12s</div>
                </div>
                <div className="p-2 rounded-sm bg-[#252526] border border-[#2B2B2B]">
                  <div className="text-[#FFFFFF] font-medium">Checkpoint Created</div>
                  <div className="text-[#858585] text-[10px] mt-0.5">AI Checkpoint a83d9f2 before patch</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={openSettings}
          className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors"
          title="Settings & Permissions"
        >
          <Settings size={14} />
        </button>

        <div className="flex items-center gap-1.5 pl-2 border-l border-[#2B2B2B]">
          <div className="w-5 h-5 rounded-sm bg-[#007ACC] text-[#FFFFFF] flex items-center justify-center font-semibold text-[10px] font-mono">
            MB
          </div>
        </div>
      </div>
    </header>
  );
};
