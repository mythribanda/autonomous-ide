import React, { useEffect, useState } from 'react';

function PulseLine({ width = 'w-full', height = 'h-3' }: { width?: string; height?: string }) {
  return (
    <div className={`${width} ${height} rounded bg-zinc-800 animate-pulse`} />
  );
}

export const ProjectScanSkeleton: React.FC = () => (
  <div className="p-6 space-y-4 max-w-2xl mx-auto">
    <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono mb-4">
      <div className="w-3 h-3 rounded-full bg-[#007ACC] animate-pulse" />
      <span>Analyzing project...</span>
    </div>

    <div className="p-4 rounded-lg bg-[#1E1E1E] border border-[#2B2B2B] space-y-3">
      <PulseLine width="w-1/3" height="h-2.5" />
      <div className="grid grid-cols-3 gap-3">
        <PulseLine height="h-12" />
        <PulseLine height="h-12" />
        <PulseLine height="h-12" />
      </div>
    </div>

    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-4 rounded bg-zinc-800 animate-pulse shrink-0" />
          <PulseLine width="w-full" height="h-2.5" />
        </div>
      ))}
    </div>

    <div className="p-3 rounded bg-[#1E1E1E] border border-[#2B2B2B] space-y-2">
      <PulseLine width="w-2/5" height="h-2" />
      <PulseLine width="w-3/4" height="h-2" />
      <PulseLine width="w-1/2" height="h-2" />
    </div>
  </div>
);

const GRAPH_STEPS = [
  'Parsing source files',
  'Extracting AST nodes',
  'Resolving imports',
  'Building dependency edges',
  'Computing impact scores',
  'Finalizing graph',
];

export const KnowledgeGraphSkeleton: React.FC = () => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => {
        const next = Math.min(s + 1, GRAPH_STEPS.length - 1);
        setProgress(Math.round((next / (GRAPH_STEPS.length - 1)) * 100));
        return next;
      });
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 text-zinc-400 text-xs font-mono">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        <span>Building knowledge graph...</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-zinc-300">{GRAPH_STEPS[step]}</span>
          <span className="text-[#007ACC]">{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#007ACC] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-1.5">
        {GRAPH_STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2.5 text-[11px] font-mono">
            <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
              i < step ? 'bg-emerald-500' : i === step ? 'bg-[#007ACC] animate-pulse' : 'bg-zinc-700'
            }`} />
            <span className={i <= step ? 'text-zinc-200' : 'text-zinc-600'}>{s}</span>
          </div>
        ))}
      </div>

      {/* Simulated node graph */}
      <div className="h-40 rounded-lg bg-[#141414] border border-[#2B2B2B] flex items-center justify-center relative overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-4 h-4 rounded-full bg-zinc-700 animate-pulse"
            style={{
              left: `${15 + (i % 4) * 22}%`,
              top: `${20 + Math.floor(i / 4) * 30}%`,
              animationDelay: `${i * 150}ms`,
              opacity: i / 12 <= progress / 100 ? 0.9 : 0.2
            }}
          />
        ))}
        <span className="text-zinc-600 text-[10px] font-mono z-10">
          {progress < 100 ? 'Indexing nodes...' : 'Graph ready'}
        </span>
      </div>
    </div>
  );
};
