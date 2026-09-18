import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useProjectStore } from '../../stores/projectStore';
import { Loader2 } from 'lucide-react';

export const MonacoEditorContainer: React.FC = () => {
  const { openFiles, activeFileId, updateFileContent } = useProjectStore();
  const editorRef = useRef<any>(null);

  const activeFile = openFiles.find((f) => f.id === activeFileId);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

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
        'editor.inactiveSelectionBackground': '#3A3D41'
      }
    });

    monaco.editor.setTheme('vscode-dark-custom');
  };

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
