import React, { useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useGitHubStore } from '../../store/githubStore';
import {
  FolderOpen,
  GitBranch,
  Sparkles,
  Network,
  Bot,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Server,
  Check,
  X as XIcon,
  Loader
} from 'lucide-react';
import { clsx } from 'clsx';

type HealthStatus = 'checking' | 'ok' | 'error';

interface SystemStatus {
  backend: HealthStatus;
  ollama: HealthStatus;
  github: HealthStatus;
}

async function checkBackend(): Promise<boolean> {
  try {
    const r = await fetch('http://localhost:8000/api/health', { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch { return false; }
}

async function checkOllama(): Promise<boolean> {
  try {
    const r = await fetch('http://localhost:8000/api/health/ollama', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const data = await r.json();
    return data?.connected === true;
  } catch { return false; }
}

async function checkGitHub(): Promise<boolean> {
  try {
    const r = await fetch('http://localhost:8000/api/github/status', { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return false;
    const data = await r.json();
    return data?.connected === true;
  } catch { return false; }
}

function StatusDot({ status, label }: { status: HealthStatus; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-mono">
      {status === 'checking' && <Loader size={11} className="animate-spin text-zinc-400" />}
      {status === 'ok' && <Check size={11} className="text-emerald-400" />}
      {status === 'error' && <XIcon size={11} className="text-rose-400" />}
      <span className={clsx(
        status === 'ok' ? 'text-emerald-300' : status === 'error' ? 'text-rose-300' : 'text-zinc-400'
      )}>{label}</span>
    </div>
  );
}

export const WelcomeScreen: React.FC = () => {
  const { openProjectWithDialog, openProject } = useProjectStore();
  const { setActiveView, addToast } = useUIStore();
  const { connected: isGitHubConnected } = useGitHubStore();

  // Access recentProjects safely — may not exist in all store versions
  const recentProjects = (useProjectStore.getState() as any).recentProjects as any[] | undefined;

  const [status, setStatus] = useState<SystemStatus>({
    backend: 'checking',
    ollama: 'checking',
    github: 'checking',
  });

  const runHealthChecks = async () => {
    setStatus({ backend: 'checking', ollama: 'checking', github: 'checking' });
    const [be, ol, gh] = await Promise.all([checkBackend(), checkOllama(), checkGitHub()]);
    setStatus({
      backend: be ? 'ok' : 'error',
      ollama: ol ? 'ok' : 'error',
      github: gh ? 'ok' : 'error',
    });
  };

  useEffect(() => {
    runHealthChecks();
    const t = setInterval(runHealthChecks, 15_000);
    return () => clearInterval(t);
  }, []);

  const handleOpenFolder = async () => {
    try {
      const path = await openProjectWithDialog();
      if (path) {
        setActiveView('intelligence');
        addToast({ type: 'success', title: 'Project Opened', message: `Workspace loaded: ${path}` });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Open Project Failed', message: err?.message || 'Error opening workspace' });
    }
  };

  const handleCloneFromGitHub = () => {
    if (isGitHubConnected) {
      setActiveView('github' as any);
    } else {
      addToast({ type: 'info', title: 'GitHub Not Connected', message: 'Connect GitHub in Settings → GitHub first.' });
    }
  };

  // Show last 5 real recent projects from store, fall back to placeholders
  const displayProjects = recentProjects?.slice(0, 5) ?? [];
  const fallbackProjects = [
    { name: 'EduSim', path: 'C:\\Projects\\EduSim', desc: 'Classroom simulation platform • React + FastAPI', lastOpened: 'Today' },
    { name: 'InsightFlow', path: 'C:\\Projects\\InsightFlow', desc: 'Realtime streaming analytics • Next.js + Go', lastOpened: 'Yesterday' },
    { name: 'StudLyf', path: 'C:\\Projects\\StudLyf', desc: 'Campus life companion • Django + Flutter', lastOpened: '3 days ago' },
  ];
  const projectList = displayProjects.length > 0 ? displayProjects : fallbackProjects;

  const features = [
    { title: 'Smart Prompt Composer', desc: 'Compiles rough requirements into verified engineering specs.', icon: Sparkles, view: 'explorer' as const },
    { title: 'Project Intelligence', desc: 'AST semantic graph, dependency tracing, and risk analysis.', icon: Network, view: 'intelligence' as const },
    { title: 'Autonomous Agent', desc: 'Multi-step code modifications with full live observability.', icon: Bot, view: 'explorer' as const },
    { title: 'Testing & Verification', desc: 'Real-time test suite runner with assertion diagnostics.', icon: CheckCircle2, view: 'verification' as const },
    { title: 'Self-Recovery Timeline', desc: 'Automated error localization, patch synthesis, and recovery.', icon: RefreshCw, view: 'recovery' as const },
    { title: 'Git Integration', desc: 'Pre-change atomic checkpoints and instant rollback.', icon: GitBranch, view: 'git' as const },
  ];

  const quickStart = [
    { step: '1', title: 'Open a Project', desc: 'Point to any local workspace or clone a GitHub repo.', icon: FolderOpen, color: 'text-[#007ACC]' },
    { step: '2', title: 'Describe Your Task', desc: 'Type what you want in plain English in the prompt bar.', icon: Sparkles, color: 'text-emerald-400' },
    { step: '3', title: 'Execute & Verify', desc: 'The agent codes, tests, and checkpoints — you stay in control.', icon: Bot, color: 'text-amber-400' },
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-8 flex flex-col items-center justify-center select-none text-[#CCCCCC]">
      <div className="max-w-3xl w-full space-y-6 py-4">

        {/* Header */}
        <div className="text-left space-y-1.5 border-b border-[#2B2B2B] pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#007ACC]">
            <Sparkles size={14} />
            <span>Autonomous Software Engineering Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-[#FFFFFF] tracking-tight font-mono">AUTONOMOUS DEV</h1>
          <p className="text-sm text-[#858585] font-sans">
            Autonomous Developer Workspace — Idea to verified implementation
          </p>
        </div>

        {/* System Status Panel */}
        <div className="p-3 rounded-lg bg-[#181818] border border-[#2B2B2B] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">System Status</span>
          <div className="flex items-center gap-5">
            <StatusDot status={status.backend} label="Backend" />
            <StatusDot status={status.ollama} label="Ollama" />
            <StatusDot status={status.github} label="GitHub" />
            <button
              onClick={runHealthChecks}
              className="text-zinc-500 hover:text-zinc-200 transition-colors"
              title="Refresh status"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenFolder}
            className="px-5 py-2.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-white font-bold text-sm flex items-center gap-2 transition-colors shadow-md"
          >
            <FolderOpen size={16} />
            Open Project Folder
          </button>
          <button
            onClick={handleCloneFromGitHub}
            className="px-4 py-2.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] font-semibold text-sm flex items-center gap-2 transition-colors"
          >
            <GitBranch size={15} className="text-[#007ACC]" />
            Clone from GitHub
          </button>
        </div>

        {/* Quick Start Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickStart.map(qs => {
            const Icon = qs.icon;
            return (
              <div key={qs.step} className="p-3.5 rounded-lg bg-[#181818] border border-[#2B2B2B] space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#252526] border border-[#3c3c3c] text-[10px] font-mono font-bold flex items-center justify-center text-zinc-300">{qs.step}</span>
                  <Icon size={14} className={qs.color} />
                  <span className="text-xs font-semibold text-zinc-100 font-mono">{qs.title}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans pl-7">{qs.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Recent Projects */}
        <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
            <span className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">RECENT WORKSPACES</span>
            <span className="text-[10px] font-mono text-[#858585]">Local Sandbox</span>
          </div>
          <div className="space-y-1">
            {projectList.length === 0 ? (
              <div className="py-4 text-center text-zinc-500 text-xs font-mono">No recent projects</div>
            ) : (
              projectList.map((p: any) => (
                <div
                  key={p.path || p.name}
                  onClick={async () => {
                    try {
                      await openProject(p.path, p.name);
                      setActiveView('intelligence');
                    } catch {
                      setActiveView('explorer');
                    }
                  }}
                  className="p-2.5 rounded-sm bg-[#1E1E1E] hover:bg-[#264F78] border border-[#2B2B2B] cursor-pointer transition-all flex items-center justify-between text-xs font-sans group"
                >
                  <div>
                    <div className="font-semibold text-[#FFFFFF]">{p.name}</div>
                    <div className="text-[11px] text-[#858585] group-hover:text-[#CCCCCC] mt-0.5">
                      {p.desc || p.path}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[#858585] group-hover:text-[#FFFFFF]">
                    <span className="text-[10px] font-mono">{p.lastOpened || ''}</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {features.map(feat => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                onClick={() => setActiveView(feat.view)}
                className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] hover:border-[#007ACC] hover:bg-[#252526] transition-all cursor-pointer space-y-1 group"
              >
                <div className="text-[#007ACC] inline-flex mb-0.5"><Icon size={16} /></div>
                <h4 className="text-xs font-semibold text-[#FFFFFF] font-sans group-hover:text-[#3794FF]">{feat.title}</h4>
                <p className="text-[11px] text-[#858585] leading-relaxed font-sans">{feat.desc}</p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
