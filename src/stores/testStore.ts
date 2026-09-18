import { create } from 'zustand';
import { TestSummary, TestCase } from '../types';
import { MOCK_TEST_SUMMARY, MOCK_FAILED_TEST_SAMPLE } from '../services/mockData';

// TODO: Out of scope for 'project-intelligence' branch.
// Connect to real backend test runner service (e.g. backend/routers/tests.py)
// when structured test suite execution and failure parsing are implemented.
// Real CLI tests can currently be executed directly via the terminal store and backend terminal router.


interface TestState {
  testSummary: TestSummary;
  selectedFailure: TestCase | null;
  isRunningTests: boolean;
  filter: 'all' | 'passed' | 'failed';
  
  // Actions
  runAllTests: () => Promise<void>;
  setSelectedFailure: (test: TestCase | null) => void;
  setFilter: (filter: 'all' | 'passed' | 'failed') => void;
  injectSimulatedFailure: () => void;
  resolveFailure: () => void;
}

export const useTestStore = create<TestState>((set) => ({
  testSummary: MOCK_TEST_SUMMARY,
  selectedFailure: null,
  isRunningTests: false,
  filter: 'all',

  runAllTests: async () => {
    set({ isRunningTests: true });
    await new Promise((r) => setTimeout(r, 800));
    set({
      isRunningTests: false,
      testSummary: MOCK_TEST_SUMMARY,
      selectedFailure: null
    });
  },

  setSelectedFailure: (selectedFailure) => set({ selectedFailure }),
  setFilter: (filter) => set({ filter }),

  injectSimulatedFailure: () => {
    set({
      testSummary: {
        ...MOCK_TEST_SUMMARY,
        overall: 'FAILED',
        unit: { total: 42, passed: 41, failed: 1 },
        tests: [MOCK_FAILED_TEST_SAMPLE, ...MOCK_TEST_SUMMARY.tests]
      },
      selectedFailure: MOCK_FAILED_TEST_SAMPLE
    });
  },

  resolveFailure: () => {
    set({
      testSummary: MOCK_TEST_SUMMARY,
      selectedFailure: null
    });
  }
}));
