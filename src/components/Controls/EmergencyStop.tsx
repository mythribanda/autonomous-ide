import React, { useState } from 'react';
import { Square } from 'lucide-react';
import { useAgentStore } from '../../store/agentStore';
import { useUIStore } from '../../stores/uiStore';

export const EmergencyStop: React.FC = () => {
  const { agentStatus, stopAgent } = useAgentStore();
  const { addToast } = useUIStore();
  const [showConfirm, setShowConfirm] = useState(false);
  const [stopping, setStopping] = useState(false);

  const isActive =
    agentStatus === 'executing' ||
    agentStatus === 'recovering' ||
    agentStatus === 'verifying' ||
    agentStatus === 'paused' ||
    agentStatus === 'waiting_approval';

  if (!isActive) return null;

  const handleConfirm = async () => {
    setStopping(true);
    setShowConfirm(false);
    await stopAgent();
    setStopping(false);
    addToast({
      type: 'warning',
      title: 'Agent stopped',
      message: 'Execution was halted. Changes made so far are preserved.'
    });
  };

  return (
    <>
      {/* Floating emergency stop button */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={stopping}
        title="Emergency stop — halt agent execution immediately"
        className={`
          fixed bottom-9 right-5 z-40
          flex items-center justify-center
          w-10 h-10 rounded-full
          bg-red-600 hover:bg-red-500 active:bg-red-700
          text-white shadow-lg shadow-red-900/50
          transition-all duration-200
          ${stopping ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}
          ring-2 ring-red-700 ring-offset-1 ring-offset-[#1E1E1E]
        `}
      >
        <Square className="w-4 h-4 fill-current" />
      </button>

      {/* Confirmation overlay */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-6 pointer-events-none">
          <div
            className="bg-[#1E1E1E] border border-red-500/50 rounded-lg shadow-2xl p-4 max-w-xs w-full pointer-events-auto
                        animate-in slide-in-from-bottom-2 duration-200"
          >
            <p className="text-[#CCCCCC] text-sm font-medium mb-1">Stop the agent?</p>
            <p className="text-[#9D9D9D] text-xs mb-4 leading-relaxed">
              This will halt execution but not undo changes already made.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-xs text-[#9D9D9D] hover:text-[#CCCCCC] border border-[#3C3C3C] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Stop agent
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
