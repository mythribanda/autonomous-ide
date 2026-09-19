import React, { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { TaskStatusBadge } from './TaskStatusBadge';
import { ActivityTimeline } from '../agent/ActivityTimeline';
import { TaskReport } from '../agent/TaskReport';
import { TaskReportData } from '../../types/api';
import {
  Clock,
  FileText,
  FileCode,
  GitBranch,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Code,
  FileCheck2,
  GitCommit
} from 'lucide-react';
import { clsx } from 'clsx';

type HistoryTab = 'timeline' | 'report' | 'files' | 'git';

export const TaskHistory: React.FC = () => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('timeline');

  const {
    selectedTaskId,
    selectedTaskDetail,
    tasks,
    taskEvents,
    taskReports,
    fetchTaskReport,
    retryTask,
    deleteTask,
    isRetrying
  } = useTaskStore();

  const task = selectedTaskDetail || tasks.find((t) => t.id === selectedTaskId) || null;
  const events = (selectedTaskId && taskEvents[selectedTaskId]) || selectedTaskDetail?.events || [];
  const report = selectedTaskId ? taskReports[selectedTaskId] : null;

  useEffect(() => {
    if (selectedTaskId && !taskReports[selectedTaskId]) {
      fetchTaskReport(selectedTaskId);
    }
  }, [selectedTaskId, taskReports, fetchTaskReport]);

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#1E1E1E] select-none">
        <div className="w-12 h-12 rounded-xl bg-[#252526] border border-[#333333] flex items-center justify-center text-[#757575] mb-3">
          <FileText size={24} />
        </div>
        <h3 className="text-sm font-semibold text-[#CCCCCC]">No Task Selected</h3>
        <p className="text-xs text-[#7E7E7E] mt-1 max-w-sm">
          Select a task from the sidebar list or submit a new requirement via the prompt bar above.
        </p>
      </div>
    );
  }

  const isExecuting = ['executing', 'running', 'planning', 'testing', 'recovering', 'waiting_approval'].includes(
    task.status.toLowerCase()
  );

  // Convert taskReport response to TaskReportData shape for TaskReport component
  const taskReportData: TaskReportData | null = report
    ? {
        task: report.requirement,
        status: report.status,
        filesChanged: report.metrics?.files_changed || report.files_modified?.length || 0,
        testsPassed: report.metrics?.tests_passed || 0,
        testsFailed: report.metrics?.tests_failed || 0,
        buildStatus:
          report.verification_report?.build_status?.passed === true
            ? 'success'
            : report.verification_report?.build_status?.passed === false
            ? 'failed'
            : 'skipped',
        recoveryAttempts: report.metrics?.recovery_attempts || 0,
        humanInterventions: report.metrics?.human_interventions || 0,
        executionTimeSeconds: report.metrics?.execution_time_seconds || 0,
        gitCheckpoint: report.git_checkpoint?.commit_hash || null
      }
    : task.status === 'completed' || task.status === 'failed'
    ? {
        task: task.requirement,
        status: task.status,
        filesChanged: task.files_changed,
        testsPassed: task.tests_passed,
        testsFailed: task.tests_failed,
        buildStatus: 'skipped',
        recoveryAttempts: task.recovery_attempts,
        humanInterventions: task.human_interventions,
        executionTimeSeconds: task.execution_time_seconds || 0
      }
    : null;

  const handleRetry = async () => {
    if (!task) return;
    await retryTask(task.id);
  };

  const handleDelete = async () => {
    if (!task) return;
    if (window.confirm('Are you sure you want to delete this task and its history?')) {
      await deleteTask(task.id);
    }
  };

  // AgentEvents adaptation for ActivityTimeline
  const timelineEvents = events.map((e) => {
    let parsedData = {};
    if (e.data_json) {
      try {
        parsedData = typeof e.data_json === 'string' ? JSON.parse(e.data_json) : e.data_json;
      } catch {
        parsedData = {};
      }
    }
    return {
      type: e.event_type,
      event_type: e.event_type,
      timestamp: e.timestamp,
      message: e.message,
      data: parsedData,
      task_id: e.task_id
    };
  });

  const modifiedFiles = report?.files_modified || [];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#1E1E1E] text-[#CCCCCC]">
      {/* 1. Header Banner */}
      <div className="flex flex-col border-b border-[#2D2D2D] bg-[#252526] px-5 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <TaskStatusBadge status={task.status} size="md" />
              <span className="text-xs font-mono text-[#858585]">ID: {task.id.substring(0, 8)}</span>
              {task.execution_time_seconds != null && (
                <span className="text-xs font-mono text-[#858585] flex items-center gap-1">
                  <Clock size={12} />
                  {task.execution_time_seconds.toFixed(1)}s
                </span>
              )}
            </div>

            <h2 className="text-sm font-semibold text-white tracking-wide break-words mt-1 leading-snug">
              {task.requirement}
            </h2>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {!isExecuting && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2D2D2D] hover:bg-[#383838] text-xs font-medium text-white transition-colors border border-[#404040] disabled:opacity-50"
                title="Retry task with same specification"
              >
                <RotateCcw size={13} className={isRetrying ? 'animate-spin' : ''} />
                <span>Retry</span>
              </button>
            )}

            {!isExecuting && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded hover:bg-rose-950/40 text-[#858585] hover:text-rose-400 transition-colors border border-transparent hover:border-rose-900/40"
                title="Delete task"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[#333333]">
          <button
            onClick={() => setActiveTab('timeline')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors',
              activeTab === 'timeline'
                ? 'bg-[#007ACC] text-white shadow-sm'
                : 'text-[#969696] hover:text-white hover:bg-[#2A2A2A]'
            )}
          >
            <Clock size={13} />
            <span>Timeline</span>
            <span className="text-[10px] opacity-75 font-mono">({timelineEvents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('report')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors',
              activeTab === 'report'
                ? 'bg-[#007ACC] text-white shadow-sm'
                : 'text-[#969696] hover:text-white hover:bg-[#2A2A2A]'
            )}
          >
            <FileText size={13} />
            <span>Report</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors',
              activeTab === 'files'
                ? 'bg-[#007ACC] text-white shadow-sm'
                : 'text-[#969696] hover:text-white hover:bg-[#2A2A2A]'
            )}
          >
            <FileCode size={13} />
            <span>Files Changed</span>
            {modifiedFiles.length > 0 && (
              <span className="text-[10px] opacity-75 font-mono">({modifiedFiles.length})</span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('git')}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors',
              activeTab === 'git'
                ? 'bg-[#007ACC] text-white shadow-sm'
                : 'text-[#969696] hover:text-white hover:bg-[#2A2A2A]'
            )}
          >
            <GitBranch size={13} />
            <span>Git</span>
            {report?.git_checkpoint && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* 2. Tab Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div className="h-full flex flex-col">
            {timelineEvents.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#757575]">
                No events recorded for this task yet.
              </div>
            ) : (
              <ActivityTimeline events={timelineEvents} agentStatus={task.status} showHeader={false} />
            )}
          </div>
        )}

        {/* Tab: Report */}
        {activeTab === 'report' && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {taskReportData ? (
              <TaskReport report={taskReportData} />
            ) : (
              <div className="p-8 text-center text-xs text-[#777777] bg-[#252526] rounded border border-[#333333]">
                Task is currently in progress. Report will be generated upon completion.
              </div>
            )}

            {/* Phases Breakdown if available */}
            {report?.phases && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {Object.entries(report.phases).map(([phaseName, phaseEvents]) => (
                  <div
                    key={phaseName}
                    className="p-3 rounded bg-[#252526] border border-[#333333] flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-white border-b border-[#383838] pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Layers size={13} className="text-[#007ACC]" />
                        {phaseName} Phase
                      </span>
                      <span className="text-[10px] font-mono text-[#858585]">
                        {phaseEvents.length} events
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {phaseEvents.length === 0 ? (
                        <p className="text-[11px] text-[#6E6E6E] italic">No events in this phase</p>
                      ) : (
                        phaseEvents.map((pe) => (
                          <div
                            key={pe.id}
                            className="text-[11px] flex items-start gap-1.5 text-[#BBBBBB] leading-snug"
                          >
                            <span className="text-[9px] font-mono text-[#666666] shrink-0 pt-0.5">
                              {new Date(pe.timestamp).toLocaleTimeString([], { hour12: false })}
                            </span>
                            <span className="break-words">{pe.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Files Changed */}
        {activeTab === 'files' && (
          <div className="max-w-4xl mx-auto space-y-3">
            <div className="flex items-center justify-between text-xs text-[#858585] border-b border-[#2D2D2D] pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <FileCode size={14} className="text-[#007ACC]" />
                Modified Files ({modifiedFiles.length})
              </span>
            </div>

            {modifiedFiles.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#757575] bg-[#252526] rounded border border-[#333333]">
                No files were modified during this task execution.
              </div>
            ) : (
              <div className="divide-y divide-[#2B2B2B] rounded border border-[#333333] bg-[#252526] overflow-hidden">
                {modifiedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-2.5 hover:bg-[#2A2D2E] transition-colors"
                  >
                    <div className="flex items-center gap-2 font-mono text-xs text-[#CCCCCC] min-w-0">
                      <Code size={14} className="text-[#007ACC] shrink-0" />
                      <span className="truncate">{file}</span>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-mono shrink-0">
                      modified
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Git */}
        {activeTab === 'git' && (
          <div className="max-w-4xl mx-auto space-y-4">
            {report?.git_checkpoint ? (
              <div className="rounded border border-[#333333] bg-[#252526] p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-[#383838] pb-2">
                  <div className="flex items-center gap-2">
                    <GitCommit size={16} className="text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white">Autonomous Git Checkpoint</h4>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#1E1E1E] text-sky-400 border border-[#3A3A3A]">
                    {report.git_checkpoint.branch}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[#858585] w-24">Commit Hash:</span>
                    <span className="font-mono text-amber-300 bg-[#1A1A1A] px-2 py-0.5 rounded">
                      {report.git_checkpoint.commit_hash}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#858585] w-24">Message:</span>
                    <span className="text-white font-medium">{report.git_checkpoint.message}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#858585] w-24">Author:</span>
                    <span className="text-[#CCCCCC]">{report.git_checkpoint.author}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[#858585] w-24">Files Changed:</span>
                    <span className="font-mono text-emerald-400">
                      {report.git_checkpoint.files_changed}
                    </span>
                  </div>

                  {report.git_checkpoint.created_at && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#858585] w-24">Committed At:</span>
                      <span className="text-[#858585] font-mono">
                        {new Date(report.git_checkpoint.created_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#757575] bg-[#252526] rounded border border-[#333333]">
                No git checkpoint was created for this task. Checkpoints are automatically generated upon successful verification.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
