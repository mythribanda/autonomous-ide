import React from 'react';
import { useAgentStore } from '../../stores/agentStore';
import { Check, Loader2, Play, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

export const AgentPlan: React.FC = () => {
  const { currentTask, runNextStep } = useAgentStore();

  return (
    <div className="rounded-sm border border-[#2B2B2B] bg-[#181818] p-2.5 select-none">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider font-mono">
            PLAN
          </span>
          <span className="text-[10px] font-mono text-[#858585]">
            ({currentTask.plan.filter((s) => s.status === 'completed').length}/{currentTask.plan.length})
          </span>
        </div>

        <button
          onClick={runNextStep}
          className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#3794FF] text-[10px] font-mono flex items-center gap-1 border border-[#2B2B2B] transition-colors"
          title="Simulate step forward"
        >
          <Play size={10} /> Step
        </button>
      </div>

      {/* Steps List */}
      <div className="space-y-1 text-xs">
        {currentTask.plan.map((step) => {
          const isCompleted = step.status === 'completed';
          const isInProgress = step.status === 'in_progress';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={step.id}
              className={clsx(
                'flex items-center gap-2 px-2 py-1 rounded-sm transition-colors',
                isInProgress
                  ? 'bg-[#252526] text-[#FFFFFF] border-l-2 border-l-[#007ACC]'
                  : isCompleted
                  ? 'text-[#858585]'
                  : 'text-[#858585]'
              )}
            >
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <span className="text-[#89D185] font-bold text-xs">✓</span>
                ) : isInProgress ? (
                  <Loader2 size={11} className="text-[#007ACC] animate-spin" />
                ) : isFailed ? (
                  <AlertCircle size={11} className="text-[#F14C4C]" />
                ) : (
                  <span className="text-[#858585] text-xs">○</span>
                )}
              </div>

              {/* Title */}
              <div className="flex-1 truncate">
                <span
                  className={clsx(
                    'font-mono text-xs',
                    isCompleted && 'text-[#858585]',
                    isInProgress && 'text-[#FFFFFF] font-medium',
                    !isCompleted && !isInProgress && 'text-[#CCCCCC]'
                  )}
                >
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
