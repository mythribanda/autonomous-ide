import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Search, Play, FileCode, Terminal, GitBranch, Cpu, ShieldCheck, CheckCircle, RefreshCw, X } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveView } = useUIStore();
  const { openFiles, setActiveFile } = useProjectStore();
  const { runNextStep, pauseAgent, resumeAgent, isPaused } = useAgentStore();
  const { toggleOpen: toggleTerminal, executeCommand } = useTerminalStore();
  const { openSettings } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const actions = [
    {
      id: 'agent-step',
      title: 'Agent: Step Forward Execution Plan',
      category: 'Autonomous Agent',
      icon: Play,
      action: () => {
        runNextStep();
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'agent-pause',
      title: isPaused ? 'Agent: Resume Execution' : 'Agent: Pause Execution',
      category: 'Autonomous Agent',
      icon: isPaused ? Play : RefreshCw,
      action: () => {
        if (isPaused) resumeAgent();
        else pauseAgent();
        setCommandPaletteOpen(false);
      }
    },

    {
      id: 'view-intelligence',
      title: 'Navigate: Open Project Intelligence & Graph',
      category: 'Navigation',
      icon: Cpu,
      action: () => {
        setActiveView('intelligence');
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'view-tests',
      title: 'Navigate: Open Verification Suite',
      category: 'Navigation',
      icon: CheckCircle,
      action: () => {
        setActiveView('verification');
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'view-git',
      title: 'Navigate: Open Git Checkpoints & Diff',
      category: 'Navigation',
      icon: GitBranch,
      action: () => {
        setActiveView('git');
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'view-security',
      title: 'Navigate: Open Autonomy & Security Permissions',
      category: 'Navigation',
      icon: ShieldCheck,
      action: () => {
        setActiveView('security');
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'run-npm-test',
      title: 'Terminal: Run `npm test`',
      category: 'Terminal',
      icon: Terminal,
      action: () => {
        toggleTerminal();
        executeCommand('npm test');
        setCommandPaletteOpen(false);
      }
    },
    {
      id: 'open-settings',
      title: 'Settings: Open Workspace & Model Configuration',
      category: 'System',
      icon: FileCode,
      action: () => {
        openSettings();
        setCommandPaletteOpen(false);
      }
    }
  ];

  const fileActions = openFiles.map((file) => ({
    id: `file-${file.id}`,
    title: `File: ${file.name}`,
    category: 'Editor Tabs',
    icon: FileCode,
    action: () => {
      setActiveFile(file.id);
      setActiveView('explorer');
      setCommandPaletteOpen(false);
    }
  }));

  const allItems = [...actions, ...fileActions];
  const filteredItems = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-black/50"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[#1E1E1E] border border-[#007ACC] rounded-sm shadow-2xl overflow-hidden animate-in fade-in duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-2.5 border-b border-[#2B2B2B] bg-[#181818] flex items-center gap-2.5">
          <Search size={16} className="text-[#858585]" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search files..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
              } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
                e.preventDefault();
                filteredItems[selectedIndex].action();
              } else if (e.key === 'Escape') {
                setCommandPaletteOpen(false);
              }
            }}
            className="w-full bg-transparent text-xs text-[#FFFFFF] placeholder-[#858585] focus:outline-none font-sans"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF]"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-1 space-y-0.5">
          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#858585]">No matching commands found</div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-1.5 rounded-sm cursor-pointer text-xs font-sans transition-colors ${
                    isSelected ? 'bg-[#264F78] text-[#FFFFFF]' : 'text-[#CCCCCC] hover:bg-[#2A2D2E]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={14} className={isSelected ? 'text-[#FFFFFF]' : 'text-[#858585]'} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-[#E0E0E0]' : 'text-[#858585]'}`}>
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-1.5 border-t border-[#2B2B2B] bg-[#181818] flex items-center justify-between text-[11px] text-[#858585] font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc dismiss</span>
          </div>
          <span>AutonomousDev</span>
        </div>
      </div>
    </div>
  );
};
