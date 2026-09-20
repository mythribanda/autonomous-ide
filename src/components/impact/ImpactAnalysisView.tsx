import React, { useState } from 'react';
import { useImpactStore } from '../../stores/impactStore';
import { useAgentStore } from '../../stores/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { ImpactGraph } from '../Visualization';
import { MetricCard } from '../common/MetricCard';
import { Badge } from '../common/Badge';
import {
  Radar,
  AlertTriangle,
  FileCode,
  CheckCircle2,
  Bot,
  Search,
  Play,
  Server,
  Layers,
  Database,
  TestTube,
  GitPullRequest,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';

export const ImpactAnalysisView: React.FC = () => {
  const {
    report,
    task,
    selectedFile,
    setSelectedFile,
    isPlanApproved,
    approveImpactPlan,
    fetchImpactAnalysis,
    isLoading,
    error
  } = useImpactStore();

  const { startNewTask } = useAgentStore();
  const { setActiveView, addToast } = useUIStore();

  const [reqInput, setReqInput] = useState(task || '');

  const handleRunAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reqInput.trim()) return;
    await fetchImpactAnalysis(reqInput.trim());
  };

  const handleApprove = () => {
    approveImpactPlan();
    const effectiveTask = task || reqInput || 'Execute validated code changes';
    startNewTask(effectiveTask);
    setActiveView('explorer');
    addToast({
      type: 'success',
      title: 'Impact Plan Approved',
      message: `Executing autonomous changes for: "${effectiveTask}"`
    });
  };

  const getRiskBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return { label: 'LOW RISK', variant: 'emerald' as const, icon: ShieldCheck };
      case 'medium':
        return { label: 'MEDIUM RISK', variant: 'amber' as const, icon: AlertTriangle };
      case 'high':
      default:
        return { label: 'HIGH RISK', variant: 'rose' as const, icon: ShieldAlert };
    }
  };

  const totalAffectedCount = report
    ? report.directly_affected_files.length + report.transitively_affected_files.length
    : 0;

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
              {report ? (
                <Badge variant={getRiskBadge(report.risk_level).variant} size="xs">
                  {getRiskBadge(report.risk_level).label}
                </Badge>
              ) : (
                <Badge variant="amber" size="xs">
                  Blast Radius Scanner
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Code modification blast radius analysis for:{' '}
              <span className="text-[#CCCCCC] font-mono">
                "{task || reqInput || 'Enter requirement below'}"
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Requirement Input Bar */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
        <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider flex items-center gap-1.5">
          <Search size={13} className="text-[#007ACC]" />
          <span>Simulate Requirement Blast Radius</span>
        </div>
        <form onSubmit={handleRunAnalysis} className="flex gap-2">
          <input
            type="text"
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            placeholder="e.g. Add attendance tracking to student model, or modify auth routes..."
            className="flex-1 px-3 py-1.5 rounded-sm bg-[#252526] border border-[#2B2B2B] text-xs text-[#FFFFFF] placeholder-[#6E7681] focus:outline-none focus:border-[#007ACC]"
          />
          <button
            type="submit"
            disabled={isLoading || !reqInput.trim()}
            className="px-3.5 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] disabled:opacity-50 text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 transition-colors font-sans"
          >
            <Play size={12} fill="currentColor" />
            <span>{isLoading ? 'Analyzing...' : 'Predict Impact'}</span>
          </button>
        </form>
        {error && (
          <div className="text-[#F85149] text-[11px] font-mono pt-1">
            {error}
          </div>
        )}
      </div>

      {!report ? (
        <div className="p-12 rounded-sm bg-[#181818] border border-[#2B2B2B] text-center text-[#858585] space-y-2">
          <Radar size={32} className="mx-auto text-[#444444]" />
          <h3 className="text-sm font-semibold text-[#CCCCCC]">No Active Impact Report</h3>
          <p className="max-w-md mx-auto text-xs text-[#858585]">
            Enter a feature requirement or task description above and click "Predict Impact" to inspect affected files, dependencies, routes, and risk levels before modifying code.
          </p>
        </div>
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <MetricCard
              label="Direct Files"
              value={report.directly_affected_files.length}
              icon={FileCode}
              accentColor="cyan"
            />
            <MetricCard
              label="Transitive Files"
              value={report.transitively_affected_files.length}
              icon={GitPullRequest}
              accentColor="amber"
            />
            <MetricCard
              label="API & DB Touchpoints"
              value={report.affected_api_routes.length + report.affected_database_models.length}
              icon={Server}
              accentColor="rose"
            />
            <MetricCard
              label="Tests Recommended"
              value={report.tests_to_run.length}
              icon={CheckCircle2}
              accentColor="emerald"
            />
          </div>

          {/* Risk Evaluation Rationale */}
          {report.risk_reasons && report.risk_reasons.length > 0 && (
            <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
              <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider pb-1 border-b border-[#2B2B2B]">
                Risk Assessment Rationale ({report.risk_level.toUpperCase()} RISK)
              </div>
              <ul className="space-y-1 pt-1">
                {report.risk_reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-[#A0A0A0]">
                    <span className="text-[#007ACC] mt-0.5">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected Files Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Directly Affected */}
            <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
                <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <FileCode size={13} className="text-[#3794FF]" />
                  <span>Directly Affected Files ({report.directly_affected_files.length})</span>
                </h3>
              </div>
              <div className="space-y-1 pt-1">
                {report.directly_affected_files.length === 0 ? (
                  <div className="text-[11px] text-[#858585]">No directly affected files identified</div>
                ) : (
                  report.directly_affected_files.map((file) => {
                    const isSelected = selectedFile === file;
                    return (
                      <div
                        key={file}
                        onClick={() => setSelectedFile(file)}
                        className={clsx(
                          'px-2.5 py-1.5 rounded-sm border font-mono text-xs cursor-pointer transition-all flex items-center justify-between',
                          isSelected
                            ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                            : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                        )}
                      >
                        <span className="truncate">{file}</span>
                        <Badge variant="cyan" size="xs">Direct</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Transitively Affected */}
            <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
                <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider flex items-center gap-1.5">
                  <GitPullRequest size={13} className="text-[#E3B341]" />
                  <span>Transitively Affected Files ({report.transitively_affected_files.length})</span>
                </h3>
              </div>
              <div className="space-y-1 pt-1 max-h-56 overflow-y-auto">
                {report.transitively_affected_files.length === 0 ? (
                  <div className="text-[11px] text-[#858585]">No transitive dependencies detected</div>
                ) : (
                  report.transitively_affected_files.map((file) => {
                    const isSelected = selectedFile === file;
                    return (
                      <div
                        key={file}
                        onClick={() => setSelectedFile(file)}
                        className={clsx(
                          'px-2.5 py-1.5 rounded-sm border font-mono text-xs cursor-pointer transition-all flex items-center justify-between',
                          isSelected
                            ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                            : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#858585]'
                        )}
                      >
                        <span className="truncate">{file}</span>
                        <Badge variant="amber" size="xs">Transitive</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Touchpoint Surfaces: Routes, Components, DB Models */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#CCCCCC]">
                <Server size={13} className="text-[#E3B341]" />
                <span>API Routes ({report.affected_api_routes.length})</span>
              </div>
              {report.affected_api_routes.length === 0 ? (
                <div className="text-[10px] text-[#858585]">None affected</div>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto pt-1">
                  {report.affected_api_routes.map((rt, i) => (
                    <li key={i} className="text-[10px] font-mono text-[#E3B341] px-1.5 py-0.5 rounded-sm bg-[#252526] truncate">
                      {rt}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#CCCCCC]">
                <Layers size={13} className="text-[#58A6FF]" />
                <span>Components ({report.affected_components.length})</span>
              </div>
              {report.affected_components.length === 0 ? (
                <div className="text-[10px] text-[#858585]">None affected</div>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto pt-1">
                  {report.affected_components.map((comp, i) => (
                    <li key={i} className="text-[10px] font-mono text-[#58A6FF] px-1.5 py-0.5 rounded-sm bg-[#252526] truncate">
                      {comp}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#CCCCCC]">
                <Database size={13} className="text-[#D2A8FF]" />
                <span>Database Models ({report.affected_database_models.length})</span>
              </div>
              {report.affected_database_models.length === 0 ? (
                <div className="text-[10px] text-[#858585]">None affected</div>
              ) : (
                <ul className="space-y-1 max-h-36 overflow-y-auto pt-1">
                  {report.affected_database_models.map((mod, i) => (
                    <li key={i} className="text-[10px] font-mono text-[#D2A8FF] px-1.5 py-0.5 rounded-sm bg-[#252526] truncate">
                      {mod}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Interactive Blast Radius Topology */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider flex items-center gap-1.5">
              <Radar size={13} className="text-[#007ACC]" />
              <span>Topological Blast Radius & Force-Directed Graph</span>
            </div>
            <div className="h-[460px] w-full">
              <ImpactGraph height={460} showControls={true} />
            </div>
          </div>

          {/* Recommended Tests */}
          {report.tests_to_run && report.tests_to_run.length > 0 && (
            <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
              <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-[#2B2B2B]">
                <TestTube size={13} className="text-[#89D185]" />
                <span>Recommended Tests to Execute ({report.tests_to_run.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {report.tests_to_run.map((testFile, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[11px] font-mono text-[#CCCCCC] truncate"
                    title={testFile}
                  >
                    {testFile}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review & Approval Action Footer */}
          <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-semibold text-[#CCCCCC] font-mono">
                {isPlanApproved ? '✓ Impact plan approved for execution' : 'Autonomous execution waiting on human review'}
              </h4>
              <p className="text-[11px] text-[#858585] mt-0.5">
                Estimated ~{report.estimated_files_to_change} file(s) to change directly across {totalAffectedCount} affected modules.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('explorer')}
                className="px-3.5 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-medium transition-colors"
              >
                Review in Explorer
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
        </>
      )}
    </div>
  );
};

