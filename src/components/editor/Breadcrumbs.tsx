import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ChevronRight, Sparkles } from 'lucide-react';
import { FileIcon } from '../explorer/FileIcon';

export const Breadcrumbs: React.FC = () => {
  const { openFiles, activeFileId } = useProjectStore();
  const activeFile = openFiles.find((f) => f.id === activeFileId);

  if (!activeFile) return null;

  const parts = activeFile.path.split('/').filter(Boolean);

  return (
    <div className="h-6 px-3 border-b border-[#2B2B2B] bg-[#1E1E1E] flex items-center justify-between text-xs font-sans text-[#858585] select-none">
      <div className="flex items-center gap-1 overflow-x-auto">
        <span className="text-[#858585] hover:text-[#CCCCCC] cursor-pointer">EduSim</span>
        {parts.map((part, index) => {
          const isLast = index === parts.length - 1;
          return (
            <React.Fragment key={index}>
              <ChevronRight size={12} className="text-[#858585]/60 flex-shrink-0" />
              <span
                className={`flex items-center gap-1 hover:text-[#FFFFFF] transition-colors cursor-pointer ${
                  isLast ? 'text-[#CCCCCC]' : ''
                }`}
              >
                {isLast && <FileIcon name={part} size={12} />}
                {part}
              </span>
            </React.Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        {activeFile.isModified && (
          <span className="text-[#E2C08D] font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E2C08D]" /> Modified
          </span>
        )}
        <div className="flex items-center gap-1 px-1.5 py-0.2 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[#007ACC] text-[10px] font-mono">
          <Sparkles size={10} />
          <span>AI Monitored</span>
        </div>
      </div>
    </div>
  );
};
