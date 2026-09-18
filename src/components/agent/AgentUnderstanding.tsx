import React, { useState } from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { ChevronDown, ChevronUp, Bot } from 'lucide-react';

export const AgentUnderstanding: React.FC = () => {
  const { currentTask } = useAgentStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!currentTask.understandings || currentTask.understandings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-sm border border-[#2B2B2B] bg-[#181818] p-2.5 select-none">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-1.5">
          <Bot size={13} className="text-[#007ACC]" />
          <span className="text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider font-mono">
            UNDERSTANDING
          </span>
        </div>
        <button className="text-[#858585] hover:text-[#CCCCCC]">
          {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-2 space-y-1 text-xs text-[#CCCCCC] pl-1">
          <p className="text-[11px] text-[#858585]">The agent understood:</p>
          <ul className="space-y-1 font-sans">
            {currentTask.understandings.map((item, idx) => (
              <li key={idx} className="flex items-start gap-1.5 text-xs text-[#CCCCCC]">
                <span className="text-[#007ACC] flex-shrink-0">•</span>
                <span className="leading-tight">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
