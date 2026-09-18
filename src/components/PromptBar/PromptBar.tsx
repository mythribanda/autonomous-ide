import React, { useRef, useEffect } from 'react';
import {
  Sparkles,
  Paperclip,
  X,
  File,
  Loader2,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { usePromptStore, PromptMode } from '../../store/promptStore';
import { CompilerPanel } from './CompilerPanel';

export const PromptBar: React.FC = () => {
  const {
    requirement,
    setRequirement,
    mode,
    setMode,
    attachedFiles,
    addAttachedFiles,
    removeAttachedFile,
    compileRequirement,
    isCompiling,
    compiledSpec,
    isPanelOpen,
    setIsPanelOpen
  } = usePromptStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;

  // Auto-grow textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        Math.max(textareaRef.current.scrollHeight, 38),
        150
      )}px`;
    }
  }, [requirement]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isCompiling && requirement.trim()) {
        compileRequirement(requirement, mode);
      }
    }
  };

  const handleAttachFile = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openFile) {
      try {
        const res = await (window as any).electronAPI.openFile();
        if (res) {
          const files = Array.isArray(res) ? res : [res];
          addAttachedFiles(files);
        }
        return;
      } catch (err) {
        console.warn('Electron openFile failed, falling back to browser input:', err);
      }
    }

    // Web fallback file input
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: any) => {
      const selected = Array.from(e.target.files || []).map((f: any) => f.name);
      addAttachedFiles(selected);
    };
    input.click();
  };

  const confidencePercent = compiledSpec ? Math.round(compiledSpec.confidence_score * 100) : null;

  return (
    <div className="w-full flex flex-col z-20 shrink-0 border-b border-[#2D2D2D] bg-[#1E1E1E]">
      {/* Main Command Bar Container */}
      <div className="p-3 bg-[#1E1E1E] border-b border-[#252526]">
        <div className="w-full max-w-5xl mx-auto rounded-lg bg-[#252526] border border-[#3C3C3C] shadow-lg focus-within:border-[#007ACC] focus-within:shadow-[0_0_12px_rgba(0,122,204,0.25)] transition-all flex flex-col overflow-hidden">
          {/* File Attachment Chips */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5 pb-1 border-b border-[#303030]">
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider mr-1">
                Context Files:
              </span>
              {attachedFiles.map((file, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-[#1E1E1E] text-blue-300 border border-zinc-700/80"
                >
                  <File size={11} className="text-zinc-400" />
                  <span className="truncate max-w-[180px]">{file}</span>
                  <button
                    onClick={() => removeAttachedFile(file)}
                    className="hover:text-rose-400 text-zinc-500 transition-colors ml-0.5"
                    title="Remove file"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Prompt Multi-line Auto-growing Input */}
          <div className="flex items-start px-3 py-2 gap-2.5">
            <div className="pt-1 text-zinc-400 shrink-0">
              <Bot size={16} className="text-[#007ACC]" />
            </div>

            <textarea
              ref={textareaRef}
              rows={1}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to build or change? (e.g. 'Add dark mode toggle to navigation and persist in localStorage')..."
              className="flex-1 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none leading-relaxed font-sans min-h-[38px] max-h-[150px]"
            />
          </div>

          {/* Bottom Controls Bar */}
          <div className="px-3 py-2 bg-[#202020] border-t border-[#2E2E2E] flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Left Controls: Mode Pill Selector & Attach File */}
            <div className="flex items-center gap-3">
              {/* Three Mode Selector Pills */}
              <div className="flex items-center bg-[#181818] p-0.5 rounded-full border border-zinc-700/80 text-[11px] font-medium">
                {(['Assist', 'Guided', 'Autonomous'] as PromptMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-2.5 py-1 rounded-full transition-all ${
                      mode === m
                        ? 'bg-[#007ACC] text-white shadow-sm font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80'
                    }`}
                    title={
                      m === 'Assist'
                        ? 'Assist: Interactive review of every modification'
                        : m === 'Guided'
                        ? 'Guided: Compiles spec and requests approval before execution (Recommended)'
                        : 'Autonomous: End-to-end autonomous compilation and execution'
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Attach File Button */}
              <button
                type="button"
                onClick={handleAttachFile}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181818] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 text-[11px] font-sans transition-colors"
                title="Attach project file for semantic context"
              >
                <Paperclip size={12} className="text-zinc-400" />
                <span>Attach File</span>
              </button>
            </div>

            {/* Right Controls: Character count, Confidence badge, Submit button */}
            <div className="flex items-center gap-3">
              {/* Character Count */}
              <span className="text-[11px] font-mono text-zinc-500 select-none">
                {requirement.length} chars
              </span>

              {/* Confidence Indicator Pill (appears after compilation) */}
              {confidencePercent !== null && (
                <button
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border transition-colors ${
                    confidencePercent >= 70
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/60'
                      : confidencePercent >= 40
                      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
                      : 'bg-rose-950/60 text-rose-300 border-rose-800/80 hover:bg-rose-900/60'
                  }`}
                  title="Click to toggle specification details panel"
                >
                  <span>Confidence: {confidencePercent}%</span>
                  {isPanelOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                </button>
              )}

              {/* Spec Toggle Button if already compiled */}
              {compiledSpec && confidencePercent === null && (
                <button
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <span>Spec Details</span>
                  {isPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={isCompiling || !requirement.trim()}
                onClick={() => compileRequirement(requirement, mode)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded text-xs font-semibold shadow-md transition-all ${
                  isCompiling || !requirement.trim()
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
                    : 'bg-[#007ACC] hover:bg-[#0062a3] text-white cursor-pointer shadow-blue-900/20 active:scale-98'
                }`}
              >
                {isCompiling ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Compiling...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Compile</span>
                    <span className="text-[10px] font-mono opacity-60 bg-black/30 px-1 py-0.2 rounded border border-white/10 ml-0.5">
                      {isMac ? '⌘↵' : 'Ctrl+↵'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-down Compiler Panel */}
      {isPanelOpen && <CompilerPanel />}
    </div>
  );
};
