import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useProjectStore } from '../../store/projectStore';
import { Trash2, Loader2 } from 'lucide-react';

// ─── Helper: colorize a line based on its type ────────────────────────────────

function lineClass(type: string): string {
  switch (type) {
    case 'input':   return 'text-[#89D185]';          // green — command echo
    case 'stdout':  return 'text-[#CCCCCC]';           // white — normal output
    case 'stderr':  return 'text-[#F48771]';           // orange-red — stderr
    case 'error':   return 'text-[#F14C4C]';           // bright red — system error
    case 'exit':    return 'text-[#5A5A5A] italic';    // dim — exit code line
    case 'system':  return 'text-[#4EC9B0]';           // teal — IDE messages
    default:        return 'text-[#CCCCCC]';
  }
}

// ─── Prompt component ─────────────────────────────────────────────────────────

function Prompt({ cwd }: { cwd: string }) {
  const short = cwd.length > 40 ? `…${cwd.slice(-37)}` : cwd;
  return (
    <span className="text-[#89D185] select-none shrink-0">
      {short}&gt;{' '}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const InteractiveShell: React.FC = () => {
  const {
    sessions,
    activeSessionId,
    isLoading,
    sendCommand,
    clearTerminal
  } = useTerminalStore();

  const { projectPath } = useProjectStore();

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? sessions[0];
  const lines = activeSession?.lines ?? [];
  const commandHistory = activeSession?.commandHistory ?? [];
  const cwd = activeSession?.cwd ?? projectPath ?? 'C:\\Projects';

  const [inputVal, setInputVal] = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [lines.length]);

  // Focus input on mount and when session changes
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const cmd = inputVal.trim();
      if (!cmd) return;
      sendCommand(cmd);
      setInputVal('');
      setHistIdx(-1);
    },
    [inputVal, sendCommand]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const nextIdx = histIdx < commandHistory.length - 1 ? histIdx + 1 : histIdx;
        setHistIdx(nextIdx);
        setInputVal(commandHistory[commandHistory.length - 1 - nextIdx] ?? '');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (histIdx <= 0) {
          setHistIdx(-1);
          setInputVal('');
        } else {
          const nextIdx = histIdx - 1;
          setHistIdx(nextIdx);
          setInputVal(commandHistory[commandHistory.length - 1 - nextIdx] ?? '');
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        clearTerminal();
      }
    },
    [commandHistory, histIdx, clearTerminal]
  );

  return (
    <div
      className="h-full flex flex-col bg-[#0D0D0D] font-['JetBrains_Mono',_'Fira_Code',_Consolas,_monospace] text-xs select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* ─── Scrollable output area ─── */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-[1px] leading-[1.6]">
        {lines.map((line) => {
          if (line.type === 'input') {
            return (
              <div key={line.id} className="flex items-start gap-0 pt-1">
                <Prompt cwd={cwd} />
                <span className="text-[#CCCCCC] break-all">{line.content}</span>
              </div>
            );
          }
          return (
            <div
              key={line.id}
              className={`whitespace-pre-wrap break-all pl-0 ${lineClass(line.type)}`}
            >
              {line.content}
            </div>
          );
        })}

        {/* Spinning indicator while waiting for response */}
        {isLoading && (
          <div className="flex items-center gap-1.5 text-[#5A5A5A] pt-0.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>running…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ─── Input row ─── */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex items-center gap-0 border-t border-[#1E1E1E] bg-[#0D0D0D] px-3 py-1.5"
      >
        <Prompt cwd={cwd} />
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          className="flex-1 bg-transparent text-[#CCCCCC] focus:outline-none font-['JetBrains_Mono',_'Fira_Code',_Consolas,_monospace] text-xs caret-[#CCCCCC] min-w-0"
          aria-label="Terminal input"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); clearTerminal(); }}
          className="ml-2 p-1 text-[#5A5A5A] hover:text-[#9D9D9D] transition-colors shrink-0"
          title="Clear terminal (Ctrl+L)"
          tabIndex={-1}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
