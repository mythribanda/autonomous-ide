import React from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { AgentUnderstanding } from './AgentUnderstanding';
import { AgentPlan } from './AgentPlan';
import { AgentActivityFeed } from './AgentActivityFeed';
import { InlinePromptComposer } from './InlinePromptComposer';
import { AutonomyLevel } from '../../types';
import {
  Bot,
  Square,
  Play,
  Pause,
  X
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const AgentPanel: React.FC = () => {
  const {
    currentTask,
    stopAgent,
    pauseAgent,
    resumeAgent,
    isPaused
  } = useAgentStore();
  const { isAgentPanelOpen, toggleAgentPanel } = useUIStore();

  if (!isAgentPanelOpen) return null;

  const autonomyLabels: Record<AutonomyLevel, { label: string; desc: string; color: 'cyan' | 'emerald' | 'amber' }> = {
    autonomous: { label: 'Autonomous', desc: 'Auto-executes code & tests within boundary', color: 'cyan' },
    guided: { label: 'Guided', desc: 'Asks approval before write operations', color: 'emerald' },
    assist: { label: 'Assist', desc: 'Suggests changes, developer triggers execution', color: 'amber' }
  };

  const currentAutonomy = autonomyLabels[currentTask.autonomyLevel];

  return (
    <div className="h-full flex flex-col bg-[#181818] border-l border-[#2B2B2B] select-none overflow-hidden text-xs">
      {/* Top Header */}
      <div className="h-8 px-3 border-b border-[#2B2B2B] flex items-center justify-between bg-[#181818]">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-[#007ACC]" />
          <span className="font-semibold text-xs text-[#FFFFFF] uppercase tracking-wider font-mono">
            AI AGENT
          </span>
          <Badge variant="blue" size="xs" dot>
            {currentAutonomy.label} Mode
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          {/* Pause / Resume Controls */}
          {currentTask.status === 'executing' && (
            <button
              onClick={isPaused ? resumeAgent : pauseAgent}
              className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors"
              title={isPaused ? 'Resume Agent' : 'Pause Agent'}
            >
              {isPaused ? <Play size={13} className="text-[#007ACC]" /> : <Pause size={13} />}
            </button>
          )}

          {/* Stop Agent */}
          {currentTask.status !== 'idle' && (
            <button
              onClick={stopAgent}
              className="p-1 rounded-sm text-[#F14C4C] hover:bg-[#F14C4C]/15 transition-colors"
              title="Stop Agent"
            >
              <Square size={13} />
            </button>
          )}

          <button
            onClick={toggleAgentPanel}
            className="p-1 rounded-sm text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {/* Current Task Box */}
        <div className="p-2.5 rounded-sm border border-[#2B2B2B] bg-[#181818]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono font-bold tracking-wider text-[#858585] uppercase">
              TASK
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-[#858585]">{currentTask.progress}%</span>
              <div className="w-16 h-1 bg-[#2B2B2B] rounded-none overflow-hidden">
                <div
                  className="h-full bg-[#007ACC] transition-all duration-300"
                  style={{ width: `${currentTask.progress}%` }}
                />
              </div>
            </div>
          </div>
          <h4 className="text-xs font-semibold text-[#FFFFFF] leading-snug font-sans">
            "{currentTask.title}"
          </h4>
        </div>

        {/* Understanding Section */}
        <AgentUnderstanding />

        {/* Plan Section */}
        <AgentPlan />

        {/* Agent Activity Feed */}
        <AgentActivityFeed />
      </div>

      {/* Bottom Integrated Prompt Composer with Inline Compiler */}
      <InlinePromptComposer />
    </div>
  );
};
