import React from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { ToolCallItem } from './ToolCallItem';
import { Activity, Clock } from 'lucide-react';

export const AgentActivityFeed: React.FC = () => {
  const { currentTask, selectedToolCall, setSelectedToolCall } = useAgentStore();

  return (
    <div className="rounded-sm border border-[#2B2B2B] bg-[#181818] p-2.5 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Activity size={13} className="text-[#007ACC]" />
          <span className="text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider font-mono">
            AGENT ACTIVITY
          </span>
        </div>
        <span className="text-[10px] font-mono text-[#858585]">Stream</span>
      </div>

      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {currentTask.activities.map((act, idx) => {
          if (act.toolCall) {
            return (
              <ToolCallItem
                key={act.toolCall.id || idx}
                toolCall={act.toolCall}
                isSelected={selectedToolCall?.id === act.toolCall.id}
                onSelect={() => setSelectedToolCall(act.toolCall || null)}
              />
            );
          }

          return (
            <div
              key={idx}
              className="px-2 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-xs font-mono flex items-start gap-2 text-[#CCCCCC]"
            >
              <div className="flex items-center gap-1 text-[10px] text-[#858585] flex-shrink-0 mt-0.5">
                <Clock size={10} />
                <span>{act.timestamp}</span>
              </div>
              <span className="leading-snug">{act.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
