import { create } from 'zustand';
import { FileNode } from '../types';
import { MOCK_PROJECT_FILES } from '../services/mockData';

interface OpenFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isModified?: boolean;
}

interface ProjectState {
  currentProject: string;
  projectPath: string;
  rootFolder: FileNode;
  openFiles: OpenFile[];
  activeFileId: string | null;
  searchQuery: string;
  expandedFolders: Record<string, boolean>;
  
  // Actions
  setProject: (name: string, path: string) => void;
  openFile: (file: FileNode) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  addFile: (parentPath: string, name: string) => void;
  addFolder: (parentPath: string, name: string) => void;
}

// Initial open files for realistic feel
const initialOpenFiles: OpenFile[] = [
  {
    id: 'f-p-dashboard',
    name: 'Dashboard.tsx',
    path: '/frontend/src/pages/Dashboard.tsx',
    language: 'typescript',
    content: (MOCK_PROJECT_FILES.children?.[0].children?.[0].children?.[1].children?.[0] as FileNode).content || '',
    isModified: true
  },
  {
    id: 'f-s-theme',
    name: 'theme.ts',
    path: '/frontend/src/services/theme.ts',
    language: 'typescript',
    content: (MOCK_PROJECT_FILES.children?.[0].children?.[0].children?.[2].children?.[0] as FileNode).content || '',
    isModified: true
  },
  {
    id: 'f-s-auth',
    name: 'authService.ts',
    path: '/frontend/src/services/authService.ts',
    language: 'typescript',
    content: (MOCK_PROJECT_FILES.children?.[0].children?.[0].children?.[2].children?.[1] as FileNode).content || ''
  }
];

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: 'EduSim',
  projectPath: 'C:\\Projects\\EduSim',
  rootFolder: MOCK_PROJECT_FILES,
  openFiles: initialOpenFiles,
  activeFileId: 'f-p-dashboard',
  searchQuery: '',
  expandedFolders: {
    'root': true,
    'frontend': true,
    'frontend-src': true,
    'frontend-src-pages': true,
    'frontend-src-services': true,
    'frontend-src-components': true,
    'backend': false,
    'tests': true
  },

  setProject: (name, path) => set({ currentProject: name, projectPath: path }),

  openFile: (file) => {
    if (file.type !== 'file') return;
    set((state) => {
      const exists = state.openFiles.find((f) => f.id === file.id);
      if (exists) {
        return { activeFileId: file.id };
      }
      const newFile: OpenFile = {
        id: file.id,
        name: file.name,
        path: file.path,
        language: file.language || 'plaintext',
        content: file.content || `// ${file.name}\n`,
        isModified: file.status === 'modified' || file.status === 'added'
      };
      return {
        openFiles: [...state.openFiles, newFile],
        activeFileId: file.id
      };
    });
  },

  closeFile: (id) => {
    set((state) => {
      const newOpen = state.openFiles.filter((f) => f.id !== id);
      let nextActive = state.activeFileId;
      if (state.activeFileId === id) {
        nextActive = newOpen.length > 0 ? newOpen[newOpen.length - 1].id : null;
      }
      return { openFiles: newOpen, activeFileId: nextActive };
    });
  },

  setActiveFile: (id) => set({ activeFileId: id }),

  updateFileContent: (id, content) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.id === id ? { ...f, content, isModified: true } : f
      )
    }));
  },

  toggleFolder: (id) => {
    set((state) => ({
      expandedFolders: {
        ...state.expandedFolders,
        [id]: !state.expandedFolders[id]
      }
    }));
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addFile: (parentPath, name) => {
    // Simulation add file helper
    set((state) => {
      const newFileId = `file-${Date.now()}`;
      const ext = name.split('.').pop() || 'txt';
      const langMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        py: 'python',
        json: 'json',
        md: 'markdown'
      };
      const newOpenFile: OpenFile = {
        id: newFileId,
        name,
        path: `${parentPath}/${name}`,
        language: langMap[ext] || 'plaintext',
        content: `// New file: ${name}\n\n`,
        isModified: true
      };
      return {
        openFiles: [...state.openFiles, newOpenFile],
        activeFileId: newFileId
      };
    });
  },

  addFolder: (_parentPath, _name) => {
    // Folder added state
  }
}));
