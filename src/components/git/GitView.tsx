import React from 'react';
import { useGitStore } from '../../stores/gitStore';
import { useUIStore } from '../../stores/uiStore';
import { CheckpointTimeline } from './CheckpointTimeline';
import { DiffViewerModal } from '../editor/DiffViewerModal';
import {
  GitBranch,
  GitCommit,
  FileDiff,
  Check,
  Sparkles
} from 'lucide-react';

export const GitView: React.FC = () => {
  const {
    currentBranch,
    changes,
    commitMessage,
    setCommitMessage,
    toggleStageChange,
    stageAll,
    unstageAll,
    commitChanges,
    openDiffModal,
    createCheckpoint
  } = useGitStore();
  const { addToast } = useUIStore();

  const stagedChanges = changes.filter((c) => c.staged);

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim()) return;
    commitChanges();
    addToast({
      type: 'success',
      title: 'Committed to Git',
      message: `Created commit on branch "${currentBranch}".`
    });
  };

  const handleCreateCheckpoint = async () => {
    await createCheckpoint('Manual User Snapshot');
    addToast({
      type: 'info',
      title: 'AI Checkpoint Created',
      message: 'Created atomic safety snapshot in git index.'
    });
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <GitBranch size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                SOURCE CONTROL: GIT
              </h1>
              <span className="px-2 py-0.2 rounded-xs bg-[#007ACC]/20 text-[#3794FF] font-mono text-xs font-semibold border border-[#007ACC]/30">
                {currentBranch}
              </span>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Inspect staged changes, create commits, and manage checkpoints.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateCheckpoint}
            className="px-3 py-1.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Sparkles size={12} className="text-[#007ACC]" />
            <span>Create AI Checkpoint</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Changes & Commit Box */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Working Tree Changes */}
        <div className="lg:col-span-2 space-y-3">
          <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-1.5">
                <FileDiff size={14} className="text-[#007ACC]" />
                <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
                  CHANGES ({changes.length})
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <button
                  onClick={stageAll}
                  className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border border-[#2B2B2B] transition-colors"
                >
                  Stage All
                </button>
                <button
                  onClick={unstageAll}
                  className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border border-[#2B2B2B] transition-colors"
                >
                  Unstage All
                </button>
              </div>
            </div>

            {/* Changes list */}
            <div className="space-y-1">
              {changes.length === 0 ? (
                <div className="p-4 text-center text-xs text-[#858585] font-mono">
                  Working tree clean. No uncommitted modifications.
                </div>
              ) : (
                changes.map((change) => {
                  const statusColor = {
                    M: 'text-[#E2C08D] bg-[#E2C08D]/10 border-[#E2C08D]/30',
                    A: 'text-[#89D185] bg-[#89D185]/10 border-[#89D185]/30',
                    D: 'text-[#F14C4C] bg-[#F14C4C]/10 border-[#F14C4C]/30',
                    U: 'text-[#3794FF] bg-[#3794FF]/10 border-[#3794FF]/30'
                  }[change.status];

                  return (
                    <div
                      key={change.file}
                      className="p-2 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] hover:border-[#3C3C3C] transition-all flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={() => toggleStageChange(change.file)}
                          className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors ${
                            change.staged
                              ? 'bg-[#007ACC] border-[#007ACC] text-[#FFFFFF]'
                              : 'border-[#858585] hover:border-[#CCCCCC] text-transparent'
                          }`}
                          title={change.staged ? 'Unstage' : 'Stage'}
                        >
                          <Check size={11} className="stroke-[3]" />
                        </button>

                        <span className={`px-1.5 py-0.2 rounded-xs border text-[10px] font-bold ${statusColor}`}>
                          {change.status}
                        </span>

                        <span className="font-semibold text-[#CCCCCC] truncate text-xs">{change.file}</span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-[11px] text-[#89D185]">+{change.additions}</span>
                        <span className="text-[11px] text-[#F14C4C]">-{change.deletions}</span>

                        <button
                          onClick={() => openDiffModal(change)}
                          className="px-2 py-0.5 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#007ACC] text-xs font-mono border border-[#2B2B2B] flex items-center gap-1 transition-colors"
                        >
                          <FileDiff size={12} />
                          <span>View Diff</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right: Commit Panel */}
        <div className="space-y-3">
          <form
            onSubmit={handleCommit}
            className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3 select-none"
          >
            <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-1.5">
                <GitCommit size={14} className="text-[#89D185]" />
                <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
                  COMMIT ({stagedChanges.length} STAGED)
                </h3>
              </div>
            </div>

            <textarea
              rows={4}
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Message (Ctrl+Enter to commit)..."
              className="w-full p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] text-xs font-mono text-[#FFFFFF] placeholder-[#858585] focus:outline-none focus:border-[#007ACC] transition-colors resize-none"
            />

            <button
              type="submit"
              disabled={!commitMessage.trim() || changes.length === 0}
              className="w-full py-1.5 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <GitCommit size={13} />
              <span>Commit</span>
            </button>
          </form>
        </div>
      </div>

      {/* Checkpoints Timeline */}
      <CheckpointTimeline />

      {/* Diff Viewer Modal */}
      <DiffViewerModal />
    </div>
  );
};
