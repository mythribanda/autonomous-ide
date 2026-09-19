import React from 'react';
import { usePromptStore, PromptMode } from '../../store/promptStore';

const MODES: { value: PromptMode; label: string; title: string }[] = [
  {
    value: 'Assist',
    label: 'Assist',
    title: 'Suggest changes — you review and apply each one'
  },
  {
    value: 'Guided',
    label: 'Guided',
    title: 'Execute steps, but ask for approval on risky actions'
  },
  {
    value: 'Autonomous',
    label: 'Auto',
    title: 'Fully autonomous — agent completes the entire task without interruption'
  }
];

interface ModeSelectorProps {
  /** When true, renders a compact pill without labels */
  compact?: boolean;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ compact = false }) => {
  const { mode, setMode } = usePromptStore();

  if (compact) {
    // Compact version for TopBar / AutonomyControls
    return (
      <div className="flex items-center gap-0.5 bg-[#1A1A1A] border border-[#3C3C3C] rounded-full p-0.5">
        {MODES.map(({ value, label, title }) => (
          <button
            key={value}
            onClick={() => setMode(value)}
            title={title}
            className={`
              px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150
              ${mode === value
                ? 'bg-[#0066B8] text-white shadow-sm'
                : 'text-[#9D9D9D] hover:text-[#CCCCCC] hover:bg-[#2D2D2D]'
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  // Full version for PromptBar or standalone use
  return (
    <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#3C3C3C] rounded-lg p-1">
      {MODES.map(({ value, title }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          title={title}
          className={`
            flex-1 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 whitespace-nowrap
            ${mode === value
              ? 'bg-[#0066B8] text-white shadow-sm'
              : 'text-[#9D9D9D] hover:text-[#CCCCCC] hover:bg-[#2D2D2D]'
            }
          `}
        >
          {value}
        </button>
      ))}
    </div>
  );
};
