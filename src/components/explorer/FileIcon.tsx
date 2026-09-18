import React from 'react';
import {
  FileCode,
  FileJson,
  FileText,
  Boxes,
  FileSpreadsheet,
  FileTerminal,
  Folder,
  FolderOpen
} from 'lucide-react';

interface FileIconProps {
  name: string;
  isFolder?: boolean;
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  isFolder,
  isOpen,
  className = '',
  size = 14
}) => {
  if (isFolder) {
    return isOpen ? (
      <FolderOpen size={size} className={`text-[#CCCCCC] ${className}`} />
    ) : (
      <Folder size={size} className={`text-[#858585] ${className}`} />
    );
  }

  const ext = name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'tsx':
    case 'jsx':
      return <FileCode size={size} className={`text-[#3794FF] ${className}`} />;
    case 'ts':
    case 'js':
      return <FileCode size={size} className={`text-[#007ACC] ${className}`} />;
    case 'py':
      return <FileTerminal size={size} className={`text-[#CCA700] ${className}`} />;
    case 'json':
      return <FileJson size={size} className={`text-[#CCA700] ${className}`} />;
    case 'md':
      return <FileText size={size} className={`text-[#CCCCCC] ${className}`} />;
    case 'yml':
    case 'yaml':
    case 'dockerfile':
      return <Boxes size={size} className={`text-[#3794FF] ${className}`} />;
    case 'sql':
      return <FileSpreadsheet size={size} className={`text-[#E2C08D] ${className}`} />;
    default:
      return <FileText size={size} className={`text-[#858585] ${className}`} />;
  }
};
