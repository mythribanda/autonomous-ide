import React from 'react';
import { useImpactStore } from '../../stores/impactStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { MetricCard } from '../common/MetricCard';
import { Badge } from '../common/Badge';
import {
  Radar,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  Bot
} from 'lucide-react';
import { clsx } from 'clsx';

export const ImpactAnalysisView: React.FC = () => {
  const { impact, selectedFile, setSelectedFile, isPlanApproved, approveImpactPlan } = useImpactStore();
  const { startNewTask } = useAgentStore();
  const { setActiveView, addToast } = useUIStore();

  const handleApprove = () => {
    approveImpactPlan();
    startNewTask(impact.task);
    setActiveView('explorer');
    addToast({
      type: 'success',
      title: 'Impact Plan Approved',
      message: `Executing autonomous changes for: "${impact.task}"`
    });
  };

  const getImpactBadgeVariant = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'rose';
      case 'MEDIUM':
        return 'amber';
      case 'TESTS':
        return 'cyan';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <Radar size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                IMPACT ANALYSIS
              </h1>
              <Badge variant="amber" size="xs">
                Blast Radius Scan
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Code modification analysis for:{' '}
              <span className="text-[#CCCCCC] font-mono">"{impact.task}"</span>
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <MetricCard label="Affected Components" value={impact.totalAffected} icon={Radar} accentColor="cyan" />
        <MetricCard label="High Impact" value={impact.highImpact} icon={AlertTriangle} accentColor="rose" />
        <MetricCard label="Medium Impact" value={impact.mediumImpact} icon={FileCode} accentColor="amber" />
        <MetricCard label="Test Suites" value={impact.testImpact} icon={CheckCircle2} accentColor="emerald" />
      </div>

      {/* Affected Files Detailed Breakdown */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
          <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
            AFFECTED FILES & CONFIDENCE SCORES
          </h3>
          <span className="text-[10px] font-mono text-[#858585]">Priority Order</span>
        </div>

        <div className="space-y-1.5">
          {impact.affectedFiles.map((fileItem) => {
            const isSelected = selectedFile === fileItem.file;

            return (
              <div
                key={fileItem.file}
                onClick={() => setSelectedFile(fileItem.file)}
                className={clsx(
                  'p-2.5 rounded-sm border text-xs font-mono cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-2',
                  isSelected
                    ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                    : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={getImpactBadgeVariant(fileItem.impact) as any} size="sm">
                    {fileItem.impact}
                  </Badge>
                  <div>
                    <div className="font-semibold text-[#FFFFFF] truncate text-xs">{fileItem.file}</div>
                    <div className={`text-[11px] font-sans mt-0.5 ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                      {fileItem.reason}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-[#858585]">Confidence</div>
                    <div className="font-bold text-[#3794FF] font-mono text-xs">{fileItem.confidence}%</div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-[#858585]">Est. Delta</div>
                    <div className={`font-mono text-xs ${isSelected ? 'text-[#FFFFFF]' : 'text-[#CCCCCC]'}`}>
                      ~{fileItem.locChangeEstimate} LOC
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Review & Approval Action Footer */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-[#CCCCCC] font-mono">
            {isPlanApproved ? '✓ Impact plan approved for execution' : 'Autonomous execution waiting on human review'}
          </h4>
          <p className="text-[11px] text-[#858585] mt-0.5">
            The agent creates pre-change git checkpoints before mutating files.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('explorer')}
            className="px-3.5 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-medium transition-colors"
          >
            Review Changes
          </button>

          <button
            onClick={handleApprove}
            className="px-4 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Bot size={14} />
            <span>Approve Impact Plan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
