import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useUIStore } from '../../stores/uiStore';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  GitCommit,
  RotateCcw,
  FileCode,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const VerificationReport: React.FC = () => {
  const { verificationReport, taskReport } = useAgentStore();
  const { setActiveView } = useUIStore();

  if (!verificationReport) return null;

  const {
    build_status,
    test_status,
    lint_status,
    requirements_met = [],
    files_changed_count = 0,
    overall_success,
    summary
  } = verificationReport;

  const commitHash = taskReport?.gitCheckpoint || null;
  const executionTime = taskReport?.executionTimeSeconds || 0;
  const recoveryCount = taskReport?.recoveryAttempts || 0;

  const handleOpenGit = () => {
    setActiveView('git');
  };

  return (
    <div className="rounded-sm border border-[#2B2B2B] bg-[#181818] p-3 text-xs font-sans select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2B2B2B] pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className={overall_success ? 'text-emerald-400' : 'text-rose-400'} />
          <h3 className="font-semibold text-white tracking-wide font-mono text-xs">
            VERIFICATION REPORT
          </h3>
          <Badge variant={overall_success ? 'emerald' : 'rose'} size="xs">
            {overall_success ? 'PASSED' : 'FAILED'}
          </Badge>
        </div>
        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
          <Clock size={11} />
          <span>{executionTime}s total</span>
        </div>
      </div>

      {/* Summary Banner */}
      <div className={`p-2 rounded border leading-relaxed ${
        overall_success
          ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
          : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
      }`}>
        {summary}
      </div>

      {/* Core Verification Checks (Build, Test, Lint) */}
      <div className="grid grid-cols-3 gap-2">
        {/* Build Check */}
        <div className="p-2 rounded bg-[#202020] border border-[#2B2B2B] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-zinc-400">Build</span>
            {build_status?.passed ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : (
              <XCircle size={13} className="text-rose-400" />
            )}
          </div>
          <p className="text-[11px] font-mono text-zinc-200 truncate" title={build_status?.output}>
            {build_status?.passed ? 'Compiled clean' : (build_status?.error || 'Failed')}
          </p>
        </div>

        {/* Test Check */}
        <div className="p-2 rounded bg-[#202020] border border-[#2B2B2B] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-zinc-400">Tests</span>
            {test_status?.passed ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : (
              <XCircle size={13} className="text-rose-400" />
            )}
          </div>
          <p className="text-[11px] font-mono text-zinc-200 truncate" title={test_status?.output}>
            {test_status?.passed ? 'All tests pass' : (test_status?.error || 'Failed')}
          </p>
        </div>

        {/* Lint Check */}
        <div className="p-2 rounded bg-[#202020] border border-[#2B2B2B] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-mono text-zinc-400">Lint</span>
            {lint_status?.passed ? (
              <CheckCircle2 size={13} className="text-emerald-400" />
            ) : (
              <XCircle size={13} className="text-rose-400" />
            )}
          </div>
          <p className="text-[11px] font-mono text-zinc-200 truncate" title={lint_status?.output}>
            {lint_status?.passed ? '0 lint errors' : (lint_status?.error || 'Lint warnings')}
          </p>
        </div>
      </div>

      {/* Acceptance Criteria Checklist */}
      {requirements_met.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-zinc-400 uppercase font-semibold tracking-wider">
            Requirement Criteria Checklist ({requirements_met.filter(r => r.met).length}/{requirements_met.length})
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {requirements_met.map((item, idx) => (
              <div
                key={idx}
                className="p-1.5 rounded bg-[#1C1C1D] border border-[#2B2B2B] flex items-start gap-2 text-[11px]"
              >
                {item.met ? (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={13} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <span className={item.met ? 'text-zinc-200' : 'text-zinc-400 line-through'}>
                    {item.criterion}
                  </span>
                  {item.evidence && (
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                      Evidence: {item.evidence}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Metrics Footer */}
      <div className="pt-2 border-t border-[#2B2B2B] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileCode size={12} className="text-sky-400" />
            {files_changed_count} files changed
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw size={12} className="text-amber-400" />
            {recoveryCount} recovery cycle{recoveryCount === 1 ? '' : 's'}
          </span>
        </div>

        {commitHash && (
          <button
            onClick={handleOpenGit}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors font-mono underline decoration-dotted"
            title="Inspect checkpoint in Git view"
          >
            <GitCommit size={12} />
            <span>{commitHash.substring(0, 7)}</span>
            <ExternalLink size={10} />
          </button>
        )}
      </div>
    </div>
  );
};
