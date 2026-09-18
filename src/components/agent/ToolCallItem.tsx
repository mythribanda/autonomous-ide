import React, { useState } from 'react';
import { ToolCall } from '../../types';
import {
  FileCode,
  Search,
  FileEdit,
  Terminal,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Badge } from '../common/Badge';

interface ToolCallItemProps {
  toolCall: ToolCall;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const ToolCallItem: React.FC<ToolCallItemProps> = ({
  toolCall,
  onSelect,
  isSelected
}) => {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = () => {
    switch (toolCall.type) {
      case 'READ_FILE':
        return <FileCode size={13} className="text-[#007ACC]" />;
      case 'SEARCH':
        return <Search size={13} className="text-[#3794FF]" />;
      case 'WRITE_FILE':
        return <FileEdit size={13} className="text-[#89D185]" />;
      case 'RUN_COMMAND':
        return <Terminal size={13} className="text-[#CCA700]" />;
      default:
        return <FileCode size={13} className="text-[#858585]" />;
    }
  };

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case 'success':
        return <Check size={13} className="text-[#89D185] stroke-[2.5]" />;
      case 'running':
        return <Loader2 size={13} className="text-[#007ACC] animate-spin" />;
      case 'failed':
        return <AlertCircle size={13} className="text-[#F14C4C]" />;
    }
  };

  const badgeVariant: Record<string, 'cyan' | 'indigo' | 'emerald' | 'amber' | 'default'> = {
    READ_FILE: 'cyan',
    SEARCH: 'indigo',
    WRITE_FILE: 'emerald',
    RUN_COMMAND: 'amber',
    GIT_DIFF: 'indigo',
    ANALYZE_AST: 'cyan',
    INSPECT_TEST: 'amber'
  };

  return (
    <div
      onClick={onSelect}
      className={`rounded-sm border text-xs font-mono transition-all ${
        isSelected
          ? 'border-[#007ACC] bg-[#252526]'
          : 'border-[#2B2B2B] bg-[#181818] hover:border-[#3C3C3C]'
      }`}
    >
      <div
        className="p-2 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button className="text-[#858585] hover:text-[#CCCCCC]">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {getToolIcon()}
          <Badge variant={badgeVariant[toolCall.type] || 'default'} size="xs">
            {toolCall.type}
          </Badge>
          <span className="text-[#CCCCCC] font-medium truncate text-[11px]">{toolCall.target}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#858585]">{toolCall.timestamp}</span>
          {getStatusIcon()}
        </div>
      </div>

      {expanded && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-[#2B2B2B] space-y-2 bg-[#1E1E1E]">
          <div className="text-[11px] text-[#858585]">{toolCall.summary}</div>

          {toolCall.diff && (
            <div className="p-2 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[11px] text-[#CCCCCC] font-mono overflow-x-auto">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-[#2B2B2B] text-[#858585] text-[10px]">
                <span>{toolCall.diff.file}</span>
                <span className="text-[#89D185]">+{toolCall.diff.additions} -{toolCall.diff.deletions}</span>
              </div>
              <pre className="text-[10px] whitespace-pre-wrap">{toolCall.diff.preview}</pre>
            </div>
          )}

          {toolCall.output && (
            <div className="p-2 rounded-sm bg-[#181818] border border-[#2B2B2B] text-[11px] text-[#CCCCCC] font-mono overflow-x-auto">
              <pre className="text-[10px] whitespace-pre-wrap text-[#858585]">{toolCall.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
