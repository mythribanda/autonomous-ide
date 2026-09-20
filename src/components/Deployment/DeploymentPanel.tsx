import React, { useState, useEffect } from 'react';
import {
  DeploymentConfig,
  DeployResult,
  DeployVerificationResult
} from '../../types/api';
import {
  getDeploymentConfig,
  generateDeploymentConfig,
  deployProject,
  getDeploymentStatus,
  verifyDeployment
} from '../../lib/api';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import {
  Cloud,
  Rocket,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  FileCode,
  Globe,
  Server,
  Zap,
  Clock,
  Terminal,
  ShieldCheck,
  Check,
  Copy,
  ChevronRight,
  AlertTriangle,
  LucideIcon
} from 'lucide-react';
import { clsx } from 'clsx';

interface ProviderCardProps {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: LucideIcon;
  isSelected: boolean;
  isConfigured: boolean;
  onSelect: () => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  id,
  name,
  badge,
  description,
  icon: Icon,
  isSelected,
  isConfigured,
  onSelect
}) => (
  <div
    onClick={onSelect}
    className={clsx(
      'p-3.5 rounded-lg border cursor-pointer transition-all flex flex-col justify-between select-none relative overflow-hidden',
      isSelected
        ? 'bg-[#1E1E1E] border-[#007ACC] ring-1 ring-[#007ACC]'
        : 'bg-[#141414] border-[#2B2B2B] hover:border-[#3C3C3C] hover:bg-[#181818]'
    )}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <div
          className={clsx(
            'p-1.5 rounded text-white',
            isSelected ? 'bg-[#007ACC]' : 'bg-[#252526]'
          )}
        >
          <Icon size={16} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-mono font-bold text-xs text-white">{name}</h4>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">
              {badge}
            </span>
          </div>
        </div>
      </div>
      {isConfigured && (
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
          <Check size={9} />
          Configured
        </span>
      )}
    </div>
    <p className="text-[11px] text-zinc-400 mt-2 font-sans leading-relaxed">
      {description}
    </p>
  </div>
);

