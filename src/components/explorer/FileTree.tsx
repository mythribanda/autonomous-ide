import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { FileNode } from '../../types';
import { FileIcon } from './FileIcon';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface FileTreeProps {
  node: FileNode;
  level?: number;
}

export const FileTree: React.FC<FileTreeProps> = ({ node, level = 0 }) => {
  const { activeFileId, openFile, toggleFolder, expandedFolders, searchQuery } = useProjectStore();

  const isFolder = node.type === 'folder';
  const isExpanded = expandedFolders[node.id] || false;
  const isSelected = activeFileId === node.id;

  // Filter search
  if (searchQuery && !isFolder) {
    if (!node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return null;
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      toggleFolder(node.id);
    } else {
      openFile(node);
    }
  };

  const getStatusBadge = () => {
    if (node.status === 'modified') {
      return <span className="text-[11px] font-mono font-bold text-[#E2C08D] ml-auto pr-1">M</span>;
    }
    if (node.status === 'added') {
      return <span className="text-[11px] font-mono font-bold text-[#89D185] ml-auto pr-1">A</span>;
    }
    if (node.status === 'deleted') {
      return <span className="text-[11px] font-mono font-bold text-[#F14C4C] ml-auto pr-1">D</span>;
    }
    return null;
  };

  return (
    <div className="select-none text-xs font-sans">
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        className={clsx(
          'flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer transition-colors group',
          isSelected
            ? 'bg-[#264F78] text-[#FFFFFF]'
            : 'text-[#CCCCCC] hover:bg-[#2A2D2E]'
        )}
      >
        {isFolder ? (
          <span className="text-[#858585] group-hover:text-[#CCCCCC]">
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        ) : (
          <span className="w-3" />
        )}

        <FileIcon name={node.name} isFolder={isFolder} isOpen={isExpanded} size={13} />

        <span className={`truncate text-xs ${isSelected ? 'text-[#FFFFFF]' : 'text-[#CCCCCC]'}`}>
          {node.name}
        </span>

        {getStatusBadge()}
      </div>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTree key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};
