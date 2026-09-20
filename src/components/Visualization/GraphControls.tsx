import React from 'react';
import {
  Search,
  RotateCcw,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Eye,
  EyeOff,
  Flame
} from 'lucide-react';
import { clsx } from 'clsx';

export type NodeType = 'component' | 'service' | 'api_route' | 'database_model' | 'config' | 'test' | 'file';

export interface NodeTypeConfig {
  id: NodeType;
  label: string;
  color: string;
}

export const NODE_TYPE_CONFIGS: NodeTypeConfig[] = [
  { id: 'component', label: 'Components', color: '#4a9eff' },
  { id: 'service', label: 'Services', color: '#22c55e' },
  { id: 'api_route', label: 'API Routes', color: '#f97316' },
  { id: 'database_model', label: 'DB Models', color: '#a855f7' },
  { id: 'config', label: 'Config', color: '#6b7280' },
  { id: 'test', label: 'Tests', color: '#eab308' }
];

interface GraphControlsProps {
  typeFilters: Record<string, boolean>;
  onToggleFilter: (type: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchSelectNode?: (nodeId: string) => void;
  focusAffected: boolean;
  onToggleFocusAffected: () => void;
  onResetLayout: () => void;
  onExportSvg: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  hasImpactData: boolean;
  matchingCount?: number;
}

export const GraphControls: React.FC<GraphControlsProps> = ({
  typeFilters,
  onToggleFilter,
  searchTerm,
  onSearchChange,
  focusAffected,
  onToggleFocusAffected,
  onResetLayout,
  onExportSvg,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  hasImpactData,
  matchingCount = 0
}) => {
  return (
    <div className="bg-[#1E1E1E]/95 backdrop-blur-sm border border-[#2B2B2B] rounded-lg p-3 space-y-3 shadow-lg select-none text-xs">
      {/* Top Row: Search & Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files or symbols..."
            className="w-full bg-[#141414] border border-[#333333] rounded pl-8 pr-7 py-1 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none focus:border-[#007ACC]"
          />
          {searchTerm && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-zinc-400">
              {matchingCount}
            </span>
          )}
        </div>

        {/* View Actions */}
        <div className="flex items-center gap-1.5">
          {hasImpactData && (
            <button
              onClick={onToggleFocusAffected}
              className={clsx(
                'px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors text-[11px]',
                focusAffected
                  ? 'bg-rose-950 text-rose-300 border border-rose-700/80 shadow-sm'
                  : 'bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c]'
              )}
              title="Dim unaffected nodes and isolate requirement blast radius"
            >
              <Flame size={12} className={focusAffected ? 'text-rose-400 animate-pulse' : 'text-zinc-400'} />
              <span>{focusAffected ? 'Focused on Affected' : 'Focus Affected'}</span>
            </button>
          )}

          <div className="h-4 w-px bg-[#333333] mx-0.5" />

          {/* Zoom Buttons */}
          <button
            onClick={onZoomIn}
            className="p-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={onZoomOut}
            className="p-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <button
            onClick={onResetZoom}
            className="p-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] transition-colors"
            title="Reset Zoom & Center"
          >
            <Maximize2 size={13} />
          </button>

          <div className="h-4 w-px bg-[#333333] mx-0.5" />

          {/* Reset Layout */}
          <button
            onClick={onResetLayout}
            className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] text-zinc-300 border border-[#3c3c3c] flex items-center gap-1.5 transition-colors text-[11px]"
            title="Re-run spring physics simulation"
          >
            <RotateCcw size={12} />
            <span>Reset Physics</span>
          </button>

          {/* Export SVG */}
          <button
            onClick={onExportSvg}
            className="px-2.5 py-1 rounded bg-[#007ACC] hover:bg-[#0062a3] text-white font-medium flex items-center gap-1.5 shadow-sm transition-colors text-[11px]"
            title="Download vector SVG diagram"
          >
            <Download size={12} />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#2B2B2B]">
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
          <Filter size={11} />
          <span>Filters:</span>
        </div>

        {NODE_TYPE_CONFIGS.map((cfg) => {
          const isVisible = typeFilters[cfg.id] !== false;
          return (
            <button
              key={cfg.id}
              onClick={() => onToggleFilter(cfg.id)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-mono flex items-center gap-1.5 border transition-all',
                isVisible
                  ? 'bg-[#181818] border-zinc-600 text-zinc-200'
                  : 'bg-[#121212] border-zinc-800 text-zinc-600 line-through opacity-60'
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: cfg.color }}
              />
              <span>{cfg.label}</span>
              {isVisible ? (
                <Eye size={10} className="text-zinc-400" />
              ) : (
                <EyeOff size={10} className="text-zinc-600" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
