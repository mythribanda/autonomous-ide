import React from 'react';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore } from '../../store/projectStore';
import { FileIcon } from '../explorer/FileIcon';
import { X, GitCompare, Bot } from 'lucide-react';
import { clsx } from 'clsx';
import { getFileDiff } from '../../lib/api';

export const EditorTabs: React.FC = () => {
  const {
    openFiles: editorOpenFiles,
    activeFile,
    aiModifiedFiles,
    setActiveFile,
    closeFile,
    openDiff,
    toggleDiffDrawer,
    isDiffDrawerOpen
  } = useEditorStore();

  const {
    openFiles: projectOpenFiles,
    activeFileId,
    projectId,
    setActiveFile: setProjectActiveFile,
    closeFile: closeProjectFile
  } = useProjectStore();

  // Merge tabs from both stores if any files were opened via projectStore
  const tabs = React.useMemo(() => {
    const tabMap = new Map<string, {
      id: string;
      path: string;
      name: string;
      isDirty: boolean;
      isAIModified: boolean;
      language: string;
      content: string;
    }>();

    projectOpenFiles.forEach((f) => {
      const norm = f.path.replace(/\\/g, '/');
      tabMap.set(norm, {
        id: f.id,
        path: f.path,
        name: f.name,
        isDirty: !!f.isModified,
        isAIModified: aiModifiedFiles.some((m) => m.replace(/\\/g, '/') === norm),
        language: f.language,
        content: f.content
      });
    });

    editorOpenFiles.forEach((f) => {
      const norm = f.path.replace(/\\/g, '/');
      const existing = tabMap.get(norm);
      tabMap.set(norm, {
        id: f.path,
        path: f.path,
        name: f.name || f.path.split(/[/\\]/).pop() || f.path,
        isDirty: f.isDirty || (existing ? existing.isDirty : false),
        isAIModified: f.isAIModified || aiModifiedFiles.some((m) => m.replace(/\\/g, '/') === norm),
        language: f.language,
        content: f.content
      });
    });

    return Array.from(tabMap.values());
  }, [projectOpenFiles, editorOpenFiles, aiModifiedFiles]);

  if (tabs.length === 0) return null;

  const currentActivePath = (activeFile || activeFileId || '').replace(/\\/g, '/');

  const handleTabClick = (path: string, id: string) => {
    setActiveFile(path);
    setProjectActiveFile(id);
  };

  const handleTabClose = (e: React.MouseEvent, path: string, id: string) => {
    e.stopPropagation();
    closeFile(path);
    closeProjectFile(id);
  };

  const handleOpenDiff = async (e: React.MouseEvent, path: string, content: string, language: string) => {
    e.stopPropagation();
    if (!projectId) return;
    try {
      const diffData = await getFileDiff(projectId, path);
      openDiff({
        filePath: path,
        original: diffData.original ?? '',
        modified: diffData.modified ?? content,
        language
      });
    } catch {
      // Fallback
      openDiff({
        filePath: path,
        original: '',
        modified: content,
        language
      });
    }
  };

  const hasAIModifications = aiModifiedFiles.length > 0;

  return (
    <div className="h-8 border-b border-[#2B2B2B] bg-[#181818] flex items-center justify-between overflow-x-auto select-none no-scrollbar">
      {/* ─── Tabs List ─── */}
      <div className="flex items-center h-full min-w-0 flex-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.path.replace(/\\/g, '/') === currentActivePath;

          return (
            <div
              key={tab.path}
              onClick={() => handleTabClick(tab.path, tab.id)}
              className={clsx(
                'group h-full px-3 flex items-center gap-2 border-r border-[#2B2B2B] cursor-pointer text-xs font-sans transition-colors relative min-w-[120px] max-w-[200px]',
                isActive
                  ? 'bg-[#1E1E1E] text-[#FFFFFF] border-t-2 border-t-[#007ACC]'
                  : 'bg-[#181818] text-[#858585] hover:bg-[#1E1E1E]/50 hover:text-[#CCCCCC]'
              )}
            >
              <FileIcon name={tab.name} size={13} />
              <span className="truncate flex-1 text-xs">{tab.name}</span>

              {/* Status Badges & Close Button */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* AI Modified Indicator (orange dot / bot badge) */}
                {tab.isAIModified && (
                  <span
                    onClick={(e) => handleOpenDiff(e, tab.path, tab.content, tab.language)}
                    title="Modified by AI Agent — click to view diff"
                    className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 transition-colors cursor-pointer"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                    <Bot className="w-2.5 h-2.5" />
                  </span>
                )}

                {/* Unsaved changes dot */}
                {tab.isDirty && !tab.isAIModified && (
                  <span
                    className="w-2 h-2 rounded-full bg-[#E2C08D] group-hover:hidden"
                    title="Unsaved changes"
                  />
                )}

                {/* Close Button */}
                <button
                  onClick={(e) => handleTabClose(e, tab.path, tab.id)}
                  className={clsx(
                    'p-0.5 rounded-sm hover:bg-[#2A2D2E] text-[#858585] hover:text-[#FFFFFF] transition-colors',
                    tab.isDirty || tab.isAIModified ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                  )}
                  title="Close (Ctrl+W)"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Right Controls: AI Diff Drawer Toggle ─── */}
      {hasAIModifications && (
        <div className="flex items-center px-2 h-full border-l border-[#2B2B2B] bg-[#181818] shrink-0">
          <button
            onClick={toggleDiffDrawer}
            className={clsx(
              'flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-colors',
              isDiffDrawerOpen
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40'
                : 'bg-[#252526] hover:bg-[#2A2D2E] text-[#CCCCCC] border border-[#2B2B2B]'
            )}
            title="Toggle File Diff Drawer (AI changes)"
          >
            <GitCompare className="w-3.5 h-3.5 text-orange-400" />
            <span className="hidden sm:inline">AI Changes</span>
            <span className="px-1 text-[10px] font-bold rounded-full bg-orange-500/30 text-orange-300">
              {aiModifiedFiles.length}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
