import React from 'react';
import { useIntelligenceStore } from '../../stores/intelligenceStore';
import { useProjectStore } from '../../stores/projectStore';
import { DependencyGraph } from './DependencyGraph';
import { NodeInspector } from './NodeInspector';
import { MetricCard } from '../common/MetricCard';
import {
  FileCode,
  Network,
  Code2,
  PackageCheck,
  CheckCircle2,
  Cpu,
  Server,
  Database,
  Boxes,
  Layers
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const ProjectIntelligenceView: React.FC = () => {
  const { metrics } = useIntelligenceStore();
  const { currentProject } = useProjectStore();

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs">
      {/* Header */}
      <div className="border-b border-[#2B2B2B] pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-sm bg-[#007ACC] flex items-center justify-center text-[#FFFFFF]">
            <Network size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-[#FFFFFF] font-mono">
                PROJECT INTELLIGENCE
              </h1>
              <Badge variant="blue" size="xs">
                AST Scan
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Semantic project graph, dependency mapping, and architectural metrics for{' '}
              <span className="text-[#CCCCCC] font-semibold">{currentProject}</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <MetricCard label="Files" value={metrics.files} icon={FileCode} accentColor="cyan" />
        <MetricCard label="Functions" value={metrics.functions.toLocaleString()} icon={Code2} accentColor="indigo" />
        <MetricCard label="Dependencies" value={metrics.dependencies} icon={PackageCheck} accentColor="emerald" />
        <MetricCard label="Tests" value={metrics.tests} icon={CheckCircle2} accentColor="amber" />
        <MetricCard label="Languages" value={metrics.languages} icon={Cpu} accentColor="cyan" />
        <MetricCard label="APIs" value={metrics.apis} icon={Server} accentColor="indigo" />
      </div>

      {/* Project Overview Card */}
      <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-3">
        <h3 className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
          PROJECT TECH STACK & CONFIGURATION
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
            <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
              <Cpu size={11} /> Languages
            </span>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">Python</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">TypeScript</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">JavaScript</span>
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
            <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
              <Layers size={11} /> Frameworks
            </span>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#3794FF]">React</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCA700]">FastAPI</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#73C991]">Tailwind</span>
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
            <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
              <Database size={11} /> Database
            </span>
            <div className="text-[#CCCCCC] font-semibold flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#89D185]" />
              <span>PostgreSQL 16</span>
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
            <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
              <CheckCircle2 size={11} /> Testing
            </span>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">Pytest</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">Playwright</span>
              <span className="px-1.5 py-0.2 rounded-xs bg-[#252526] text-[#CCCCCC]">Vitest</span>
            </div>
          </div>

          <div className="p-2.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1">
            <span className="text-[10px] text-[#858585] uppercase flex items-center gap-1">
              <Boxes size={11} /> Container
            </span>
            <div className="text-[#CCCCCC] font-semibold flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007ACC]" />
              <span>Docker Detected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Dependency Graph */}
      <DependencyGraph />

      {/* Node Inspector */}
      <NodeInspector />
    </div>
  );
};
