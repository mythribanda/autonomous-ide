# Autonomous IDE — Self-Governing AI Desktop Development Environment

Autonomous IDE is an AI-native desktop IDE powered by local LLMs (via Ollama), AST-informed knowledge graphs, self-healing reflection loops, and granular security sandboxing. Built with **Electron**, **React**, **TypeScript**, and **FastAPI**, it allows developers to delegate multi-file coding, automated testing, and error recovery to autonomous agents while maintaining supervisory control.

---

## Research Paper Abstract

> **Title**: *Autonomous Developer Workspaces: Supervisory Autonomy and Self-Healing Feedback Loops in Local AI Software Engineering*
>
> **Abstract**: Modern AI-assisted development tools largely operate as autocomplete assistants or single-turn generation interfaces that lack situational codebase awareness and execution feedback. This paper presents **Autonomous IDE**, an open-source, local-first developer environment incorporating supervisory autonomy. By combining Tree-Sitter abstract syntax tree (AST) knowledge graphs, deterministic policy sandboxing, and reflective self-healing recovery loops with string-similarity repair caching, Autonomous IDE executes multi-step software modifications with zero human supervision overhead for safe tasks and policy-gated interventions for destructive actions. Evaluated across 100+ tasks in Assisted, Guided, and Autonomous modes, the system demonstrates an 87.5% task completion rate with 0% token telemetry cloud cost utilizing local Ollama models.

---

## System Architecture

```text
+-----------------------------------------------------------------------------------+
|                            ELECTRON DESKTOP SHELL                                 |
|                                                                                   |
|   +--------------------------+  +---------------------------------------------+   |
|   |   Activity Bar           |  |           Monaco Code Editor                |   |
|   |   - Explorer             |  +---------------------------------------------+   |
|   |   - Dependency Graph     |  |         Force-Directed Impact Graph         |   |
|   |   - Agent Activity Feed  |  +---------------------------------------------+   |
|   |   - Test Verification    |  |         Interactive Terminal (Xterm)        |   |
|   |   - Research Dashboard   |  +---------------------------------------------+   |
|   +--------------------------+  |      Status Bar (Telemetry, Branch, Model)  |   |
|                                 +---------------------------------------------+   |
+----------------------------------------|------------------------------------------+
                                         | HTTP REST / WebSocket JSON-RPC
                                         v
+-----------------------------------------------------------------------------------+
|                         FASTAPI PYTHON CORE BACKEND                               |
|                                                                                   |
|   +-----------------------+  +-----------------------+  +---------------------+   |
|   |  Project Scanner &    |  |   Knowledge Graph &   |  |   Prompt Compiler   |   |
|   |  Watchdog Listener    |  |   AST Analyzer        |  |   & Intent Engine   |   |
|   +-----------------------+  +-----------------------+  +---------------------+   |
|               |                          |                         |              |
|               v                          v                         v              |
|   +---------------------------------------------------------------------------+   |
|   |                       Autonomous AI Agent Engine                          |   |
|   |   - Supervisory Modes (Assist / Guided / Autonomous)                      |   |
|   |   - Tool Sandbox: read_file, write_file, run_command, git_checkpoint      |   |
|   |   - Self-Healing Loop: Error -> Fuzzy Pattern Match -> Repair Reflection  |   |
|   |   - Audit Logger & Rotating JSONL Stream                                  |   |
|   +---------------------------------------------------------------------------+   |
|               |                          |                         |              |
|               v                          v                         v              |
|   +-----------------------+  +-----------------------+  +---------------------+   |
|   | SQLite + Async Pool   |  | In-Memory TTL Cache   |  | Local Ollama Client |   |
|   | (QueuePool size=10)   |  | (Graphs, Scans, AST)  |  | (wait_for 30s)      |   |
|   +-----------------------+  +-----------------------+  +---------------------+   |
+-----------------------------------------------------------------------------------+
```

---

## Prerequisites

Before running Autonomous IDE, ensure the following are installed on your system:
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **Python**: v3.11 or v3.12 ([Download Python](https://python.org/))
- **Ollama**: Local LLM runner ([Download Ollama](https://ollama.ai/))
  - Recommended model: `ollama pull llama3.2:latest` (or `ollama pull llama3.1:8b`)

---

## Quickstart (5 Commands)

Clone the repository and launch the full desktop environment in 5 simple commands:

```bash
# 1. Clone repository
git clone https://github.com/mythribanda/autonomous-ide.git && cd autonomous-ide

# 2. Install Node dependencies
npm install

# 3. Create and activate Python virtual environment
python -m venv .venv && source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 4. Install backend dependencies
pip install -r backend/requirements.txt

# 5. Launch desktop application (starts Vite + FastAPI + Electron)
npm run dev
```

---

## Packaging Desktop Installers

To package native desktop executables:

```bash
# Package for Windows (.exe / NSIS installer)
npm run package:win

# Package for macOS (.dmg / universal binary)
npm run package:mac

# Package for Linux (.AppImage)
npm run package:linux
```

---

## End-to-End Demo Walkthrough (11-Step Journey)

Follow this 11-step interactive flow to test the complete autonomous workflow:

1. **App Launch & Diagnostics**
   - The desktop shell launches with `WelcomeScreen`.
   - The status bar polls `/api/health` and verifies that backend, Ollama (`11434`), and Git services are active.
2. **Open Project**
   - Click **[Open Project Folder]** to invoke the native OS directory selector (`ipcRenderer.invoke('dialog:openFolder')`).
   - The backend mounts the workspace, runs `ProjectScanner`, and registers project metadata in SQLite.
3. **AST Scanning & Knowledge Graph Construction**
   - Tree-Sitter parses all source files in parallel.
   - The interactive **Impact Visualization Graph** renders with physics-based spring forces connecting components, routes, models, and tests.
4. **User Types Requirement**
   - Press `Ctrl+P` to focus the prompt bar.
   - Enter a feature request (e.g. *"Add input validation and error boundaries to the registration form"*).
5. **Requirement Compilation & Risk Analysis**
   - Click **[Compile]**.
   - `PromptCompiler` extracts intents, checks for ambiguities, predicts affected files using the knowledge graph, and outputs a confidence score.
6. **Plan Execution**
   - Click **[Execute Plan]**.
   - The client opens a WebSocket (`ws://localhost:8000/ws/agent/{task_id}`) to stream real-time telemetry.
7. **Live Agent Activity Timeline**
   - The timeline renders step-by-step progress: reading files, editing AST nodes, generating schemas, and running tests.
8. **Sandboxed Code Modifications & Privileged Auditing**
   - Every file edit and command execution is checked against the security policy.
   - Privileged operations are recorded in the persistent **Audit Log** (`backend/logs/agent.jsonl` and database).
9. **Automated Verification & Git Checkpoint**
   - The verification harness executes automated tests.
   - Upon test passing, a transactional git checkpoint commit is created (`[AutoDev] Add input validation...`).
10. **Task Report & Telemetry**
    - The task dashboard displays the final summary: completion verdict, files changed, execution time, and recovery iterations.
11. **Impact Graph Auto-Highlight**
    - The Knowledge Graph updates incrementally: affected files glow orange/red with ripple highlights across dependent components.

---

## License & Academic Attribution

Developed for B.Tech Major Project Thesis Defense. Released under the MIT License.
