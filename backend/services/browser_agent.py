import asyncio
import base64
import json
import logging
import os
import re
import signal
import subprocess
import time
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable

import httpx
from playwright.async_api import async_playwright, Browser, Page

from backend.config import settings
from backend.schemas import (
    UITestStep,
    ScreenshotResult,
    UIVerificationResult,
    ProjectScanResult,
)
from backend.services.model_provider import model_router

logger = logging.getLogger(__name__)


class AppStartResult:
    def __init__(self, url: str, process_pid: int, process: Optional[subprocess.Popen] = None):
        self.url = url
        self.process_pid = process_pid
        self.process = process


class BrowserAgent:
    """
    Playwright-based UI automation and verification agent.
    - Automates frontend dev server startup & teardown
    - Generates UI test steps from requirements and acceptance criteria
    - Executes test steps in Playwright Chromium, takes screenshots, streams events
    """

    def __init__(self, default_timeout_ms: int = 10000):
        self.default_timeout_ms = default_timeout_ms
        self.active_processes: Dict[int, subprocess.Popen] = {}

    async def generate_ui_tests(
        self,
        requirement: str,
        acceptance_criteria: List[str],
        app_url: str = "http://localhost:5173"
    ) -> List[UITestStep]:
        """
        Calls the LLM (model_router) to generate Playwright UI test steps based on requirement & acceptance criteria.
        """
        system_prompt = (
            "You are an automated Playwright UI testing specialist.\n"
            "Generate UI test steps for Playwright based on acceptance criteria.\n"
            "Return ONLY a valid JSON array of objects with fields:\n"
            "- action: one of [\"navigate\", \"click\", \"fill\", \"wait\", \"screenshot\", \"assert_text\", \"assert_visible\"]\n"
            "- target: CSS selector (e.g. 'button[type=submit]', 'input#email', 'nav a', 'h1', etc.) or URL for navigate\n"
            "- value: text value for fill or expected text for assert_text, or milliseconds for wait (optional)\n"
            "- description: human-readable step explanation\n"
            "Keep the test realistic, robust, and concise (3-8 steps maximum)."
        )

        user_prompt = (
            f"App URL: {app_url}\n"
            f"Requirement: {requirement}\n"
            f"Acceptance Criteria: {json.dumps(acceptance_criteria)}\n\n"
            "Generate the test steps JSON array starting with navigating to the App URL."
        )

        try:
            resp = await model_router.complete(
                role="planning",
                system=system_prompt,
                user=user_prompt,
                temperature=0.1,
            )
            raw_content = resp.content.strip()

            # Clean JSON markdown blocks if present
            if "```" in raw_content:
                match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_content)
                if match:
                    raw_content = match.group(1).strip()

            start_idx = raw_content.find("[")
            end_idx = raw_content.rfind("]")
            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                raw_content = raw_content[start_idx:end_idx + 1]

            parsed = json.loads(raw_content)
            steps: List[UITestStep] = []
            for item in parsed:
                if isinstance(item, dict):
                    action = str(item.get("action", "wait")).lower()
                    if action not in ["navigate", "click", "fill", "wait", "screenshot", "assert_text", "assert_visible"]:
                        action = "wait"
                    steps.append(UITestStep(
                        action=action,
                        target=item.get("target") or (app_url if action == "navigate" else None),
                        value=str(item.get("value")) if item.get("value") is not None else None,
                        description=item.get("description") or f"Execute {action}"
                    ))
            if steps:
                return steps
        except Exception as e:
            logger.warning(f"Error generating UI tests via LLM: {e}. Using intelligent fallback.")

        # Fallback default test steps
        return [
            UITestStep(
                action="navigate",
                target=app_url,
                value=None,
                description=f"Navigate to {app_url}"
            ),
            UITestStep(
                action="wait",
                target=None,
                value="1000",
                description="Wait for page to hydrate"
            ),
            UITestStep(
                action="assert_visible",
                target="body",
                value=None,
                description="Verify body is visible"
            ),
            UITestStep(
                action="screenshot",
                target=None,
                value=None,
                description="Capture baseline landing screen"
            ),
        ]

    async def verify_ui(
        self,
        app_url: str,
        test_steps: List[UITestStep],
        task_id: str,
        event_emitter: Optional[Callable[[str, str, Dict[str, Any]], Any]] = None,
        headless: bool = True
    ) -> UIVerificationResult:
        """
        Executes UITestSteps using Playwright Chromium, takes screenshots, and streams events.
        """
        screenshots: List[ScreenshotResult] = []
        errors: List[str] = []
        steps_passed = 0
        steps_failed = 0

        async def emit(event_type: str, msg: str, data: Dict[str, Any]):
            if event_emitter:
                try:
                    res = event_emitter(event_type, msg, data)
                    if asyncio.iscoroutine(res):
                        await res
                except Exception as ex:
                    logger.debug(f"Event emitter error in verify_ui: {ex}")

        await emit("ui_verification_start", f"Starting Playwright UI verification on {app_url}", {
            "type": "ui_verification_start",
            "task_id": task_id,
            "app_url": app_url,
            "total_steps": len(test_steps),
            "headless": headless
        })

        async with async_playwright() as p:
            browser: Optional[Browser] = None
            page: Optional[Page] = None
            try:
                browser = await p.chromium.launch(
                    headless=headless,
                    args=["--disable-dev-shm-usage", "--no-sandbox"]
                )
                context = await browser.new_context(
                    viewport={"width": 1280, "height": 800},
                    user_agent="AutonomousIDE-Playwright/1.0"
                )
                page = await context.new_page()
                page.set_default_timeout(self.default_timeout_ms)

                for idx, step in enumerate(test_steps):
                    step_passed = True
                    step_error: Optional[str] = None
                    screenshot_b64 = ""

                    try:
                        action = step.action.lower()
                        target = step.target or app_url
                        val = step.value

                        if action == "navigate":
                            url_to_go = target if target.startswith("http") else app_url
                            await page.goto(url_to_go, wait_until="networkidle", timeout=15000)

                        elif action == "click":
                            await page.click(target, timeout=self.default_timeout_ms)

                        elif action == "fill":
                            await page.fill(target, val or "", timeout=self.default_timeout_ms)

                        elif action == "wait":
                            ms = int(val) if val and val.isdigit() else 1000
                            await page.wait_for_timeout(ms)

                        elif action == "assert_visible":
                            locator = page.locator(target).first
                            is_vis = await locator.is_visible(timeout=self.default_timeout_ms)
                            if not is_vis:
                                raise AssertionError(f"Element '{target}' is not visible.")

                        elif action == "assert_text":
                            locator = page.locator(target).first
                            content = await locator.inner_text(timeout=self.default_timeout_ms)
                            expected = val or ""
                            if expected.lower() not in content.lower():
                                raise AssertionError(f"Expected text '{expected}' not found in '{content}'.")

                        elif action == "screenshot":
                            # Screenshot action is automatically captured below
                            pass

                        else:
                            await page.wait_for_timeout(500)

                    except Exception as step_ex:
                        step_passed = False
                        step_error = str(step_ex)
                        errors.append(f"Step {idx + 1} ({step.description}): {step_error}")
                        logger.warning(f"UI test step {idx + 1} failed: {step_error}")

                    # Capture screenshot after each step
                    try:
                        screenshot_bytes = await page.screenshot(
                            full_page=False,
                            type="jpeg",
                            quality=75
                        )
                        screenshot_b64 = base64.b64encode(screenshot_bytes).decode("utf-8")
                    except Exception as ss_err:
                        logger.debug(f"Screenshot capture failed: {ss_err}")

                    if step_passed:
                        steps_passed += 1
                    else:
                        steps_failed += 1

                    res_item = ScreenshotResult(
                        step_index=idx + 1,
                        action=step.action,
                        description=step.description or f"Step {idx + 1}",
                        screenshot_base64=screenshot_b64,
                        passed=step_passed,
                        error=step_error
                    )
                    screenshots.append(res_item)

                    # Emit step event
                    await emit("ui_test_step", f"UI Step {idx + 1}: {step.description} - {'PASS' if step_passed else 'FAIL'}", {
                        "type": "ui_test_step",
                        "step_index": idx + 1,
                        "action": step.action,
                        "description": step.description,
                        "status": "passed" if step_passed else "failed",
                        "error": step_error,
                        "screenshot_base64": screenshot_b64
                    })

            except Exception as overall_ex:
                errors.append(f"Playwright runtime error: {str(overall_ex)}")
                logger.error(f"Playwright runtime failed: {overall_ex}")
            finally:
                if page:
                    try:
                        await page.close()
                    except Exception:
                        pass
                if browser:
                    try:
                        await browser.close()
                    except Exception:
                        pass

        overall_passed = (steps_failed == 0 and steps_passed > 0)
        result = UIVerificationResult(
            steps_passed=steps_passed,
            steps_failed=steps_failed,
            screenshots=screenshots,
            errors=errors,
            overall_passed=overall_passed,
            app_url=app_url
        )

        await emit("ui_verification_complete", f"UI Verification completed: {'PASSED' if overall_passed else 'FAILED'}", {
            "type": "ui_verification_complete",
            "task_id": task_id,
            "overall_passed": overall_passed,
            "steps_passed": steps_passed,
            "steps_failed": steps_failed,
            "total_screenshots": len(screenshots)
        })

        return result

    async def start_app_for_testing(
        self,
        project_path: str,
        scan_result: Optional[ProjectScanResult] = None
    ) -> AppStartResult:
        """
        Starts the web application development server as a background subprocess
        and polls until the endpoint responds.
        """
        project_dir = Path(project_path).resolve()
        if not project_dir.exists():
            raise FileNotFoundError(f"Project directory {project_path} not found.")

        # Determine start command and candidate URLs
        cmd: List[str] = []
        candidate_urls: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"]
        chosen_url = "http://localhost:5173"

        pkg_json = project_dir / "package.json"
        is_node = pkg_json.exists()

        if is_node:
            try:
                content = json.loads(pkg_json.read_text(encoding="utf-8"))
                scripts = content.get("scripts", {})
                if "dev" in scripts:
                    cmd = ["npm.cmd" if os.name == "nt" else "npm", "run", "dev"]
                elif "start" in scripts:
                    cmd = ["npm.cmd" if os.name == "nt" else "npm", "start"]
                else:
                    cmd = ["npx.cmd" if os.name == "nt" else "npx", "vite"]
            except Exception:
                cmd = ["npm.cmd" if os.name == "nt" else "npm", "run", "dev"]
        elif (project_dir / "main.py").exists() or (project_dir / "app.py").exists():
            cmd = ["uvicorn", "main:app", "--reload", "--port", "8000"]
            chosen_url = "http://localhost:8000"
            candidate_urls = [chosen_url]
        else:
            # Simple python HTTP server fallback
            cmd = ["python", "-m", "http.server", "5173"]
            chosen_url = "http://localhost:5173"
            candidate_urls = [chosen_url]

        logger.info(f"Starting test app with command: {' '.join(cmd)} in {project_dir}")

        creationflags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        proc = subprocess.Popen(
            cmd,
            cwd=str(project_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=creationflags,
            env=os.environ.copy()
        )

        self.active_processes[proc.pid] = proc

        # Poll URLs to verify server is up
        ready_url = None
        async with httpx.AsyncClient(timeout=1.5) as client:
            for _ in range(30):  # Wait up to 30 seconds
                if proc.poll() is not None:
                    # Process died prematurely
                    stderr = proc.stderr.read().decode("utf-8", errors="ignore") if proc.stderr else ""
                    raise RuntimeError(f"App server process exited with code {proc.returncode}: {stderr}")

                for u in candidate_urls:
                    try:
                        r = await client.get(u)
                        if r.status_code < 500:
                            ready_url = u
                            break
                    except Exception:
                        pass

                if ready_url:
                    break
                await asyncio.sleep(1.0)

        final_url = ready_url or chosen_url
        return AppStartResult(url=final_url, process_pid=proc.pid, process=proc)

    def stop_app(self, process_pid: int):
        """
        Kills the started development server process.
        """
        proc = self.active_processes.pop(process_pid, None)
        if not proc:
            try:
                if os.name == "nt":
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(process_pid)], capture_output=True)
                else:
                    os.kill(process_pid, signal.SIGTERM)
            except Exception as e:
                logger.debug(f"Could not stop process {process_pid}: {e}")
            return

        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
        except Exception as e:
            logger.warning(f"Error terminating app process {proc.pid}: {e}")


browser_agent = BrowserAgent()
