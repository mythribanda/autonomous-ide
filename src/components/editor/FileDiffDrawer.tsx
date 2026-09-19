import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore, detectLanguage } from '../../store/projectStore';
import { getFileDiff, revertFile } from '../../lib/api';
import { X, GitCompare, FileDiff, Check, RotateCcw, Loader2, Bot } from 'lucide-react';
import { clsx } from 'clsx';

interface FileDiffSummary {
  path: string;
  name: string;
  additions: number;
  deletions: number;
  original: string;
  modified: string;
  language: string;
  loading: boolean;
}

export const FileDiffDrawer: React.FC = () => {
  const {
    aiModifiedFiles,
    isDiffDrawerOpen,
    setDiffDrawerOpen,
    openDiff,
    clearAIModifications
  } = useEditorStore();

  const { projectId } = useProjectStore();
  const [fileSummaries, setFileSummaries] = useState<FileDiffSummary[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!isDiffDrawerOpen || aiModifiedFiles.length === 0 || !projectId) {
      return;
    }

    let isMounted = true;

    const loadDiffSummaries = async () => {
      const initial: FileDiffSummary[] = aiModifiedFiles.map((p) => {
        const name = p.split(/[/\\]/).pop() || p;
        return {
          path: p,
          name,
          additions: 0,
          deletions: 0,
          original: '',
          modified: '',
          language: detectLanguage(name),
          loading: true
        };
      });
      setFileSummaries(initial);

      const results = await Promise.all(
        aiModifiedFiles.map(async (p) => {
          const name = p.split(/[/\\]/).pop() || p;
          try {
            const data = await getFileDiff(projectId, p);
            return {
              path: p,
              name,
              additions: data.lines_added ?? 0,
              deletions: data.lines_removed ?? 0,
              original: data.original ?? '',
              modified: data.modified ?? '',
              language: detectLanguage(name),
              loading: false
            };
          } catch {
            return {
              path: p,
              name,
              additions: 0,
              deletions: 0,
              original: '',
              modified: '',
              language: detectLanguage(name),
              loading: false
            };
          }
        })
      );

      if (isMounted) {
        setFileSummaries(results);
      }
    };

    loadDiffSummaries();

    return () => {
      isMounted = false;
    };
  }, [isDiffDrawerOpen, aiModifiedFiles, projectId]);

  if (!isDiffDrawerOpen) return null;

  const handleFileClick = (summary: FileDiffSummary) => {
    openDiff({
      filePath: summary.path,
      original: summary.original,
      modified: summary.modified,
      language: summary.language
    });
  };

  const handleRevertSingle = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    if (!projectId) return;
    setActionLoading(path);
    try {
      await revertFile(projectId, path);
      clearAIModifications(path);
    } catch (err) {
      console.error('Failed to revert file:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div
      className={clsx(
        'absolute right-0 top-0 bottom-0 w-80 max-w-full bg-[#181818] border-l border-[#2B2B2B] shadow-2xl z-40',
        'flex flex-col select-none transition-transform duration-200 ease-in-out font-sans'
      )}
    >
      {/* ─── Drawer Header ─── */}
      <div className="h-9 px-3 border-b border-[#2B2B2B] flex items-center justify-between bg-[#1F1F1F]">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-orange-400" />
          <span className="text-xs font-semibold text-[#FFFFFF]">AI Modified Files</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-orange-500/20 text-orange-300">
            {aiModifiedFiles.length}
          </span>
        </div>
        <button
          onClick={() => setDiffDrawerOpen(false)}
          className="p-1 rounded text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors"
          title="Close Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Info Banner ─── */}
      <div className="px-3 py-2 bg-[#252526] border-b border-[#2B2B2B] text-[11px] text-[#858585] leading-relaxed">
        Click a file to inspect the side-by-side diff between agent changes and HEAD.
      </div>

      {/* ─── Files List ─── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {fileSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-[#5A5A5A] text-xs p-4">
            <GitCompare className="w-8 h-8 mb-2 opacity-40 text-[#5A5A5A]" />
            <p>No AI modifications active</p>
            <p className="text-[11px] mt-1">Files edited by the agent will be listed here.</p>
          </div>
        ) : (
          fileSummaries.map((file) => {
            const isProcessing = actionLoading === file.path;

            return (
              <div
                key={file.path}
                onClick={() => handleFileClick(file)}
                className={clsx(
                  'group flex items-center justify-between p-2 rounded-md border border-transparent',
                  'hover:bg-[#1E1E1E] hover:border-[#2B2B2B] cursor-pointer transition-all'
                )}
              >
                {/* File Name & Path */}
                <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                  <FileDiff className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#CCCCCC] group-hover:text-[#FFFFFF] truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-[#5A5A5A] font-mono truncate" title={file.path}>
                      {file.path}
                    </p>
                  </div>
                </div>

                {/* Line count stats & quick actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {file.loading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#5A5A5A]" />
                  ) : (
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      {file.additions > 0 && (
                        <span className="text-[#89D185]">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-[#F14C4C]">-{file.deletions}</span>
                      )}
                      {file.additions === 0 && file.deletions === 0 && (
                        <span className="text-[#E2C08D] text-[10px] font-mono">diff</span>
                      )}
                    </div>
                  )}

                  {/* Revert button on hover */}
                  <button
                    onClick={(e) => handleRevertSingle(e, file.path)}
                    disabled={isProcessing}
                    className="p-1 rounded text-[#5A5A5A] hover:text-[#F14C4C] hover:bg-[#252526] transition-colors opacity-0 group-hover:opacity-100"
                    title="Revert file to HEAD"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Drawer Footer ─── */}
      {fileSummaries.length > 0 && (
        <div className="p-3 border-t border-[#2B2B2B] bg-[#181818] flex items-center justify-between">
          <button
            onClick={() => clearAIModifications()}
            className="text-[11px] text-[#858585] hover:text-[#CCCCCC] transition-colors"
          >
            Clear list
          </button>
          <span className="text-[10px] text-[#5A5A5A] font-mono">
            {fileSummaries.length} files changed
          </span>
        </div>
      )}
    </div>
  );
};
