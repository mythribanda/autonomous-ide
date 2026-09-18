import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { FileIcon } from '../explorer/FileIcon';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export const EditorTabs: React.FC = () => {
  const { openFiles, activeFileId, setActiveFile, closeFile } = useProjectStore();

  if (openFiles.length === 0) return null;

  return (
    <div className="h-8 border-b border-[#2B2B2B] bg-[#181818] flex items-center overflow-x-auto select-none no-scrollbar">
      {openFiles.map((file) => {
        const isActive = file.id === activeFileId;

        return (
          <div
            key={file.id}
            onClick={() => setActiveFile(file.id)}
            className={clsx(
              'group h-full px-3 flex items-center gap-2 border-r border-[#2B2B2B] cursor-pointer text-xs font-sans transition-colors relative min-w-[120px] max-w-[200px]',
              isActive
                ? 'bg-[#1E1E1E] text-[#FFFFFF] border-t-2 border-t-[#007ACC]'
                : 'bg-[#181818] text-[#858585] hover:bg-[#1E1E1E]/50 hover:text-[#CCCCCC]'
            )}
          >
            <FileIcon name={file.name} size={13} />
            <span className="truncate flex-1 text-xs">{file.name}</span>

            {/* Modified Dot or Close Button */}
            <div className="flex items-center">
              {file.isModified ? (
                <span className="w-2 h-2 rounded-full bg-[#E2C08D] group-hover:hidden" />
              ) : null}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file.id);
                }}
                className={clsx(
                  'p-0.5 rounded-sm hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF] transition-colors',
                  file.isModified ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                )}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
