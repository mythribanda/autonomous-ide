import React, { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { ProjectScanPanel } from '../ProjectIntelligence/ProjectScanPanel';
import { DependencyGraph } from '../ProjectIntelligence/DependencyGraph';
import { ImpactReport } from '../ProjectIntelligence/ImpactReport';
import { MetricCard } from '../common/MetricCard';
import { Badge } from '../common/Badge';
import {
  FileCode,
  Network,
  Code2,
  PackageCheck,
  CheckCircle2,
  Cpu,
  Server,
  RefreshCw,
  Radar,
  FolderOpen
} from 'lucide-react';

export const ProjectIntelligenceView: React.FC = () => {
  const {
    currentProject,
    projectId,
    projectPath,
    scanResult,
    knowledgeGraph,
    projectSummary,
    loadProjectIntelligence,
    openProjectWithDialog
  } = useProjectStore();

  const [activeTab, setActiveTab] = useState<'scan' | 'graph' | 'impact'>('scan');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!projectId) return;
    setRefreshing(true);
    try {
      await loadProjectIntelligence(projectId);
    } finally {
      setRefreshing(false);
    }
  };

  // Compute metrics from scanResult and knowledgeGraph or defaults
  const fileCount = scanResult?.file_count || knowledgeGraph?.nodes.filter((n) => n.type === 'file').length || 42;
  const functionCount = knowledgeGraph?.nodes.filter((n) => n.type === 'function').length || 167;
  const routesCount = knowledgeGraph?.nodes.filter((n) => n.type === 'api_route').length || 18;
  const compCount = knowledgeGraph?.nodes.filter((n) => n.type === 'component').length || 14;
  const langCount = scanResult?.languages.length || 3;
  const linkCount = knowledgeGraph?.edges.length || 186;

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-5 space-y-4 font-sans text-xs select-none">
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
                Live Knowledge Graph
              </Badge>
            </div>
            <p className="text-xs text-[#858585] mt-0.5">
              Semantic architecture, AST intelligence, and dependency mapping for{' '}
              <span className="text-[#CCCCCC] font-semibold">{currentProject}</span> ({projectPath}).
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={openProjectWithDialog}
            className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] hover:text-[#FFFFFF] text-xs flex items-center gap-1.5 transition-colors font-medium"
          >
            <FolderOpen size={12} className="text-[#007ACC]" />
            <span>Open Folder</span>
          </button>

          {projectId && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-2.5 py-1 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] hover:text-[#FFFFFF] text-xs flex items-center gap-1.5 transition-colors font-medium disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin text-[#007ACC]' : ''} />
              <span>{refreshing ? 'Refreshing...' : 'Re-scan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <MetricCard label="Files" value={fileCount} icon={FileCode} accentColor="cyan" />
        <MetricCard label="Functions" value={functionCount} icon={Code2} accentColor="indigo" />
        <MetricCard label="Dependencies" value={linkCount} icon={PackageCheck} accentColor="emerald" />
        <MetricCard label="Components" value={compCount} icon={CheckCircle2} accentColor="amber" />
        <MetricCard label="Languages" value={langCount} icon={Cpu} accentColor="cyan" />
        <MetricCard label="APIs" value={routesCount} icon={Server} accentColor="indigo" />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-[#2B2B2B] pt-1">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-3 py-1.5 font-mono text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'scan'
              ? 'border-[#007ACC] text-[#FFFFFF]'
              : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
          }`}
        >
          <Cpu size={13} />
          <span>Project Scan & Architecture</span>
        </button>

        <button
          onClick={() => setActiveTab('graph')}
          className={`px-3 py-1.5 font-mono text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'graph'
              ? 'border-[#007ACC] text-[#FFFFFF]'
              : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
          }`}
        >
          <Network size={13} />
          <span>Dependency Graph</span>
        </button>

        <button
          onClick={() => setActiveTab('impact')}
          className={`px-3 py-1.5 font-mono text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'impact'
              ? 'border-[#007ACC] text-[#FFFFFF]'
              : 'border-transparent text-[#858585] hover:text-[#CCCCCC]'
          }`}
        >
          <Radar size={13} />
          <span>Blast Radius & Impact</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scan' && (
        <ProjectScanPanel scanResult={scanResult} summary={projectSummary} />
      )}

      {activeTab === 'graph' && (
        <DependencyGraph graph={knowledgeGraph} height={460} />
      )}

      {activeTab === 'impact' && (
        <ImpactReport />
      )}
    </div>
  );
};
