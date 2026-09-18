import { create } from 'zustand';
import { PromptSpecification } from '../types';
import { compilePrompt, ApiError } from '../lib/api';

const initialSpec: PromptSpecification = {
  id: 'spec-default',
  rawPrompt: 'Add attendance tracking to my student application',
  title: 'Student Attendance Tracking Subsystem',
  qualityScore: 82,
  intent: 'Feature addition — Student Management Lifecycle',
  detectedRequirements: [
    'Attendance records model & relational schema',
    'Student association and course mapping',
    'Teacher marking interface with date picker and batch actions',
    'Student personal attendance view and percentage calculations'
  ],
  ambiguities: [
    'Attendance calculation method (strict percentage vs weighted sessions)',
    'Teacher permission boundaries across cross-department courses'
  ],
  missingInformation: [
    'Database migration strategy for historical enrollments',
    'Attendance status rules (Excused, Late, Unexcused cutoffs)',
    'Automated notification thresholds for low attendance warnings'
  ],
  assumptions: [
    'Teachers can mark attendance for assigned courses only',
    'Students have read-only access to their own attendance records',
    'Attendance records are stored per course session date'
  ],
  technicalPlan: {
    frontend: 'React + TypeScript + Tailwind CSS (AttendanceTable, StatusPill, BatchActions)',
    backend: 'FastAPI router `/attendance` with SQLAlchemy Async Session',
    database: 'PostgreSQL `attendance_records` table with composite index `(student_id, course_id, date)`',
    testing: 'Pytest API integration tests + Playwright E2E teacher workflow',
    architectureNotes: [
      'Indexed query for fast date-range filtering',
      'Optimistic UI updates for batch marking with rollback on error'
    ]
  },
  acceptanceCriteria: [
    { id: 'ac-1', text: 'Teacher can mark attendance (Present, Absent, Late) per student', completed: true },
    { id: 'ac-2', text: 'Student can view historical attendance percentage in Dashboard', completed: true },
    { id: 'ac-3', text: 'Attendance persists reliably in PostgreSQL database after reload', completed: true },
    { id: 'ac-4', text: 'Unauthorized users cannot modify or tamper with attendance records', completed: false }
  ]
};

interface PromptState {
  rawPrompt: string;
  isCompiling: boolean;
  compileError: string | null;
  spec: PromptSpecification;
  history: PromptSpecification[];
  
  // Actions
  setRawPrompt: (val: string) => void;
  compileRequirement: () => Promise<void>;
  toggleCriteria: (id: string) => void;
  approveAndPlan: () => void;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  rawPrompt: 'Add attendance tracking to my student application',
  isCompiling: false,
  compileError: null,
  spec: initialSpec,
  history: [initialSpec],

  setRawPrompt: (rawPrompt) => set({ rawPrompt }),

  compileRequirement: async () => {
    const { rawPrompt } = get();
    if (!rawPrompt.trim()) return;
    set({ isCompiling: true, compileError: null });
    try {
      const compiled = await compilePrompt({ prompt: rawPrompt });
      set((state) => ({
        isCompiling: false,
        spec: compiled,
        history: [compiled, ...state.history],
        compileError: null
      }));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to compile requirement';
      set({ isCompiling: false, compileError: message });
    }
  },

  toggleCriteria: (id) => {
    set((state) => ({
      spec: {
        ...state.spec,
        acceptanceCriteria: state.spec.acceptanceCriteria.map((ac) =>
          ac.id === id ? { ...ac, completed: !ac.completed } : ac
        )
      }
    }));
  },

  approveAndPlan: () => {
    // Bridges to agent store
  }
}));

