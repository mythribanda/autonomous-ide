import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { ProjectScanResult } from '../../types/api';
import {
  FileCode,
  Box,
  Layers,
  CheckCircle2,
  XCircle,
  GitBranch,
  Terminal,
  Cpu,
  Database,
  Server,
  FileText,
  Workflow
} from 'lucide-react';

interface ProjectScanPanelProps {
  scanResult?: ProjectScanResult | null;
  summary?: string | null;
  className?: string;
}

const LANGUAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  typescript: { bg: 'bg-[#3178C6]/15', text: 'text-[#61AFEF]', border: 'border-[#3178C6]/40' },
  python: { bg: 'bg-[#3776AB]/15', text: 'text-[#E5C07B]', border: 'border-[#3776AB]/40' },
  javascript: { bg: 'bg-[#F7DF1E]/15', text: 'text-[#E5C07B]', border: 'border-[#F7DF1E]/40' },
  go: { bg: 'bg-[#00ADD8]/15', text: 'text-[#56B6C2]', border: 'border-[#00ADD8]/40' },
  rust: { bg: 'bg-[#DEA584]/15', text: 'text-[#D19A66]', border: 'border-[#DEA584]/40' },
  java: { bg: 'bg-[#ED8B00]/15', text: 'text-[#E06C75]', border: 'border-[#ED8B00]/40' },
  c: { bg: 'bg-[#A8B9CC]/15', text: 'text-[#98C379]', border: 'border-[#A8B9CC]/40' },
  cpp: { bg: 'bg-[#00599C]/15', text: 'text-[#61AFEF]', border: 'border-[#00599C]/40' },
  html: { bg: 'bg-[#E34F26]/15', text: 'text-[#E06C75]', border: 'border-[#E34F26]/40' },
  css: { bg: 'bg-[#1572B6]/15', text: 'text-[#61AFEF]', border: 'border-[#1572B6]/40' },
};

export const ProjectScanPanel: React.FC<ProjectScanPanelProps> = ({
  scanResult: propScanResult,
  summary: propSummary,
  className = ''
}) => {
  const storeScanResult = useProjectStore((s) => s.scanResult);
  const storeSummary = useProjectStore((s) => s.projectSummary);
  const currentProject = useProjectStore((s) => s.currentProject);

  const scan = propScanResult || storeScanResult;
  const summary = propSummary || storeSummary;

  if (!scan) {
    return (
      <div className={`p-4 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[#858585] text-xs ${className}`}>
        No scan results loaded yet. Open a workspace or trigger scan to analyze.
      </div>
    );
  }

  return (
    <div className={`space-y-3 font-sans text-xs ${className}`}>
      {/* Top Banner: Languages, Frameworks, Meta */}
      <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-3 shadow-sm">
        {/* Row 1: Languages & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono font-medium text-[#858585] mr-1">LANGUAGES:</span>
            {scan.languages && scan.languages.length > 0 ? (
              scan.languages.map((lang) => {
                const colors = LANGUAGE_COLORS[lang.toLowerCase()] || {
                  bg: 'bg-[#2A2D2E]',
                  text: 'text-[#CCCCCC]',
                  border: 'border-[#3C3C3C]'
                };
                return (
                  <span
                    key={lang}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                  >
                    {lang}
                  </span>
                );
              })
            ) : (
              <span className="text-[#858585] text-[11px]">None detected</span>
            )}
          </div>

          {/* Infrastructure / Environment Badges */}
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            {/* File Count */}
            <span className="px-2 py-0.5 rounded-sm bg-[#252526] border border-[#2B2B2B] text-[#CCCCCC] flex items-center gap-1">
              <FileCode size={11} className="text-[#61AFEF]" />
              <span>{scan.file_count} files</span>
            </span>

            {/* Docker */}
            <span
              className={`px-2 py-0.5 rounded-sm border flex items-center gap-1 ${
                scan.has_docker
                  ? 'bg-[#007ACC]/15 text-[#61AFEF] border-[#007ACC]/40'
                  : 'bg-[#252526] text-[#555555] border-[#2B2B2B]'
              }`}
            >
              <Box size={11} />
              <span>Docker {scan.has_docker ? '✓' : '✗'}</span>
            </span>

            {/* Git */}
            <span
              className={`px-2 py-0.5 rounded-sm border flex items-center gap-1 ${
                scan.has_git
                  ? 'bg-[#E5C07B]/15 text-[#E5C07B] border-[#E5C07B]/40'
                  : 'bg-[#252526] text-[#555555] border-[#2B2B2B]'
              }`}
            >
              <GitBranch size={11} />
              <span>Git {scan.has_git ? '✓' : '✗'}</span>
            </span>

            {/* CI / CD */}
            <span
              className={`px-2 py-0.5 rounded-sm border flex items-center gap-1 ${
                scan.has_ci
                  ? 'bg-[#98C379]/15 text-[#98C379] border-[#98C379]/40'
                  : 'bg-[#252526] text-[#555555] border-[#2B2B2B]'
              }`}
            >
              <Workflow size={11} />
              <span>CI {scan.has_ci ? '✓' : '✗'}</span>
            </span>
          </div>
        </div>

        {/* Row 2: Frameworks, Package Manager, Test Framework */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] pt-2 border-t border-[#2B2B2B]">
          {/* Frameworks */}
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-[#61AFEF]" />
            <span className="text-[#858585]">Frameworks:</span>
            <span className="text-[#FFFFFF] font-medium font-mono">
              {scan.frameworks && scan.frameworks.length > 0 ? scan.frameworks.join(', ') : 'Standard'}
            </span>
          </div>

          {/* Package Manager */}
          {scan.package_manager && (
            <div className="flex items-center gap-1.5">
              <Terminal size={13} className="text-[#98C379]" />
              <span className="text-[#858585]">Package Manager:</span>
              <span className="text-[#98C379] font-medium font-mono">{scan.package_manager}</span>
            </div>
          )}

          {/* Test Framework */}
          {scan.test_framework && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-[#E5C07B]" />
              <span className="text-[#858585]">Testing:</span>
              <span className="text-[#E5C07B] font-medium font-mono">{scan.test_framework}</span>
            </div>
          )}

          {/* Database */}
          {scan.detected_database && (
            <div className="flex items-center gap-1.5">
              <Database size={13} className="text-[#C678DD]" />
              <span className="text-[#858585]">Database:</span>
              <span className="text-[#C678DD] font-medium font-mono">{scan.detected_database}</span>
            </div>
          )}

          {/* API Style */}
          {scan.api_style && (
            <div className="flex items-center gap-1.5">
              <Server size={13} className="text-[#56B6C2]" />
              <span className="text-[#858585]">API:</span>
              <span className="text-[#56B6C2] font-medium font-mono">{scan.api_style}</span>
            </div>
          )}
        </div>
      </div>

      {/* Architecture Summary Paragraph */}
      {summary && (
        <div className="p-3.5 rounded-sm bg-[#1E1E1E] border border-[#2B2B2B] space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 pb-1 border-b border-[#2B2B2B]">
            <FileText size={13} className="text-[#007ACC]" />
            <h3 className="font-mono text-[11px] font-bold text-[#CCCCCC] uppercase tracking-wider">
              Architecture Summary
            </h3>
          </div>
          <p className="text-xs text-[#A0A0A0] leading-relaxed font-sans pt-1">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
};
