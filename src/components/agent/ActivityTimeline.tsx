import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { AgentEvent } from '../../types/api';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Activity,
  ChevronDown,
  Terminal
} from 'lucide-react';

interface FormattedEvent {
  timeStr: string;
  icon: React.ReactNode;
  text: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  raw: AgentEvent;
}

export interface ActivityTimelineProps {
  events?: AgentEvent[];
  agentStatus?: string;
  showHeader?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  events: propEvents,
  agentStatus: propStatus,
  showHeader = true
}) => {
  const storeState = useAgentStore();
  const events = propEvents !== undefined ? propEvents : storeState.events;
  const agentStatus = propStatus !== undefined ? propStatus : storeState.agentStatus;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const formatEvent = (event: AgentEvent): FormattedEvent => {
    const rawTime = event.timestamp ? new Date(event.timestamp) : new Date();
    const timeStr = !isNaN(rawTime.getTime())
      ? rawTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    const evType = (event.type || event.event_type || event.data?.type || '').toLowerCase();
    const d = event.data || {};

    switch (evType) {
      case 'plan_created':
      case 'planning_complete':
      case 'plan_generated': {
        const count = d.steps ? (Array.isArray(d.steps) ? d.steps.length : 0) : 0;
        return {
          timeStr,
          icon: <span className="text-blue-400 font-mono text-sm">📋</span>,
          text: `Implementation plan ready (${count} steps)`,
          colorClass: 'text-blue-300',
          borderClass: 'border-blue-900/40',
          bgClass: 'bg-blue-950/20',
          raw: event
        };
      }

      case 'step_start': {
        const desc = d.description || event.message || 'Executing step';
        const tool = d.tool || 'tool';
        return {
          timeStr,
          icon: <RotateCcw size={13} className="text-sky-400 animate-spin" />,
          text: `${desc} [${tool}]`,
          colorClass: 'text-sky-300',
          borderClass: 'border-sky-900/40',
          bgClass: 'bg-sky-950/20',
          raw: event
        };
      }

      case 'step_complete':
      case 'step_done': {
        const desc = d.description || event.message || 'Step finished';
        return {
          timeStr,
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          text: desc,
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/40',
          bgClass: 'bg-emerald-950/20',
          raw: event
        };
      }

      case 'step_failed': {
        const desc = d.description || event.message || 'Step execution failed';
        const err = d.error_summary || d.error || '';
        return {
          timeStr,
          icon: <XCircle size={13} className="text-rose-400" />,
          text: err ? `${desc} — ${err}` : desc,
          colorClass: 'text-rose-300',
          borderClass: 'border-rose-900/40',
          bgClass: 'bg-rose-950/20',
          raw: event
        };
      }

      case 'recovery_start': {
        const n = d.attempt_number || 1;
        return {
          timeStr,
          icon: <AlertTriangle size={13} className="text-amber-400 animate-pulse" />,
          text: `Recovery attempt ${n} — analyzing failure...`,
          colorClass: 'text-amber-300',
          borderClass: 'border-amber-900/40',
          bgClass: 'bg-amber-950/25',
          raw: event
        };
      }

      case 'recovery_diagnosis': {
        const diag = d.diagnosis || event.message || '';
        return {
          timeStr,
          icon: <span className="text-amber-400 text-xs">🔍</span>,
          text: `Diagnosis: ${diag}`,
          colorClass: 'text-amber-200',
          borderClass: 'border-amber-900/30',
          bgClass: 'bg-amber-950/15',
          raw: event
        };
      }

      case 'recovery_complete':
      case 'recovery_success': {
        const n = d.attempt_number || 1;
        return {
          timeStr,
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          text: `Recovery attempt ${n} succeeded — resumed execution`,
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/40',
          bgClass: 'bg-emerald-950/25',
          raw: event
        };
      }

      case 'approval_requested':
      case 'waiting_approval': {
        const tool = d.tool || 'Operation';
        return {
          timeStr,
          icon: <PauseCircle size={13} className="text-amber-400" />,
          text: `Waiting approval: ${tool}`,
          colorClass: 'text-amber-300 font-semibold',
          borderClass: 'border-amber-600/60',
          bgClass: 'bg-amber-950/40',
          raw: event
        };
      }

      case 'approval_granted': {
        return {
          timeStr,
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          text: 'User approved tool execution',
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/40',
          bgClass: 'bg-emerald-950/20',
          raw: event
        };
      }

      case 'approval_denied': {
        return {
          timeStr,
          icon: <XCircle size={13} className="text-rose-400" />,
          text: 'User denied tool execution',
          colorClass: 'text-rose-300',
          borderClass: 'border-rose-900/40',
          bgClass: 'bg-rose-950/20',
          raw: event
        };
      }

      case 'verification_start': {
        return {
          timeStr,
          icon: <RotateCcw size={13} className="text-indigo-400 animate-spin" />,
          text: 'Running post-execution verification...',
          colorClass: 'text-indigo-300',
          borderClass: 'border-indigo-900/40',
          bgClass: 'bg-indigo-950/20',
          raw: event
        };
      }

      case 'verification_run':
      case 'verification_results': {
        const passed = d.passed !== undefined ? d.passed : true;
        return {
          timeStr,
          icon: passed ? <CheckCircle2 size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-rose-400" />,
          text: `Verification: ${event.message}`,
          colorClass: passed ? 'text-emerald-300' : 'text-rose-300',
          borderClass: passed ? 'border-emerald-900/40' : 'border-rose-900/40',
          bgClass: passed ? 'bg-emerald-950/20' : 'bg-rose-950/20',
          raw: event
        };
      }

      case 'git_commit': {
        const hash = d.commit_hash ? d.commit_hash.substring(0, 7) : '';
        return {
          timeStr,
          icon: <span className="text-emerald-400 font-mono text-xs">📦</span>,
          text: hash ? `Git checkpoint created: ${hash}` : 'Git checkpoint created',
          colorClass: 'text-emerald-300',
          borderClass: 'border-emerald-900/40',
          bgClass: 'bg-emerald-950/20',
          raw: event
        };
      }

      case 'task_complete':
      case 'task_completed': {
        return {
          timeStr,
          icon: <CheckCircle2 size={13} className="text-emerald-400" />,
          text: 'Task completed successfully',
          colorClass: 'text-emerald-200 font-bold',
          borderClass: 'border-emerald-700/60',
          bgClass: 'bg-emerald-950/40',
          raw: event
        };
      }

      case 'agent_stopped':
      case 'task_stopped': {
        return {
          timeStr,
          icon: <XCircle size={13} className="text-amber-400" />,
          text: 'Agent execution stopped',
          colorClass: 'text-amber-300',
          borderClass: 'border-amber-900/40',
          bgClass: 'bg-amber-950/20',
          raw: event
        };
      }

      case 'task_failed':
      case 'fatal_error': {
        const err = d.error || event.message || 'Execution error';
        return {
          timeStr,
          icon: <XCircle size={13} className="text-rose-400" />,
          text: `Execution failed: ${err}`,
          colorClass: 'text-rose-200 font-bold',
          borderClass: 'border-rose-700/60',
          bgClass: 'bg-rose-950/40',
          raw: event
        };
      }

      default: {
        return {
          timeStr,
          icon: <Activity size={12} className="text-zinc-400" />,
          text: event.message || 'Processing event',
          colorClass: 'text-zinc-300',
          borderClass: 'border-zinc-800',
          bgClass: 'bg-[#212122]',
          raw: event
        };
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#181818] border border-[#2B2B2B] rounded-sm overflow-hidden select-none font-sans text-xs">
      {/* Header */}
      {showHeader && (
        <div className="h-8 px-3 bg-[#1F1F1F] border-b border-[#2B2B2B] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={13} className="text-[#007ACC]" />
            <span className="font-semibold text-xs text-white uppercase tracking-wider font-mono">
              ACTIVITY TIMELINE
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              ({events.length} events)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              agentStatus === 'executing' ? 'bg-emerald-400 animate-pulse' :
              agentStatus === 'recovering' ? 'bg-amber-400 animate-pulse' :
              agentStatus === 'verifying' ? 'bg-indigo-400 animate-pulse' :
              agentStatus === 'paused' ? 'bg-amber-500' :
              agentStatus === 'error' ? 'bg-rose-500' : 'bg-zinc-600'
            }`} />
            <span className="text-[10px] font-mono uppercase text-zinc-400">
              {agentStatus}
            </span>
          </div>
        </div>
      )}

      {/* Events Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[140px]">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-1.5 py-8">
            <Activity size={18} className="opacity-40" />
            <span className="text-[11px] font-mono">No live agent activity yet.</span>
            <span className="text-[10px] text-zinc-600">Start an autonomous task to view real-time events.</span>
          </div>
        ) : (
          events.map((event, idx) => {
            const item = formatEvent(event);
            return (
              <div
                key={idx}
                className={`px-2.5 py-1.5 rounded-sm border ${item.borderClass} ${item.bgClass} flex items-start gap-2.5 transition-colors`}
              >
                {/* Timestamp */}
                <div className="text-[10px] font-mono text-zinc-500 flex-shrink-0 pt-0.5 select-none">
                  {item.timeStr}
                </div>

                {/* Status Icon */}
                <div className="flex-shrink-0 pt-0.5">
                  {item.icon}
                </div>

                {/* Event Text */}
                <div className={`flex-1 text-[11px] leading-relaxed font-mono ${item.colorClass} break-words`}>
                  {item.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
