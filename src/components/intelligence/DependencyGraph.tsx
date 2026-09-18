import React from 'react';
import { useIntelligenceStore } from '../../stores/intelligenceStore';
import { DependencyNode } from '../../types';
import { clsx } from 'clsx';
import { Database, FileCode, Layers, Server, ArrowRight } from 'lucide-react';

export const DependencyGraph: React.FC = () => {
  const { nodes, edges, selectedNodeId, selectNode } = useIntelligenceStore();

  const getNodeIcon = (type: DependencyNode['type']) => {
    switch (type) {
      case 'component':
        return <FileCode size={13} className="text-[#3794FF]" />;
      case 'service':
        return <Layers size={13} className="text-[#007ACC]" />;
      case 'router':
        return <Server size={13} className="text-[#CCA700]" />;
      case 'database':
        return <Database size={13} className="text-[#89D185]" />;
      default:
        return <FileCode size={13} className="text-[#858585]" />;
    }
  };

  const getRiskColor = (risk: DependencyNode['risk']) => {
    switch (risk) {
      case 'High':
        return 'border-[#F14C4C]/40 text-[#F14C4C] bg-[#F14C4C]/10';
      case 'Medium':
        return 'border-[#CCA700]/40 text-[#CCA700] bg-[#CCA700]/10';
      case 'Low':
        return 'border-[#89D185]/40 text-[#89D185] bg-[#89D185]/10';
    }
  };

  return (
    <div className="relative rounded-sm bg-[#181818] border border-[#2B2B2B] p-4 overflow-hidden select-none min-h-[300px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2B2B2B]">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-[#CCCCCC] uppercase tracking-wider">
            DEPENDENCY GRAPH
          </span>
          <span className="text-[10px] font-mono text-[#858585]">AST Semantic Link Trace</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[#858585]">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#007ACC]" /> Frontend</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#CCA700]" /> Backend</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#89D185]" /> Database</span>
        </div>
      </div>

      {/* Primary Pipeline View */}
      <div className="my-auto py-4 space-y-4">
        <div>
          <div className="text-[10px] font-mono text-[#858585] uppercase tracking-wider mb-2">
            Authentication Pipeline Trace
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {nodes.slice(0, 5).map((node, index) => {
              const isSelected = selectedNodeId === node.id;
              return (
                <React.Fragment key={node.id}>
                  <div
                    onClick={() => selectNode(node.id)}
                    className={clsx(
                      'p-2.5 rounded-sm border cursor-pointer transition-all min-w-[140px]',
                      isSelected
                        ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                        : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {getNodeIcon(node.type)}
                        <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-[#E0E0E0]' : 'text-[#858585]'}`}>
                          {node.type}
                        </span>
                      </div>
                      <span className={clsx('text-[9px] font-mono px-1 py-0.2 rounded-xs border', getRiskColor(node.risk))}>
                        {node.risk}
                      </span>
                    </div>

                    <div className="font-mono text-xs font-semibold truncate">
                      {node.name}
                    </div>
                    <div className={`text-[10px] font-mono mt-0.5 truncate ${isSelected ? 'text-[#CCCCCC]' : 'text-[#858585]'}`}>
                      {node.layer}
                    </div>
                  </div>

                  {index < 4 && (
                    <div className="hidden lg:flex flex-col items-center text-[#858585]">
                      <ArrowRight size={14} className="text-[#858585]" />
                      <span className="text-[9px] font-mono text-[#858585] mt-0.5">
                        {edges[index]?.label || 'link'}
                      </span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Secondary Theme Pipeline */}
        <div className="pt-3 border-t border-[#2B2B2B]">
          <div className="text-[10px] font-mono text-[#858585] uppercase tracking-wider mb-2">
            Theme & Dashboard Subsystem
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {nodes.slice(5).map((node) => {
              const isSelected = selectedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  onClick={() => selectNode(node.id)}
                  className={clsx(
                    'p-2 rounded-sm border cursor-pointer transition-all min-w-[130px]',
                    isSelected
                      ? 'bg-[#264F78] border-[#007ACC] text-[#FFFFFF]'
                      : 'bg-[#1E1E1E] border-[#2B2B2B] hover:bg-[#252526] text-[#CCCCCC]'
                  )}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      {getNodeIcon(node.type)}
                      <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-[#E0E0E0]' : 'text-[#858585]'}`}>
                        {node.type}
                      </span>
                    </div>
                  </div>
                  <div className="font-mono text-xs font-semibold">
                    {node.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
