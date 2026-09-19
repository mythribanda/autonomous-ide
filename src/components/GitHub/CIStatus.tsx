import React, { useEffect, useState } from 'react';
import { useGitHubStore } from '../../store/githubStore';
import { useProjectStore } from '../../store/projectStore';
import { CheckCircle2, XCircle, RefreshCw, HelpCircle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';

interface CIStatusProps {
  compact?: boolean;
  className?: string;
}

export const CIStatus: React.FC<CIStatusProps> = ({ compact = false, className = '' }) => {
  const { projectId } = useProjectStore();
  const { ciStatus, fetchCIStatus, connected } = useGitHubStore();
  const [isOpen, setIsOpen] = useState(false);

  // Poll CI status every 30 seconds
  useEffect(() => {
    if (!projectId) return;
    fetchCIStatus(projectId);

    const interval = setInterval(() => {
      fetchCIStatus(projectId);
    }, 30000);

    return () => clearInterval(interval);
  }, [projectId, fetchCIStatus]);

  if (!ciStatus || ciStatus.status === 'unknown') {
    if (compact) {
      return (
        <span
          className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-[#858585] bg-white/5 border border-[#2B2B2B]',
            className
          )}
          title="CI Status: Not configured or no check runs detected"
        >
          <HelpCircle size={11} />
          <span>CI: Unknown</span>
        </span>
      );
    }
    return null;
  }

  const status = ciStatus.status;
  const isPassing = status === 'passing';
  const isFailing = status === 'failing';
  const isRunning = status === 'running';

  const badgeConfig = {
    passing: {
      color: 'text-[#89D185]',
      bg: 'bg-[#89D185]/15',
      border: 'border-[#89D185]/30',
      icon: CheckCircle2,
      label: 'Passing'
    },
    failing: {
      color: 'text-[#F14C4C]',
      bg: 'bg-[#F14C4C]/15',
      border: 'border-[#F14C4C]/30',
      icon: XCircle,
      label: 'Failing'
    },
    running: {
      color: 'text-[#CCA700]',
      bg: 'bg-[#CCA700]/15',
      border: 'border-[#CCA700]/30',
      icon: RefreshCw,
      label: 'Running'
    }
  }[status] || {
    color: 'text-[#858585]',
    bg: 'bg-white/5',
    border: 'border-[#2B2B2B]',
    icon: HelpCircle,
    label: 'Unknown'
  };

  const Icon = badgeConfig.icon;

  if (compact) {
    return (
      <div className={clsx('relative inline-block', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={clsx(
            'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer',
            badgeConfig.bg,
            badgeConfig.border,
            badgeConfig.color
          )}
          title={`GitHub Actions: ${badgeConfig.label} (${ciStatus.successful_runs}/${ciStatus.total_runs} passing)`}
        >
          <Icon size={12} className={clsx(isRunning && 'animate-spin')} />
          <span className="font-semibold">CI: {badgeConfig.label}</span>
        </button>

        {isOpen && ciStatus.runs && ciStatus.runs.length > 0 && (
          <div className="absolute bottom-6 right-0 w-64 bg-[#252526] border border-[#2B2B2B] rounded-md shadow-2xl p-2.5 z-50 text-xs font-sans text-[#CCCCCC] space-y-1.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#2B2B2B] font-semibold text-white">
              <span>GitHub Actions Runs</span>
              <span className="text-[10px] text-[#858585]">
                {ciStatus.successful_runs}/{ciStatus.total_runs} passed
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {ciStatus.runs.map((run, idx) => (
                <div key={idx} className="flex items-center justify-between py-0.5 text-[11px]">
                  <span className="truncate max-w-[140px] text-[#CCCCCC]">{run.name}</span>
                  <span
                    className={clsx(
                      'text-[10px] font-mono capitalize',
                      run.conclusion === 'success'
                        ? 'text-[#89D185]'
                        : run.conclusion === 'failure'
                        ? 'text-[#F14C4C]'
                        : 'text-[#CCA700]'
                    )}
                  >
                    {run.conclusion || run.status || 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Expanded card view (for Project Dashboard or GitHub Panel)
  return (
    <div className={clsx('p-4 rounded-xl bg-[#181818] border border-[#2B2B2B] space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={clsx(badgeConfig.color, isRunning && 'animate-spin')} />
          <span className="text-xs font-bold text-white uppercase tracking-wider">GitHub Actions CI</span>
        </div>
        <span className={clsx('px-2 py-0.5 rounded text-[11px] font-mono border font-semibold', badgeConfig.bg, badgeConfig.border, badgeConfig.color)}>
          {badgeConfig.label}
        </span>
      </div>

      <div className="text-xs text-[#858585] flex items-center justify-between pt-1">
        <span>{ciStatus.total_runs} Workflow Checks</span>
        <span className="font-mono text-[11px] text-[#89D185]">{ciStatus.successful_runs} Succeeded</span>
        {ciStatus.failed_runs > 0 && (
          <span className="font-mono text-[11px] text-[#F14C4C]">{ciStatus.failed_runs} Failed</span>
        )}
      </div>

      {ciStatus.runs && ciStatus.runs.length > 0 && (
        <div className="pt-2 border-t border-[#252526] space-y-1.5">
          {ciStatus.runs.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#A6A6A6] truncate max-w-[180px]">{r.name}</span>
              <span className={clsx('text-[11px]', r.conclusion === 'success' ? 'text-[#89D185]' : 'text-[#F14C4C]')}>
                {r.conclusion || r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
