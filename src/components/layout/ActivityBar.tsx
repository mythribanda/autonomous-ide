import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { ActivityView } from '../../types';
import {
  Home,
  FolderTree,
  Sparkles,
  Network,
  Bot,
  CheckCircle2,
  GitBranch,
  Terminal,
  ShieldCheck,
  Settings,
  Radar,
  RefreshCw,
  LucideIcon
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  id: ActivityView;
  label: string;
  icon: LucideIcon;
  badge?: string;
  isBottom?: boolean;
  onClickCustom?: () => void;
}

export const ActivityBar: React.FC = () => {
  const { activeView, setActiveView, toggleAgentPanel, isAgentPanelOpen } = useUIStore();
  const { openSettings } = useSettingsStore();
  const { toggleOpen: toggleTerminal, isOpen: isTerminalOpen } = useTerminalStore();

  const navItems: NavItem[] = [
    { id: 'home', label: 'Welcome', icon: Home },
    { id: 'explorer', label: 'Explorer', icon: FolderTree },
    { id: 'intelligence', label: 'Project Intelligence & Graph', icon: Network },
    { id: 'impact', label: 'Impact Analysis', icon: Radar },
    {
      id: 'agent',
      label: 'AI Autonomous Agent',
      icon: Bot,
      badge: 'Live',
      onClickCustom: () => {
        setActiveView('explorer');
        if (!isAgentPanelOpen) toggleAgentPanel();
      }
    },
    { id: 'verification', label: 'Testing & Verification', icon: CheckCircle2, badge: '42' },
    { id: 'recovery', label: 'Self-Recovery Timeline', icon: RefreshCw },
    { id: 'git', label: 'Source Control & Git', icon: GitBranch },
    {
      id: 'terminal',
      label: 'Terminal & Output',
      icon: Terminal,
      onClickCustom: () => toggleTerminal()
    },
    { id: 'security', label: 'Security & Permissions', icon: ShieldCheck },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      isBottom: true,
      onClickCustom: () => openSettings()
    }
  ];

  const topItems = navItems.filter((i) => !i.isBottom);
  const bottomItems = navItems.filter((i) => i.isBottom);

  return (
    <aside className="w-12 border-r border-[#2B2B2B] bg-[#181818] flex flex-col justify-between items-center py-1 z-20 select-none">
      {/* Top Group */}
      <div className="flex flex-col items-center w-full">
        {topItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.id === 'terminal'
              ? isTerminalOpen
              : item.id === 'agent'
              ? isAgentPanelOpen
              : activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.onClickCustom) {
                  item.onClickCustom();
                } else {
                  setActiveView(item.id);
                }
              }}
              className={clsx(
                'relative w-12 h-11 flex items-center justify-center transition-colors group cursor-pointer',
                isActive
                  ? 'text-[#FFFFFF]'
                  : 'text-[#858585] hover:text-[#CCCCCC]'
              )}
            >
              {/* Active Indicator Bar (VS Code left bar) */}
              {isActive && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#007ACC]" />
              )}

              <Icon size={20} className="stroke-[1.6]" />

              {/* Optional tiny badge */}
              {item.badge && (
                <span className="absolute top-1.5 right-1.5 px-1 text-[8px] font-mono font-bold rounded-full bg-[#007ACC] text-[#FFFFFF]">
                  {item.badge}
                </span>
              )}

              {/* Tooltip */}
              <div className="absolute left-13 px-2 py-1 bg-[#252526] border border-[#2B2B2B] rounded-sm text-[11px] font-sans text-[#FFFFFF] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Group */}
      <div className="flex flex-col items-center w-full pt-1 border-t border-[#2B2B2B]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={item.onClickCustom}
              className="relative w-12 h-11 flex items-center justify-center text-[#858585] hover:text-[#FFFFFF] transition-colors group cursor-pointer"
            >
              <Icon size={20} className="stroke-[1.6]" />
              <div className="absolute left-13 px-2 py-1 bg-[#252526] border border-[#2B2B2B] rounded-sm text-[11px] font-sans text-[#FFFFFF] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
