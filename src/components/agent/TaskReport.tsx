import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useUIStore } from '../../stores/uiStore';
import {
  CheckCircle2,
  XCircle,
  FileCode,
  ShieldCheck,
  RotateCcw,
  UserCheck,
  Clock,
  GitCommit,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const TaskReport: React.FC = () => {
  const { taskReport } = useAgentStore();
  const { setActiveView } = useUIStore();

  if (!taskReport) return null;

  const {
    task,
    status,
    filesChanged,
    testsPassed,
    testsFailed,
    buildStatus,
    recoveryAttempts,
    humanInterventions,
    executionTimeSeconds,
    gitCheckpoint
  } = taskReport;

  const isSuccess = status === 'completed';

  return (
    <div className="rounded-sm border border-[#2B2B2B] bg-[#181818] p-3 text-xs font-sans select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2B2B2B] pb-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2 size={16} className="text-emerald-400" />
          ) : (
            <XCircle size={16} className="text-rose-400" />
          )}
          <h3 className="font-semibold text-white tracking-wide font-mono text-xs uppercase">
            TASK COMPLETED
          </h3>
          <Badge variant={isSuccess ? 'emerald' : 'rose'} size="xs">
            {status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Task Title */}
      <div className="p-2 rounded bg-[#202020] border border-[#2B2B2B]">
        <span className="text-[10px] font-mono text-zinc-500 uppercase block">Task Requirement</span>
        <span className="font-medium text-white text-xs leading-snug">"{task}"</span>
      </div>

      {/* Structured Metrics Table */}
      <div className="border border-[#2B2B2B] rounded divide-y divide-[#2B2B2B] text-[11px] font-mono">
        {/* Status */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1C1C1D]">
          <span className="text-zinc-400">Status</span>
          <span className={isSuccess ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {status}
          </span>
        </div>

        {/* Files Changed */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <FileCode size={11} className="text-sky-400" />
            Files Changed
          </span>
          <span className="text-white font-medium">{filesChanged}</span>
        </div>

        {/* Tests Passed / Failed */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1C1C1D]">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck size={11} className="text-emerald-400" />
            Tests
          </span>
          <span className="text-zinc-200">
            <span className="text-emerald-400">{testsPassed} passed</span>
            {testsFailed > 0 && <span className="text-rose-400 ml-1.5">/ {testsFailed} failed</span>}
          </span>
        </div>

        {/* Build Status */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-zinc-400">Build</span>
          <span className={buildStatus === 'success' ? 'text-emerald-400' : buildStatus === 'failed' ? 'text-rose-400' : 'text-zinc-400'}>
            {buildStatus}
          </span>
        </div>

        {/* Recovery Attempts */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1C1C1D]">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <RotateCcw size={11} className="text-amber-400" />
            Recovery Attempts
          </span>
          <span className="text-white">{recoveryAttempts}</span>
        </div>

        {/* Human Interventions */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <UserCheck size={11} className="text-blue-400" />
            Human Interventions
          </span>
          <span className="text-white">{humanInterventions}</span>
        </div>

        {/* Execution Time */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1C1C1D]">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Clock size={11} className="text-zinc-400" />
            Execution Time
          </span>
          <span className="text-white">{executionTimeSeconds}s</span>
        </div>

        {/* Git Checkpoint */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <GitCommit size={11} className="text-emerald-400" />
            Git Checkpoint
          </span>
          {gitCheckpoint ? (
            <button
              onClick={() => setActiveView('git')}
              className="text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1 underline decoration-dotted"
            >
              <span>{gitCheckpoint.substring(0, 7)}</span>
              <ExternalLink size={10} />
            </button>
          ) : (
            <span className="text-zinc-500">None</span>
          )}
        </div>
      </div>
    </div>
  );
};
