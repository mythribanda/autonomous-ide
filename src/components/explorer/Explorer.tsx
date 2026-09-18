import React, { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { FileTree } from './FileTree';
import {
  FilePlus,
  FolderPlus,
  RefreshCw,
  Search,
  ChevronDown,
  X
} from 'lucide-react';

export const Explorer: React.FC = () => {
  const { rootFolder, currentProject, searchQuery, setSearchQuery, addFile } = useProjectStore();
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFileName.trim()) {
      addFile('/frontend/src/components', newFileName.trim());
      setNewFileName('');
      setIsCreatingFile(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 300);
  };

  return (
    <div className="h-full flex flex-col bg-[#181818] border-r border-[#2B2B2B] select-none text-xs">
      {/* Explorer Top Header */}
      <div className="h-8 px-3 border-b border-[#2B2B2B] flex items-center justify-between text-[#858585]">
        <div className="flex items-center gap-1 font-semibold text-[11px] uppercase tracking-wider text-[#CCCCCC]">
          <span>EXPLORER</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsCreatingFile(true)}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title="New File"
          >
            <FilePlus size={14} />
          </button>
          <button
            onClick={() => setIsCreatingFile(true)}
            className="p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors"
            title="New Folder"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={handleRefresh}
            className={`p-1 rounded-sm hover:bg-[#2A2D2E] hover:text-[#FFFFFF] transition-colors ${
              isRefreshing ? 'animate-spin text-[#007ACC]' : ''
            }`}
            title="Refresh Explorer"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-2 border-b border-[#2B2B2B] bg-[#181818]">
        <div className="relative flex items-center">
          <Search size={12} className="absolute left-2 text-[#858585]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-6 pr-6 py-1 bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm text-xs text-[#CCCCCC] placeholder-[#858585] focus:outline-none focus:border-[#007ACC] font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-[#858585] hover:text-[#FFFFFF]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Project Section Title */}
      <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-[#CCCCCC] bg-[#181818] border-b border-[#2B2B2B]/60">
        <div className="flex items-center gap-1">
          <ChevronDown size={13} className="text-[#858585]" />
          <span className="font-sans uppercase tracking-wider">{currentProject}</span>
        </div>
      </div>

      {/* New File Inline Creator */}
      {isCreatingFile && (
        <form onSubmit={handleCreateFile} className="px-3 py-1.5 bg-[#252526] border-b border-[#2B2B2B]">
          <input
            autoFocus
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="FileName.tsx"
            className="w-full px-2 py-0.5 bg-[#1E1E1E] border border-[#007ACC] rounded-sm text-xs font-mono text-[#FFFFFF] focus:outline-none"
            onBlur={() => {
              if (!newFileName.trim()) setIsCreatingFile(false);
            }}
          />
        </form>
      )}

      {/* Project Tree */}
      <div className="flex-1 overflow-y-auto py-1 space-y-[1px]">
        <FileTree node={rootFolder} />
      </div>

      {/* Active Autonomous Status in Explorer */}
      <div className="px-3 py-1.5 border-t border-[#2B2B2B] bg-[#181818] text-[11px] font-mono flex items-center justify-between">
        <span className="text-[#858585]">AST Indexed</span>
        <span className="text-[#89D185]">312 files</span>
      </div>
    </div>
  );
};
