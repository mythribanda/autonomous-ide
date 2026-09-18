import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import {
  Cpu,
  HardDrive,
  ShieldCheck,
  Palette,
  Check
} from 'lucide-react';

export const SettingsModal: React.FC = () => {
  const { settings, isSettingsOpen, closeSettings, updateSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<'ai' | 'workspace' | 'security' | 'appearance'>('ai');

  const models = [
    { name: 'Qwen 3 4B', ram: 4.8, context: 32768, type: 'Local Ollama' },
    { name: 'Qwen 2.5 Coder 14B', ram: 10.2, context: 65536, type: 'Local Ollama' },
    { name: 'DeepSeek-Coder V2 16B', ram: 12.0, context: 131072, type: 'Local vLLM' },
    { name: 'Claude 3.7 Sonnet (Hybrid)', ram: 0, context: 200000, type: 'Cloud API' }
  ];

  return (
    <Modal
      isOpen={isSettingsOpen}
      onClose={closeSettings}
      title="Settings"
      subtitle="Workspace, local runtime, and model configuration."
      maxWidth="4xl"
    >
      <div className="flex flex-col gap-4 font-sans text-xs">
        {/* Local storage status indicator */}
        <div className="p-2 px-3 rounded-sm bg-[#181818] border border-[#2B2B2B] flex items-center justify-between">
          <span className="text-[#858585] font-mono text-[11px]">Configuration State:</span>
          <Badge variant="amber" size="xs">Local Preferences • Server sync not connected</Badge>
        </div>

        <div className="flex flex-col md:flex-row gap-5">
          {/* Left Tabs */}
          <div className="w-full md:w-44 space-y-0.5 select-none border-b md:border-b-0 md:border-r border-[#2B2B2B] pb-2 md:pb-0 md:pr-2">
          {[
            { id: 'ai', label: 'AI & Model', icon: Cpu },
            { id: 'workspace', label: 'Workspace', icon: HardDrive },
            { id: 'security', label: 'Security', icon: ShieldCheck },
            { id: 'appearance', label: 'Appearance', icon: Palette }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full text-left px-2.5 py-1.5 rounded-sm flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-[#264F78] text-[#FFFFFF] font-medium'
                    : 'text-[#858585] hover:text-[#CCCCCC] hover:bg-[#2A2D2E]'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-[#FFFFFF]' : 'text-[#858585]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 space-y-4">
          {activeTab === 'ai' && (
            <div className="space-y-3.5">
              {/* Provider Selection */}
              <div>
                <label className="text-[10px] text-[#858585] uppercase tracking-wider block mb-1 font-mono">
                  AI RUNTIME PROVIDER
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => updateSettings({ aiProvider: 'local' })}
                    className={`p-3 rounded-sm border cursor-pointer transition-all ${
                      settings.aiProvider === 'local'
                        ? 'bg-[#252526] border-[#007ACC]'
                        : 'bg-[#181818] border-[#2B2B2B] hover:border-[#3C3C3C]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#FFFFFF]">Local Runtime</span>
                      <Badge variant="emerald" size="xs">Recommended</Badge>
                    </div>
                    <p className="text-[11px] text-[#858585] mt-1">
                      Ollama / LMStudio running on your local machine with zero data egress.
                    </p>
                  </div>

                  <div
                    onClick={() => updateSettings({ aiProvider: 'cloud' })}
                    className={`p-3 rounded-sm border cursor-pointer transition-all ${
                      settings.aiProvider === 'cloud'
                        ? 'bg-[#252526] border-[#007ACC]'
                        : 'bg-[#181818] border-[#2B2B2B] hover:border-[#3C3C3C]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#FFFFFF]">Cloud API</span>
                      <Badge variant="default" size="xs">Hybrid</Badge>
                    </div>
                    <p className="text-[11px] text-[#858585] mt-1">
                      Connect to high-parameter reasoning models via API keys.
                    </p>
                  </div>
                </div>
              </div>

              {/* Model Selection */}
              <div>
                <label className="text-[10px] text-[#858585] uppercase tracking-wider block mb-1 font-mono">
                  AVAILABLE LOCAL MODELS
                </label>
                <div className="space-y-1.5">
                  {models.map((m) => {
                    const isSelected = settings.model === m.name;
                    return (
                      <div
                        key={m.name}
                        onClick={() => updateSettings({ model: m.name, ramEstimateGb: m.ram, contextLimit: m.context })}
                        className={`p-2.5 rounded-sm border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                            : 'bg-[#181818] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
                            isSelected ? 'border-[#007ACC] bg-[#007ACC] text-[#FFFFFF]' : 'border-[#858585]'
                          }`}>
                            {isSelected && <Check size={10} className="stroke-[3]" />}
                          </div>
                          <div>
                            <div className="font-medium text-xs text-[#FFFFFF]">{m.name}</div>
                            <div className={`text-[10px] font-mono ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                              {m.type}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <span className={`text-[10px] block ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                              Est. RAM
                            </span>
                            <span className="font-mono text-xs">{m.ram > 0 ? `~${m.ram} GB` : 'Cloud'}</span>
                          </div>
                          <div>
                            <span className={`text-[10px] block ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                              Context
                            </span>
                            <span className="font-mono text-xs">{(m.context / 1024).toFixed(0)}k</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resource Diagnostics */}
              <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#858585] uppercase">Local AI Status</span>
                  <Badge variant="emerald" size="xs" dot>Connected (127.0.0.1:11434)</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#2B2B2B]">
                  <div>Allocated VRAM: <span className="text-[#89D185]">4.8 GB / 16.0 GB</span></div>
                  <div>Inference Latency: <span className="text-[#3794FF]">34 tokens/sec</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#858585] uppercase tracking-wider block mb-1 font-mono">
                  WORKSPACE DIRECTORY
                </label>
                <input
                  type="text"
                  value={settings.workspacePath}
                  onChange={(e) => updateSettings({ workspacePath: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[#FFFFFF] text-xs font-mono focus:outline-none focus:border-[#007ACC]"
                />
              </div>

              <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1">
                <div className="font-semibold text-[#FFFFFF]">Sandbox Isolation</div>
                <p className="text-xs text-[#858585]">
                  The agent is strictly restricted to operations inside this directory. Any attempt to access external paths is automatically blocked by the runtime safety guard.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-3">
              <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1">
                <div className="font-semibold text-[#FFFFFF]">Autonomy & Policy Control</div>
                <p className="text-xs text-[#858585]">
                  Configure permission gates from the Security tab on the activity bar for comprehensive fine-grained control.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-[#858585] uppercase tracking-wider block mb-1 font-mono">
                  THEME PREFERENCE
                </label>
                <div className="p-2.5 rounded-sm bg-[#252526] border border-[#007ACC] flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#FFFFFF]">VS Code Dark (Standard)</div>
                    <div className="text-[11px] text-[#858585]">Official VS Code Dark developer palette</div>
                  </div>
                  <Badge variant="blue" size="xs">Active</Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </Modal>
);
};
