import React from 'react';
import { CheckCircle2, RefreshCw, UserCheck, Timer, TrendingUp, ShieldAlert } from 'lucide-react';

export interface AIStatsProps {
  tasksCompleted: number;
  tasksFailed: number;
  recoveryAttempts: number;
  recoveryTotal?: number;
  humanInterventions: number;
  avgExecutionTimeSeconds: number;
}

export const AIStats: React.FC<AIStatsProps> = ({
  tasksCompleted,
  tasksFailed,
  recoveryAttempts,
  recoveryTotal,
  humanInterventions,
  avgExecutionTimeSeconds
}) => {
  const totalTasks = tasksCompleted + tasksFailed;
  const successRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 100;
  
  // Format execution time: e.g. 24s or 1m 15s
  const formatTime = (secs: number) => {
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
  };

  const effectiveRecoveryTotal = recoveryTotal ?? (recoveryAttempts > 0 ? recoveryAttempts : 0);
  const recoveryRatioStr = effectiveRecoveryTotal > 0
    ? `${recoveryAttempts} recovered / ${effectiveRecoveryTotal} total`
    : '0 issues';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#858585]">
          AI Statistics & Efficiency
        </h3>
        <span className="text-[11px] font-mono text-[#5A5A5A]">
          Overall Success: <span className="text-[#89D185] font-semibold">{successRate}%</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Tasks Completed (Green) */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] hover:border-[#89D185]/40 transition-colors">
          <div className="flex items-center justify-between text-[#858585] mb-2">
            <span className="text-xs font-medium">Tasks Completed</span>
            <div className="p-1.5 rounded-md bg-[#89D185]/10 text-[#89D185]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#89D185]">
              {tasksCompleted}
            </span>
            {tasksFailed > 0 && (
              <span className="text-[11px] font-mono text-[#F14C4C]">
                ({tasksFailed} failed)
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#5A5A5A] mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#89D185]" />
            <span>Autonomous code tasks finalized</span>
          </p>
        </div>

        {/* 2. Recovery Attempts (Yellow) */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] hover:border-[#CCA700]/40 transition-colors">
          <div className="flex items-center justify-between text-[#858585] mb-2">
            <span className="text-xs font-medium">Recovery Attempts</span>
            <div className="p-1.5 rounded-md bg-[#CCA700]/10 text-[#CCA700]">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#CCA700]">
              {recoveryAttempts}
            </span>
            <span className="text-[11px] font-mono text-[#858585]">
              {recoveryRatioStr}
            </span>
          </div>
          <p className="text-[11px] text-[#5A5A5A] mt-1 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-[#CCA700]" />
            <span>Self-healing repairs executed</span>
          </p>
        </div>

        {/* 3. Human Interventions (Blue) */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] hover:border-[#007ACC]/40 transition-colors">
          <div className="flex items-center justify-between text-[#858585] mb-2">
            <span className="text-xs font-medium">Human Interventions</span>
            <div className="p-1.5 rounded-md bg-[#007ACC]/10 text-[#007ACC]">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#007ACC]">
              {humanInterventions}
            </span>
            <span className="text-[11px] font-mono text-[#858585]">
              approvals / pauses
            </span>
          </div>
          <p className="text-[11px] text-[#5A5A5A] mt-1">
            Permission gates & manual reviews
          </p>
        </div>

        {/* 4. Avg Execution Time */}
        <div className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] hover:border-[#C586C0]/40 transition-colors">
          <div className="flex items-center justify-between text-[#858585] mb-2">
            <span className="text-xs font-medium">Avg Execution Time</span>
            <div className="p-1.5 rounded-md bg-[#C586C0]/10 text-[#C586C0]">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-[#C586C0]">
              {formatTime(avgExecutionTimeSeconds)}
            </span>
            <span className="text-[11px] font-mono text-[#858585]">
              per requirement
            </span>
          </div>
          <p className="text-[11px] text-[#5A5A5A] mt-1">
            Plan, synthesize, build & test cycle
          </p>
        </div>
      </div>
    </div>
  );
};
