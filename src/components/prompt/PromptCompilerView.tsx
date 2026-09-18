import React from 'react';
import { usePromptStore } from '../../stores/promptStore';
import { SpecificationView } from './SpecificationView';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';

export const PromptCompilerView: React.FC = () => {
  const { rawPrompt, setRawPrompt, compileRequirement, isCompiling, spec } = usePromptStore();

  const handleCompile = (e: React.FormEvent) => {
    e.preventDefault();
    compileRequirement();
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <Sparkles size={14} />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
              PROMPT COMPILER
            </h1>
            <p className="text-xs text-[#858585]">
              Turn an idea into an executable engineering specification.
            </p>
          </div>
        </div>
      </div>

      {/* Input Prompt Section */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2.5">
        <label className="text-xs font-bold text-[#CCCCCC] font-mono tracking-wider flex items-center gap-2">
          <span>REQUIREMENT PROMPT</span>
        </label>

        <form onSubmit={handleCompile} className="space-y-2.5">
          <textarea
            rows={3}
            value={rawPrompt}
            onChange={(e) => setRawPrompt(e.target.value)}
            placeholder="What do you want to build or change?"
            className="w-full p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] text-xs text-[#FFFFFF] placeholder-[#858585] focus:outline-none focus:border-[#007ACC] transition-colors resize-none font-sans"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-[#858585]">Examples:</span>
              <button
                type="button"
                onClick={() => setRawPrompt('Add attendance tracking to my student application')}
                className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] text-[11px] font-mono border border-[#2B2B2B] transition-colors"
              >
                Attendance Tracking
              </button>
              <button
                type="button"
                onClick={() => setRawPrompt('Add phone number to Student model and REST endpoints')}
                className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] text-[11px] font-mono border border-[#2B2B2B] transition-colors"
              >
                Student Phone Field
              </button>
            </div>

            <button
              type="submit"
              disabled={isCompiling || !rawPrompt.trim()}
              className="px-4 py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isCompiling ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Compiling Specification...</span>
                </>
              ) : (
                <>
                  <Wand2 size={13} />
                  <span>Compile Requirement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Compiled Specification Result */}
      {spec && <SpecificationView spec={spec} />}
    </div>
  );
};
