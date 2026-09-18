import React from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import {
  FolderOpen,
  GitBranch,
  Sparkles,
  Network,
  Bot,
  CheckCircle2,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

export const WelcomeScreen: React.FC = () => {
  const { setProject } = useProjectStore();
  const { setActiveView, addToast } = useUIStore();

  const recentProjects = [
    { name: 'EduSim', path: 'C:\\Projects\\EduSim', desc: 'Classroom simulation platform • React + FastAPI', lastOpened: 'Today' },
    { name: 'InsightFlow', path: 'C:\\Projects\\InsightFlow', desc: 'Realtime streaming analytics • Next.js + Go', lastOpened: 'Yesterday' },
    { name: 'StudLyf', path: 'C:\\Projects\\StudLyf', desc: 'Campus life student companion API • Django + Flutter', lastOpened: '3 days ago' }
  ];

  const features = [
    {
      title: 'Smart Prompt Composer',
      desc: 'Compiles rough requirements into verified engineering specs in place.',
      icon: Sparkles,
      view: 'explorer' as const
    },
    {
      title: 'Project Intelligence',
      desc: 'AST semantic graph, dependency tracing, and risk analysis.',
      icon: Network,
      view: 'intelligence' as const
    },
    {
      title: 'Autonomous Agent',
      desc: 'Executes multi-step code modifications with full observability.',
      icon: Bot,
      view: 'explorer' as const
    },
    {
      title: 'Testing & Verification',
      desc: 'Real-time test suite runner with assertion diagnostics.',
      icon: CheckCircle2,
      view: 'verification' as const
    },
    {
      title: 'Self-Recovery Timeline',
      desc: 'Automated error localization, patch synthesis, and recovery.',
      icon: RefreshCw,
      view: 'recovery' as const
    },
    {
      title: 'Git Integration',
      desc: 'Pre-change atomic checkpoints and instant rollback protection.',
      icon: GitBranch,
      view: 'git' as const
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#1E1E1E] p-8 flex flex-col items-center justify-center select-none text-[#CCCCCC]">
      <div className="max-w-3xl w-full space-y-6 py-4">
        {/* Title */}
        <div className="text-left space-y-1.5 border-b border-[#2B2B2B] pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-[#007ACC]">
            <Sparkles size={14} />
            <span>Autonomous Software Engineering Workspace</span>
          </div>
          <h1 className="text-2xl font-bold text-[#FFFFFF] tracking-tight font-mono">
            AUTONOMOUS DEV
          </h1>
          <p className="text-xs text-[#858585] font-sans">
            VS Code-inspired autonomous software engineering environment.
          </p>
        </div>

        {/* Quick Start Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setProject('EduSim', 'C:\\Projects\\EduSim');
              setActiveView('explorer');
              addToast({
                type: 'success',
                title: 'Workspace Loaded',
                message: 'Loaded EduSim project workspace.'
              });
            }}
            className="px-4 py-2 rounded-sm bg-[#007ACC] hover:bg-[#0062A3] text-[#FFFFFF] font-bold text-xs flex items-center gap-2 transition-colors font-sans"
          >
            <FolderOpen size={15} />
            <span>Open Local Project (EduSim)</span>
          </button>

          <button
            onClick={() => {
              addToast({
                type: 'info',
                title: 'Clone Repository',
                message: 'Enter Git URL to clone repository into autonomous sandbox.'
              });
            }}
            className="px-4 py-2 rounded-sm bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-[#CCCCCC] font-semibold text-xs flex items-center gap-2 transition-colors font-sans"
          >
            <GitBranch size={15} className="text-[#007ACC]" />
            <span>Clone from GitHub</span>
          </button>
        </div>

        {/* Recent Projects List */}
        <div className="p-3.5 rounded-sm bg-[#181818] border border-[#2B2B2B] space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-[#2B2B2B]">
            <span className="text-[11px] font-bold text-[#CCCCCC] uppercase font-mono tracking-wider">
              RECENT WORKSPACES
            </span>
            <span className="text-[10px] font-mono text-[#858585]">Local Sandbox</span>
          </div>

          <div className="space-y-1">
            {recentProjects.map((p) => (
              <div
                key={p.name}
                onClick={() => {
                  setProject(p.name, p.path);
                  setActiveView('explorer');
                }}
                className="p-2.5 rounded-sm bg-[#1E1E1E] hover:bg-[#264F78] border border-[#2B2B2B] cursor-pointer transition-all flex items-center justify-between text-xs font-sans group"
              >
                <div>
                  <div className="font-semibold text-[#FFFFFF] group-hover:text-[#FFFFFF] transition-colors">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-[#858585] group-hover:text-[#CCCCCC] mt-0.5">{p.desc}</div>
                </div>

                <div className="flex items-center gap-3 text-[#858585] group-hover:text-[#FFFFFF]">
                  <span className="text-[10px] font-mono">{p.lastOpened}</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Overview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                onClick={() => setActiveView(feat.view)}
                className="p-3 rounded-sm bg-[#181818] border border-[#2B2B2B] hover:border-[#007ACC] hover:bg-[#252526] transition-all cursor-pointer space-y-1 group"
              >
                <div className="text-[#007ACC] inline-flex mb-0.5">
                  <Icon size={16} />
                </div>
                <h4 className="text-xs font-semibold text-[#FFFFFF] font-sans group-hover:text-[#3794FF] transition-colors">
                  {feat.title}
                </h4>
                <p className="text-[11px] text-[#858585] leading-relaxed font-sans">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
