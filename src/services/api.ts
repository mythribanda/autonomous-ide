import {
  PromptSpecification,
  AgentTask,
  ImpactAnalysisResult,
  TestSummary,
  GitCheckpoint,
  GitChange,
  AutonomyLevel
} from '../types';
import {
  MOCK_PROMPT_SPEC,
  MOCK_AGENT_TASK,
  MOCK_IMPACT_ANALYSIS,
  MOCK_TEST_SUMMARY,
  MOCK_GIT_CHECKPOINTS,
  MOCK_GIT_CHANGES
} from './mockData';

export interface CompilePromptRequest {
  prompt: string;
  projectContext?: string;
}

export interface RunAgentRequest {
  task: string;
  autonomyLevel: AutonomyLevel;
  targetFiles?: string[];
  specificationId?: string;
}

export interface TerminalExecRequest {
  command: string;
  cwd?: string;
}

export interface TerminalExecResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Future API contract client.
 * Currently uses high-fidelity asynchronous simulations.
 */
export const AutonomousAPI = {
  async compilePrompt(req: CompilePromptRequest): Promise<PromptSpecification> {
    await new Promise((r) => setTimeout(r, 600));
    return {
      ...MOCK_PROMPT_SPEC,
      id: `spec-${Date.now().toString(36)}`,
      rawPrompt: req.prompt || MOCK_PROMPT_SPEC.rawPrompt,
      title: req.prompt ? `Specification for "${req.prompt.slice(0, 30)}..."` : MOCK_PROMPT_SPEC.title
    };
  },

  async analyzeImpact(task: string): Promise<ImpactAnalysisResult> {
    await new Promise((r) => setTimeout(r, 450));
    return {
      ...MOCK_IMPACT_ANALYSIS,
      task
    };
  },

  async runAgent(req: RunAgentRequest): Promise<AgentTask> {
    await new Promise((r) => setTimeout(r, 300));
    return {
      ...MOCK_AGENT_TASK,
      title: req.task || MOCK_AGENT_TASK.title,
      autonomyLevel: req.autonomyLevel || 'autonomous',
      status: 'executing'
    };
  },

  async stopAgent(taskId: string): Promise<{ success: boolean; message: string }> {
    await new Promise((r) => setTimeout(r, 200));
    return { success: true, message: `Agent for task ${taskId} stopped.` };
  },

  async getAgentStatus(taskId: string): Promise<AgentTask> {
    await new Promise((r) => setTimeout(r, 100));
    return MOCK_AGENT_TASK;
  },

  async executeTerminal(req: TerminalExecRequest): Promise<TerminalExecResponse> {
    await new Promise((r) => setTimeout(r, 350));
    const cmd = req.command.trim().toLowerCase();

    if (cmd === 'npm test' || cmd === 'vitest') {
      return {
        stdout: `\n RUN  v1.5.0 /Projects/EduSim/frontend\n\n ✓ src/components/ThemeToggle.test.tsx (2)\n ✓ src/services/theme.test.ts (3)\n ✓ src/pages/Dashboard.test.tsx (4)\n\n Test Files  3 passed (3)\n      Tests  9 passed (9)\n   Duration  1.12s (transform 320ms, setup 0ms, collect 450ms, tests 350ms)\n`,
        stderr: '',
        exitCode: 0
      };
    }

    if (cmd === 'pytest' || cmd === 'python -m pytest') {
      return {
        stdout: `============================= test session starts =============================\nplatform win32 -- Python 3.11.8, pytest-8.1.1, pluggy-1.4.0\nrootdir: C:\\Projects\\EduSim\\backend\ncollected 33 items\n\ntests/test_students.py ............                                      [ 36%]\ntests/test_auth.py .....................                                 [100%]\n\n============================== 33 passed in 1.48s ==============================`,
        stderr: '',
        exitCode: 0
      };
    }

    if (cmd === 'git status') {
      return {
        stdout: `On branch ai/dark-mode\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n\tmodified:   frontend/src/pages/Dashboard.tsx\n\tmodified:   frontend/src/services/theme.ts\n\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n\tfrontend/src/components/ThemeToggle.tsx\n`,
        stderr: '',
        exitCode: 0
      };
    }

    if (cmd === 'git diff') {
      return {
        stdout: `diff --git a/frontend/src/pages/Dashboard.tsx b/frontend/src/pages/Dashboard.tsx\n--- a/frontend/src/pages/Dashboard.tsx\n+++ b/frontend/src/pages/Dashboard.tsx\n@@ -8,6 +8,16 @@\n+  const { theme } = useTheme();\n`,
        stderr: '',
        exitCode: 0
      };
    }

    return {
      stdout: `Command '${req.command}' executed successfully in C:\\Projects\\EduSim`,
      stderr: '',
      exitCode: 0
    };
  },

  async runTests(): Promise<TestSummary> {
    await new Promise((r) => setTimeout(r, 700));
    return MOCK_TEST_SUMMARY;
  },

  async createGitCheckpoint(message: string): Promise<GitCheckpoint> {
    await new Promise((r) => setTimeout(r, 400));
    return {
      id: `cp-${Date.now()}`,
      commitHash: Math.random().toString(16).substring(2, 9),
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      author: 'AutonomousDev Agent',
      type: 'ai_post_change',
      filesChanged: 3
    };
  },

  async getGitStatus(): Promise<{ branch: string; changes: GitChange[]; checkpoints: GitCheckpoint[] }> {
    await new Promise((r) => setTimeout(r, 200));
    return {
      branch: 'ai/dark-mode',
      changes: MOCK_GIT_CHANGES,
      checkpoints: MOCK_GIT_CHECKPOINTS
    };
  }
};
