import { create } from 'zustand';
import { readFile, writeFile } from '../lib/api';
import { useProjectStore, detectLanguage } from './projectStore';

export interface FileTab {
  path: string;
  name?: string;
  content: string;
  originalContent?: string;
  isDirty: boolean;
  isAIModified: boolean;
  language: string;
}

export interface DiffTarget {
  filePath: string;
  original: string;
  modified: string;
  language: string;
}

export interface EditorStoreState {
  openFiles: FileTab[];
  activeFile: string | null;
  aiModifiedFiles: string[];
  aiTouchedLines: Record<string, number[]>;
  isDiffOpen: boolean;
  diffTarget: DiffTarget | null;
  isDiffDrawerOpen: boolean;

  // Actions
  openFile: (path: string, content?: string, language?: string) => Promise<void>;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markAsAIModified: (paths: string[], touchedLines?: Record<string, number[]>) => void;
  clearAIModifications: (path?: string) => void;
  clearTouchedLines: (path: string) => void;
  openDiff: (target: DiffTarget) => void;
  closeDiff: () => void;
  toggleDiffDrawer: () => void;
  setDiffDrawerOpen: (open: boolean) => void;
  saveActiveFile: () => Promise<boolean>;
}

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  openFiles: [],
  activeFile: null,
  aiModifiedFiles: [],
  aiTouchedLines: {},
  isDiffOpen: false,
  diffTarget: null,
  isDiffDrawerOpen: false,

  openFile: async (path: string, initialContent?: string, lang?: string) => {
    const { openFiles, aiModifiedFiles } = get();
    const normalized = path.replace(/\\/g, '/');
    const existing = openFiles.find((f) => f.path.replace(/\\/g, '/') === normalized);

    if (existing) {
      set({ activeFile: existing.path });
      // Sync with projectStore if present
      useProjectStore.getState().setActiveFile(existing.path);
      return;
    }

    let content = initialContent;
    if (content === undefined) {
      try {
        const projectPath = useProjectStore.getState().projectPath || '.';
        const res = await readFile(projectPath, path);
        content = res.content;
      } catch (err) {
        console.warn(`Failed to read file ${path} for editor:`, err);
        content = '';
      }
    }

    const fileName = normalized.split('/').pop() || normalized;
    const language = lang || detectLanguage(fileName);
    const isAIModified = aiModifiedFiles.some((f) => f.replace(/\\/g, '/') === normalized);

    const newTab: FileTab = {
      path,
      name: fileName,
      content: content ?? '',
      originalContent: content ?? '',
      isDirty: false,
      isAIModified,
      language
    };

    set({
      openFiles: [...openFiles, newTab],
      activeFile: path
    });

    // Also sync to projectStore for Explorer file tree tracking
    try {
      useProjectStore.getState().openFile({
        id: path,
        name: fileName,
        path,
        type: 'file',
        content: content ?? '',
        language
      });
    } catch {
      // Best-effort sync
    }
  },

  closeFile: (path: string) => {
    set((state) => {
      const filtered = state.openFiles.filter((f) => f.path !== path);
      let nextActive = state.activeFile;
      if (state.activeFile === path) {
        nextActive = filtered.length > 0 ? filtered[filtered.length - 1].path : null;
      }
      return {
        openFiles: filtered,
        activeFile: nextActive,
        isDiffOpen: state.diffTarget?.filePath === path ? false : state.isDiffOpen,
        diffTarget: state.diffTarget?.filePath === path ? null : state.diffTarget
      };
    });

    try {
      useProjectStore.getState().closeFile(path);
    } catch {
      // Best-effort
    }
  },

  setActiveFile: (path: string) => {
    set({ activeFile: path });
    try {
      useProjectStore.getState().setActiveFile(path);
    } catch {
      // Best-effort
    }
  },

  updateFileContent: (path: string, content: string) => {
    set((state) => {
      // If user edits, clear AI touched lines for this file as requested
      const nextTouched = { ...state.aiTouchedLines };
      delete nextTouched[path];
      delete nextTouched[path.replace(/\\/g, '/')];

      const updated = state.openFiles.map((tab) => {
        if (tab.path === path || tab.path.replace(/\\/g, '/') === path.replace(/\\/g, '/')) {
          return {
            ...tab,
            content,
            isDirty: content !== tab.originalContent
          };
        }
        return tab;
      });

      return {
        openFiles: updated,
        aiTouchedLines: nextTouched
      };
    });

    try {
      useProjectStore.getState().updateFileContent(path, content);
    } catch {
      // Best-effort
    }
  },

  markAsAIModified: (paths: string[], touchedLines?: Record<string, number[]>) => {
    const normalized = paths.map((p) => p.replace(/\\/g, '/'));
    set((state) => {
      const existing = new Set(state.aiModifiedFiles.map((p) => p.replace(/\\/g, '/')));
      normalized.forEach((p) => existing.add(p));

      const updatedTabs = state.openFiles.map((tab) => {
        const tabNorm = tab.path.replace(/\\/g, '/');
        if (existing.has(tabNorm)) {
          return { ...tab, isAIModified: true };
        }
        return tab;
      });

      const nextTouched = { ...state.aiTouchedLines };
      if (touchedLines) {
        Object.entries(touchedLines).forEach(([f, lines]) => {
          nextTouched[f] = lines;
          nextTouched[f.replace(/\\/g, '/')] = lines;
        });
      }

      return {
        aiModifiedFiles: Array.from(existing),
        openFiles: updatedTabs,
        aiTouchedLines: nextTouched
      };
    });
  },

  clearAIModifications: (path?: string) => {
    set((state) => {
      if (!path) {
        return {
          aiModifiedFiles: [],
          aiTouchedLines: {},
          openFiles: state.openFiles.map((t) => ({ ...t, isAIModified: false }))
        };
      }
      const norm = path.replace(/\\/g, '/');
      const filtered = state.aiModifiedFiles.filter((p) => p.replace(/\\/g, '/') !== norm);
      const nextTouched = { ...state.aiTouchedLines };
      delete nextTouched[path];
      delete nextTouched[norm];

      return {
        aiModifiedFiles: filtered,
        aiTouchedLines: nextTouched,
        openFiles: state.openFiles.map((t) =>
          t.path.replace(/\\/g, '/') === norm ? { ...t, isAIModified: false } : t
        )
      };
    });
  },

  clearTouchedLines: (path: string) => {
    set((state) => {
      const nextTouched = { ...state.aiTouchedLines };
      delete nextTouched[path];
      delete nextTouched[path.replace(/\\/g, '/')];
      return { aiTouchedLines: nextTouched };
    });
  },

  openDiff: (target: DiffTarget) => {
    set({ isDiffOpen: true, diffTarget: target });
  },

  closeDiff: () => {
    set({ isDiffOpen: false, diffTarget: null });
  },

  toggleDiffDrawer: () => {
    set((state) => ({ isDiffDrawerOpen: !state.isDiffDrawerOpen }));
  },

  setDiffDrawerOpen: (open: boolean) => {
    set({ isDiffDrawerOpen: open });
  },

  saveActiveFile: async () => {
    const { activeFile, openFiles } = get();
    if (!activeFile) return false;
    const tab = openFiles.find((f) => f.path === activeFile);
    if (!tab) return false;

    if (typeof window !== 'undefined' && window.electronAPI?.writeFile) {
      try {
        const ok = await window.electronAPI.writeFile(tab.path, tab.content);
        if (ok) {
          set((state) => ({
            openFiles: state.openFiles.map((f) =>
              f.path === activeFile ? { ...f, isDirty: false, originalContent: tab.content } : f
            )
          }));
          return true;
        }
      } catch {
        // Fallback
      }
    }

    try {
      await writeFile(tab.path, tab.content);
      set((state) => ({
        openFiles: state.openFiles.map((f) =>
          f.path === activeFile ? { ...f, isDirty: false, originalContent: tab.content } : f
        )
      }));
      return true;
    } catch (err) {
      console.error('Failed to save file:', err);
      return false;
    }
  }
}));
