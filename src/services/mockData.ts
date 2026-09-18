import {
  TestSummary,
  TestCase,
  RecoveryStep,
  AuditLogEntry
} from '../types';

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
