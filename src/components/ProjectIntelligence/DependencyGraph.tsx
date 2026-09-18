import React, { useMemo, useState, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { KnowledgeGraphResult, GraphNode, GraphEdge } from '../../types/api';
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Layers } from 'lucide-react';

interface DependencyGraphProps {
  graph?: KnowledgeGraphResult | null;
  className?: string;
  height?: number;
}

interface LayoutNode {
  id: string;
  name: string;
  filePath: string;
  folder: string;
  type: 'component' | 'service' | 'api_route' | 'database_model' | 'file';
  x: number;
  y: number;
  width: number;
  height: number;
  node: GraphNode;
}

interface LayoutEdge {
  fromId: string;
  toId: string;
  type: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const TYPE_COLORS: Record<string, { stroke: string; fill: string; badge: string; text: string }> = {
  component: { stroke: '#388BFD', fill: '#0D1A2E', badge: 'bg-[#388BFD]/20 text-[#58A6FF] border-[#388BFD]/50', text: '#58A6FF' },
  service: { stroke: '#3FB950', fill: '#0F2618', badge: 'bg-[#3FB950]/20 text-[#56D364] border-[#3FB950]/50', text: '#56D364' },
  api_route: { stroke: '#D29922', fill: '#2A1F0C', badge: 'bg-[#D29922]/20 text-[#E3B341] border-[#D29922]/50', text: '#E3B341' },
  database_model: { stroke: '#BC8CFF', fill: '#221636', badge: 'bg-[#BC8CFF]/20 text-[#D2A8FF] border-[#BC8CFF]/50', text: '#D2A8FF' },
  file: { stroke: '#8B949E', fill: '#161B22', badge: 'bg-[#8B949E]/20 text-[#8B949E] border-[#30363D]', text: '#8B949E' }
};

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  graph: propGraph,
  className = '',
  height = 420
}) => {
  const storeGraph = useProjectStore((s) => s.knowledgeGraph);
  const graph = propGraph || storeGraph;

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Classify a GraphNode
  const classifyNodeType = (node: GraphNode): 'component' | 'service' | 'api_route' | 'database_model' | 'file' => {
    if (node.type === 'component') return 'component';
    if (node.type === 'api_route') return 'api_route';
    if (node.type === 'database_model') return 'database_model';

    const p = node.file_path.toLowerCase();
    if (p.includes('component') || p.endsWith('.tsx') || p.endsWith('.jsx')) return 'component';
    if (p.includes('router') || p.includes('route') || p.includes('api')) return 'api_route';
    if (p.includes('model') || p.includes('schema') || p.includes('db')) return 'database_model';
    if (p.includes('service') || p.includes('util') || p.includes('lib') || p.includes('scanner') || p.includes('analyzer')) return 'service';

    return 'file';
  };

  // Compute Layout (grouped by folder, basic math force layout)
  const { layoutNodes, layoutEdges, foldersList } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { layoutNodes: [], layoutEdges: [], foldersList: [] };
    }

    // Filter to file/symbol nodes
    let candidateNodes = graph.nodes.filter((n) => n.type === 'file' || n.type === 'api_route' || n.type === 'component' || n.type === 'database_model');
    if (candidateNodes.length === 0) {
      candidateNodes = graph.nodes;
    }

    // If > 50 nodes, show only file nodes or top-level files
    if (candidateNodes.length > 50) {
      const fileNodes = graph.nodes.filter((n) => n.type === 'file');
      candidateNodes = fileNodes.length > 0 ? fileNodes.slice(0, 48) : candidateNodes.slice(0, 48);
    }

    if (selectedFilter !== 'all') {
      candidateNodes = candidateNodes.filter((n) => classifyNodeType(n) === selectedFilter);
    }

    const candidateIds = new Set(candidateNodes.map((n) => n.id));

    // Group by folder
    const folderGroups: Record<string, GraphNode[]> = {};
    candidateNodes.forEach((n) => {
      const parts = n.file_path.split(/[/\\]/);
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
      if (!folderGroups[folder]) folderGroups[folder] = [];
      folderGroups[folder].push(n);
    });

    const folders = Object.keys(folderGroups);
    const numFolders = folders.length;
    const width = 800;
    const h = height;

    const nodeWidth = 110;
    const nodeHeight = 30;

    const nodePosMap: Record<string, { x: number; y: number; node: GraphNode; folder: string }> = {};

    // Position each folder cluster around ellipse
    folders.forEach((folder, fIdx) => {
      const angle = (2 * Math.PI * fIdx) / Math.max(numFolders, 1) - Math.PI / 2;
      const clusterRadiusX = Math.min(width * 0.35, 260);
      const clusterRadiusY = Math.min(h * 0.32, 130);
      const centerX = width / 2 + clusterRadiusX * Math.cos(angle);
      const centerY = h / 2 + clusterRadiusY * Math.sin(angle);

      const items = folderGroups[folder];
      const itemsPerRow = Math.min(3, Math.ceil(Math.sqrt(items.length)));

      items.forEach((n, idx) => {
        const row = Math.floor(idx / itemsPerRow);
        const col = idx % itemsPerRow;
        const offsetX = (col - (itemsPerRow - 1) / 2) * (nodeWidth + 14);
        const offsetY = (row - Math.floor(items.length / itemsPerRow) / 2) * (nodeHeight + 12);

        nodePosMap[n.id] = {
          x: Math.max(70, Math.min(width - 70, centerX + offsetX)),
          y: Math.max(30, Math.min(h - 30, centerY + offsetY)),
          node: n,
          folder
        };
      });
    });

    // Build layout nodes
    const lNodes: LayoutNode[] = Object.entries(nodePosMap).map(([id, item]) => {
      const type = classifyNodeType(item.node);
      return {
        id,
        name: item.node.name || item.node.id,
        filePath: item.node.file_path,
        folder: item.folder,
        type,
        x: item.x,
        y: item.y,
        width: nodeWidth,
        height: nodeHeight,
        node: item.node
      };
    });

    // Build layout edges
    const lEdges: LayoutEdge[] = [];
    graph.edges.forEach((edge) => {
      const src = nodePosMap[edge.from_id] || nodePosMap[edge.from_id.split('::')[0]];
      const dst = nodePosMap[edge.to_id] || nodePosMap[edge.to_id.split('::')[0]];

      if (src && dst && src !== dst) {
        lEdges.push({
          fromId: src.node.id,
          toId: dst.node.id,
          type: edge.type,
          x1: src.x,
          y1: src.y,
          x2: dst.x,
          y2: dst.y
        });
      }
    });

    return { layoutNodes: lNodes, layoutEdges: lEdges, foldersList: folders };
  }, [graph, height, selectedFilter]);

  const hoveredNode = useMemo(() => {
    return layoutNodes.find((n) => n.id === hoveredNodeId) || null;
  }, [layoutNodes, hoveredNodeId]);

  return (
    <div className={`flex flex-col bg-[#1E1E1E] border border-[#2B2B2B] rounded-sm select-none font-sans text-xs ${className}`}>
      {/* Header & Controls */}
      <div className="px-3.5 py-2 border-b border-[#2B2B2B] flex flex-wrap items-center justify-between gap-2 bg-[#181818]">
        <div className="flex items-center gap-2">
          <Network size={14} className="text-[#007ACC]" />
          <span className="font-mono text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider">
            DEPENDENCY GRAPH
          </span>
          <span className="text-[10px] text-[#858585] font-mono">
            ({layoutNodes.length} nodes, {layoutEdges.length} links)
          </span>
        </div>

        {/* Legend / Filter */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-2 py-0.5 rounded-sm border transition-colors ${
              selectedFilter === 'all' ? 'bg-[#264F78] text-[#FFFFFF] border-[#007ACC]' : 'bg-[#252526] text-[#858585] border-[#2B2B2B]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedFilter('component')}
            className={`px-1.5 py-0.5 rounded-sm border flex items-center gap-1 ${
              selectedFilter === 'component' ? 'bg-[#388BFD]/30 border-[#388BFD] text-[#58A6FF]' : 'text-[#58A6FF] border-[#388BFD]/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#388BFD]" />
            Components
          </button>
          <button
            onClick={() => setSelectedFilter('service')}
            className={`px-1.5 py-0.5 rounded-sm border flex items-center gap-1 ${
              selectedFilter === 'service' ? 'bg-[#3FB950]/30 border-[#3FB950] text-[#56D364]' : 'text-[#56D364] border-[#3FB950]/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3FB950]" />
            Services
          </button>
          <button
            onClick={() => setSelectedFilter('api_route')}
            className={`px-1.5 py-0.5 rounded-sm border flex items-center gap-1 ${
              selectedFilter === 'api_route' ? 'bg-[#D29922]/30 border-[#D29922] text-[#E3B341]' : 'text-[#E3B341] border-[#D29922]/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D29922]" />
            API Routes
          </button>
          <button
            onClick={() => setSelectedFilter('database_model')}
            className={`px-1.5 py-0.5 rounded-sm border flex items-center gap-1 ${
              selectedFilter === 'database_model' ? 'bg-[#BC8CFF]/30 border-[#BC8CFF] text-[#D2A8FF]' : 'text-[#D2A8FF] border-[#BC8CFF]/30'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#BC8CFF]" />
            DB Models
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-2 border-l border-[#2B2B2B] pl-2">
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="p-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF]"
              title="Zoom In"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="p-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF]"
              title="Zoom Out"
            >
              <ZoomOut size={12} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="p-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF]"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative overflow-hidden bg-[#141619]" style={{ height }}>
        {layoutNodes.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#858585] gap-2 text-xs">
            <Network size={28} className="text-[#333333]" />
            <span>No nodes to render. Build the project knowledge graph to view dependencies.</span>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 800 420"
            className="w-full h-full cursor-grab active:cursor-grabbing"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease-out'
            }}
          >
            <defs>
              <marker
                id="edge-arrow"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#4B5563" />
              </marker>
              <marker
                id="edge-arrow-highlight"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#388BFD" />
              </marker>
            </defs>

            {/* Edges */}
            <g className="edges">
              {layoutEdges.map((e, idx) => {
                const isHighlighted = hoveredNodeId && (e.fromId === hoveredNodeId || e.toId === hoveredNodeId);
                const isDimmed = hoveredNodeId && !isHighlighted;
                return (
                  <line
                    key={`${e.fromId}-${e.toId}-${idx}`}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke={isHighlighted ? '#388BFD' : '#30363D'}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeOpacity={isDimmed ? 0.15 : isHighlighted ? 0.9 : 0.45}
                    markerEnd={isHighlighted ? 'url(#edge-arrow-highlight)' : 'url(#edge-arrow)'}
                    strokeDasharray={e.type === 'calls' ? '3 3' : e.type === 'renders' ? '2 2' : undefined}
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {layoutNodes.map((n) => {
                const isHovered = hoveredNodeId === n.id;
                const colors = TYPE_COLORS[n.type] || TYPE_COLORS.file;
                const isDimmed = hoveredNodeId && !isHovered && !layoutEdges.some((e) => (e.fromId === hoveredNodeId && e.toId === n.id) || (e.toId === hoveredNodeId && e.fromId === n.id));

                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x - n.width / 2}, ${n.y - n.height / 2})`}
                    onMouseEnter={(e) => {
                      setHoveredNodeId(n.id);
                      setTooltipPos({ x: n.x, y: n.y });
                    }}
                    onMouseLeave={() => {
                      setHoveredNodeId(null);
                      setTooltipPos(null);
                    }}
                    className="cursor-pointer"
                    opacity={isDimmed ? 0.25 : 1}
                  >
                    {/* Rectangle Card */}
                    <rect
                      width={n.width}
                      height={n.height}
                      rx={3}
                      ry={3}
                      fill={isHovered ? '#1E232E' : colors.fill}
                      stroke={isHovered ? '#FFFFFF' : colors.stroke}
                      strokeWidth={isHovered ? 1.5 : 1}
                      filter={isHovered ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))' : undefined}
                    />

                    {/* Left Accent Bar */}
                    <rect
                      x={0}
                      y={0}
                      width={3}
                      height={n.height}
                      rx={1}
                      fill={colors.stroke}
                    />

                    {/* Node Text */}
                    <text
                      x={8}
                      y={15}
                      fontSize={10}
                      fill={colors.text}
                      fontWeight="bold"
                      fontFamily="monospace"
                      dominantBaseline="middle"
                    >
                      {n.name.length > 13 ? `${n.name.slice(0, 11)}..` : n.name}
                    </text>

                    {/* Folder Subtitle */}
                    <text
                      x={8}
                      y={24}
                      fontSize={7.5}
                      fill="#6E7681"
                      fontFamily="monospace"
                    >
                      {n.folder.length > 18 ? `../${n.folder.split('/').pop()}` : n.folder}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Hover Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="absolute z-40 pointer-events-none p-2.5 rounded-sm bg-[#181818] border border-[#388BFD] shadow-2xl text-[11px] font-sans max-w-xs animate-in fade-in duration-75"
            style={{
              left: Math.min(tooltipPos.x + 10, 580),
              top: Math.max(10, Math.min(tooltipPos.y - 45, height - 90))
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono border ${TYPE_COLORS[hoveredNode.type].badge}`}>
                {hoveredNode.type.toUpperCase()}
              </span>
              <span className="font-bold text-[#FFFFFF] font-mono">{hoveredNode.name}</span>
            </div>
            <div className="text-[10px] text-[#858585] font-mono break-all">
              {hoveredNode.filePath}
            </div>
            {hoveredNode.node.metadata && Object.keys(hoveredNode.node.metadata).length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t border-[#2B2B2B] text-[10px] text-[#A0A0A0] flex flex-wrap gap-2">
                {hoveredNode.node.metadata.language && (
                  <span>Lang: <b className="text-[#CCCCCC]">{hoveredNode.node.metadata.language}</b></span>
                )}
                {hoveredNode.node.metadata.complexity_score !== undefined && (
                  <span>Complexity: <b className="text-[#CCCCCC]">{hoveredNode.node.metadata.complexity_score}</b></span>
                )}
                {hoveredNode.node.metadata.functions_count !== undefined && (
                  <span>Fns: <b className="text-[#CCCCCC]">{hoveredNode.node.metadata.functions_count}</b></span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
