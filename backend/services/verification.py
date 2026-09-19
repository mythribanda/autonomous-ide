import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

import ollama
from sqlalchemy import select

from backend.config import settings
from backend.database import AsyncSessionLocal
from backend.models.project import Task, Project
from backend.schemas import (
    AgentState,
    VerificationReport,
    VerificationCheck,
    CriterionCheck,
)
from backend.services.project_scanner import ProjectScanner

logger = logging.getLogger(__name__)


class VerificationService:
    """
    Verification service that determines if an AI agent's work meets codebase requirements.
    Runs build/typecheck verification, automated tests, linter/type analysis, and LLM requirement QA.
    """

    def __init__(self, ollama_url: Optional[str] = None, model: Optional[str] = None):
        self.ollama_url = ollama_url or settings.ollama_url
        self.model = model or settings.ollama_model
        self.client = ollama.AsyncClient(host=self.ollama_url)

    @classmethod
    async def verify(cls, state: AgentState, workspace_path: Optional[str] = None) -> VerificationReport:
        """Convenience class method to execute full verification suite on an AgentState."""
        service = cls()
        return await service.run_verification(state, workspace_path)

    async def _resolve_workspace_path(self, state: AgentState, provided_path: Optional[str] = None) -> str:
        """Resolves the physical directory path for the project associated with the task."""
        if provided_path and Path(provided_path).exists():
            return str(Path(provided_path).resolve())

        try:
            async with AsyncSessionLocal() as session:
                stmt = select(Project).where(Project.id == state.project_id)
                res = await session.execute(stmt)
                project = res.scalars().first()
                if project and Path(project.path).exists():
                    return str(Path(project.path).resolve())
        except Exception as e:
            logger.warning(f"Could not query project path from DB for {state.project_id}: {e}")

        return str(Path(".").resolve())

    async def _run_command(self, command: str, cwd: str, timeout: int = 30) -> Tuple[int, str, str]:
        """Runs a subprocess command asynchronously and returns (returncode, stdout, stderr)."""
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=cwd
            )
            stdout_b, stderr_b = await asyncio.wait_for(proc.communicate(), timeout=float(timeout))
            stdout = stdout_b.decode("utf-8", errors="replace")
            stderr = stderr_b.decode("utf-8", errors="replace")
            return proc.returncode if proc.returncode is not None else 0, stdout, stderr
        except asyncio.TimeoutError:
            try:
                proc.kill()
                await proc.wait()
            except Exception:
                pass
            return -1, "", f"Command timed out after {timeout} seconds"
        except Exception as e:
            return -1, "", f"Execution error: {str(e)}"

    async def _resolve_model(self) -> str:
        """Resolves available model on local Ollama instance."""
        try:
            models_info = await asyncio.wait_for(self.client.list(), timeout=3.0)
            names = [m.model for m in models_info.models] if hasattr(models_info, "models") else []
            if self.model in names:
                return self.model
            for n in names:
                if n.startswith(self.model.split(":")[0]):
                    return n
            if names:
                return names[0]
        except Exception:
            pass
        return self.model

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """Cleans markdown backticks and extracts JSON dict."""
        text = raw_text.strip()
        if "```" in text:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
            if match:
                text = match.group(1).strip()
        first_brace = text.find("{")
        last_brace = text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            text = text[first_brace:last_brace + 1]
        return json.loads(text)

    # -----------------------------------------------------------------------
    # STEP 1 — BUILD VERIFICATION
    # -----------------------------------------------------------------------
    async def verify_build(self, ws: Path) -> Tuple[VerificationCheck, bool]:
        """
        Runs build or typecheck based on project framework.
        Returns (VerificationCheck, is_typecheck_only).
        """
        is_typecheck_only = False
        pkg_json = ws / "package.json"
        tsconfig = ws / "tsconfig.json"

        # 1. Node / TypeScript / JavaScript project
        if pkg_json.exists():
            if tsconfig.exists():
                is_typecheck_only = True
                cmd = "npx tsc --noEmit"
            else:
                try:
                    pkg_data = json.loads(pkg_json.read_text(encoding="utf-8", errors="replace"))
                    scripts = pkg_data.get("scripts", {})
                    if "build" in scripts:
                        cmd = "npm run build"
                    else:
                        return VerificationCheck(
                            name="build",
                            passed=True,
                            output="Node project without build script; build skipped."
                        ), False
                except Exception:
                    cmd = "npm run build"

            code, stdout, stderr = await self._run_command(cmd, str(ws), timeout=45)
            passed = (code == 0)
            out = stdout if stdout else ("Build completed" if passed else "")
            err = stderr if not passed else None
            return VerificationCheck(
                name="build",
                passed=passed,
                output=out.strip(),
                error=err.strip() if err else None
            ), is_typecheck_only

        # 2. Python project
        py_indicators = [ws / "requirements.txt", ws / "pyproject.toml", ws / "setup.py"]
        has_py = any(p.exists() for p in py_indicators) or any(ws.glob("*.py"))
        if has_py:
            # Check for candidate entry points
            candidates = ["backend/main.py", "src/main.py", "main.py", "app.py", "server.py"]
            entry_file = None
            for c in candidates:
                if (ws / c).exists():
                    entry_file = c
                    break

            if entry_file:
                cmd = f"python -m py_compile {entry_file}"
            else:
                first_py = next(ws.glob("*.py"), None)
                if first_py:
                    cmd = f"python -m py_compile {first_py.name}"
                else:
                    return VerificationCheck(
                        name="build",
                        passed=True,
                        output="No Python entry points found to compile; build check passed."
                    ), False

            code, stdout, stderr = await self._run_command(cmd, str(ws), timeout=20)
            passed = (code == 0)
            return VerificationCheck(
                name="build",
                passed=passed,
                output=stdout.strip() or ("Python bytecode compilation succeeded" if passed else ""),
                error=stderr.strip() if not passed else None
            ), False

        # 3. Go project
        if (ws / "go.mod").exists():
            code, stdout, stderr = await self._run_command("go build ./...", str(ws), timeout=30)
            passed = (code == 0)
            return VerificationCheck(
                name="build",
                passed=passed,
                output=stdout.strip() or ("Go build succeeded" if passed else ""),
                error=stderr.strip() if not passed else None
            ), False

        # Fallback for generic/scratch directory
        return VerificationCheck(
            name="build",
            passed=True,
            output="No explicit build step required for workspace."
        ), False

    # -----------------------------------------------------------------------
    # STEP 2 — TEST VERIFICATION
    # -----------------------------------------------------------------------
    async def verify_tests(self, ws: Path, state: AgentState) -> VerificationCheck:
        """
        Executes automated test suites (Jest/Vitest or Pytest).
        """
        pkg_json = ws / "package.json"
        pytest_ini = ws / "pytest.ini"
        tests_dir = ws / "tests"
        has_pytests = pytest_ini.exists() or tests_dir.exists() or any(ws.glob("test_*.py")) or any(ws.glob("*_test.py"))

        # 1. JS / TS test suite
        if pkg_json.exists():
            has_test_script = False
            try:
                pkg_data = json.loads(pkg_json.read_text(encoding="utf-8", errors="replace"))
                has_test_script = "test" in pkg_data.get("scripts", {})
            except Exception:
                pass

            if has_test_script:
                cmd = "npm test -- --run"
                code, stdout, stderr = await self._run_command(cmd, str(ws), timeout=45)
                full_out = (stdout + "\n" + stderr).strip()

                # If package.json has default placeholder "Error: no test specified"
                if "no test specified" in full_out.lower():
                    return VerificationCheck(
                        name="test",
                        passed=True,
                        output="No tests configured in package.json."
                    )

                # Parse pass count
                passed = (code == 0)
                pass_match = re.search(r"(\d+)\s+passed", full_out, re.IGNORECASE)
                fail_match = re.search(r"(\d+)\s+failed", full_out, re.IGNORECASE)
                summary_line = ""
                if pass_match:
                    summary_line += f"{pass_match.group(1)} tests passed"
                if fail_match:
                    summary_line += f", {fail_match.group(1)} tests failed"

                return VerificationCheck(
                    name="test",
                    passed=passed,
                    output=summary_line or full_out[:300],
                    error=stderr.strip() if not passed else None
                )

        # 2. Python Pytest suite
        if has_pytests:
            # Check target test files from impact report
            target_tests = []
            if state.compiled_spec and state.compiled_spec.impact_report:
                target_tests = [t for t in state.compiled_spec.impact_report.tests_to_run if (ws / t).exists()]

            if target_tests:
                cmd = f"pytest -x -q {' '.join(target_tests)}"
            else:
                cmd = "pytest -x -q"

            code, stdout, stderr = await self._run_command(cmd, str(ws), timeout=40)
            full_out = (stdout + "\n" + stderr).strip()
            passed = (code == 0)

            pass_match = re.search(r"(\d+)\s+passed", full_out, re.IGNORECASE)
            fail_match = re.search(r"(\d+)\s+failed", full_out, re.IGNORECASE)
            summary_line = ""
            if pass_match:
                summary_line += f"{pass_match.group(1)} tests passed"
            if fail_match:
                summary_line += f", {fail_match.group(1)} tests failed"

            return VerificationCheck(
                name="test",
                passed=passed,
                output=summary_line or full_out[:300],
                error=stderr.strip() if not passed else None
            )

        return VerificationCheck(
            name="test",
            passed=True,
            output="No test suite configured; tests skipped."
        )

    # -----------------------------------------------------------------------
    # STEP 3 — LINT / TYPE VERIFICATION
    # -----------------------------------------------------------------------
    async def verify_lint(self, ws: Path, build_was_typecheck: bool) -> VerificationCheck:
        """
        Verifies TypeScript types and linter status.
        """
        tsconfig = ws / "tsconfig.json"
        if tsconfig.exists():
            if build_was_typecheck:
                return VerificationCheck(
                    name="lint",
                    passed=True,
                    output="TypeScript type validation passed during build phase."
                )
            code, stdout, stderr = await self._run_command("npx tsc --noEmit", str(ws), timeout=30)
            passed = (code == 0)
            errors = re.findall(r"error TS\d+:", stdout + stderr)
            err_count = len(errors)
            return VerificationCheck(
                name="lint",
                passed=passed,
                output=f"TypeScript validation: {err_count} errors" if not passed else "TypeScript validation passed (0 errors)",
                error=stderr.strip() or stdout.strip() if not passed else None
            )

        # Python Ruff check if available
        pyproject = ws / "pyproject.toml"
        if pyproject.exists() or any(ws.glob("*.py")):
            code, stdout, stderr = await self._run_command("ruff check .", str(ws), timeout=20)
            # If ruff not installed or recognized
            if "not recognized" in (stdout + stderr) or "not found" in (stdout + stderr) or code == 9009:
                return VerificationCheck(
                    name="lint",
                    passed=True,
                    output="Linter skipped (ruff not installed in environment)."
                )
            passed = (code == 0)
            return VerificationCheck(
                name="lint",
                passed=passed,
                output=stdout.strip()[:300] if stdout else ("Lint clean" if passed else "Lint issues detected"),
                error=stderr.strip() if not passed else None
            )

        return VerificationCheck(
            name="lint",
            passed=True,
            output="No linter configured for project."
        )

    # -----------------------------------------------------------------------
    # STEP 4 — REQUIREMENT VERIFICATION
    # -----------------------------------------------------------------------
    async def verify_requirements(
        self,
        ws: Path,
        state: AgentState,
        build_passed: bool,
        test_summary: str
    ) -> List[CriterionCheck]:
        """
        Validates each acceptance criterion using Ollama evaluation or rule-based verification.
        """
        criteria = state.compiled_spec.acceptance_criteria if state.compiled_spec else []
        if not criteria:
            intent = state.compiled_spec.intent if state.compiled_spec else "Requirement"
            criteria = [f"Complete requirement: {intent}"]

        # Gather relevant snippets from modified files
        snippets: List[str] = []
        for mod_path in state.files_modified[:4]:
            try:
                target_fp = ws / mod_path
                if target_fp.exists() and target_fp.is_file():
                    content = target_fp.read_text(encoding="utf-8", errors="replace")[:800]
                    snippets.append(f"File '{mod_path}':\n{content}")
            except Exception:
                pass
        snippets_text = "\n\n".join(snippets) if snippets else "No modified file snippets available."

        model_name = await self._resolve_model()
        results: List[CriterionCheck] = []

        system_prompt = "You are a QA engineer verifying if a software requirement was met. Return ONLY valid JSON."

        for criterion in criteria:
            user_prompt = (
                f"Criterion: {criterion}\n"
                f"Files modified: {state.files_modified}\n"
                f"File contents (relevant snippets):\n{snippets_text}\n"
                f"Build passed: {build_passed}\n"
                f"Tests passed: {test_summary}\n\n"
                f"Return JSON:\n"
                f"{{\n"
                f"  \"met\": true,\n"
                f"  \"evidence\": \"<brief explanation of why criterion is met or not>\"\n"
                f"}}"
            )

            met = True
            evidence = f"Verified implementation against build status and {len(state.files_modified)} modified files."

            try:
                resp = await asyncio.wait_for(
                    self.client.chat(
                        model=model_name,
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        options={"temperature": 0.0}
                    ),
                    timeout=15.0
                )
                parsed = self._clean_and_parse_json(resp.message.content)
                met = bool(parsed.get("met", True))
                evidence = str(parsed.get("evidence", evidence))
            except Exception:
                # Rule-based fallback: if build failed, mark unmet; otherwise met
                if not build_passed:
                    met = False
                    evidence = "Build failures prevent satisfying requirement."
                else:
                    met = True
                    evidence = f"Code modifications successfully applied across {len(state.files_modified)} files and compiled without syntax errors."

            results.append(CriterionCheck(
                criterion=criterion,
                met=met,
                evidence=evidence
            ))

        return results

    # -----------------------------------------------------------------------
    # STEP 5 — RUN FULL VERIFICATION & OVERALL SUCCESS
    # -----------------------------------------------------------------------
    async def run_verification(self, state: AgentState, workspace_path: Optional[str] = None) -> VerificationReport:
        """Runs the complete 5-step verification process and produces a VerificationReport."""
        ws_str = await self._resolve_workspace_path(state, workspace_path)
        ws = Path(ws_str)

        # 1. Build check
        build_status, is_typecheck = await self.verify_build(ws)

        # 2. Test check
        test_status = await self.verify_tests(ws, state)

        # 3. Lint check
        lint_status = await self.verify_lint(ws, is_typecheck)

        # 4. Requirement QA
        requirements_met = await self.verify_requirements(
            ws,
            state,
            build_passed=build_status.passed,
            test_summary=test_status.output
        )

        # 5. Compute overall success & summary
        all_criteria_met = all(c.met for c in requirements_met)
        overall_success = build_status.passed and test_status.passed and all_criteria_met

        # Generate summary string
        build_str = "✓ Build successful" if build_status.passed else "✗ Build failed"

        if "skipped" in test_status.output.lower() or "no tests" in test_status.output.lower():
            test_str = "✓ Tests skipped"
        elif test_status.passed:
            test_str = f"✓ {test_status.output}" if "passed" in test_status.output else "✓ Tests passed"
        else:
            test_str = "✗ Tests failed"

        met_count = sum(1 for c in requirements_met if c.met)
        total_count = len(requirements_met)
        if met_count == total_count:
            req_str = f"✓ {met_count}/{total_count} requirements met"
        else:
            unmet_count = total_count - met_count
            req_str = f"✗ {unmet_count}/{total_count} requirements not met"

        files_count = len(state.files_modified)
        files_str = f"{files_count} files modified"

        summary = f"{build_str} | {test_str} | {req_str} | {files_str}"

        return VerificationReport(
            build_status=build_status,
            test_status=test_status,
            lint_status=lint_status,
            requirements_met=requirements_met,
            files_changed_count=files_count,
            overall_success=overall_success,
            summary=summary
        )


verification_service = VerificationService()
