import { create } from 'zustand';
import {
  Project,
  ProjectScanResult,
  KnowledgeGraphResult,
  ImpactReport,
  FileItem
} from '../types/api';
import { FileNode } from '../types';
import {
  openProject as apiOpenProject,
  analyzeProject as apiAnalyzeProject,
  buildKnowledgeGraph as apiBuildKnowledgeGraph,
  getProjectSummary as apiGetProjectSummary,
  getImpactAnalysis as apiGetImpactAnalysis,
  listFiles as apiListFiles,
  readFile as apiReadFile
} from '../lib/api';

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'py':
      return 'python';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

export function convertFileListToFileTree(rootPath: string, items: FileItem[]): FileNode {
  const normalizedRoot = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const baseName = normalizedRoot.split('/').pop() || 'Project';

  const rootNode: FileNode = {
    id: normalizedRoot,
    name: baseName,
    path: normalizedRoot,
    type: 'folder',
    children: []
  };

  const findOrCreateFolder = (parent: FileNode, name: string, fullPath: string): FileNode => {
    if (!parent.children) parent.children = [];
    let existing = parent.children.find((c) => c.name === name && c.type === 'folder');
    if (!existing) {
      existing = {
        id: fullPath,
        name,
        path: fullPath,
        type: 'folder',
        children: []
      };
      parent.children.push(existing);
    }
    return existing;
  };

  const rootLower = normalizedRoot.toLowerCase();

  for (const item of items) {
    const itemPath = item.path.replace(/\\/g, '/');
    const itemLower = itemPath.toLowerCase();

    let rel = item.name;
    if (itemLower.startsWith(rootLower + '/')) {
      rel = itemPath.slice(normalizedRoot.length + 1);
    } else if (itemLower === rootLower) {
      continue;
    }

    const parts = rel.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let curr = rootNode;
    let currentPath = normalizedRoot;

    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = `${currentPath}/${seg}`;

      if (!isLast) {
        curr = findOrCreateFolder(curr, seg, currentPath);
      } else {
        if (item.is_dir) {
          findOrCreateFolder(curr, seg, itemPath);
        } else {
          if (!curr.children) curr.children = [];
          const existing = curr.children.find((c) => c.name === seg && c.type === 'file');
          if (!existing) {
            curr.children.push({
              id: itemPath,
              name: seg,
              path: itemPath,
              type: 'file',
              size: item.size ?? undefined,
              language: detectLanguage(seg)
            });
          }
        }
      }
    }
  }

  const sortTree = (node: FileNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      node.children.forEach(sortTree);
    }
  };

  sortTree(rootNode);
  return rootNode;
}

export interface OpenFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
  isModified?: boolean;
}

export type OpenProjectStep =
  | 'idle'
  | 'selecting_folder'
  | 'opening_project'
  | 'scanning_metadata'
  | 'analyzing_ast'
  | 'building_knowledge_graph'
  | 'generating_summary'
  | 'complete'
  | 'error';

export interface ProjectStoreState {
  // Core Project & Workspace
  currentProject: string;
  projectId: string | null;
  projectPath: string;
  project: Project | null;
  rootFolder: FileNode | null;
  openFiles: OpenFile[];
  activeFileId: string | null;
  searchQuery: string;
  expandedFolders: Record<string, boolean>;

  // Project Intelligence Data
  scanResult: ProjectScanResult | null;
  knowledgeGraph: KnowledgeGraphResult | null;
  projectSummary: string | null;
  impactReport: ImpactReport | null;

  // Project Open Progress Flow
  isOpening: boolean;
  openStep: OpenProjectStep;
  openStepLabel: string;
  openProgress: number; // 0 - 100
  openError: string | null;

  // Editor Actions
  setProject: (name: string, path: string) => void;
  openFile: (file: FileNode) => Promise<void>;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  addFile: (parentPath: string, name: string) => void;
  addFolder: (parentPath: string, name: string) => void;

  // Intelligence Actions
  openProject: (path: string, name?: string) => Promise<Project>;
  openProjectWithDialog: () => Promise<string | null>;
  loadProjectIntelligence: (projectId: string) => Promise<void>;
  fetchImpactAnalysis: (requirement: string) => Promise<ImpactReport | null>;
  resetOpenState: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  currentProject: '',
  projectId: null,
  projectPath: '',
  project: null,
  rootFolder: null,
  openFiles: [],
  activeFileId: null,
  searchQuery: '',
  expandedFolders: {},

  scanResult: null,
  knowledgeGraph: null,
  projectSummary: null,
  impactReport: null,

  isOpening: false,
  openStep: 'idle',
  openStepLabel: '',
  openProgress: 0,
  openError: null,

  setProject: (name, path) => set({ currentProject: name, projectPath: path }),

