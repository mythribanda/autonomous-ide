import React from 'react';
import { useGitStore } from '../../stores/gitStore';
import { useUIStore } from '../../stores/uiStore';
import { GitCheckpoint } from '../../types';
import { GitCommit, RotateCcw, Clock, User } from 'lucide-react';
import { Badge } from '../common/Badge';

export const CheckpointTimeline: React.FC = () => {
  const { checkpoints, rollbackToCheckpoint } = useGitStore();
  const { addToast } = useUIStore();

  const handleRollback = (cp: GitCheckpoint) => {
    rollbackToCheckpoint(cp.commitHash);
    addToast({
      type: 'warning',
      title: 'Rollback Executed',
      message: `Restored workspace files to snapshot ${cp.commitHash}.`
    });
  };

  const getCheckpointBadge = (type: GitCheckpoint['type']) => {
    switch (type) {
      case 'ai_pre_change':
        return <Badge variant="blue" size="xs">AI Pre-Change Safe Point</Badge>;
      case 'ai_post_change':
        return <Badge variant="emerald" size="xs">AI Verified</Badge>;
      case 'recovery_point':
        return <Badge variant="amber" size="xs">Auto-Recovery Point</Badge>;
      default:
        return <Badge variant="default" size="xs">Manual Commit</Badge>;
    }
  };

  return (
    <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-1.5">
          <GitCommit size={14} className="text-[#007ACC]" />
          <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
            AI CHECKPOINTS & COMMIT TIMELINE
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#858585]">Safe Rollbacks</span>
      </div>

      <div className="space-y-2">
        {checkpoints.map((cp) => (
          <div
            key={cp.id}
            className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] hover:border-[#3C3C3C] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#007ACC] px-1.5 py-0.2 rounded-xs bg-[#007ACC]/10 border border-[#007ACC]/30">
                  {cp.commitHash}
                </span>
                {getCheckpointBadge(cp.type)}
                <span className="text-[#858585] text-[10px] flex items-center gap-1">
                  <Clock size={10} /> {cp.timestamp}
                </span>
              </div>

              <div className="font-semibold text-[#CCCCCC]">{cp.message}</div>

              <div className="text-[11px] text-[#858585] flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <User size={11} /> {cp.author}
                </span>
                <span>• {cp.filesChanged} files touched</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleRollback(cp)}
                className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] hover:text-[#FFFFFF] border border-[#2B2B2B] text-xs flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={12} className="text-[#CCA700]" />
                <span>Rollback</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
