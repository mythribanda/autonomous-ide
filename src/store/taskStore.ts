import { create } from 'zustand';
import { Task, TaskEvent, TaskDetailResponse, TaskReportResponse, TaskStatus } from '../types/api';
import {
  getProjectTasks,
  getTaskDetail,
  getTaskEvents,
  deleteTask as apiDeleteTask,
  retryTask as apiRetryTask,
  getTaskReport as apiGetTaskReport
} from '../lib/api';

export interface TaskStoreState {
  tasks: Task[];
  selectedTaskId: string | null;
  selectedTaskDetail: TaskDetailResponse | null;
  taskEvents: Record<string, TaskEvent[]>;
  taskReports: Record<string, TaskReportResponse>;
  isLoading: boolean;
  isRetrying: boolean;
  error: string | null;

  fetchTasks: (projectId: string, status?: string) => Promise<void>;
  selectTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<Task | null>;
  deleteTask: (taskId: string) => Promise<boolean>;
  fetchTaskReport: (taskId: string) => Promise<TaskReportResponse | null>;
  fetchTaskEvents: (taskId: string, since?: string) => Promise<TaskEvent[]>;
  appendEvent: (taskId: string, event: TaskEvent) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  clearError: () => void;
}

export const useTaskStore = create<TaskStoreState>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  selectedTaskDetail: null,
  taskEvents: {},
  taskReports: {},
  isLoading: false,
  isRetrying: false,
  error: null,

  fetchTasks: async (projectId: string, status?: string) => {
    if (!projectId) return;
    set({ isLoading: true, error: null });
    try {
      const tasks = await getProjectTasks(projectId, status);
      set({ tasks, isLoading: false });

      // If nothing selected and we have tasks, select the first one
      const { selectedTaskId, selectTask } = get();
      if (!selectedTaskId && tasks.length > 0) {
        selectTask(tasks[0].id);
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Failed to load project tasks'
      });
    }
  },

  selectTask: async (taskId: string) => {
    set({ selectedTaskId: taskId, error: null });
    try {
      const detail = await getTaskDetail(taskId);
      set((state) => ({
        selectedTaskDetail: detail,
        taskEvents: {
          ...state.taskEvents,
          [taskId]: detail.events || []
        }
      }));

      // Fetch report in background for completed/failed tasks
      get().fetchTaskReport(taskId).catch(() => {});
    } catch (err: any) {
      console.error('Failed to load task details for:', taskId, err);
    }
  },

  retryTask: async (taskId: string) => {
    set({ isRetrying: true, error: null });
    try {
      const newTask = await apiRetryTask(taskId);
      set((state) => ({
        isRetrying: false,
        tasks: [
          newTask,
          ...state.tasks.map((t) => (t.id === taskId ? { ...t, status: 'superseded' as TaskStatus } : t))
        ]
      }));
      // Select newly spawned task
      get().selectTask(newTask.id);
      return newTask;
    } catch (err: any) {
      set({
        isRetrying: false,
        error: err?.message || 'Failed to retry task'
      });
      return null;
    }
  },

  deleteTask: async (taskId: string) => {
    set({ error: null });
    try {
      await apiDeleteTask(taskId);
      set((state) => {
        const remaining = state.tasks.filter((t) => t.id !== taskId);
        const nextSelected = state.selectedTaskId === taskId ? (remaining[0]?.id ?? null) : state.selectedTaskId;

        const updatedEvents = { ...state.taskEvents };
        delete updatedEvents[taskId];
        const updatedReports = { ...state.taskReports };
        delete updatedReports[taskId];

        return {
          tasks: remaining,
          selectedTaskId: nextSelected,
          selectedTaskDetail: state.selectedTaskId === taskId ? null : state.selectedTaskDetail,
          taskEvents: updatedEvents,
          taskReports: updatedReports
        };
      });

      const { selectedTaskId, selectTask } = get();
      if (selectedTaskId) {
        selectTask(selectedTaskId);
      }
      return true;
    } catch (err: any) {
      set({
        error: err?.message || 'Failed to delete task'
      });
      return false;
    }
  },

  fetchTaskReport: async (taskId: string) => {
    try {
      const report = await apiGetTaskReport(taskId);
      set((state) => ({
        taskReports: {
          ...state.taskReports,
          [taskId]: report
        }
      }));
      return report;
    } catch (err: any) {
      return null;
    }
  },

  fetchTaskEvents: async (taskId: string, since?: string) => {
    try {
      const events = await getTaskEvents(taskId, since);
      set((state) => {
        const existing = state.taskEvents[taskId] || [];
        const merged = since ? [...existing, ...events] : events;
        return {
          taskEvents: {
            ...state.taskEvents,
            [taskId]: merged
          }
        };
      });
      return events;
    } catch (err: any) {
      return [];
    }
  },

  appendEvent: (taskId: string, event: TaskEvent) => {
    set((state) => {
      const existing = state.taskEvents[taskId] || [];
      return {
        taskEvents: {
          ...state.taskEvents,
          [taskId]: [...existing, event]
        }
      };
    });
  },

  updateTaskStatus: (taskId: string, status: TaskStatus) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      selectedTaskDetail:
        state.selectedTaskDetail && state.selectedTaskDetail.id === taskId
          ? { ...state.selectedTaskDetail, status }
          : state.selectedTaskDetail
    }));
  },

  clearError: () => set({ error: null })
}));
