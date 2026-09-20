# End-to-End Flow — Autonomous IDE

This document describes the complete user journey from first launch to a verified code change.

## a) App Launch — Empty State

**UI**: WelcomeScreen is displayed (no project open).
**Status bar**: Polls `GET /api/health` every 5s.
- Backend ✓ → green indicator
- Ollama ✓/✗ → `GET /api/health/ollama`
- GitHub ✓/✗ → `GET /api/github/status`

**Error states surfaced**:
- If Ollama not running → `ErrorBanner` with `ollama pull llama3.1:8b` instructions
- If backend not running → app itself shows "Run: npm run start:backend"

---

## b) Open Project

**Action**: User clicks [Open Project Folder].
**Electron**: `ipcRenderer.invoke('dialog:openFolder')` → OS native picker.
**API**: `POST /api/projects/open { path: "/home/user/myapp" }`
**Response**: `{ project_id, name, path, language, framework }`
**UI**: Project store hydrated → `currentProject`, `projectId`, `projectPath` set.

---

## c) Project Scan + Knowledge Graph

**Trigger**: Automatic on project open.
**API sequence**:
1. `POST /api/projects/{id}/scan` → returns `ProjectScanResult` (files, framework, deps)
2. `POST /api/projects/{id}/knowledge-graph` → builds AST + dependency graph

**UI**:
- `ProjectScanSkeleton` shown during scan (animated bars, "Analyzing project...")
- `KnowledgeGraphSkeleton` shown during graph build (labelled progress steps)
- On completion → `ImpactGraph` renders with force-directed node layout
- `ProjectDashboard` populates: file count, framework badge, language, architecture summary

---

## d) User Types Requirement

**UI**: User types in the prompt bar: *"Add input validation to the registration form"*
**Store**: `promptStore.setDraft(text)` on every keystroke.
**Shortcut**: `Ctrl+P` focuses the prompt bar from anywhere in the UI.

---

## e) Requirement Compilation

**Action**: User presses Enter or clicks [Compile].
**API**: `POST /api/prompt/compile { project_id, requirement }`
**Processing** (streamed via SSE or returned as JSON):
- Intent extraction
- Ambiguity detection
- File impact prediction (from knowledge graph)
- Risk scoring
- Confidence score computation

**Response** `CompiledSpec`:
```json
{
  "intent": "Add server-side and client-side validation to RegisterForm",
  "requirements": ["Validate email format", "Validate password length ≥ 8", "Show inline errors"],
  "ambiguities": ["Which validation library? (Zod / Yup / manual)"],
  "affected_files": ["src/forms/RegisterForm.tsx", "src/api/auth.py"],
  "risk_level": "low",
  "confidence_score": 0.87
}
```
**UI**: Compiled spec shown in `CompilerOutput` panel. Confidence shown as `87%`.

---

## f) Execute Plan

**Action**: User clicks [Execute Plan].
**API**: `POST /api/tasks { project_id, requirement, compiled_spec_json }`
**Response**: `{ task_id }` — task created with status `queued`.
**WebSocket**: Frontend connects to `ws://localhost:8000/ws/agent/{task_id}`.

---

## g) Agent Execution — Live Timeline

**Mode**: Guided (requires approval for destructive ops).
**WebSocket events** streamed in real time:
```json
{ "type": "agent_step", "step": "planning", "message": "Building execution plan..." }
{ "type": "agent_step", "step": "reading", "target": "src/forms/RegisterForm.tsx" }
{ "type": "agent_step", "step": "reading", "target": "src/lib/validation.ts" }
{ "type": "agent_step", "step": "writing", "target": "src/forms/RegisterForm.tsx" }
{ "type": "agent_step", "step": "running_tests", "command": "npm test" }
{ "type": "verification", "passed": 42, "failed": 0 }
{ "type": "git_checkpoint", "sha": "a3f9c12" }
{ "type": "task_complete", "summary": "..." }
```
**UI**: `ActivityTimeline` fills up in real time. Each step has icon, message, elapsed time.

---

## h) Code Modifications

**Step-by-step agent actions**:
1. `tool:read_file("src/forms/RegisterForm.tsx")` → reads current form
2. `tool:read_file("src/lib/validation.ts")` → reads existing validation utilities
3. `tool:write_file("src/forms/RegisterForm.tsx", patched_content)` → applies validated form
4. **Audit log entry created**: `action_type=file_write`, `description="Patched RegisterForm.tsx — added Zod validation schema"`
5. `tool:run_command("npm test")` → executes test suite
6. **Audit log entry created**: `action_type=command_run`, `description="npm test — 42 passed, 0 failed"`

---

## i) Tests + Verification + Git Checkpoint

**Test result**: All 42 tests pass.
**Verification**: `POST /api/projects/{id}/verify` → returns `VerificationResult { passed: true }`
**Git checkpoint**: `git add -A && git commit -m "[AutoDev] Add input validation to RegisterForm"`
**Audit log**: `action_type=git_commit`, `description="checkpoint: Add input validation to RegisterForm"`
**UI**: Verification panel turns green. Git panel shows new commit.

---

## j) Task Report

**API**: `GET /api/tasks/{task_id}` → full task record with all events.
**UI**: Task summary panel shows:
- ✓ Status: Completed
- Files changed: 1
- Tests: 42/42
- Recovery attempts: 0
- Execution time: ~45s
- Git SHA: `a3f9c12`

---

## k) Impact Graph Update

**Trigger**: Task completion event received via WebSocket.
**Action**: Frontend re-fetches `GET /api/projects/{id}/knowledge-graph`.
**UI**: `ImpactGraph` re-renders — `RegisterForm.tsx` node glows orange/red to indicate recent modification.
Nodes connected to it (parent page, test file) show secondary highlight.