export const DeploymentPanel: React.FC = () => {
  const { projectId, currentProject } = useProjectStore();
  const { addToast } = useUIStore();

  const [selectedProvider, setSelectedProvider] = useState<string>('vercel');
  const [config, setConfig] = useState<DeploymentConfig | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [generatedConfigContent, setGeneratedConfigContent] = useState<string | null>(null);
  const [activeDeployResult, setActiveDeployResult] = useState<DeployResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<DeployVerificationResult | null>(null);
  const [history, setHistory] = useState<DeployResult[]>([]);
  const [showLogs, setShowLogs] = useState<boolean>(false);

  // Load config & history on mount / project change
  useEffect(() => {
    if (!projectId) return;
    loadStatus();
    detectConfig();
  }, [projectId]);

  const loadStatus = async () => {
    if (!projectId) return;
    try {
      const data = await getDeploymentStatus(projectId);
      if (data.last_deployment) {
        setActiveDeployResult(data.last_deployment);
      }
      setHistory(data.history || []);
    } catch {
      // Ignore
    }
  };

  const detectConfig = async () => {
    if (!projectId) return;
    setIsDetecting(true);
    try {
      const cfg = await getDeploymentConfig(projectId);
      setConfig(cfg);
      if (cfg.suggested_provider) {
        setSelectedProvider(cfg.suggested_provider);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Config Detection Failed',
        message: err?.message || 'Could not inspect deployment configurations.'
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleGenerateConfig = async () => {
    if (!projectId) return;
    setIsGenerating(true);
    try {
      const res = await generateDeploymentConfig(projectId, selectedProvider);
      setGeneratedConfigContent(res.content);
      addToast({
        type: 'success',
        title: 'Deployment Config Generated',
        message: `Generated and wrote ${selectedProvider} deployment setup to project workspace.`
      });
      await detectConfig();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Generation Failed',
        message: err?.message || 'Could not generate deployment configuration.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!projectId) return;
    setIsDeploying(true);
    setVerifyResult(null);
    try {
      addToast({
        type: 'info',
        title: 'Deployment Initiated',
        message: `Deploying application to ${selectedProvider}...`
      });

      const res = await deployProject(projectId, selectedProvider);
      setActiveDeployResult(res);
      setHistory((prev) => [res, ...prev]);

      if (res.success && res.url) {
        addToast({
          type: 'success',
          title: 'Deployment Succeeded',
          message: `Application is live at ${res.url}`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Deployment Failed',
          message: res.error || 'Check deployment logs for details.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Deployment Error',
        message: err?.message || 'Subprocess error during deployment.'
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleVerify = async (urlToVerify: string) => {
    if (!projectId || !urlToVerify) return;
    setIsVerifying(true);
    try {
      const res = await verifyDeployment(projectId, urlToVerify);
      setVerifyResult(res);
      if (res.accessible) {
        addToast({
          type: 'success',
          title: 'Deployment Verified',
          message: `HTTP ${res.status_code} response in ${res.response_time_ms}ms.`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Deployment Inaccessible',
          message: res.error || 'Server did not respond with 2xx status.'
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: err?.message || 'Network error during deployment verification.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const providers = [
    {
      id: 'vercel',
      name: 'Vercel',
      badge: 'Frontend',
      description: 'Zero-configuration global edge deployments for Vite, Next.js, and static assets.',
      icon: Zap,
      isConfigured: !!config?.has_vercel
    },
    {
      id: 'railway',
      name: 'Railway',
      badge: 'Full-Stack',
      description: 'Instant Nixpacks runtime deployment for Node.js, Python, databases, and cron workers.',
      icon: Server,
      isConfigured: !!config?.has_railway || !!config?.has_procfile
    },
    {
      id: 'fly',
      name: 'Fly.io',
      badge: 'MicroVMs',
      description: 'Run Docker containers close to users on lightweight Firecracker virtual machines.',
      icon: Cloud,
      isConfigured: !!config?.has_fly
    },
    {
      id: 'manual',
      name: 'Manual / Self-Hosted',
      badge: 'Custom',
      description: 'Export build artifacts and configure direct Nginx/Caddy or PM2 processes.',
      icon: Globe,
      isConfigured: false
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#181818] p-5 space-y-5 font-sans text-xs select-none">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#007ACC] flex items-center justify-center text-white">
            <Rocket size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white font-mono tracking-tight">
                CLOUD DEPLOYMENT
              </h1>
              {config?.detected_provider && (
                <span className="px-2 py-0.2 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {config.detected_provider.toUpperCase()} DETECTED
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Production configuration generation, deployment execution, and live URL verification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={detectConfig}
            disabled={isDetecting}
            className="px-3 py-1.5 rounded bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-zinc-300 font-mono text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={12} className={isDetecting ? 'animate-spin' : ''} />
            <span>Detect Config</span>
          </button>

          <button
            onClick={handleGenerateConfig}
            disabled={isGenerating || selectedProvider === 'manual'}
            className="px-3.5 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <FileCode size={13} className="text-[#007ACC]" />
            <span>{isGenerating ? 'Generating...' : 'Generate Config'}</span>
          </button>

          <button
            onClick={handleDeploy}
            disabled={isDeploying || selectedProvider === 'manual'}
            className="px-4 py-1.5 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow"
          >
            {isDeploying ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <Rocket size={13} />
            )}
            <span>{isDeploying ? 'Deploying...' : 'Deploy to Cloud'}</span>
          </button>
        </div>
      </div>

      {/* Provider Selection Row */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
          Select Deployment Provider
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              {...p}
              isSelected={selectedProvider === p.id}
              onSelect={() => setSelectedProvider(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Active Deployment Card / Success Banner */}
      {activeDeployResult && (
        <div className="p-4 rounded-lg border border-[#2B2B2B] bg-[#1E1E1E] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeDeployResult.success ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <XCircle size={16} className="text-rose-400" />
              )}
              <span className="font-bold text-sm text-white font-mono">
                {activeDeployResult.success ? 'Deployment Live' : 'Deployment Failed'}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono uppercase">
                {activeDeployResult.provider}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {activeDeployResult.url && (
                <button
                  onClick={() => handleVerify(activeDeployResult.url!)}
                  disabled={isVerifying}
                  className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-xs font-mono text-zinc-200 flex items-center gap-1.5 transition-colors"
                >
                  <ShieldCheck size={12} className={isVerifying ? 'animate-pulse text-[#007ACC]' : 'text-emerald-400'} />
                  <span>{isVerifying ? 'Pinging...' : 'Verify URL'}</span>
                </button>
              )}

              {activeDeployResult.logs && (
                <button
                  onClick={() => setShowLogs(!showLogs)}
                  className="px-2 py-1 rounded bg-[#252526] text-zinc-400 hover:text-white border border-[#2B2B2B] text-xs font-mono"
                >
                  {showLogs ? 'Hide Logs' : 'View Logs'}
                </button>
              )}
            </div>
          </div>

          {/* Clickable Deployed URL Link */}
          {activeDeployResult.url && (
            <div className="p-3 rounded bg-[#141414] border border-[#2B2B2B] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Globe size={15} className="text-[#007ACC] shrink-0" />
                <a
                  href={activeDeployResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-white hover:text-[#007ACC] hover:underline truncate"
                >
                  {activeDeployResult.url}
                </a>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(activeDeployResult.url!);
                    addToast({ type: 'info', title: 'Copied', message: 'URL copied to clipboard' });
                  }}
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                  title="Copy URL"
                >
                  <Copy size={13} />
                </button>
                <a
                  href={activeDeployResult.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded text-zinc-400 hover:text-white transition-colors"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* Verification Ping Result Pill */}
          {verifyResult && (
            <div
              className={clsx(
                'p-2.5 rounded border text-xs font-mono flex items-center justify-between',
                verifyResult.accessible
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              )}
            >
              <div className="flex items-center gap-2">
                {verifyResult.accessible ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )}
                <span>
                  Status: HTTP {verifyResult.status_code || 'Err'} • Latency: {verifyResult.response_time_ms}ms
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 truncate max-w-xs">
                {verifyResult.url}
              </span>
            </div>
          )}

          {/* Deployment Log Viewer */}
          {showLogs && activeDeployResult.logs && (
            <div className="p-3 bg-black/90 rounded border border-[#2B2B2B] font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
              {activeDeployResult.logs}
            </div>
          )}
        </div>
      )}

      {/* Generated Config Preview */}
      {generatedConfigContent && (
        <div className="p-3.5 rounded-lg border border-[#2B2B2B] bg-[#1E1E1E] space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
            <div className="flex items-center gap-2">
              <FileCode size={14} className="text-[#007ACC]" />
              <span className="font-mono font-bold text-xs text-zinc-200">
                Config Written to Workspace
              </span>
            </div>
            <button
              onClick={() => setGeneratedConfigContent(null)}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono"
            >
              Dismiss
            </button>
          </div>
          <pre className="p-2.5 bg-[#141414] rounded border border-[#2B2B2B] font-mono text-[11px] text-zinc-300 overflow-x-auto max-h-44">
            {generatedConfigContent}
          </pre>
        </div>
      )}

      {/* Deployment History Table */}
      <div className="p-3.5 rounded-lg border border-[#2B2B2B] bg-[#181818] space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
            DEPLOYMENT HISTORY
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            {history.length} deployments
          </span>
        </div>

        {history.length === 0 ? (
          <div className="py-6 text-center text-zinc-500 font-mono text-xs">
            No deployments recorded yet. Choose a provider and click Deploy.
          </div>
        ) : (
          <div className="divide-y divide-[#2B2B2B]">
            {history.map((h, i) => (
              <div
                key={h.deploy_id || i}
                className="py-2.5 flex items-center justify-between font-mono text-xs hover:bg-[#1E1E1E] px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={clsx(
                      'w-2 h-2 rounded-full shrink-0',
                      h.success ? 'bg-emerald-400' : 'bg-rose-400'
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold uppercase text-[11px]">
                        {h.provider}
                      </span>
                      {h.url && (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#007ACC] hover:underline text-[11px]"
                        >
                          {h.url}
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Clock size={10} />
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {h.url && (
                  <button
                    onClick={() => handleVerify(h.url!)}
                    className="px-2 py-0.5 rounded bg-[#252526] text-zinc-300 hover:text-white border border-[#3C3C3C] text-[10px]"
                  >
                    Verify
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
