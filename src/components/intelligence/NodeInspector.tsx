import React from 'react';
import { useIntelligenceStore } from '../../stores/intelligenceStore';
import { useUIStore } from '../../stores/uiStore';
import { ArrowUpRight, ArrowDownLeft, ShieldAlert } from 'lucide-react';
import { Badge } from '../common/Badge';

export const NodeInspector: React.FC = () => {
  const { nodes, selectedNodeId } = useIntelligenceStore();
  const { setActiveView } = useUIStore();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!selectedNode) {
    return (
      <div className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] text-center text-xs text-[#858585] font-mono">
        Select a node in the dependency graph to inspect its AST references.
      </div>
    );
  }

  const riskBadgeVariant = {
    High: 'rose',
    Medium: 'amber',
    Low: 'emerald'
  } as const;

  return (
    <div className="p-4 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3 font-sans text-xs">
      {/* Node Header */}
      <div className="flex items-start justify-between pb-2 border-b border-[#2B2B2B]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase text-[#858585]">{selectedNode.layer}</span>
            <Badge variant={riskBadgeVariant[selectedNode.risk]} size="xs">
              {selectedNode.risk} Impact
            </Badge>
          </div>
          <h3 className="text-sm font-bold text-[#FFFFFF] font-mono">{selectedNode.name}</h3>
          <p className="text-[11px] text-[#858585] font-mono mt-0.5">{selectedNode.file}</p>
        </div>

        <button
          onClick={() => setActiveView('impact')}
          className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#007ACC] text-xs font-mono border border-[#2B2B2B] transition-colors"
        >
          Analyze Impact
        </button>
      </div>

      {/* Grid of Imports / Exports / Dependents */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
        {/* Imports */}
        <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#858585] font-semibold text-[11px]">
            <ArrowDownLeft size={12} className="text-[#007ACC]" />
            <span>IMPORTS ({selectedNode.imports.length})</span>
          </div>
          <div className="space-y-1">
            {selectedNode.imports.length > 0 ? (
              selectedNode.imports.map((imp, idx) => (
                <div key={idx} className="px-2 py-0.5 rounded-xs bg-[#252526] text-[#CCCCCC] truncate text-[11px]">
                  {imp}
                </div>
              ))
            ) : (
              <span className="text-[#858585] text-[11px]">No external imports</span>
            )}
          </div>
        </div>

        {/* Exports */}
        <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#858585] font-semibold text-[11px]">
            <ArrowUpRight size={12} className="text-[#89D185]" />
            <span>EXPORTS ({selectedNode.exports.length})</span>
          </div>
          <div className="space-y-1">
            {selectedNode.exports.map((exp, idx) => (
              <div key={idx} className="px-2 py-0.5 rounded-xs bg-[#252526] text-[#CCCCCC] truncate text-[11px]">
                {exp}
              </div>
            ))}
          </div>
        </div>

        {/* Used By */}
        <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#858585] font-semibold text-[11px]">
            <ShieldAlert size={12} className="text-[#CCA700]" />
            <span>USED BY ({selectedNode.usedBy.length})</span>
          </div>
          <div className="space-y-1">
            {selectedNode.usedBy.length > 0 ? (
              selectedNode.usedBy.map((user, idx) => (
                <div key={idx} className="px-2 py-0.5 rounded-xs bg-[#252526] text-[#CCCCCC] truncate text-[11px]">
                  {user}
                </div>
              ))
            ) : (
              <span className="text-[#858585] text-[11px]">Top-level entry point</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
