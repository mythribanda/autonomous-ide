import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useImpactStore } from '../../stores/impactStore';
import { useAgentStore } from '../../store/agentStore';
import { KnowledgeGraphResult, GraphNode, GraphEdge } from '../../types/api';
import { GraphControls, NodeType, NODE_TYPE_CONFIGS } from './GraphControls';
import { ImpactHighlighter } from './ImpactHighlighter';
import {
  FileCode,
  Network,
  Maximize2,
  Info,
  Code2,
  GitBranch,
  Flame,
  CheckCircle2,
  Activity,
  Layers
} from 'lucide-react';
import { clsx } from 'clsx';

export interface SimNode {
  id: string;
  name: string;
  filePath: string;
  type: NodeType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  degree: number;
  functionsList: string[];
  isDirectlyAffected: boolean;
  isTransitivelyAffected: boolean;
  isRecentlyModified: boolean;
}

export interface SimEdge {
  fromId: string;
  toId: string;
  type: string;
}

const TYPE_COLORS: Record<NodeType, string> = {
  component: '#4a9eff',
  service: '#22c55e',
  api_route: '#f97316',
  database_model: '#a855f7',
  config: '#6b7280',
  test: '#eab308',
  file: '#94a3b8'
};

interface ImpactGraphProps {
  height?: number | string;
  className?: string;
  showControls?: boolean;
}