  openFile: async (file) => {
    if (file.type !== 'file') return;
    const { openFiles, projectPath } = get();
    const exists = openFiles.find((f) => f.id === file.id || f.path === file.path);
    if (exists) {
      set({ activeFileId: exists.id });
      return;
    }

    let fileContent = file.content;
    if (fileContent === undefined) {
      try {
        const res = await apiReadFile(projectPath, file.path);
        fileContent = res.content;
      } catch (err) {
        console.error(`Failed to read file ${file.path}:`, err);
        fileContent = `// Unable to load file content\n// Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const newFile: OpenFile = {
      id: file.id,
      name: file.name,
      path: file.path,
      language: file.language || detectLanguage(file.name),
      content: fileContent ?? '',
      isModified: file.status === 'modified' || file.status === 'added'
    };

    set({
      openFiles: [...openFiles, newFile],
      activeFileId: file.id
    });
  },

  closeFile: (id) => {
    set((state) => {
      const filtered = state.openFiles.filter((f) => f.id !== id);
      const newActive = state.activeFileId === id ? (filtered[0]?.id || null) : state.activeFileId;
      return { openFiles: filtered, activeFileId: newActive };
    });
  },

  setActiveFile: (id) => set({ activeFileId: id }),

  updateFileContent: (id, content) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) => (f.id === id ? { ...f, content, isModified: true } : f))
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

  setSearchQuery: (query) => set({ searchQuery: query }),

  addFile: (parentPath, name) => {
    // Basic local state append
  },

  addFolder: (parentPath, name) => {
    // Basic local state append
  },

  resetOpenState: () => {
    set({
      isOpening: false,
      openStep: 'idle',
      openStepLabel: '',
      openProgress: 0,
      openError: null
    });
  },

  openProject: async (path: string, name?: string) => {
    set({
      isOpening: true,
      openStep: 'opening_project',
      openStepLabel: 'Connecting to workspace and registering project...',
      openProgress: 15,
      openError: null
    });

    try {
      // 1. Call POST /api/projects/open (performs scanner scan automatically)
      const project = await apiOpenProject(path, name);
      const projName = project.name || path.split(/[/\\]/).filter(Boolean).pop() || 'Project';

      // 2. Fetch real filesystem tree from backend
      let realRootFolder: FileNode | null = null;
      try {
        const fileList = await apiListFiles(project.path, true);
        realRootFolder = convertFileListToFileTree(project.path, fileList.items);
      } catch (fsErr) {
        console.warn('Could not load filesystem tree for project:', fsErr);
      }

      set({
        currentProject: projName,
        projectId: project.id,
        projectPath: project.path,
        project,
        rootFolder: realRootFolder,
        expandedFolders: realRootFolder ? { [realRootFolder.id]: true } : {},
        scanResult: project.scan_result || null,
        openStep: 'scanning_metadata',
        openStepLabel: 'Detected languages, frameworks, and architecture...',
        openProgress: 35
      });

      // 2. Load Project Intelligence (AST analysis + Knowledge Graph + Summary)
      await get().loadProjectIntelligence(project.id);

      set({
        openStep: 'complete',
        openStepLabel: 'Project workspace and intelligence graph ready!',
        openProgress: 100,
        isOpening: false
      });

      return project;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to open project workspace';
      set({
        isOpening: false,
        openStep: 'error',
        openStepLabel: `Failed: ${errMsg}`,
        openError: errMsg
      });
      throw err;
    }
  },

  openProjectWithDialog: async () => {
    set({
      isOpening: true,
      openStep: 'selecting_folder',
      openStepLabel: 'Waiting for folder selection dialog...',
      openProgress: 5,
      openError: null
    });

    try {
      let chosenPath: string | null = null;
      if (typeof window !== 'undefined' && (window as any).electronAPI?.openFolder) {
        chosenPath = await (window as any).electronAPI.openFolder();
      } else {
        // Web fallback prompt
        chosenPath = window.prompt('Enter full local project folder path:');
      }

      if (!chosenPath) {
        set({ isOpening: false, openStep: 'idle', openProgress: 0 });
        return null;
      }

      await get().openProject(chosenPath);
      return chosenPath;
    } catch (err: any) {
      set({
        isOpening: false,
        openStep: 'error',
        openStepLabel: err?.message || 'Folder selection aborted',
        openError: err?.message || 'Folder selection aborted'
      });
      return null;
    }
  },

  loadProjectIntelligence: async (projectId: string) => {
    try {
      // Step A: Trigger Tree-Sitter AST analysis
      set({
        openStep: 'analyzing_ast',
        openStepLabel: 'Parsing AST nodes and function signatures with Tree-Sitter...',
        openProgress: 55
      });
      await apiAnalyzeProject(projectId, true);

      // Step B: Build & Store Knowledge Graph
      set({
        openStep: 'building_knowledge_graph',
        openStepLabel: 'Constructing cross-file dependencies and semantic graph...',
        openProgress: 75
      });
      const kg = await apiBuildKnowledgeGraph(projectId, true);

      // Step C: Fetch Project Summary
      set({
        openStep: 'generating_summary',
        openStepLabel: 'Synthesizing architectural summary...',
        openProgress: 90
      });
      let summaryText = kg.summary;
      if (!summaryText) {
        const sumResp = await apiGetProjectSummary(projectId);
        summaryText = sumResp.summary;
      }

      set({
        knowledgeGraph: kg,
        projectSummary: summaryText,
        openProgress: 98
      });
    } catch (err: any) {
      console.warn('Could not complete full project intelligence loading:', err);
      // Non-fatal fallback for intelligence
    }
  },

  fetchImpactAnalysis: async (requirement: string) => {
    const { projectId } = get();
    if (!projectId) return null;

    try {
      const report = await apiGetImpactAnalysis(projectId, requirement);
      set({ impactReport: report });
      return report;
    } catch (err) {
      console.error('Failed to run impact analysis:', err);
      return null;
    }
  }
}));
