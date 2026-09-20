import React, { useState } from 'react';
import { AlertTriangle, Copy, Check, X, ExternalLink, Terminal, GitBranch, FolderOpen, Zap } from 'lucide-react';
import { clsx } from 'clsx';

type ErrorKind =
  | 'ollama_not_running'
  | 'backend_not_running'
  | 'git_not_initialized'
  | 'project_too_large'
  | 'ollama_model_not_found';

export interface ErrorBannerProps {
  kind: ErrorKind;
  detail?: string; // e.g. model name for ollama_model_not_found, file count for project_too_large
  onDismiss?: () => void;
  onAction?: () => void; // e.g. git init button
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#141414] border border-[#333] hover:border-[#007ACC] text-zinc-300 font-mono text-[10px] transition-colors"
    >
      {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
      <span className="font-mono">{text}</span>
    </button>
  );
}

const ERROR_CONFIG: Record<ErrorKind, {
  icon: React.ComponentType<any>;
  title: string;
  severity: 'warning' | 'error' | 'info';
  render: (detail?: string, onAction?: () => void) => React.ReactNode;
}> = {
  ollama_not_running: {
    icon: Zap,
    title: 'Ollama Not Running',
    severity: 'error',
    render: () => (
      <div className="space-y-2">
        <p className="text-zinc-300 text-xs">The local Ollama runtime is offline. The AI agent cannot execute without it.</p>
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-zinc-400 text-[11px]">1. Install from</span>
          <a href="https://ollama.ai" target="_blank" rel="noreferrer"
            className="text-[#007ACC] underline text-[11px] flex items-center gap-0.5">
            ollama.ai <ExternalLink size={10} />
          </a>
          <span className="text-zinc-400 text-[11px]">2. Then pull the model:</span>
          <CopyButton text="ollama pull llama3.1:8b" />
        </div>
      </div>
    ),
  },
  backend_not_running: {
    icon: Terminal,
    title: 'Backend Not Running',
    severity: 'error',
    render: () => (
      <div className="space-y-2">
        <p className="text-zinc-300 text-xs">The Python FastAPI backend is not reachable at localhost:8000.</p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-[11px]">Start the backend:</span>
          <CopyButton text="npm run start:backend" />
        </div>
      </div>
    ),
  },
  git_not_initialized: {
    icon: GitBranch,
    title: 'Git Not Initialized',
    severity: 'warning',
    render: (_detail, onAction) => (
      <div className="space-y-2">
        <p className="text-zinc-300 text-xs">This project has no git repository. Checkpointing and rollback require git.</p>
        <div className="flex items-center gap-2">
          <CopyButton text="git init" />
          {onAction && (
            <button
              onClick={onAction}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white text-[11px] transition-colors"
            >
              <GitBranch size={11} />
              Initialize Git
            </button>
          )}
        </div>
      </div>
    ),
  },
  project_too_large: {
    icon: FolderOpen,
    title: 'Project Too Large',
    severity: 'warning',
    render: (detail, onAction) => (
      <div className="space-y-2">
        <p className="text-zinc-300 text-xs">
          {detail ? `${detail} files detected.` : 'Over 10,000 files detected.'} This may slow scanning significantly.
        </p>
        <div className="flex items-center gap-2">
          {onAction && (
            <button
              onClick={onAction}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-200 border border-[#3c3c3c] text-[11px] transition-colors"
            >
              <FolderOpen size={11} />
              Select Subdirectory
            </button>
          )}
          <span className="text-zinc-400 text-[11px]">Or add exclusions in Project Settings → Excluded Paths</span>
        </div>
      </div>
    ),
  },
  ollama_model_not_found: {
    icon: Zap,
    title: 'Ollama Model Not Found',
    severity: 'error',
    render: (detail) => {
      const model = detail || 'llama3.2:latest';
      return (
        <div className="space-y-2">
          <p className="text-zinc-300 text-xs">Model <code className="font-mono bg-zinc-800 px-1 rounded">{model}</code> is not available in Ollama.</p>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-[11px]">Pull it:</span>
            <CopyButton text={`ollama pull ${model}`} />
          </div>
        </div>
      );
    },
  },
};

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ kind, detail, onDismiss, onAction }) => {
  const config = ERROR_CONFIG[kind];
  const Icon = config.icon;

  const borderColor = config.severity === 'error' ? 'border-rose-800' : 'border-amber-800';
  const bgColor = config.severity === 'error' ? 'bg-rose-950/30' : 'bg-amber-950/30';
  const iconColor = config.severity === 'error' ? 'text-rose-400' : 'text-amber-400';
  const titleColor = config.severity === 'error' ? 'text-rose-200' : 'text-amber-200';

  return (
    <div className={clsx('rounded-lg border p-3 flex gap-3', borderColor, bgColor)}>
      <div className={clsx('mt-0.5 shrink-0', iconColor)}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className={clsx('font-bold text-xs font-mono', titleColor)}>
          {config.title}
        </div>
        {config.render(detail, onAction)}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors mt-0.5"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};
