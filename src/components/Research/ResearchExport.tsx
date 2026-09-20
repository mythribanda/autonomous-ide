import React, { useState } from 'react';
import {
  exportLatexTables,
  exportComparisonTable,
  getEvaluationMetrics,
  getEvaluationReport
} from '../../lib/api';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  FileText,
  Download,
  Copy,
  Check,
  BookOpen,
  GraduationCap,
  Layers,
  Sparkles,
  RefreshCw,
  Code2,
  Table
} from 'lucide-react';
import { clsx } from 'clsx';

export const ResearchExport: React.FC = () => {
  const { projectId } = useProjectStore();
  const { addToast } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<'latex' | 'comparison' | 'final_report'>('latex');
  const [latexContent, setLatexContent] = useState<string>('');
  const [comparisonContent, setComparisonContent] = useState<string>('');
  const [finalReportContent, setFinalReportContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchLatex = async () => {
    setLoading(true);
    try {
      const res = await exportLatexTables(projectId || undefined);
      setLatexContent(res.latex);
      setActiveTab('latex');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'LaTeX Export Failed',
        message: err?.message || 'Could not compile LaTeX tables.'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    setLoading(true);
    try {
      const res = await exportComparisonTable(projectId || undefined);
      setComparisonContent(res.markdown);
      setActiveTab('comparison');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Comparison Export Failed',
        message: err?.message || 'Could not compile comparison matrix.'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinalReport = async () => {
    setLoading(true);
    try {
      if (projectId) {
        const rep = await getEvaluationReport(projectId);
        setFinalReportContent(rep);
      } else {
        const dummy = `# Autonomous Developer Workspace: Empirical B.Tech Project Report\n\nNo active project loaded. Open a project to generate complete project-specific empirical figures.`;
        setFinalReportContent(dummy);
      }
      setActiveTab('final_report');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Report Generation Failed',
        message: err?.message || 'Could not compile thesis report.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy =
      activeTab === 'latex'
        ? latexContent
        : activeTab === 'comparison'
        ? comparisonContent
        : finalReportContent;

    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: `${activeTab.toUpperCase()} content copied.`
    });
  };

  const handleDownload = () => {
    const ext = activeTab === 'latex' ? 'tex' : 'md';
    const filename = `autonomous_workspace_${activeTab}.${ext}`;
    const textToSave =
      activeTab === 'latex'
        ? latexContent
        : activeTab === 'comparison'
        ? comparisonContent
        : finalReportContent;

    if (!textToSave) return;
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllMetricsJson = async () => {
    try {
      if (!projectId) {
        addToast({ type: 'warning', title: 'No Project', message: 'Open a project to export metrics.' });
        return;
      }
      const metrics = await getEvaluationMetrics(projectId);
      const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project_${projectId}_metrics.json`;
      link.click();
      URL.revokeObjectURL(url);
      addToast({ type: 'success', title: 'Export Complete', message: 'Metrics JSON downloaded.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Export Failed', message: err?.message || 'Could not export JSON.' });
    }
  };

  const currentContent =
    activeTab === 'latex'
      ? latexContent
      : activeTab === 'comparison'
      ? comparisonContent
      : finalReportContent;

  return (
    <div className="p-4 rounded-lg border border-[#2B2B2B] bg-[#181818] space-y-4 font-sans text-xs select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#2B2B2B] gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-indigo-600 flex items-center justify-center text-white">
            <GraduationCap size={15} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-mono font-bold text-sm text-white">
                ACADEMIC & RESEARCH EXPORT
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-indigo-950 text-indigo-300 border border-indigo-800">
                THESIS DEFENSE READY
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Generate publication-grade LaTeX tables, comparison matrices, and thesis documentation.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchLatex}
            disabled={loading}
            className="px-2.5 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Code2 size={12} className="text-indigo-400" />
            <span>Export LaTeX</span>
          </button>

          <button
            onClick={fetchComparison}
            disabled={loading}
            className="px-2.5 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Table size={12} className="text-emerald-400" />
            <span>Comparison Matrix</span>
          </button>

          <button
            onClick={downloadAllMetricsJson}
            className="px-2.5 py-1.5 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-zinc-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <Download size={12} className="text-amber-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={fetchFinalReport}
            disabled={loading}
            className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow"
          >
            <BookOpen size={12} />
            <span>Generate Final Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[#2B2B2B] pb-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('latex')}
            className={clsx(
              'px-3 py-1 rounded transition-colors',
              activeTab === 'latex'
                ? 'bg-[#252526] text-white font-bold text-indigo-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            LaTeX Tables (.tex)
          </button>
          <button
            onClick={() => setActiveTab('comparison')}
            className={clsx(
              'px-3 py-1 rounded transition-colors',
              activeTab === 'comparison'
                ? 'bg-[#252526] text-white font-bold text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Tool Comparison Matrix (.md)
          </button>
          <button
            onClick={() => setActiveTab('final_report')}
            className={clsx(
              'px-3 py-1 rounded transition-colors',
              activeTab === 'final_report'
                ? 'bg-[#252526] text-white font-bold text-indigo-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Complete Thesis Report (.md)
          </button>
        </div>

        {currentContent && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-xs font-mono text-zinc-300 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2e2e30] border border-[#3C3C3C] text-xs font-mono text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <Download size={11} />
              <span>Download</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor / Preview Area */}
      <div className="relative rounded-lg border border-[#2B2B2B] bg-[#141414] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500 font-mono">
            <RefreshCw size={20} className="animate-spin mb-2 text-indigo-400" />
            <span>Compiling research export artifact...</span>
          </div>
        ) : !currentContent ? (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-center">
            <GraduationCap size={28} className="mb-2 text-zinc-600" />
            <span>Select an action above to generate academic export code.</span>
            <span className="text-[10px] text-zinc-600 mt-1">
              Formatted for thesis defense, IEEE/ACM publication styles, and viva presentation.
            </span>
          </div>
        ) : (
          <pre className="p-4 font-mono text-[11px] text-zinc-200 overflow-x-auto max-h-[450px] whitespace-pre-wrap leading-relaxed">
            {currentContent}
          </pre>
        )}
      </div>
    </div>
  );
};
