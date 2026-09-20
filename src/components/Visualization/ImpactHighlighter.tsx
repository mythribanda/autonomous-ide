import React, { useState, useEffect } from 'react';
import {
  Radar,
  AlertTriangle,
  Flame,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles
} from 'lucide-react';
import { usePromptStore } from '../../store/promptStore';
import { useImpactStore } from '../../stores/impactStore';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { getProjectContext } from '../../lib/api';
import { FileContext } from '../../types/api';
import { clsx } from 'clsx';

interface ImpactHighlighterProps {
  onFocusAffected?: () => void;
  className?: string;
}

export const ImpactHighlighter: React.FC<ImpactHighlighterProps> = ({
  onFocusAffected,
  className = ''
}) => {
  const { requirement } = usePromptStore();
  const { report, task, fetchImpactAnalysis, isLoading } = useImpactStore();
  const { projectId } = useProjectStore();
  const { setActiveView } = useUIStore();

  const [dismissed, setDismissed] = useState<boolean>(false);
  const [contexts, setContexts] = useState<FileContext[]>([]);
  const [showContextDetails, setShowContextDetails] = useState<boolean>(false);
  const activeText = requirement?.trim() || task?.trim() || '';

  // Reset dismissal when a new requirement is typed
  useEffect(() => {
    if (activeText) {
      setDismissed(false);
    }
  }, [activeText]);

  // Auto-fetch impact and context if requirement is provided
  useEffect(() => {
    if (projectId && activeText && (!report || task !== activeText)) {
      const timer = setTimeout(async () => {
        fetchImpactAnalysis(activeText, projectId);
        try {
          const ctx = await getProjectContext(projectId, activeText, 6);
          setContexts(ctx || []);
        } catch {
          setContexts([]);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [activeText, projectId, report, task]);

  if (dismissed || !activeText) {
    return null;
  }

  const directCount = report?.directly_affected_files?.length || 0;
  const transitiveCount = report?.transitively_affected_files?.length || 0;
  const totalCount = directCount + transitiveCount;
  const riskLevel = (report?.risk_level || 'Medium').toUpperCase();

  const getRiskBadge = () => {
    switch (riskLevel) {
      case 'CRITICAL':
      case 'HIGH':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/80';
      case 'MEDIUM':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/80';
      case 'LOW':
      default:
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
    }
  };

  return (
    <div
      className={clsx(
        'bg-[#1A1A1A]/95 backdrop-blur-md border border-amber-500/40 rounded-lg p-3.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs transition-all animate-in fade-in slide-in-from-top-2',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-md bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
          <Radar size={18} className={isLoading ? 'animate-spin' : 'animate-pulse'} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} />
              Requirement Impact Simulation
            </span>
            <span
              className={clsx(
                'px-2 py-0.2 rounded text-[10px] font-mono font-bold border',
                getRiskBadge()
              )}
            >
              {riskLevel} RISK
            </span>
            {totalCount > 0 && (
              <span className="text-[10px] font-mono text-zinc-400">
                {totalCount} {totalCount === 1 ? 'file' : 'files'} affected ({directCount} direct, {transitiveCount} indirect)
              </span>
            )}
            {contexts.length > 0 && (
              <span className="text-[10px] font-mono text-[#007ACC]/90">
                • {contexts.length} context files retrieved
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-300 line-clamp-1 italic max-w-xl">
            "{activeText}"
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        {onFocusAffected && totalCount > 0 && (
          <button
            onClick={onFocusAffected}
            className="px-3 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900/80 text-rose-200 border border-rose-700/70 font-medium flex items-center gap-1.5 transition-colors text-xs shadow-sm"
          >
            <Flame size={12} className="text-rose-400" />
            <span>Highlight Affected Nodes</span>
          </button>
        )}

        <button
          onClick={() => setActiveView('impact')}
          className="px-3 py-1.5 rounded bg-[#252526] hover:bg-[#323233] text-zinc-200 border border-[#3c3c3c] font-medium flex items-center gap-1.5 transition-colors text-xs"
        >
          <Layers size={12} className="text-[#007ACC]" />
          <span>Full Report</span>
        </button>

        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-[#252526]"
          title="Dismiss banner"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
