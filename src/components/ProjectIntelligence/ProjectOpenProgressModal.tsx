import React from 'react';
import { useProjectStore, OpenProjectStep } from '../../store/projectStore';
import {
  FolderOpen,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Network,
  Cpu,
  FileCode,
  FileText
} from 'lucide-react';

export const ProjectOpenProgressModal: React.FC = () => {
  const {
    isOpening,
    openStep,
    openStepLabel,
    openProgress,
    openError,
    resetOpenState
  } = useProjectStore();

  if (!isOpening && openStep !== 'error') {
    return null;
  }

  const steps: { id: OpenProjectStep; label: string; icon: React.FC<any> }[] = [
    { id: 'selecting_folder', label: 'Select Workspace Directory', icon: FolderOpen },
    { id: 'opening_project', label: 'Initialize Project & Fast Scan', icon: FileCode },
    { id: 'analyzing_ast', label: 'Parse AST with Tree-Sitter', icon: Cpu },
    { id: 'building_knowledge_graph', label: 'Build Cross-File Knowledge Graph', icon: Network },
    { id: 'generating_summary', label: 'Synthesize Architecture Summary', icon: FileText }
  ];

  const getStepStatus = (stepId: OpenProjectStep): 'pending' | 'in_progress' | 'completed' => {
    const order: OpenProjectStep[] = [
      'selecting_folder',
      'opening_project',
      'scanning_metadata',
      'analyzing_ast',
      'building_knowledge_graph',
      'generating_summary',
      'complete'
    ];

    const currentIdx = order.indexOf(openStep);
    const stepIdx = order.indexOf(stepId);

    if (currentIdx > stepIdx || openStep === 'complete') return 'completed';
    if (currentIdx === stepIdx || (stepId === 'opening_project' && openStep === 'scanning_metadata')) {
      return 'in_progress';
    }
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#2B2B2B] bg-[#181818] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
              <FolderOpen size={12} />
            </div>
            <span className="font-mono text-xs font-bold text-[#FFFFFF] tracking-tight">
              OPENING WORKSPACE & ANALYZING
            </span>
          </div>
          {openStep === 'error' && (
            <button
              onClick={resetOpenState}
              className="text-xs text-[#858585] hover:text-[#FFFFFF] px-2 py-0.5 rounded-sm bg-[#252526]"
            >
              Dismiss
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono text-[#858585]">
              <span className="text-[#CCCCCC]">{openStepLabel || 'Loading project workspace...'}</span>
              <span>{Math.round(openProgress)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#252526] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  openStep === 'error' ? 'bg-[#F85149]' : 'bg-[#007ACC]'
                }`}
                style={{ width: `${Math.min(100, Math.max(5, openProgress))}%` }}
              />
            </div>
          </div>

          {/* Steps Checklist */}
          <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
            {steps.map((s) => {
              const status = getStepStatus(s.id);
              const Icon = s.icon;
              return (
                <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <Icon
                      size={14}
                      className={
                        status === 'completed'
                          ? 'text-[#3FB950]'
                          : status === 'in_progress'
                          ? 'text-[#007ACC]'
                          : 'text-[#555555]'
                      }
                    />
                    <span
                      className={
                        status === 'completed'
                          ? 'text-[#CCCCCC]'
                          : status === 'in_progress'
                          ? 'text-[#FFFFFF] font-semibold'
                          : 'text-[#666666]'
                      }
                    >
                      {s.label}
                    </span>
                  </div>
                  <div>
                    {status === 'completed' && (
                      <CheckCircle2 size={14} className="text-[#3FB950]" />
                    )}
                    {status === 'in_progress' && (
                      <Loader2 size={14} className="text-[#007ACC] animate-spin" />
                    )}
                    {status === 'pending' && (
                      <span className="w-2.5 h-2.5 rounded-full border border-[#444444] inline-block" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error Message if any */}
          {openError && (
            <div className="p-2.5 rounded-sm bg-[#DA3633]/15 border border-[#DA3633]/50 text-xs text-[#F85149] flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{openError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
