import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  FilePlus,
  FileEdit,
  Trash2,
  Pencil,
  Play,
  X,
  Plus,
  HelpCircle,
  Clock,
  Loader2,
  Check,
  Brain,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Bug,
  Layers,
  ListTodo
} from 'lucide-react';
import { usePromptStore } from '../../store/promptStore';
import { useProjectStore } from '../../store/projectStore';
import { ImplementationStep, ProjectMemoryItem } from '../../types/api';
import { getRelevantMemories } from '../../lib/api';

export const CompilerPanel: React.FC = () => {
  const { projectId } = useProjectStore();
  const {
    compiledSpec,
    compilerSteps,
    isCompiling,
    compileError,
    isEditingSpec,
    setIsEditingSpec,
    editSpec,
    executeSpec,
    setIsPanelOpen
  } = usePromptStore();

  const [checkedCriteria, setCheckedCriteria] = useState<Record<number, boolean>>({});
  const [relevantMemories, setRelevantMemories] = useState<ProjectMemoryItem[]>([]);
  const [isMemoryExpanded, setIsMemoryExpanded] = useState<boolean>(true);
  const [selectedMemory, setSelectedMemory] = useState<ProjectMemoryItem | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const query = compiledSpec?.intent || '';
    if (!query) {
      setRelevantMemories([]);
      return;
    }
    let active = true;
    getRelevantMemories(projectId, query, 5)
      .then((mems) => {
        if (active) {
          setRelevantMemories(mems);
          if (mems.length > 0) {
            setSelectedMemory((prev) => prev || mems[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch relevant memories for prompt', err);
      });
    return () => {
      active = false;
    };
  }, [projectId, compiledSpec?.intent]);

  const toggleCriterion = (idx: number) => {
    setCheckedCriteria((prev) => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const confidencePercent = compiledSpec ? Math.round(compiledSpec.confidence_score * 100) : 0;
  const canExecute = compiledSpec ? compiledSpec.confidence_score >= 0.4 && (compiledSpec.missing_info?.length || 0) < 5 : false;

  // Category Badge Colors
  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'feature_add':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/60';
      case 'bug_fix':
        return 'bg-amber-900/60 text-amber-300 border-amber-700/60';
      case 'refactor':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/60';
      case 'performance':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60';
      case 'security':
        return 'bg-rose-900/60 text-rose-300 border-rose-700/60';
      case 'test':
        return 'bg-cyan-900/60 text-cyan-300 border-cyan-700/60';
      case 'doc':
        return 'bg-zinc-800 text-zinc-300 border-zinc-600';
      default:
        return 'bg-blue-900/60 text-blue-300 border-blue-700/60';
    }
  };

  const getStepActionIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'create':
        return <FilePlus size={14} className="text-emerald-400" />;
      case 'delete':
        return <Trash2 size={14} className="text-rose-400" />;
      case 'modify':
      default:
        return <FileEdit size={14} className="text-sky-400" />;
    }
  };

  return (
    <div className="w-full bg-[#181818] border-b border-[#2D2D2D] text-[#CCCCCC] shadow-2xl transition-all duration-300 ease-out max-h-[75vh] overflow-y-auto">
      {/* Live Thinking / Compilation Stepper */}
      <div className="px-5 py-3 border-b border-[#2D2D2D] bg-[#1E1E1E]/90 flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-6 text-xs font-mono">
          {/* Step 1: Intent Detection */}
          <div className="flex items-center gap-2">
            {compilerSteps.intent_detection.status === 'running' ? (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Loader2 size={13} className="animate-spin" />
                <span className="font-semibold">Intent Detection</span>
                <span className="text-[10px] text-zinc-400">running...</span>
              </span>
            ) : compilerSteps.intent_detection.status === 'done' ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={13} />
                <span className="font-semibold">Intent Detection</span>
                <span className="text-[10px] text-emerald-500/80">Done</span>
              </span>
            ) : compilerSteps.intent_detection.status === 'error' ? (
              <span className="flex items-center gap-1.5 text-rose-400">
                <X size={13} />
                <span className="font-semibold">Intent Detection</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-full border border-zinc-600 inline-block" />
                <span>Intent Detection</span>
              </span>
            )}
          </div>

          <span className="text-zinc-600">→</span>

          {/* Step 2: Requirement Extraction */}
          <div className="flex items-center gap-2">
            {compilerSteps.requirement_extraction.status === 'running' ? (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Loader2 size={13} className="animate-spin" />
                <span className="font-semibold">Requirement Extraction</span>
                <span className="text-[10px] text-zinc-400">running...</span>
              </span>
            ) : compilerSteps.requirement_extraction.status === 'done' ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={13} />
                <span className="font-semibold">Requirement Extraction</span>
                <span className="text-[10px] text-emerald-500/80">Done</span>
              </span>
            ) : compilerSteps.requirement_extraction.status === 'error' ? (
              <span className="flex items-center gap-1.5 text-rose-400">
                <X size={13} />
                <span className="font-semibold">Requirement Extraction</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-full border border-zinc-600 inline-block" />
                <span>Requirement Extraction</span>
              </span>
            )}
          </div>

          <span className="text-zinc-600">→</span>

          {/* Step 3: Technical Planning */}
          <div className="flex items-center gap-2">
            {compilerSteps.technical_planning.status === 'running' ? (
              <span className="flex items-center gap-1.5 text-blue-400">
                <Loader2 size={13} className="animate-spin" />
                <span className="font-semibold">Technical Planning</span>
                <span className="text-[10px] text-zinc-400">running...</span>
              </span>
            ) : compilerSteps.technical_planning.status === 'done' ? (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 size={13} />
                <span className="font-semibold">Technical Planning</span>
                <span className="text-[10px] text-emerald-500/80">Done</span>
              </span>
            ) : compilerSteps.technical_planning.status === 'error' ? (
              <span className="flex items-center gap-1.5 text-rose-400">
                <X size={13} />
                <span className="font-semibold">Technical Planning</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-zinc-500">
                <span className="w-2.5 h-2.5 rounded-full border border-zinc-600 inline-block" />
                <span>Technical Planning</span>
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsPanelOpen(false)}
          className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
          title="Close Panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* Error Banner */}
      {compileError && (
        <div className="mx-5 my-3 p-3 bg-red-950/60 border border-red-800/80 rounded text-xs text-red-200 flex items-center gap-2">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <span>{compileError}</span>
        </div>
      )}

      {/* Structured Output Sections (Rendered once available or compiling) */}
      {compiledSpec && (
        <div className="p-5 space-y-5 text-xs">
          {/* Top Section: INTENT & Confidence Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* a) INTENT Box */}
            <div className="md:col-span-2 p-3.5 bg-[#202020] border border-[#2D2D2D] rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                  <Sparkles size={13} className="text-blue-400" />
                  Detected Intent
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${getCategoryColor(
                      compiledSpec.intent_category
                    )}`}
                  >
                    {compiledSpec.intent_category}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {compiledSpec.scope}
                  </span>
                </div>
              </div>

              {isEditingSpec ? (
                <textarea
                  value={compiledSpec.intent}
                  onChange={(e) => editSpec({ intent: e.target.value })}
                  rows={2}
                  className="w-full bg-[#181818] border border-blue-500/60 rounded p-2 text-xs text-zinc-100 focus:outline-none"
                />
              ) : (
                <p className="text-zinc-100 text-[13px] leading-relaxed font-medium">
                  {compiledSpec.intent}
                </p>
              )}
            </div>

            {/* f) Confidence Score Bar */}
            <div className="p-3.5 bg-[#202020] border border-[#2D2D2D] rounded-md space-y-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Spec Confidence
                </span>
                <span
                  className={`font-mono text-sm font-bold ${
                    confidencePercent >= 70
                      ? 'text-emerald-400'
                      : confidencePercent >= 40
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {confidencePercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/60">
                <div
                  className={`h-full transition-all duration-500 ${
                    confidencePercent >= 70
                      ? 'bg-emerald-500'
                      : confidencePercent >= 40
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>

              <span className="text-[10px] text-zinc-400">
                {confidencePercent >= 70
                  ? 'High confidence — specification is unambiguous and ready.'
                  : confidencePercent >= 40
                  ? 'Moderate confidence — review ambiguities before execution.'
                  : 'Low confidence — clarification required.'}
              </span>
            </div>
          </div>

          {/* Memory Context Section (Cross-Session Knowledge) */}
          {relevantMemories.length > 0 && (
            <div className="p-3.5 bg-[#202020] border border-purple-900/50 rounded-md space-y-3">
              <div
                onClick={() => setIsMemoryExpanded(!isMemoryExpanded)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">📚</span>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-purple-300 font-semibold flex items-center gap-1.5">
                    <Brain size={13} className="text-purple-400" />
                    {relevantMemories.length} relevant {relevantMemories.length === 1 ? 'memory' : 'memories'} found
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800/60 font-mono">
                    Injected into Planning Prompt
                  </span>
                </div>
                <div className="flex items-center gap-1 text-zinc-400 text-xs">
                  <span>{isMemoryExpanded ? 'Collapse' : 'Expand'}</span>
                  {isMemoryExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </div>

              {isMemoryExpanded && (
                <div className="space-y-3 pt-1">
                  {/* Memory Chips */}
                  <div className="flex flex-wrap gap-2">
                    {relevantMemories.map((mem) => {
                      const isSelected = selectedMemory?.id === mem.id;
                      return (
                        <button
                          key={mem.id}
                          type="button"
                          onClick={() => setSelectedMemory(isSelected ? null : mem)}
                          className={`px-2.5 py-1.5 rounded text-left border text-xs flex items-center gap-2 transition-all ${
                            isSelected
                              ? 'bg-purple-950/70 border-purple-500/80 text-purple-200 shadow-sm ring-1 ring-purple-500/50'
                              : 'bg-[#181818] border-[#2E2E2E] text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60'
                          }`}
                        >
                          {mem.memory_type === 'decision' ? (
                            <Lightbulb size={12} className="text-emerald-400 shrink-0" />
                          ) : mem.memory_type === 'bug' ? (
                            <Bug size={12} className="text-rose-400 shrink-0" />
                          ) : mem.memory_type === 'requirement' ? (
                            <ListTodo size={12} className="text-purple-400 shrink-0" />
                          ) : (
                            <Layers size={12} className="text-sky-400 shrink-0" />
                          )}
                          <span className="font-mono text-[10px] uppercase text-zinc-400">
                            {mem.memory_type}
                          </span>
                          <span className="truncate max-w-[240px] text-xs font-medium">
                            {mem.summary}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Memory Influence Detail */}
                  {selectedMemory && (
                    <div className="p-3 bg-[#161616] border border-purple-900/40 rounded text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-purple-300 font-mono">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <Sparkles size={12} className="text-purple-400" />
                          How this influenced the plan:
                        </span>
                        <span className="text-zinc-500 text-[10px]">
                          Memory ID: {selectedMemory.id.slice(0, 8)}
                        </span>
                      </div>

                      <p className="text-zinc-200 text-xs leading-relaxed">
                        {selectedMemory.memory_type === 'decision'
                          ? `The AI agent adhered to this architectural choice ("${selectedMemory.summary}") and aligned module structures and libraries accordingly.`
                          : selectedMemory.memory_type === 'bug'
                          ? `The agent took into account previous bug fixes ("${selectedMemory.summary}") to avoid regression and error loops.`
                          : selectedMemory.memory_type === 'requirement'
                          ? `The agent reused established specifications ("${selectedMemory.summary}") to ensure compatibility.`
                          : `The agent factored in codebase architectural rules ("${selectedMemory.summary}").`}
                      </p>

                      {selectedMemory.details && (selectedMemory.details.context || selectedMemory.details.fix) && (
                        <div className="pt-1.5 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                          <span className="font-semibold text-zinc-300">Context / Fix: </span>
                          <span>{selectedMemory.details.context || selectedMemory.details.fix}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Middle Section: b) REQUIREMENTS & c) AMBIGUITIES */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* b) REQUIREMENTS List */}
            <div className="p-3.5 bg-[#202020] border border-[#2D2D2D] rounded-md space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                  Explicit Requirements ({compiledSpec.explicit_requirements?.length || 0})
                </span>
                {isEditingSpec && (
                  <button
                    onClick={() => {
                      const current = compiledSpec.explicit_requirements || [];
                      editSpec({ explicit_requirements: [...current, 'New requirement'] });
                    }}
                    className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <Plus size={11} /> Add
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {compiledSpec.explicit_requirements?.map((req, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-[#181818] p-2 rounded border border-zinc-800/60">
                    <span className="font-mono text-zinc-500 text-[11px] font-bold shrink-0">{idx + 1}.</span>
                    {isEditingSpec ? (
                      <input
                        type="text"
                        value={req}
                        onChange={(e) => {
                          const updated = [...compiledSpec.explicit_requirements];
                          updated[idx] = e.target.value;
                          editSpec({ explicit_requirements: updated });
                        }}
                        className="flex-1 bg-transparent text-zinc-200 text-xs border-b border-zinc-700 focus:outline-none focus:border-blue-400"
                      />
                    ) : (
                      <span className="text-zinc-200 leading-snug">{req}</span>
                    )}
                    {isEditingSpec && (
                      <button
                        onClick={() => {
                          const updated = compiledSpec.explicit_requirements.filter((_, i) => i !== idx);
                          editSpec({ explicit_requirements: updated });
                        }}
                        className="text-zinc-500 hover:text-rose-400 shrink-0"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* c) AMBIGUITIES Section (Yellow Warning Box) */}
            <div className="p-3.5 bg-amber-950/20 border border-amber-800/50 rounded-md space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-amber-400" />
                  Ambiguities & Missing Info
                </span>
                <span className="text-[10px] text-amber-400/80 font-mono">
                  {(compiledSpec.ambiguities?.length || 0) + (compiledSpec.missing_info?.length || 0)} flags
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {compiledSpec.ambiguities?.length === 0 && compiledSpec.missing_info?.length === 0 ? (
                  <div className="text-zinc-400 text-xs flex items-center gap-1.5 py-4 justify-center">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>No critical ambiguities or missing information detected.</span>
                  </div>
                ) : (
                  <>
                    {compiledSpec.ambiguities?.map((amb, idx) => (
                      <div
                        key={`amb-${idx}`}
                        className="flex items-start gap-2 bg-amber-950/40 p-2 rounded border border-amber-800/40 text-amber-200 text-xs"
                      >
                        <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{amb}</span>
                      </div>
                    ))}
                    {compiledSpec.missing_info?.map((mis, idx) => (
                      <div
                        key={`mis-${idx}`}
                        className="flex items-start gap-2 bg-zinc-900/60 p-2 rounded border border-zinc-700/60 text-zinc-300 text-xs"
                      >
                        <HelpCircle size={12} className="text-blue-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{mis}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* d) IMPLEMENTATION PLAN */}
          <div className="p-3.5 bg-[#202020] border border-[#2D2D2D] rounded-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                <FileCode size={14} className="text-blue-400" />
                Implementation Plan ({compiledSpec.implementation_steps?.length || 0} steps)
              </span>
              {compiledSpec.new_files_needed?.length > 0 && (
                <span className="text-[10px] text-emerald-400 font-mono">
                  + {compiledSpec.new_files_needed.length} new files needed
                </span>
              )}
            </div>

            <div className="space-y-2">
              {compiledSpec.implementation_steps?.map((stepItem: ImplementationStep, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 bg-[#181818] p-2.5 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {stepItem.step || idx + 1}
                    </span>

                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 border border-zinc-700 shrink-0">
                      {getStepActionIcon(stepItem.type)}
                      <span>{stepItem.type}</span>
                    </span>

                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-900 text-blue-300 border border-blue-900/40 shrink-0 max-w-[200px] truncate">
                      {stepItem.file}
                    </span>

                    <span className="text-zinc-200 text-xs truncate flex-1">{stepItem.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* e) ACCEPTANCE CRITERIA */}
          <div className="p-3.5 bg-[#202020] border border-[#2D2D2D] rounded-md space-y-2.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              Acceptance Criteria ({compiledSpec.acceptance_criteria?.length || 0})
            </span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {compiledSpec.acceptance_criteria?.map((crit, idx) => (
                <div
                  key={idx}
                  onClick={() => toggleCriterion(idx)}
                  className="flex items-start gap-2.5 bg-[#181818] p-2 rounded border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!checkedCriteria[idx]}
                    onChange={() => {}}
                    className="mt-0.5 rounded bg-zinc-900 border-zinc-700 text-blue-500 focus:ring-0 cursor-pointer"
                  />
                  <span
                    className={`text-xs leading-snug select-none ${
                      checkedCriteria[idx] ? 'text-zinc-500 line-through' : 'text-zinc-200'
                    }`}
                  >
                    {crit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Controls Row: [Edit Spec] [Cancel] [Execute Plan] */}
          <div className="pt-2 border-t border-[#2D2D2D] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingSpec(!isEditingSpec)}
                className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-1.5 transition-colors"
              >
                {isEditingSpec ? <Check size={13} className="text-emerald-400" /> : <Pencil size={13} />}
                <span>{isEditingSpec ? 'Save Changes' : 'Edit Spec'}</span>
              </button>

              <button
                onClick={() => setIsPanelOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-medium bg-transparent hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-3">
              {!canExecute && (
                <span className="text-[11px] text-amber-400/90 font-mono">
                  Confidence must be ≥ 40% to execute
                </span>
              )}

              <button
                disabled={!canExecute}
                onClick={() => executeSpec()}
                className={`px-4 py-2 rounded text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                  canExecute
                    ? 'bg-[#007ACC] hover:bg-[#0062a3] text-white cursor-pointer shadow-blue-900/30'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                }`}
              >
                <Play size={13} className={canExecute ? 'fill-current' : ''} />
                <span>Execute Plan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
