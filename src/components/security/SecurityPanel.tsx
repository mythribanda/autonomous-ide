import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Key,
  Lock,
  FileWarning,
  RefreshCw,
  Wrench,
  CheckCircle2,
  FileText,
  Loader2,
  Package,
  AlertOctagon,
  Eye,
  Check
} from 'lucide-react';
import { useProjectStore } from '../../store/projectStore';
import { usePromptStore } from '../../store/promptStore';
import { useUIStore } from '../../stores/uiStore';
import { runSecurityScan, ApiError } from '../../lib/api';
import { SecretScanResult, DependencyScanResult, Vulnerability, SecretMatch } from '../../types/api';

export const SecurityPanel: React.FC = () => {
  const { projectId, currentProject } = useProjectStore();
  const { setRequirement, setIsPanelOpen, compileRequirement } = usePromptStore();
  const { setActiveView } = useUIStore();

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [secretsResult, setSecretsResult] = useState<SecretScanResult>({
    secrets_found: [],
    files_scanned: 0,
    has_env_example_but_no_env: false,
    env_in_gitignore: true
  });

  const [depsResult, setDepsResult] = useState<DependencyScanResult>({
    vulnerabilities: [],
    total_deps: 0,
    outdated_count: 0,
    scan_tool: 'none'
  });

  const [activeSubTab, setActiveSubTab] = useState<'all' | 'secrets' | 'dependencies'>('all');

  const executeScan = async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const report = await runSecurityScan(projectId);
      setSecretsResult(report.secrets);
      setDepsResult(report.dependencies);
    } catch (err: any) {
      console.error('Failed to run security scan', err);
      setError(err?.message || 'Failed to complete security scan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      executeScan();
    }
  }, [projectId]);

  const handleFixVulnerabilities = async () => {
    if (depsResult.vulnerabilities.length === 0) return;

    const items = depsResult.vulnerabilities
      .map(
        (v) =>
          `- ${v.package} (installed: ${v.version}, fix: ${v.fix_version || 'latest'}): ${v.description}`
      )
      .join('\n');

    const promptText = `Fix and upgrade the following vulnerable dependencies in the project:\n${items}\n\nUpdate the package manifest (and lockfile), run security audit, and verify that builds and tests pass cleanly without breaking changes.`;

    setRequirement(promptText);
    setIsPanelOpen(true);
    await compileRequirement(promptText);
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/80';
      case 'high':
        return 'bg-amber-950/80 text-amber-300 border-amber-700/80';
      case 'moderate':
      case 'medium':
        return 'bg-yellow-950/80 text-yellow-300 border-yellow-700/80';
      case 'low':
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const hasSecrets = secretsResult.secrets_found.length > 0;
  const hasVulns = depsResult.vulnerabilities.length > 0;
  const hasEnvIssue = secretsResult.has_env_example_but_no_env || !secretsResult.env_in_gitignore;

  return (
    <div className="flex flex-col h-full bg-[#181818] text-[#CCCCCC] select-none font-sans text-xs">
      {/* Top Header */}
      <div className="p-4 border-b border-[#2B2B2B] bg-[#1E1E1E] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center border shadow-sm ${
              hasSecrets || hasVulns
                ? 'bg-rose-950/50 border-rose-700/50 text-rose-400'
                : 'bg-emerald-950/50 border-emerald-700/50 text-emerald-400'
            }`}
          >
            {hasSecrets || hasVulns ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100 font-mono">
                SECURITY & VULNERABILITY AUDIT
              </h2>
              {hasSecrets ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-700/70">
                  {secretsResult.secrets_found.length} Secrets Exposed
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/70">
                  Zero Secrets
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Continuous detection of exposed credentials, API keys, and vulnerable package dependencies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasVulns && (
            <button
              onClick={handleFixVulnerabilities}
              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors text-xs"
              title="Delegate dependency remediation to the autonomous agent"
            >
              <Wrench size={13} />
              <span>Fix Vulnerabilities with AI Agent</span>
            </button>
          )}

          <button
            onClick={executeScan}
            disabled={loading || !projectId}
            className="px-3 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-semibold flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-50 text-xs"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? 'Scanning...' : 'Run Security Scan'}</span>
          </button>
        </div>
      </div>

      {/* Critical Red Alert Banner if Secrets Found */}
      {hasSecrets && (
        <div className="mx-5 mt-4 p-3.5 bg-rose-950/60 border border-rose-700/80 rounded-md text-rose-200 flex items-start gap-3 shadow-md animate-pulse">
          <AlertOctagon size={18} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-xs text-rose-100 uppercase tracking-wide">
              CRITICAL SECURITY WARNING: Secrets Found in Tracked Source Code
            </h4>
            <p className="text-[11px] text-rose-200/90 leading-relaxed">
              The scanner identified {secretsResult.secrets_found.length} unredacted API key or secret token in the repository.
              These will be blocked from git checkpointing until removed or migrated to .env files.
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="p-5 pb-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Secrets Found */}
        <div className="p-3 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-mono flex items-center gap-1">
            <Key size={12} className="text-amber-400" />
            Secrets Exposed
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-lg font-mono font-bold ${
                hasSecrets ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {secretsResult.secrets_found.length}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              in {secretsResult.files_scanned} files
            </span>
          </div>
        </div>

        {/* Vulnerabilities */}
        <div className="p-3 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-mono flex items-center gap-1">
            <Package size={12} className="text-purple-400" />
            Vulnerable Packages
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-lg font-mono font-bold ${
                hasVulns ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {depsResult.vulnerabilities.length}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              / {depsResult.total_deps} total deps
            </span>
          </div>
        </div>

        {/* Git Ignore Hygiene */}
        <div className="p-3 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-mono flex items-center gap-1">
            <Lock size={12} className="text-sky-400" />
            .env in .gitignore
          </span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-xs font-mono font-bold flex items-center gap-1 ${
                secretsResult.env_in_gitignore ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {secretsResult.env_in_gitignore ? '✓ Protected' : '⚠ Missing from .gitignore'}
            </span>
          </div>
        </div>

        {/* Audit Tooling */}
        <div className="p-3 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md space-y-1">
          <span className="text-[10px] text-zinc-400 uppercase font-mono flex items-center gap-1">
            <ShieldCheck size={12} className="text-emerald-400" />
            Audit Engine
          </span>
          <div className="text-xs font-mono text-zinc-200 truncate" title={depsResult.scan_tool}>
            {depsResult.scan_tool}
          </div>
        </div>
      </div>

      {/* Sub-Tabs: All / Secrets / Vulnerabilities */}
      <div className="px-5 border-b border-[#2B2B2B] flex items-center gap-2">
        <button
          onClick={() => setActiveSubTab('all')}
          className={`px-3 py-2 border-b-2 text-xs font-medium transition-all ${
            activeSubTab === 'all'
              ? 'border-[#007ACC] text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          All Findings ({secretsResult.secrets_found.length + depsResult.vulnerabilities.length})
        </button>
        <button
          onClick={() => setActiveSubTab('secrets')}
          className={`px-3 py-2 border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeSubTab === 'secrets'
              ? 'border-rose-500 text-rose-300 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Key size={12} />
          Exposed Secrets ({secretsResult.secrets_found.length})
        </button>
        <button
          onClick={() => setActiveSubTab('dependencies')}
          className={`px-3 py-2 border-b-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
            activeSubTab === 'dependencies'
              ? 'border-purple-500 text-purple-300 font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Package size={12} />
          Dependencies ({depsResult.vulnerabilities.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 space-y-3">
            <Loader2 size={24} className="animate-spin text-purple-400" />
            <span className="text-xs">Analyzing code and dependencies for security vulnerabilities...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300 flex items-center gap-3">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Section 1: Secrets Found */}
            {(activeSubTab === 'all' || activeSubTab === 'secrets') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Key size={13} className="text-amber-400" />
                    Exposed Secrets ({secretsResult.secrets_found.length})
                  </h3>
                  {hasSecrets && (
                    <span className="text-[10px] text-rose-400 font-mono">
                      Must be removed before git checkpoint
                    </span>
                  )}
                </div>

                {secretsResult.secrets_found.length === 0 ? (
                  <div className="p-4 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md text-center text-zinc-400 flex items-center justify-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>Clean: No API keys, tokens, or private keys detected in source files.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {secretsResult.secrets_found.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#1E1E1E] border border-rose-900/40 hover:border-rose-700/60 rounded-md flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border font-bold ${getSeverityBadge(
                                s.severity
                              )}`}
                            >
                              {s.severity}
                            </span>
                            <span className="font-semibold text-zinc-100 text-xs">{s.secret_type}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                            <FileText size={11} className="text-sky-400" />
                            <span className="text-sky-300 font-medium">{s.file_path}</span>
                            <span>:</span>
                            <span className="text-zinc-500">line {s.line_number}</span>
                          </div>
                          <div className="p-1.5 bg-[#141414] rounded border border-zinc-800 font-mono text-[11px] text-zinc-300">
                            {s.redacted_preview}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Dependencies Vulnerability Table */}
            {(activeSubTab === 'all' || activeSubTab === 'dependencies') && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase font-mono tracking-wider flex items-center gap-2">
                    <Package size={13} className="text-purple-400" />
                    Dependency Vulnerabilities ({depsResult.vulnerabilities.length})
                  </h3>
                  {hasVulns && (
                    <button
                      onClick={handleFixVulnerabilities}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono transition-colors"
                    >
                      <Wrench size={12} />
                      <span>Fix All with AI</span>
                    </button>
                  )}
                </div>

                {depsResult.vulnerabilities.length === 0 ? (
                  <div className="p-4 bg-[#1E1E1E] border border-[#2B2B2B] rounded-md text-center text-zinc-400 flex items-center justify-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span>All installed dependencies satisfy current security audit policies.</span>
                  </div>
                ) : (
                  <div className="border border-[#2B2B2B] rounded-md overflow-hidden bg-[#1E1E1E]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#141414] border-b border-[#2B2B2B] text-[10px] uppercase font-mono text-zinc-400">
                          <th className="py-2.5 px-3 font-semibold">Package</th>
                          <th className="py-2.5 px-3 font-semibold">Severity</th>
                          <th className="py-2.5 px-3 font-semibold">Installed Version</th>
                          <th className="py-2.5 px-3 font-semibold">Description</th>
                          <th className="py-2.5 px-3 font-semibold">Fix Version</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#282828] text-[11px]">
                        {depsResult.vulnerabilities.map((v, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-zinc-100">
                              {v.package}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(
                                  v.severity
                                )}`}
                              >
                                {v.severity}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-zinc-400">{v.version}</td>
                            <td className="py-2.5 px-3 text-zinc-300 max-w-md truncate" title={v.description}>
                              {v.description}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-emerald-400 font-semibold">
                              {v.fix_version || 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
