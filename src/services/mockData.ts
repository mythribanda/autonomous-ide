import {
  FileNode,
  TestSummary,
  TestCase,
  RecoveryStep,
  AuditLogEntry
} from '../types';

export const MOCK_PROJECT_FILES: FileNode = {
  id: 'root',
  name: 'EduSim',
  path: '/',
  type: 'folder',
  children: [
    {
      id: 'frontend',
      name: 'frontend',
      path: '/frontend',
      type: 'folder',
      children: [
        {
          id: 'frontend-src',
          name: 'src',
          path: '/frontend/src',
          type: 'folder',
          children: [
            {
              id: 'frontend-src-components',
              name: 'components',
              path: '/frontend/src/components',
              type: 'folder',
              children: [
                {
                  id: 'f-c-header',
                  name: 'Header.tsx',
                  path: '/frontend/src/components/Header.tsx',
                  type: 'file',
                  language: 'typescript',
                  content: `import React from 'react';
import { useTheme } from '../services/theme';
import { ThemeToggle } from './ThemeToggle';
import { User, Bell, Terminal } from 'lucide-react';

export const Header: React.FC = () => {
  const { theme } = useTheme();

  return (
    <header className="h-14 border-b border-workspace-800 bg-workspace-900/90 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan">
          <Terminal size={18} />
        </div>
        <span className="font-semibold text-workspace-100 tracking-tight">EduSim Classroom</span>
        <span className="text-xs px-2 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan font-mono">v2.4.0</span>
      </div>
      
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <button className="p-2 text-workspace-400 hover:text-workspace-200 transition-colors">
          <Bell size={18} />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-workspace-800">
          <div className="w-7 h-7 rounded-full bg-workspace-800 flex items-center justify-center text-workspace-300 font-medium text-xs">
            MB
          </div>
          <span className="text-xs text-workspace-300 font-medium">Prof. Mythri</span>
        </div>
      </div>
    </header>
  );
};`
                },
                {
                  id: 'f-c-themetoggle',
                  name: 'ThemeToggle.tsx',
                  path: '/frontend/src/components/ThemeToggle.tsx',
                  type: 'file',
                  language: 'typescript',
                  status: 'added',
                  content: `import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../services/theme';

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle visual theme"
      className="p-2 rounded-lg border border-workspace-800 bg-workspace-850 hover:bg-workspace-800 text-workspace-300 transition-colors flex items-center gap-2 text-xs"
    >
      {theme === 'dark' ? (
        <>
          <Moon size={15} className="text-brand-indigo" />
          <span className="font-mono">Dark</span>
        </>
      ) : (
        <>
          <Sun size={15} className="text-brand-amber" />
          <span className="font-mono">Light</span>
        </>
      )}
    </button>
  );
};`
                },
                {
                  id: 'f-c-studentform',
                  name: 'StudentForm.tsx',
                  path: '/frontend/src/components/StudentForm.tsx',
                  type: 'file',
                  language: 'typescript',
                  content: `import React, { useState } from 'react';
import { createStudent } from '../services/studentService';

export const StudentForm: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('10');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createStudent({ name, email, grade: parseInt(grade, 10) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-xl bg-workspace-850 border border-workspace-800">
      <h3 className="text-sm font-semibold text-workspace-100">Enroll New Student</h3>
      <div>
        <label className="text-xs text-workspace-400">Full Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mt-1 px-3 py-1.5 rounded bg-workspace-900 border border-workspace-800 text-workspace-200 text-sm focus:outline-none focus:border-brand-cyan"
        />
      </div>
      <div>
        <label className="text-xs text-workspace-400">Email Address</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 px-3 py-1.5 rounded bg-workspace-900 border border-workspace-800 text-workspace-200 text-sm focus:outline-none focus:border-brand-cyan"
        />
      </div>
      <button type="submit" className="w-full py-2 rounded bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-semibold hover:bg-brand-cyan/30">
        Register Student
      </button>
    </form>
  );
};`
                }
              ]
            },
            {
              id: 'frontend-src-pages',
              name: 'pages',
              path: '/frontend/src/pages',
              type: 'folder',
              children: [
                {
                  id: 'f-p-dashboard',
                  name: 'Dashboard.tsx',
                  path: '/frontend/src/pages/Dashboard.tsx',
                  type: 'file',
                  language: 'typescript',
                  status: 'modified',
                  content: `import React, { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { fetchActiveCourses, Course } from '../services/courseService';
import { useTheme } from '../services/theme';
import { Users, BookOpen, Activity, Award } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const { theme } = useTheme();

  useEffect(() => {
    fetchActiveCourses().then(setCourses);
  }, []);

  return (
    <div className={\`min-h-screen \${theme === 'dark' ? 'bg-workspace-950 text-workspace-200' : 'bg-slate-50 text-slate-900'}\`}>
      <Header />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Academic Overview</h1>
            <p className="text-sm text-workspace-400">Spring Semester 2026 Simulation Analytics</p>
          </div>
          <button className="px-4 py-2 bg-brand-cyan text-workspace-950 rounded-lg text-sm font-semibold shadow-glow-cyan hover:bg-brand-cyan/90 transition-all">
            Launch Simulation
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-workspace-800 bg-workspace-850/60 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-brand-cyan/10 text-brand-cyan">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs text-workspace-400 font-medium">Total Students</p>
              <h4 className="text-xl font-bold text-workspace-100 font-mono">1,420</h4>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-workspace-800 bg-workspace-850/60 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-brand-emerald/10 text-brand-emerald">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-xs text-workspace-400 font-medium">Active Courses</p>
              <h4 className="text-xl font-bold text-workspace-100 font-mono">38</h4>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-workspace-800 bg-workspace-850/60 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-brand-indigo/10 text-brand-indigo">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-xs text-workspace-400 font-medium">Live Labs</p>
              <h4 className="text-xl font-bold text-workspace-100 font-mono">14</h4>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-workspace-800 bg-workspace-850/60 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-brand-amber/10 text-brand-amber">
              <Award size={24} />
            </div>
            <div>
              <p className="text-xs text-workspace-400 font-medium">Avg Completion</p>
              <h4 className="text-xl font-bold text-workspace-100 font-mono">94.8%</h4>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};`
                }
              ]
            },
            {
              id: 'frontend-src-services',
              name: 'services',
              path: '/frontend/src/services',
              type: 'folder',
              children: [
                {
                  id: 'f-s-theme',
                  name: 'theme.ts',
                  path: '/frontend/src/services/theme.ts',
                  type: 'file',
                  language: 'typescript',
                  status: 'modified',
                  content: `import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },
      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('dark', next === 'dark');
          return { theme: next };
        }),
    }),
    {
      name: 'edusim_theme_preference',
    }
  )
);`
                },
                {
                  id: 'f-s-auth',
                  name: 'authService.ts',
                  path: '/frontend/src/services/authService.ts',
                  type: 'file',
                  language: 'typescript',
                  content: `import axios from 'axios';

const API_BASE = '/api/v1/auth';

export interface UserSession {
  userId: string;
  email: string;
  role: 'teacher' | 'student' | 'admin';
  token: string;
}

export const loginUser = async (credentials: { email: string; pass: string }): Promise<UserSession> => {
  const res = await axios.post(\`\${API_BASE}/login\`, credentials);
  localStorage.setItem('edusim_jwt', res.data.token);
  return res.data;
};

export const getCurrentSession = (): string | null => {
  return localStorage.getItem('edusim_jwt');
};`
                }
              ]
            },
            {
              id: 'f-app',
              name: 'App.tsx',
              path: '/frontend/src/App.tsx',
              type: 'file',
              language: 'typescript',
              content: `import React from 'react';
import { Dashboard } from './pages/Dashboard';

export function App() {
  return <Dashboard />;
}
export default App;`
            }
          ]
        },
        {
          id: 'f-package',
          name: 'package.json',
          path: '/frontend/package.json',
          type: 'file',
          language: 'json',
          content: `{
  "name": "edusim-frontend",
  "version": "2.4.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.2",
    "lucide-react": "^0.370.0",
    "axios": "^1.6.8"
  }
}`
        },
        {
          id: 'f-vite',
          name: 'vite.config.ts',
          path: '/frontend/vite.config.ts',
          type: 'file',
          language: 'typescript',
          content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
});`
        }
      ]
    },
    {
      id: 'backend',
      name: 'backend',
      path: '/backend',
      type: 'folder',
      children: [
        {
          id: 'backend-routers',
          name: 'routers',
          path: '/backend/routers',
          type: 'folder',
          children: [
            {
              id: 'b-r-student',
              name: 'student_router.py',
              path: '/backend/routers/student_router.py',
              type: 'file',
              language: 'python',
              content: `from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from models.student import StudentModel
from services.student_service import StudentService

router = APIRouter(prefix="/students", tags=["students"])

@router.get("/", response_model=List[StudentModel])
async def list_students(service: StudentService = Depends()):
    return await service.get_all_students()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_student(data: StudentModel, service: StudentService = Depends()):
    return await service.create_student(data)`
            },
            {
              id: 'b-r-auth',
              name: 'auth.py',
              path: '/backend/routers/auth.py',
              type: 'file',
              language: 'python',
              content: `from fastapi import APIRouter, HTTPException, Depends
from services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
async def login(credentials: dict, user_service: UserService = Depends()):
    user = await user_service.authenticate(credentials["email"], credentials["pass"])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": "jwt_token_simulation", "user": user}`
            }
          ]
        },
        {
          id: 'backend-models',
          name: 'models',
          path: '/backend/models',
          type: 'folder',
          children: [
            {
              id: 'b-m-student',
              name: 'student_model.py',
              path: '/backend/models/student_model.py',
              type: 'file',
              language: 'python',
              content: `from pydantic import BaseModel, EmailStr
from typing import Optional

class StudentModel(BaseModel):
    id: Optional[str] = None
    name: str
    email: EmailStr
    grade: int
    phone: Optional[str] = None
    
    class Config:
        orm_mode = True`
            }
          ]
        },
        {
          id: 'b-main',
          name: 'main.py',
          path: '/backend/main.py',
          type: 'file',
          language: 'python',
          content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import student_router, auth

app = FastAPI(title="EduSim Simulation API", version="2.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(student_router.router)
app.include_router(auth.router)

@app.get("/health")
def health():
    return {"status": "healthy", "service": "EduSim Backend"}`
        },
        {
          id: 'b-req',
          name: 'requirements.txt',
          path: '/backend/requirements.txt',
          type: 'file',
          language: 'plaintext',
          content: `fastapi==0.110.0
uvicorn==0.28.0
pydantic==2.6.4
sqlalchemy==2.0.28
asyncpg==0.29.0
pytest==8.1.1`
        }
      ]
    },
    {
      id: 'tests',
      name: 'tests',
      path: '/tests',
      type: 'folder',
      children: [
        {
          id: 't-theme',
          name: 'theme.test.ts',
          path: '/tests/theme.test.ts',
          type: 'file',
          language: 'typescript',
          content: `import { describe, it, expect, beforeEach } from 'vitest';
import { useTheme } from '../frontend/src/services/theme';

describe('Theme System Service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize default state to dark', () => {
    const theme = useTheme.getState().theme;
    expect(theme).toBe('dark');
  });

  it('should toggle theme correctly', () => {
    useTheme.getState().toggleTheme();
    expect(useTheme.getState().theme).toBe('light');
  });

  it('should persist theme change to localStorage', () => {
    useTheme.getState().setTheme('dark');
    expect(useTheme.getState().theme).toBe('dark');
  });
});`
        },
        {
          id: 't-dashboard',
          name: 'dashboard.test.ts',
          path: '/tests/dashboard.test.ts',
          type: 'file',
          language: 'typescript',
          content: `import { describe, it, expect } from 'vitest';

