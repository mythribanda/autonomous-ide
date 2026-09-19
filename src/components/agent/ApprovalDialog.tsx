import React from 'react';
import { useAgentStore } from '../../store/agentStore';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Lock
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const ApprovalDialog: React.FC = () => {
  const { approvalRequest, approveStep, stopAgent } = useAgentStore();

  if (!approvalRequest) return null;

  const { tool, args, riskLevel = 'high', message } = approvalRequest;

  const riskBadgeVariant =
    riskLevel === 'high' ? 'rose' : riskLevel === 'medium' ? 'amber' : 'emerald';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1E1E1E] border border-amber-600/70 rounded-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-amber-950/40 border-b border-amber-800/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-sm bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Agent Action Approval Required
              </h3>
              <p className="text-[11px] text-amber-300/80">
                The autonomous agent paused to request explicit confirmation.
              </p>
            </div>
          </div>
          <Badge variant={riskBadgeVariant} size="sm">
            {riskLevel.toUpperCase()} RISK
          </Badge>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5 text-xs text-[#CCCCCC]">
          {message && (
            <div className="p-2.5 bg-amber-950/20 border border-amber-900/50 rounded text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {/* Tool Information */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
              Tool Action
            </span>
            <div className="p-2 bg-[#252526] border border-[#333333] rounded font-mono text-xs text-sky-300 font-medium">
              {tool}
            </div>
          </div>

          {/* Formatted Arguments */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
              Parameters & Targets
            </span>
            <div className="max-h-48 overflow-y-auto p-2.5 bg-[#141414] border border-[#2B2B2B] rounded font-mono text-[11px] text-emerald-400/90 whitespace-pre leading-relaxed">
              {JSON.stringify(args, null, 2)}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 bg-[#181818] border-t border-[#2B2B2B] flex items-center justify-end gap-2 text-xs">
          {/* Deny Button */}
          <button
            onClick={() => stopAgent()}
            className="px-3 py-1.5 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 text-rose-200 font-medium flex items-center gap-1.5 transition-colors"
          >
            <XCircle size={13} />
            <span>Deny → Stop Agent</span>
          </button>

          {/* Allow for Session */}
          <button
            onClick={() => approveStep(true)}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 font-medium flex items-center gap-1.5 transition-colors"
            title="Automatically allow this tool for subsequent steps during this task"
          >
            <Lock size={13} className="text-amber-400" />
            <span>Allow for Session</span>
          </button>

          {/* Allow Once */}
          <button
            onClick={() => approveStep(false)}
            className="px-3.5 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062A3] text-white font-semibold flex items-center gap-1.5 shadow-md transition-colors"
          >
            <CheckCircle2 size={13} />
            <span>Allow This Once</span>
          </button>
        </div>
      </div>
    </div>
  );
};
