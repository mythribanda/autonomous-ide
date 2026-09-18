import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { ImpactReport as ImpactReportType } from '../../types/api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileCode,
  GitPullRequest,
  Server,
  Layers,
  TestTube,
  Play,
  Search,
  Database,
  ArrowRight
} from 'lucide-react';

interface ImpactReportProps {
  report?: ImpactReportType | null;
  className?: string;
}

export const ImpactReport: React.FC<ImpactReportProps> = ({
  report: propReport,
  className = ''
}) => {
  const storeReport = useProjectStore((s) => s.impactReport);
  const fetchImpact = useProjectStore((s) => s.fetchImpactAnalysis);
  const report = propReport || storeReport;

  const [reqInput, setReqInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const handleRunAnalysis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!reqInput.trim()) return;
    setAnalyzing(true);
    try {
      await fetchImpact(reqInput.trim());
    } finally {
      setAnalyzing(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return {
          label: 'LOW RISK',
          bg: 'bg-[#2EA043]/15 text-[#3FB950] border-[#2EA043]/50',
          icon: ShieldCheck,
          accent: '#3FB950'
        };
      case 'medium':
        return {
          label: 'MEDIUM RISK',
          bg: 'bg-[#D29922]/15 text-[#E3B341] border-[#D29922]/50',
          icon: AlertTriangle,
          accent: '#E3B341'
        };
      case 'high':
      default:
        return {
          label: 'HIGH RISK',
          bg: 'bg-[#DA3633]/15 text-[#F85149] border-[#DA3633]/50',
          icon: ShieldAlert,
          accent: '#F85149'
        };
    }
  };

  return (
    <div className={`space-y-4 font-sans text-xs select-none ${className}`}>
      {/* Search / What-If Bar */}
      <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B]">
        <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Search size={13} className="text-[#007ACC]" />
          <span>Simulate Requirement Blast Radius</span>
        </div>
        <form onSubmit={handleRunAnalysis} className="flex gap-2">
          <input
            type="text"
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            placeholder="e.g. Modify project scanner to add docker inspection or update auth schemas..."
            className="flex-1 px-3 py-1.5 rounded-sm bg-[#252526] border border-[#2B2B2B] text-xs text-[#FFFFFF] placeholder-[#6E7681] focus:outline-none focus:border-[#007ACC]"
          />
          <button
            type="submit"
            disabled={analyzing || !reqInput.trim()}
            className="px-3.5 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] disabled:opacity-50 text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 transition-colors font-sans"
          >
            <Play size={12} fill="currentColor" />
            <span>{analyzing ? 'Analyzing...' : 'Predict Impact'}</span>
          </button>
        </form>
      </div>

      {/* Impact Report Card */}
      {!report ? (
        <div className="p-8 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] text-center text-[#858585] space-y-2">
          <ShieldAlert size={28} className="mx-auto text-[#333333]" />
          <p>No impact analysis generated yet. Enter a requirement above to predict blast radius.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Risk Level Banner */}
          {(() => {
            const badge = getRiskBadge(report.risk_level);
            const IconComponent = badge.icon;
            return (
              <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-sm border ${badge.bg}`}>
                    <IconComponent size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badge.bg}`}>
                        {badge.label}
                      </span>
                      <span className="text-xs font-bold text-[#FFFFFF]">
                        Predicted Blast Radius
                      </span>
                    </div>
                    <p className="text-[11px] text-[#858585] mt-0.5">
                      Estimated {report.estimated_files_to_change} file(s) to change directly across{' '}
                      {report.directly_affected_files.length + report.transitively_affected_files.length} total affected modules.
                    </p>
                  </div>
                </div>

                {/* Stat pills */}
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <div className="px-2.5 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-center">
                    <div className="text-[12px] font-bold text-[#FFFFFF]">{report.directly_affected_files.length}</div>
                    <div className="text-[#858585]">Direct</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-center">
                    <div className="text-[12px] font-bold text-[#FFFFFF]">{report.transitively_affected_files.length}</div>
                    <div className="text-[#858585]">Transitive</div>
                  </div>
                  <div className="px-2.5 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-center">
                    <div className="text-[12px] font-bold text-[#E5C07B]">{report.tests_to_run.length}</div>
                    <div className="text-[#858585]">Tests</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Risk Reasons List */}
          {report.risk_reasons && report.risk_reasons.length > 0 && (
            <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
              <div className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider pb-1 border-b border-[#2B2B2B]">
                Risk Factors & Evaluation Rationale
              </div>
              <ul className="space-y-1.5 pt-1">
                {report.risk_reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[#A0A0A0] text-xs">
                    <span className="text-[#007ACC] mt-0.5">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Affected Files Grid: Direct vs Transitive */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Directly Affected Files */}
            <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#FFFFFF]">
                  <FileCode size={13} className="text-[#61AFEF]" />
                  <span>DIRECTLY AFFECTED ({report.directly_affected_files.length})</span>
                </div>
              </div>
              {report.directly_affected_files.length === 0 ? (
                <div className="text-[#858585] text-[11px] py-1">No direct files identified</div>
              ) : (
                <ul className="space-y-1">
                  {report.directly_affected_files.map((file, idx) => (
                    <li
                      key={idx}
                      className="px-2 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] font-mono text-[11px] text-[#CCCCCC] truncate"
                      title={file}
                    >
                      {file}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Transitively Affected Files */}
            <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#FFFFFF]">
                  <GitPullRequest size={13} className="text-[#E5C07B]" />
                  <span>TRANSITIVELY AFFECTED ({report.transitively_affected_files.length})</span>
                </div>
              </div>
              {report.transitively_affected_files.length === 0 ? (
                <div className="text-[#858585] text-[11px] py-1">No transitive dependencies detected</div>
              ) : (
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {report.transitively_affected_files.map((file, idx) => (
                    <li
                      key={idx}
                      className="px-2 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] font-mono text-[11px] text-[#858585] truncate"
                      title={file}
                    >
                      {file}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Affected Surface: Routes, Components, Models */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Affected Routes */}
            <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
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

            {/* Affected Components */}
            <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
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

            {/* Affected Database Models */}
            <div className="p-3 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
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

          {/* Tests to Run */}
          <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#FFFFFF]">
                <TestTube size={13} className="text-[#98C379]" />
                <span>RECOMMENDED TESTS TO RUN ({report.tests_to_run.length})</span>
              </div>
            </div>
            {report.tests_to_run.length === 0 ? (
              <div className="text-[#858585] text-[11px] py-1">No related test files detected</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                {report.tests_to_run.map((testFile, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-2.5 py-1 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[11px] font-mono text-[#CCCCCC]"
                  >
                    <span className="truncate" title={testFile}>{testFile}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-sm bg-[#98C379]/15 text-[#98C379] border border-[#98C379]/40">
                      Targeted
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
