import React, { useState, useMemo } from 'react';
import { DiffEditor as MonacoDiffEditor, DiffOnMount } from '@monaco-editor/react';
import { Check, Columns2, Rows2, RotateCcw, X, FileDiff, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { useProjectStore } from '../../store/projectStore';
import { revertFile, writeFile } from '../../lib/api';

export interface DiffEditorProps {
  original: string;
  modified: string;
  language: string;
  filePath: string;
  onAccept?: () => void;
  onClose?: () => void;
  onRevert?: () => void;
}

export const DiffEditor: React.FC<DiffEditorProps> = ({
  original,
  modified,
  language,
  filePath,
  onAccept,
  onClose,
  onRevert
}) => {
  const [isInline, setIsInline] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  const { projectId } = useProjectStore();
  const { closeDiff, clearAIModifications, updateFileContent } = useEditorStore();

  // Compute line additions and deletions
  const lineStats = useMemo(() => {
    const origLines = original ? original.split('\n') : [];
    const modLines = modified ? modified.split('\n') : [];

    let additions = 0;
    let deletions = 0;

    // Quick estimate if lengths differ, plus set difference
    const origSet = new Set(origLines);
    const modSet = new Set(modLines);

    for (const l of modLines) {
      if (!origSet.has(l)) additions++;
    }
    for (const l of origLines) {
      if (!modSet.has(l)) deletions++;
    }

    return {
      additions: Math.max(additions, modLines.length > origLines.length ? modLines.length - origLines.length : 0),
      deletions: Math.max(deletions, origLines.length > modLines.length ? origLines.length - modLines.length : 0)
    };
  }, [original, modified]);

  const handleMount: DiffOnMount = (editor, monaco) => {
    // VS Code dark theme definition
    monaco.editor.defineTheme('vscode-diff-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#1E1E1E',
        'diffEditor.insertedTextBackground': '#2ea04326',
        'diffEditor.removedTextBackground': '#f8514926',
        'diffEditor.insertedLineBackground': '#2ea04315',
        'diffEditor.removedLineBackground': '#f8514915'
      }
    });
    monaco.editor.setTheme('vscode-diff-dark');
  };

  const handleAccept = async () => {
    setIsSaving(true);
    try {
      let saved = false;
      if (typeof window !== 'undefined' && window.electronAPI?.writeFile) {
        saved = await window.electronAPI.writeFile(filePath, modified);
      }
      if (!saved) {
        await writeFile(filePath, modified);
      }

      // Update in memory and clear AI badge
      updateFileContent(filePath, modified);
      clearAIModifications(filePath);

      if (onAccept) {
        onAccept();
      } else {
        closeDiff();
      }
    } catch (err) {
      console.error('Failed to accept file changes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = async () => {
    if (!projectId) return;
    setIsReverting(true);
    try {
      await revertFile(projectId, filePath);
      clearAIModifications(filePath);
      updateFileContent(filePath, original);

      if (onRevert) {
        onRevert();
      } else {
        closeDiff();
      }
    } catch (err) {
      console.error('Failed to revert file changes:', err);
    } finally {
      setIsReverting(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      closeDiff();
    }
  };

  const fileName = filePath.split(/[/\\]/).pop() || filePath;

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#1E1E1E] text-[#CCCCCC] select-none">
      {/* ─── Diff Toolbar Header ─── */}
      <div className="h-9 px-3 bg-[#181818] border-b border-[#2B2B2B] flex items-center justify-between text-xs font-sans">
        {/* Left: File info + stats */}
        <div className="flex items-center gap-2.5 min-w-0">
          <FileDiff className="w-4 h-4 text-[#007ACC] shrink-0" />
          <span className="font-semibold text-[#FFFFFF] truncate max-w-[200px]" title={filePath}>
            {fileName}
          </span>
          <span className="text-[#5A5A5A] text-[11px] font-mono hidden md:inline truncate max-w-[250px]">
            {filePath}
          </span>

          {/* Line counts summary (+N -M) */}
          <div className="flex items-center gap-1.5 font-mono text-[11px] px-2 py-0.5 rounded bg-[#252526] border border-[#2B2B2B]">
            <span className="text-[#89D185]">+{lineStats.additions}</span>
            <span className="text-[#F14C4C]">-{lineStats.deletions}</span>
          </div>
        </div>

        {/* Center: Before / After labels */}
        <div className="hidden sm:flex items-center gap-6 text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-[#858585]">
            <span className="w-2 h-2 rounded-full bg-[#F14C4C]/60" />
            <span>Before (HEAD)</span>
          </div>
          <span className="text-[#3C3C3C]">→</span>
          <div className="flex items-center gap-1.5 text-[#89D185]">
            <span className="w-2 h-2 rounded-full bg-[#89D185]" />
            <span>After (AI Modified)</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {/* Toggle side-by-side / inline */}
          <button
            onClick={() => setIsInline(!isInline)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-xs text-[#CCCCCC] transition-colors"
            title={isInline ? 'Switch to Side-by-Side view' : 'Switch to Inline view'}
          >
            {isInline ? (
              <>
                <Columns2 className="w-3.5 h-3.5 text-[#007ACC]" />
                <span className="hidden lg:inline">Side-by-Side</span>
              </>
            ) : (
              <>
                <Rows2 className="w-3.5 h-3.5 text-[#007ACC]" />
                <span className="hidden lg:inline">Inline</span>
              </>
            )}
          </button>

          {/* Revert button */}
          <button
            onClick={handleRevert}
            disabled={isReverting}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#252526] hover:bg-[#2A2D2E] border border-[#2B2B2B] text-xs text-[#F14C4C] hover:text-[#FF6A6A] transition-colors disabled:opacity-50"
            title="Discard AI modifications and restore git HEAD"
          >
            {isReverting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Revert</span>
          </button>

          {/* Accept changes button */}
          <button
            onClick={handleAccept}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#0066B8] hover:bg-[#0077CC] text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-50"
            title="Accept AI modifications and save to disk"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Accept Changes</span>
          </button>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-1 rounded text-[#858585] hover:text-[#FFFFFF] hover:bg-[#2A2D2E] transition-colors ml-1"
            title="Close Diff View"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Monaco Diff Editor Container ─── */}
      <div className="flex-1 overflow-hidden relative">
        <MonacoDiffEditor
          height="100%"
          width="100%"
          language={language}
          original={original}
          modified={modified}
          onMount={handleMount}
          loading={
            <div className="flex items-center justify-center h-full bg-[#1E1E1E] text-[#858585] gap-2 font-mono text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-[#007ACC]" />
              <span>Loading diff...</span>
            </div>
          }
          theme="vscode-diff-dark"
          options={{
            renderSideBySide: !isInline,
            readOnly: true,
            fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
            fontSize: 13,
            lineHeight: 20,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderOverviewRuler: true,
            diffWordWrap: 'off',
            ignoreTrimWhitespace: false
          }}
        />
      </div>
    </div>
  );
};
