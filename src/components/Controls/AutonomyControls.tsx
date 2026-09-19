import React, { useState } from 'react';
import { Pause, Play, Square, AlertCircle } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { useUIStore } from '../../stores/uiStore';
import { ModeSelector } from './ModeSelector';

interface ConfirmStopDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmStopDialog: React.FC<ConfirmStopDialogProps> = ({ onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div className="bg-[#252526] border border-[#3C3C3C] rounded-lg shadow-2xl p-6 max-w-sm w-full mx-4">
      <div className="flex items-center gap-3 mb-4">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <h3 className="text-[#CCCCCC] font-semibold text-sm">Stop the agent?</h3>
      </div>
      <p className="text-[#9D9D9D] text-xs mb-5 leading-relaxed">
        This will halt execution immediately. Changes already made will not be undone.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-[#9D9D9D] hover:text-[#CCCCCC] border border-[#3C3C3C] rounded transition-colors"
        >
          Keep running
        </button>
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
        >
          Stop agent
        </button>
      </div>
    </div>
  </div>
);

export const AutonomyControls: React.FC = () => {
  const { agentStatus, pauseAgent, resumeAgent, stopAgent } = useAgentStore();
  const { addToast } = useUIStore();
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const isExecuting = agentStatus === 'executing' || agentStatus === 'recovering' || agentStatus === 'verifying';
  const isPaused = agentStatus === 'paused';
  const isWaitingApproval = agentStatus === 'waiting_approval';
  const isActive = isExecuting || isPaused || isWaitingApproval;

  const handlePause = async () => {
    await pauseAgent();
    addToast({ type: 'info', title: 'Agent paused', message: 'Execution will pause after the current step.' });
  };

  const handleResume = async () => {
    await resumeAgent();
    addToast({ type: 'success', title: 'Agent resumed', message: 'Execution is continuing.' });
  };

  const handleStop = async () => {
    setShowStopConfirm(false);
    await stopAgent();
    addToast({ type: 'warning', title: 'Agent stopped', message: 'Execution was halted by user.' });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Mode selector always visible */}
        <ModeSelector compact />

        {/* Waiting for approval badge */}
        {isWaitingApproval && (
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/15 border border-orange-500/40 text-orange-400 text-xs font-medium animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 inline-block" />
            Waiting for approval
          </span>
        )}

        {/* Pause / Resume when executing or paused */}
        {isActive && !isWaitingApproval && (
          <>
            {isExecuting && (
              <button
                onClick={handlePause}
                title="Pause agent (finish current step first)"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-[#9D9D9D] hover:text-[#CCCCCC] hover:bg-[#2D2D2D] border border-[#3C3C3C] transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </button>
            )}

            {isPaused && (
              <button
                onClick={handleResume}
                title="Resume agent execution"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/30 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
            )}

            {/* Stop — always visible when agent is running or paused */}
            <button
              onClick={() => setShowStopConfirm(true)}
              title="Stop agent"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          </>
        )}
      </div>

      {/* Stop confirmation dialog */}
      {showStopConfirm && (
        <ConfirmStopDialog
          onConfirm={handleStop}
          onCancel={() => setShowStopConfirm(false)}
        />
      )}
    </>
  );
};
