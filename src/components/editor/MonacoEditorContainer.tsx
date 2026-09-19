import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useProjectStore } from '../../store/projectStore';
import { useEditorStore } from '../../store/editorStore';
import { DiffEditor } from './DiffEditor';
import { Loader2 } from 'lucide-react';

// ─── Inject custom CSS for AI change highlighting & gutter icon ──────────────
const STYLE_ID = 'monaco-ai-decorations-style';
function ensureDecorationStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.innerHTML = `
    .ai-modified-line-highlight {
      background: rgba(234, 88, 12, 0.08) !important;
      border-left: 3px solid #f97316 !important;
    }
    .ai-modified-glyph-icon {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }
    .ai-modified-glyph-icon::before {
      content: '🤖';
      font-size: 11px;
      line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

export const MonacoEditorContainer: React.FC = () => {
  const { openFiles, activeFileId, updateFileContent } = useProjectStore();
  const {
    activeFile: editorActiveFile,
    isDiffOpen,
    diffTarget,
    aiModifiedFiles,
    aiTouchedLines,
    clearTouchedLines
  } = useEditorStore();

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsCollectionRef = useRef<any>(null);

  // Active file resolution
  const activeFile =
    openFiles.find((f) => f.id === activeFileId || f.path === editorActiveFile) ??
    openFiles.find((f) => f.id === activeFileId);

  useEffect(() => {
    ensureDecorationStyles();
  }, []);

  // Update decorations when file, modified status, or touched lines change
  const applyDecorations = useCallback(() => {
    if (!editorRef.current || !monacoRef.current || !activeFile) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const normPath = activeFile.path.replace(/\\/g, '/');
    const isAIModified = aiModifiedFiles.some((f) => f.replace(/\\/g, '/') === normPath);

    if (!isAIModified) {
      if (decorationsCollectionRef.current) {
        decorationsCollectionRef.current.clear();
      }
      return;
    }

    // Determine lines to decorate
    let linesToDecorate = aiTouchedLines[activeFile.path] || aiTouchedLines[normPath] || [];

    // If no explicit line numbers provided, highlight all non-empty lines up to first 25 lines
    if (linesToDecorate.length === 0) {
      const lineCount = model.getLineCount();
      linesToDecorate = Array.from({ length: Math.min(lineCount, 30) }, (_, i) => i + 1);
    }

    const decorations = linesToDecorate.map((lineNum) => ({
      range: new monaco.Range(lineNum, 1, lineNum, 1),
      options: {
        isWholeLine: true,
        className: 'ai-modified-line-highlight',
        glyphMarginClassName: 'ai-modified-glyph-icon',
        glyphMarginHoverMessage: { value: '**Modified by AI Agent** 🤖' },
        overviewRuler: {
          color: '#f97316',
          position: monaco.editor.OverviewRulerLane.Left
        }
      }
    }));

    if (decorationsCollectionRef.current) {
      decorationsCollectionRef.current.set(decorations);
    } else if (editor.createDecorationsCollection) {
      decorationsCollectionRef.current = editor.createDecorationsCollection(decorations);
    } else {
      decorationsCollectionRef.current = {
        ids: editor.deltaDecorations([], decorations),
        clear: () => {
          if (decorationsCollectionRef.current?.ids) {
            editor.deltaDecorations(decorationsCollectionRef.current.ids, []);
            decorationsCollectionRef.current.ids = [];
          }
        },
        set: (newDecs: any[]) => {
          decorationsCollectionRef.current.ids = editor.deltaDecorations(
            decorationsCollectionRef.current.ids || [],
            newDecs
          );
        }
      };
    }
  }, [activeFile, aiModifiedFiles, aiTouchedLines]);

  useEffect(() => {
    applyDecorations();
  }, [applyDecorations]);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define authentic VS Code Dark theme
    monaco.editor.defineTheme('vscode-dark-custom', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C586C0' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'attribute.name', foreground: '9CDCFE' },
        { token: 'delimiter', foreground: 'D4D4D4' }
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2A2D2E',
        'editorCursor.foreground': '#007ACC',
        'editorWhitespace.foreground': '#3B3A32',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorGutter.background': '#1E1E1E'
      }
    });

    monaco.editor.setTheme('vscode-dark-custom');

    // Clear decorations when file is manually edited by user
    editor.onDidChangeModelContent(() => {
      if (activeFile) {
        if (decorationsCollectionRef.current) {
          decorationsCollectionRef.current.clear();
        }
        clearTouchedLines(activeFile.path);
      }
    });

    applyDecorations();
  };

  // If Diff mode is active, render DiffEditor
  if (isDiffOpen && diffTarget) {
    return <DiffEditor {...diffTarget} />;
  }

  if (!activeFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#1E1E1E] text-[#858585] select-none">
        <p className="text-sm font-sans">No editor tabs open</p>
        <p className="text-xs text-[#858585] mt-1">Select a file from the Explorer to start editing</p>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full w-full overflow-hidden bg-[#1E1E1E] relative">
      <Editor
        height="100%"
        width="100%"
        path={activeFile.path}
        language={activeFile.language}
        value={activeFile.content}
        onChange={(value) => {
          if (value !== undefined) {
            updateFileContent(activeFile.id, value);
            useEditorStore.getState().updateFileContent(activeFile.path, value);
          }
        }}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full bg-[#1E1E1E] text-[#858585] gap-2 font-mono text-xs">
            <Loader2 size={16} className="animate-spin text-[#007ACC]" />
            <span>Loading editor...</span>
          </div>
        }
        options={{
          theme: 'vscode-dark-custom',
          fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Cascadia Mono', Consolas, monospace",
          fontSize: 13,
          lineHeight: 20,
          glyphMargin: true,
          minimap: {
            enabled: true,
            maxColumn: 60,
            renderCharacters: false
          },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          renderLineHighlight: 'all',
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          contextmenu: true,
          bracketPairColorization: {
            enabled: true
          }
        }}
      />
    </div>
  );
};
