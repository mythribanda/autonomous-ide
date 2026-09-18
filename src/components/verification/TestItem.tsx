import React, { useState } from 'react';
import { TestCase } from '../../types';
import { CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react';

interface TestItemProps {
  test: TestCase;
  onAnalyze?: (test: TestCase) => void;
}

export const TestItem: React.FC<TestItemProps> = ({ test, onAnalyze }) => {
  const [expanded, setExpanded] = useState(test.status === 'failed');

  const isFailed = test.status === 'failed';

  return (
    <div
      className={`rounded-sm border text-xs font-mono transition-all ${
        isFailed
          ? 'bg-[#F14C4C]/5 border-[#F14C4C]/30'
          : 'bg-[#181818] border-[#2B2B2B] hover:border-[#3C3C3C]'
      }`}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-2 flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button className="text-[#858585] hover:text-[#CCCCCC]">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {isFailed ? (
            <AlertCircle size={14} className="text-[#F14C4C] flex-shrink-0" />
          ) : (
            <CheckCircle2 size={14} className="text-[#89D185] flex-shrink-0" />
          )}
          <span className="font-semibold text-[#CCCCCC] truncate">{test.name}</span>
          <span className="text-[10px] text-[#858585] uppercase">[{test.suite}]</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] text-[#858585] flex items-center gap-1">
            <Clock size={11} /> {test.durationMs}ms
          </span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-xs uppercase ${
              isFailed ? 'bg-[#F14C4C]/20 text-[#F14C4C]' : 'bg-[#89D185]/15 text-[#89D185]'
            }`}
          >
            {test.status}
          </span>
        </div>
      </div>

      {expanded && test.error && (
        <div className="px-3 pb-3 pt-2 border-t border-[#F14C4C]/20 space-y-2 bg-[#1E1E1E]">
          <div className="text-[#F14C4C] font-semibold text-xs">{test.error.message}</div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2 rounded-sm bg-[#181818] border border-[#89D185]/30">
              <span className="text-[#858585] text-[10px] block">Expected</span>
              <span className="text-[#89D185] font-bold">{test.error.expected}</span>
            </div>
            <div className="p-2 rounded-sm bg-[#181818] border border-[#F14C4C]/30">
              <span className="text-[#858585] text-[10px] block">Received</span>
              <span className="text-[#F14C4C] font-bold">{test.error.received}</span>
            </div>
          </div>

          <div className="p-2 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[10px] text-[#858585] overflow-x-auto whitespace-pre font-mono">
            {test.error.stack}
          </div>

          {onAnalyze && (
            <div className="flex justify-end pt-1">
              <button
                onClick={() => onAnalyze(test)}
                className="px-2.5 py-1 rounded-sm bg-[#F14C4C]/15 hover:bg-[#F14C4C]/25 text-[#F14C4C] border border-[#F14C4C]/40 text-xs font-semibold transition-colors"
              >
                Analyze Error & Auto-Fix
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