describe('Dashboard Component Suite', () => {
  it('renders simulation metrics accurately', () => {
    expect(true).toBe(true);
  });
});`
        }
      ]
    },
    {
      id: 'r-docker',
      name: 'docker-compose.yml',
      path: '/docker-compose.yml',
      type: 'file',
      language: 'yaml',
      content: `version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://edusim:secret@db:5432/edusimdb
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: edusim
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: edusimdb
    ports:
      - "5432:5432"`
    },
    {
      id: 'r-readme',
      name: 'README.md',
      path: '/README.md',
      type: 'file',
      language: 'markdown',
      content: `# EduSim — Classroom Simulation Platform

EduSim is a multi-tier educational simulation engine powered by React, FastAPI, and PostgreSQL.

## Architecture
- **Frontend**: React 18, TypeScript, Tailwind CSS, Monaco integration
- **Backend**: FastAPI, AsyncPG, Pytest
- **Database**: PostgreSQL 16
`
    }
  ]
};

export const MOCK_TEST_SUMMARY: TestSummary = {
  overall: 'PASSED',
  build: 'Passed',
  unit: { total: 42, passed: 42, failed: 0 },
  integration: { total: 12, passed: 12, failed: 0 },
  e2e: { total: 8, passed: 8, failed: 0 },
  staticAnalysis: 'Passed',
  tests: [
    {
      id: 'test-1',
      suite: 'Auth Suite',
      name: 'authentication.test.ts',
      durationMs: 42,
      status: 'passed',
      file: 'tests/auth.test.ts'
    },
    {
      id: 'test-2',
      suite: 'Dashboard Suite',
      name: 'dashboard.test.ts',
      durationMs: 78,
      status: 'passed',
      file: 'tests/dashboard.test.ts'
    },
    {
      id: 'test-3',
      suite: 'Theme System',
      name: 'theme.test.ts',
      durationMs: 31,
      status: 'passed',
      file: 'tests/theme.test.ts'
    },
    {
      id: 'test-4',
      suite: 'Profile Suite',
      name: 'profile.test.ts',
      durationMs: 55,
      status: 'passed',
      file: 'tests/profile.test.ts'
    },
    {
      id: 'test-5',
      suite: 'Student Model',
      name: 'test_student_model.py',
      durationMs: 110,
      status: 'passed',
      file: 'tests/test_students.py'
    }
  ]
};

export const MOCK_FAILED_TEST_SAMPLE: TestCase = {
  id: 'test-fail-sample',
  suite: 'Theme Persistence',
  name: 'theme.test.ts:42',
  durationMs: 44,
  status: 'failed',
  file: 'tests/theme.test.ts',
  line: 42,
  error: {
    message: 'Theme state was not persisted to localStorage across reload session',
    expected: 'dark',
    received: 'light',
    stack: `AssertionError: expected "light" to deeply equal "dark"
    at tests/theme.test.ts:42:18
    at runTest (node_modules/vitest/dist/runner.js:142:12)`
  }
};

export const MOCK_RECOVERY_STEPS: RecoveryStep[] = [
  {
    attemptNumber: 1,
    status: 'failed',
    title: 'Initial Autonomous Execution',
    errorIdentified: 'theme.test.ts:42 assertion failure: Expected "dark", received "light"',
    rootCause: 'Zustand theme store was missing localStorage persistence hydration on initial render.',
    repairApplied: 'Added `persist` middleware from zustand/middleware with storage key `edusim_theme_preference`.',
    diffSnippet: `- export const useTheme = create<ThemeState>((set) => ({\n+ export const useTheme = create<ThemeState>()(\n+   persist((set) => ({ ... }), { name: 'edusim_theme_preference' })\n+ );`,
    result: 'Tests re-executed via vitest runner.'
  },
  {
    attemptNumber: 2,
    status: 'success',
    title: 'Automated Recovery & Verification',
    errorIdentified: 'None',
    rootCause: 'Resolved',
    repairApplied: 'Verified store hydration and executed full test suite.',
    diffSnippet: `✓ 42 / 42 Unit tests passed\n✓ 12 / 12 Integration tests passed\n✓ Build clean in 1.4s`,
    result: 'SUCCESS: Autonomous repair validated with 100% test pass rate.'
  }
];

export const MOCK_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '10:32:04',
    action: 'READ',
    target: 'frontend/package.json',
    verdict: 'Allowed',
    reason: 'Read project dependencies within workspace boundary',
    actor: 'AI Agent'
  },
  {
    id: 'log-2',
    timestamp: '10:32:08',
    action: 'READ',
    target: 'frontend/src/**/*.tsx',
    verdict: 'Allowed',
    reason: 'AST code intelligence scan for ThemeProvider references',
    actor: 'AI Agent'
  },
  {
    id: 'log-3',
    timestamp: '10:32:12',
    action: 'WRITE',
    target: 'frontend/src/services/theme.ts',
    verdict: 'Allowed',
    reason: 'Created new theme state service file',
    actor: 'AI Agent'
  },
  {
    id: 'log-4',
    timestamp: '10:32:14',
    action: 'WRITE',
    target: 'frontend/src/pages/Dashboard.tsx',
    verdict: 'Allowed',
    reason: 'Updated dashboard component styling',
    actor: 'AI Agent'
  },
  {
    id: 'log-5',
    timestamp: '10:32:15',
    action: 'RUN',
    target: 'npm test',
    verdict: 'Allowed',
    reason: 'Executed test verification suite',
    actor: 'AI Agent'
  },
  {
    id: 'log-6',
    timestamp: '10:32:16',
    action: 'GIT_PUSH',
    target: 'origin main',
    verdict: 'Blocked',
    reason: 'Autonomous push to production branch requires explicit human approval',
    actor: 'AI Agent'
  }
];
