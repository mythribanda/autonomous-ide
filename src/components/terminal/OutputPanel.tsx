import React, { useEffect, useRef, useState } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useTerminalStore } from '../../stores/terminalStore';
import { Bot, Filter, Trash2 } from 'lucide-react';

type FilterMode = 'all' | 'errors';

// ─── Parse agent events into OutputLines ─────────────────────────────────────
function useAgentOutputLines() {
  const { addOutputLine, outputLines, clearOutput } = useTerminalStore();
  const { events } = useAgentStore();
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    events.forEach((ev) => {
      // Only process tool events for run_command
      const isCommand =
        (ev.type === 'step_start' || ev.type === 'step_done' || ev.type === 'step_failed' || ev.type === 'TOOL_CALL') &&
        (ev.data?.tool === 'run_command' || ev.data?.tool_name === 'run_command');

      if (!isCommand) return;

      const uid = `${ev.type}-${ev.timestamp}-${ev.data?.step_id ?? ''}`;
      if (seenRef.current.has(uid)) return;
      seenRef.current.add(uid);

      if (ev.type === 'step_start') {
        addOutputLine({
          source: 'agent',
          type: 'command',
          content: `⚙ [Agent] $ ${ev.data?.tool_args?.command ?? ev.message}`
        });
      } else if (ev.type === 'step_done' || ev.type === 'TOOL_CALL') {
        const output = ev.data?.result?.output ?? ev.data?.output ?? '';
        if (output) {
          addOutputLine({
            source: 'agent',
            type: 'stdout',
            content: output
          });
        }
        const exitCode = ev.data?.result?.exit_code ?? ev.data?.exit_code;
        if (exitCode !== undefined) {
          addOutputLine({
            source: 'agent',
            type: 'exit',
            content: `[exit ${exitCode}]`
          });
        }
      } else if (ev.type === 'step_failed') {
        addOutputLine({
          source: 'agent',
          type: 'stderr',
          content: `✗ [Agent command failed] ${ev.message}`
        });
      }
    });
  }, [events, addOutputLine]);

  return { outputLines, clearOutput };
}

// ─── Line color ───────────────────────────────────────────────────────────────

function outputLineClass(type: string, source: string): string {
  if (type === 'command') return 'text-[#4EC9B0] font-semibold';
  if (type === 'stderr')  return 'text-[#F48771]';
  if (type === 'exit')    return 'text-[#5A5A5A] italic';
  if (source === 'agent') return 'text-[#CCCCCC]';
  return 'text-[#9D9D9D]';
}

// ─── Component ────────────────────────────────────────────────────────────────

export const OutputPanel: React.FC = () => {
  const { outputLines, clearOutput } = useAgentOutputLines();
  const { outputLogs } = useTerminalStore();
  const [filter, setFilter] = useState<FilterMode>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [outputLines.length, outputLogs.length]);

  const visibleAgentLines =
    filter === 'errors'
      ? outputLines.filter((l) => l.type === 'stderr' || l.type === 'exit')
      : outputLines;

  return (
    <div className="h-full flex flex-col bg-[#0D0D0D] font-['JetBrains_Mono',_'Fira_Code',_Consolas,_monospace] text-xs">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-1 border-b border-[#1E1E1E]">
        <div className="flex items-center gap-1 text-[#4EC9B0]">
          <Bot className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">Agent output</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* Filter toggle */}
          <button
            onClick={() => setFilter((f) => (f === 'all' ? 'errors' : 'all'))}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
              filter === 'errors'
                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                : 'text-[#5A5A5A] hover:text-[#9D9D9D] hover:bg-[#1E1E1E]'
            }`}
            title="Toggle: show errors only"
          >
            <Filter className="w-3 h-3" />
            {filter === 'errors' ? 'Errors only' : 'All output'}
          </button>

          <button
            onClick={clearOutput}
            className="p-1 text-[#5A5A5A] hover:text-[#9D9D9D] hover:bg-[#1E1E1E] rounded transition-colors"
            title="Clear output"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Output lines */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-[1px] leading-[1.6] select-text">
        {/* Agent-run command output */}
        {visibleAgentLines.length === 0 && outputLogs.length === 0 && (
          <div className="text-[#3C3C3C] pt-2">
            No output yet. Agent command output will appear here during task execution.
          </div>
        )}

        {visibleAgentLines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all ${outputLineClass(line.type, line.source)}`}
          >
            {line.type === 'command' && (
              <span className="text-[#5A5A5A] text-[9px] mr-1.5 align-middle">[{line.timestamp}]</span>
            )}
            {line.content}
          </div>
        ))}

        {/* Legacy outputLogs (INFO lines from terminal store) */}
        {filter === 'all' && outputLogs.map((log, idx) => (
          <div key={`log-${idx}`} className="text-[#5A5A5A] whitespace-pre-wrap break-all">
            {log}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
};
