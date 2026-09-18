import React from 'react';
import { useGitStore } from '../../stores/gitStore';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { Check, X, FileDiff } from 'lucide-react';

export const DiffViewerModal: React.FC = () => {
  const { selectedDiffFile, isDiffModalOpen, closeDiffModal, toggleStageChange } = useGitStore();

  if (!selectedDiffFile) return null;

  const lines = selectedDiffFile.diff.split('\n');

  return (
    <Modal
      isOpen={isDiffModalOpen}
      onClose={closeDiffModal}
      title={`Diff: ${selectedDiffFile.file}`}
      subtitle={`Status: ${selectedDiffFile.status === 'M' ? 'Modified' : 'Added'} • +${selectedDiffFile.additions} -${selectedDiffFile.deletions}`}
      maxWidth="4xl"
    >
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between p-2 rounded-sm bg-[#181818] border border-[#2B2B2B]">
          <div className="flex items-center gap-2">
            <FileDiff size={15} className="text-[#007ACC]" />
            <span className="text-[#CCCCCC]">{selectedDiffFile.file}</span>
            <Badge variant={selectedDiffFile.staged ? 'emerald' : 'amber'}>
              {selectedDiffFile.staged ? 'Staged' : 'Unstaged'}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStageChange(selectedDiffFile.file)}
              className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] text-xs flex items-center gap-1.5 transition-colors"
            >
              {selectedDiffFile.staged ? (
                <>
                  <X size={13} /> Unstage
                </>
              ) : (
                <>
                  <Check size={13} className="text-[#89D185]" /> Stage Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Diff Code Container */}
        <div className="rounded-sm border border-[#2B2B2B] bg-[#1E1E1E] p-2 overflow-x-auto max-h-96">
          {lines.map((line, idx) => {
            const isAdd = line.startsWith('+');
            const isDel = line.startsWith('-');
            const isHeader = line.startsWith('@@') || line.startsWith('diff');

            let lineBg = 'text-[#CCCCCC]';
            if (isAdd) lineBg = 'bg-[#89D185]/15 text-[#89D185]';
            if (isDel) lineBg = 'bg-[#F14C4C]/15 text-[#F14C4C]';
            if (isHeader) lineBg = 'text-[#3794FF] bg-[#007ACC]/10 font-semibold';

            return (
              <div key={idx} className={`px-2 py-[2px] whitespace-pre font-mono rounded-xs ${lineBg}`}>
                <span className="inline-block w-8 text-[#858585] select-none text-[11px]">{idx + 1}</span>
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