export const ImpactGraph: React.FC<ImpactGraphProps> = ({
  height = '100%',
  className = '',
  showControls = true
}) => {
  const { knowledgeGraph, projectPath, scanResult } = useProjectStore();
  const { report } = useImpactStore();
  const { events } = useAgentStore();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Layout & Transform State
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Filtering & Interaction State
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>({
    component: true,
    service: true,
    api_route: true,
    database_model: true,
    config: true,
    test: true,
    file: true
  });
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [focusAffected, setFocusAffected] = useState<boolean>(false);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Nodes & Edges State calculated by simulation
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const [simulationIteration, setSimulationIteration] = useState<number>(0);

  // 30-Second Recent Agent File Modifications Cache
  const [recentAgentEdits, setRecentAgentEdits] = useState<Record<string, number>>({});

  // Monitor Agent Events for File Changes (highlight for 30s)
  useEffect(() => {
    if (!events || events.length === 0) return;

    const now = Date.now();
    const newEdits: Record<string, number> = { ...recentAgentEdits };
    let hasNew = false;

    for (const ev of events) {
      // Check if event mentions file modification or write
      const target = ev.data?.file || ev.data?.path || ev.data?.target_file;
      if (target && typeof target === 'string') {
        const norm = target.replace(/\\/g, '/').toLowerCase();
        if (!newEdits[norm] || now - newEdits[norm] > 5000) {
          newEdits[norm] = now;
          hasNew = true;
        }
      }
    }

    if (hasNew) {
      setRecentAgentEdits(newEdits);
    }
  }, [events]);

  // Clean expired 30s edits periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRecentAgentEdits((prev) => {
        let changed = false;
        const updated: Record<string, number> = {};
        for (const [k, ts] of Object.entries(prev)) {
          if (now - ts <= 30000) {
            updated[k] = ts;
          } else {
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Classify a node into one of the designated types
  const classifyType = (node: GraphNode): NodeType => {
    const t = (node.type || '').toLowerCase();
    const p = (node.file_path || node.id || '').toLowerCase();

    if (t === 'component' || p.includes('/components/') || p.endsWith('.tsx') || p.endsWith('.jsx')) {
      return 'component';
    }
    if (t === 'service' || p.includes('/services/') || p.includes('/service/')) {
      return 'service';
    }
    if (t === 'api_route' || p.includes('/routers/') || p.includes('/routes/') || p.includes('/api/')) {
      return 'api_route';
    }
    if (t === 'database_model' || p.includes('/models/') || p.includes('/entities/') || p.includes('/schema')) {
      return 'database_model';
    }
    if (p.includes('.test.') || p.includes('.spec.') || p.includes('/tests/') || p.includes('/__tests__/')) {
      return 'test';
    }
    if (p.includes('config') || p.endsWith('.json') || p.endsWith('.yaml') || p.endsWith('.yml') || p.endsWith('.toml')) {
      return 'config';
    }
    return 'file';
  };

  // Build simulation nodes and run 200 physics steps
  const runSpringSimulation = useCallback(() => {
    if (!knowledgeGraph || !knowledgeGraph.nodes || knowledgeGraph.nodes.length === 0) {
      // If no graph, build synthetic demo nodes from scanResult
      return;
    }

    const width = containerRef.current?.clientWidth || 900;
    const heightPx = typeof height === 'number' ? height : (containerRef.current?.clientHeight || 600);

    const directSet = new Set(
      (report?.directly_affected_files || []).map((f) => f.replace(/\\/g, '/').toLowerCase())
    );
    const transitiveSet = new Set(
      (report?.transitively_affected_files || []).map((f) => f.replace(/\\/g, '/').toLowerCase())
    );

    // 1. Calculate degrees (connections count)
    const degreeMap = new Map<string, number>();
    for (const edge of knowledgeGraph.edges) {
      degreeMap.set(edge.from_id, (degreeMap.get(edge.from_id) || 0) + 1);
      degreeMap.set(edge.to_id, (degreeMap.get(edge.to_id) || 0) + 1);
    }

    // 2. Initialize nodes with random scatter near center
    const cx = width / 2;
    const cy = heightPx / 2;
    const now = Date.now();

    const nodes: SimNode[] = knowledgeGraph.nodes.map((n, i) => {
      const deg = degreeMap.get(n.id) || 0;
      // Node size proportional to number of connections: min 8px, max 24px
      const radius = Math.min(24, Math.max(8, 8 + deg * 1.8));

      // Initial angle & radius
      const angle = (i / knowledgeGraph.nodes.length) * 2 * Math.PI;
      const initialDist = 120 + Math.random() * 160;

      const normPath = (n.file_path || '').replace(/\\/g, '/').toLowerCase();
      const isDirect = directSet.has(normPath);
      const isTrans = transitiveSet.has(normPath);
      const isRecent = Boolean(recentAgentEdits[normPath] && now - recentAgentEdits[normPath] <= 30000);

      // Extract functions list from metadata if available
      const functionsList: string[] = [];
      if (n.metadata && Array.isArray(n.metadata.functions)) {
        functionsList.push(...n.metadata.functions);
      } else if (n.type === 'function') {
        functionsList.push(n.name);
      }

      return {
        id: n.id,
        name: n.name || n.file_path.split('/').pop() || n.id,
        filePath: n.file_path || n.id,
        type: classifyType(n),
        x: cx + Math.cos(angle) * initialDist,
        y: cy + Math.sin(angle) * initialDist,
        vx: 0,
        vy: 0,
        radius,
        degree: deg,
        functionsList,
        isDirectlyAffected: isDirect,
        isTransitivelyAffected: isTrans,
        isRecentlyModified: isRecent
      };
    });

    const edges: SimEdge[] = knowledgeGraph.edges.map((e) => ({
      fromId: e.from_id,
      toId: e.to_id,
      type: e.type
    }));

    const nodeIndexMap = new Map<string, number>();
    nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

    // 3. Run EXACTLY 200 iterations of spring physics to stabilize, then stop
    const iterations = 200;
    const kRepulsion = 8000;
    const kSpring = 0.04;
    const targetLength = 95;
    const damping = 0.82;
    const centerAttraction = 0.012;

    for (let iter = 0; iter < iterations; iter++) {
      // A. Repulsion between all node pairs (F = k / dist^2)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];

          let dx = n2.x - n1.x;
          let dy = n2.y - n1.y;
          let distSq = dx * dx + dy * dy;
          if (distSq < 1.0) {
            dx = (Math.random() - 0.5) * 2;
            dy = (Math.random() - 0.5) * 2;
            distSq = dx * dx + dy * dy + 1.0;
          }

          const dist = Math.sqrt(distSq);
          const force = kRepulsion / distSq;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }

      // B. Attraction along edges (Hooke's spring force)
      for (let e = 0; e < edges.length; e++) {
        const edge = edges[e];
        const idx1 = nodeIndexMap.get(edge.fromId);
        const idx2 = nodeIndexMap.get(edge.toId);
        if (idx1 === undefined || idx2 === undefined) continue;

        const n1 = nodes[idx1];
        const n2 = nodes[idx2];

        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const displacement = dist - targetLength;
        const force = displacement * kSpring;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        n1.vx += fx;
        n1.vy += fy;
        n2.vx -= fx;
        n2.vy -= fy;
      }

      // C. Centering force & update positions with damping
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.vx += (cx - n.x) * centerAttraction;
        n.vy += (cy - n.y) * centerAttraction;

        n.vx *= damping;
        n.vy *= damping;

        n.x += n.vx;
        n.y += n.vy;
      }
    }

    setSimNodes(nodes);
    setSimEdges(edges);
    setSimulationIteration((prev) => prev + 1);
  }, [knowledgeGraph, report, height, recentAgentEdits]);

  // Initial & Dependency Trigger
  useEffect(() => {
    runSpringSimulation();
  }, [knowledgeGraph, report]);

  // Handle Pan & Zoom
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    setZoom(Math.max(0.2, Math.min(3.5, newZoom)));
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only pan if not clicking a node directly
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).id === 'graph-bg') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Node Click -> Center node in viewport
  const handleNodeClick = (node: SimNode) => {
    setSelectedNodeId(node.id);
    const width = containerRef.current?.clientWidth || 900;
    const heightPx = containerRef.current?.clientHeight || 600;
    // Animate camera to node
    setPan({
      x: width / 2 - node.x * zoom,
      y: heightPx / 2 - node.y * zoom
    });
  };

  // Search filter
  const matchingNodes = useMemo(() => {
    if (!searchTerm.trim()) return simNodes;
    const q = searchTerm.toLowerCase();
    return simNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.filePath.toLowerCase().includes(q) ||
        n.functionsList.some((f) => f.toLowerCase().includes(q))
    );
  }, [simNodes, searchTerm]);

  // Filtered Visible Nodes
  const visibleNodes = useMemo(() => {
    return simNodes.filter((n) => {
      // Type filter
      if (typeFilters[n.type] === false) return false;
      return true;
    });
  }, [simNodes, typeFilters]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return simEdges.filter((e) => visibleNodeIds.has(e.fromId) && visibleNodeIds.has(e.toId));
  }, [simEdges, visibleNodeIds]);

  // Export SVG file
  const handleExportSvg = () => {
    if (!svgRef.current) return;
    try {
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(svgRef.current);

      // Add namespaces
      if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }

      const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dependency-graph-${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export SVG:', err);
    }
  };

  // Reset Zoom
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const hasImpactData = Boolean(
    (report?.directly_affected_files && report.directly_affected_files.length > 0) ||
    (report?.transitively_affected_files && report.transitively_affected_files.length > 0)
  );

  return (
    <div
      ref={containerRef}
      className={clsx(
        'relative w-full h-full min-h-[450px] bg-[#141414] rounded-lg border border-[#2B2B2B] overflow-hidden flex flex-col font-sans select-none',
        className
      )}
    >
      {/* Top Floating Controls */}
      {showControls && (
        <div className="absolute top-3 left-3 right-3 z-20 space-y-2 pointer-events-none">
          <div className="pointer-events-auto">
            <GraphControls
              typeFilters={typeFilters}
              onToggleFilter={(t) => setTypeFilters((prev) => ({ ...prev, [t]: !prev[t] }))}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              focusAffected={focusAffected}
              onToggleFocusAffected={() => setFocusAffected((prev) => !prev)}
              onResetLayout={runSpringSimulation}
              onExportSvg={handleExportSvg}
              onZoomIn={() => setZoom((z) => Math.min(3.5, z * 1.2))}
              onZoomOut={() => setZoom((z) => Math.max(0.2, z / 1.2))}
              onResetZoom={handleResetZoom}
              hasImpactData={hasImpactData}
              matchingCount={matchingNodes.length}
            />
          </div>

          <div className="pointer-events-auto">
            <ImpactHighlighter onFocusAffected={() => setFocusAffected(true)} />
          </div>
        </div>
      )}

      {/* SVG Canvas with Vanilla Physics */}
      <div className="flex-1 w-full h-full relative cursor-grab active:cursor-grabbing">
        <svg
          ref={svgRef}
          id="dependency-graph-svg"
          className="w-full h-full"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {/* Arrow Marker for Directed Edges */}
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#6B7280" />
            </marker>

            {/* Impact Arrow Marker */}
            <marker
              id="graph-arrow-impact"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
            </marker>

            {/* Glowing filter for directly affected nodes */}
            <filter id="direct-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glowing filter for recently edited files by agent (30s) */}
            <filter id="agent-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="7" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Catch-all background for panning */}
          <rect id="graph-bg" width="100%" height="100%" fill="transparent" />

          {/* Main Transformed Group */}
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edges Layer */}
            <g className="edges-layer">
              {visibleEdges.map((edge, idx) => {
                const source = simNodes.find((n) => n.id === edge.fromId);
                const target = simNodes.find((n) => n.id === edge.toId);
                if (!source || !target) return null;

                const isEdgeAffected =
                  (source.isDirectlyAffected || source.isTransitivelyAffected) &&
                  (target.isDirectlyAffected || target.isTransitivelyAffected);

                const isDimmed = focusAffected && !isEdgeAffected;

                return (
                  <line
                    key={`${edge.fromId}->${edge.toId}-${idx}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={isEdgeAffected ? '#EF4444' : '#4B5563'}
                    strokeWidth={isEdgeAffected ? 1.8 : 1.0}
                    strokeDasharray={edge.type === 'depends_on' ? '4,4' : undefined}
                    markerEnd={isEdgeAffected ? 'url(#graph-arrow-impact)' : 'url(#graph-arrow)'}
                    opacity={isDimmed ? 0.08 : 0.65}
                    className="transition-opacity duration-200"
                  />
                );
              })}
            </g>

            {/* Nodes Layer */}
            <g className="nodes-layer">
              {visibleNodes.map((node) => {
                const color = TYPE_COLORS[node.type] || '#94a3b8';
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const isAffected = node.isDirectlyAffected || node.isTransitivelyAffected;
                const isDimmed = focusAffected && !isAffected;

                const isSearchMatch =
                  searchTerm.trim() !== '' &&
                  (node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    node.filePath.toLowerCase().includes(searchTerm.toLowerCase()));

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-all duration-150"
                    opacity={isDimmed ? 0.15 : 1.0}
                    onClick={() => handleNodeClick(node)}
                    onMouseEnter={(e) => {
                      setHoveredNode(node);
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Live Agent Modification Outer Ring (30s glow) */}
                    {node.isRecentlyModified && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 8}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        filter="url(#agent-glow)"
                        className="animate-pulse"
                      />
                    )}

                    {/* Impact Glow Ring */}
                    {node.isDirectlyAffected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 6}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={2.5}
                        filter="url(#direct-glow)"
                        className="animate-pulse"
                      />
                    )}

                    {node.isTransitivelyAffected && !node.isDirectlyAffected && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 4}
                        fill="none"
                        stroke="#F97316"
                        strokeWidth={1.8}
                        strokeDasharray="3,3"
                      />
                    )}

                    {/* Search Highlight Ring */}
                    {isSearchMatch && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.radius + 5}
                        fill="none"
                        stroke="#FBBF24"
                        strokeWidth={2.5}
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.radius}
                      fill={color}
                      stroke={isSelected ? '#FFFFFF' : isHovered ? '#FFFFFF' : '#1E1E1E'}
                      strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                      className="transition-transform duration-100"
                    />

                    {/* Node Center Pip */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={Math.max(2, node.radius * 0.35)}
                      fill="#FFFFFF"
                      opacity={0.85}
                    />

                    {/* Node Label: filename below node */}
                    <text
                      x={node.x}
                      y={node.y + node.radius + 12}
                      textAnchor="middle"
                      fill={isAffected ? '#F87171' : '#E2E8F0'}
                      fontSize={10}
                      fontFamily="monospace"
                      fontWeight={isAffected || isSelected ? 'bold' : 'normal'}
                      className="pointer-events-none drop-shadow-sm select-none"
                    >
                      {node.name.length > 20 ? `${node.name.slice(0, 18)}...` : node.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Floating Tooltip */}
        {hoveredNode && tooltipPos && (
          <div
            className="fixed z-50 pointer-events-none bg-[#1C1C1C]/95 backdrop-blur-md border border-[#3A3A3A] rounded-lg p-3 text-xs text-zinc-200 shadow-2xl max-w-xs space-y-1.5 animate-in fade-in zoom-in-95 duration-75"
            style={{
              left: Math.min(window.innerWidth - 300, tooltipPos.x + 15),
              top: Math.min(window.innerHeight - 200, tooltipPos.y + 15)
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#2B2B2B] pb-1.5">
              <span className="font-bold text-zinc-100 font-mono text-[11px] truncate">
                {hoveredNode.name}
              </span>
              <span
                className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase"
                style={{
                  backgroundColor: `${TYPE_COLORS[hoveredNode.type]}20`,
                  color: TYPE_COLORS[hoveredNode.type],
                  border: `1px solid ${TYPE_COLORS[hoveredNode.type]}60`
                }}
              >
                {hoveredNode.type.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-0.5 text-[10px] font-mono text-zinc-400">
              <div className="truncate text-zinc-300" title={hoveredNode.filePath}>
                <span className="text-zinc-500">Path: </span>
                {hoveredNode.filePath}
              </div>
              <div>
                <span className="text-zinc-500">Connections: </span>
                <span className="text-zinc-200 font-bold">{hoveredNode.degree} edges</span>
              </div>
            </div>

            {/* Impact Status in Tooltip */}
            {(hoveredNode.isDirectlyAffected || hoveredNode.isTransitivelyAffected) && (
              <div className="pt-1 border-t border-[#2B2B2B] flex items-center gap-1.5 text-[10px] font-mono">
                <Flame size={11} className="text-rose-400" />
                <span className="text-rose-300 font-bold">
                  {hoveredNode.isDirectlyAffected
                    ? 'Direct Blast Radius'
                    : 'Transitive Dependency'}
                </span>
              </div>
            )}

            {/* Recent Agent Modification Status */}
            {hoveredNode.isRecentlyModified && (
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                <Activity size={11} />
                <span>Modified by Agent within 30s</span>
              </div>
            )}

            {/* Functions List Preview */}
            {hoveredNode.functionsList.length > 0 && (
              <div className="pt-1 border-t border-[#2B2B2B] space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-mono">Symbols / Functions:</span>
                <div className="flex flex-wrap gap-1">
                  {hoveredNode.functionsList.slice(0, 4).map((fn, i) => (
                    <span
                      key={i}
                      className="px-1.5 py-0.2 rounded bg-[#252526] text-zinc-300 text-[9px] font-mono"
                    >
                      {fn}()
                    </span>
                  ))}
                  {hoveredNode.functionsList.length > 4 && (
                    <span className="text-[9px] font-mono text-zinc-500">
                      +{hoveredNode.functionsList.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State if no nodes */}
        {simNodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 gap-2 p-6">
            <Network size={36} className="text-zinc-700 animate-pulse" />
            <span className="text-xs font-mono">Building project knowledge graph...</span>
            <span className="text-[11px] text-zinc-600">
              Open a project with source files to visualize dependency topology and blast radius.
            </span>
          </div>
        )}
      </div>

      {/* Bottom Status Ribbon */}
      <div className="px-3.5 py-2 border-t border-[#2B2B2B] bg-[#1A1A1A] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 shrink-0">
        <div className="flex items-center gap-3">
          <span>
            Topology: <strong className="text-zinc-200">{visibleNodes.length}</strong> nodes,{' '}
            <strong className="text-zinc-200">{visibleEdges.length}</strong> connections
          </span>
          <span>•</span>
          <span>
            Physics: <strong className="text-emerald-400">200 steps stabilized</strong>
          </span>
          {hasImpactData && (
            <>
              <span>•</span>
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <Flame size={10} />
                {(report?.directly_affected_files?.length || 0) + (report?.transitively_affected_files?.length || 0)} affected
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span>Scroll to zoom • Drag to pan • Click node to focus</span>
        </div>
      </div>
    </div>
  );
};
