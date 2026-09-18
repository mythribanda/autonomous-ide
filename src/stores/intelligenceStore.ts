import { create } from 'zustand';
import { DependencyNode, DependencyEdge } from '../types';
import { MOCK_DEPENDENCY_NODES, MOCK_DEPENDENCY_EDGES } from '../services/mockData';

interface IntelligenceMetrics {
  files: number;
  functions: number;
  dependencies: number;
  tests: number;
  languages: number;
  apis: number;
}

interface IntelligenceState {
  metrics: IntelligenceMetrics;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  selectedNodeId: string | null;
  filterLayer: 'all' | 'frontend' | 'backend' | 'database';
  searchQuery: string;
  
  // Actions
  selectNode: (id: string | null) => void;
  setFilterLayer: (layer: 'all' | 'frontend' | 'backend' | 'database') => void;
  setSearchQuery: (query: string) => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set) => ({
  metrics: {
    files: 312,
    functions: 1248,
    dependencies: 47,
    tests: 68,
    languages: 4,
    apis: 36
  },
  nodes: MOCK_DEPENDENCY_NODES,
  edges: MOCK_DEPENDENCY_EDGES,
  selectedNodeId: 'node-authservice',
  filterLayer: 'all',
  searchQuery: '',

  selectNode: (id) => set({ selectedNodeId: id }),
  setFilterLayer: (filterLayer) => set({ filterLayer }),
  setSearchQuery: (searchQuery) => set({ searchQuery })
}));
