import asyncio
import json
import logging
import re
import uuid
from typing import Optional, List, Dict, Any, Tuple, Callable, Awaitable
import ollama

from backend.config import settings
from backend.schemas import (
    FileContext,
    ImpactReport,
    ImplementationStep,
    CompiledSpec,
    PromptSpecificationResponse,
    TechnicalPlan,
    AcceptanceCriteriaItem,
)
from backend.services.ai_agent import agent_manager
from backend.services.model_provider import model_router

logger = logging.getLogger(__name__)


class PromptCompiler:
    """
    Inline Prompt Compiler service.
    Takes a raw natural language requirement and project context to produce a structured
    CompiledSpec that the AI agent executes.
    Also retains specification compilation for the prompt UI.
    """

    def __init__(self):
        self._cached_model: Optional[str] = None

    async def _resolve_ollama_model(self, client: ollama.AsyncClient) -> str:
        """
        Determines the appropriate Ollama model to use.
        Checks settings.ollama_model first; if not found on Ollama, selects the first available model.
        """
        if self._cached_model:
            return self._cached_model

        configured = settings.ollama_model
        try:
            models_info = await asyncio.wait_for(client.list(), timeout=10.0)
            available_names = [m.model for m in models_info.models] if hasattr(models_info, "models") else []
            if configured in available_names:
                self._cached_model = configured
                return configured
            # Check without tag (e.g. 'llama3.2' matching 'llama3.2:latest')
            for name in available_names:
                if name.startswith(configured.split(":")[0]):
                    self._cached_model = name
                    return name
            if available_names:
                self._cached_model = available_names[0]
                return self._cached_model
        except Exception as e:
            logger.warning(f"Could not query Ollama models list: {e}")

        return configured

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        """
        Cleans LLM response text (stripping markdown codeblocks if present)
        and parses JSON into a dict.
        """
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

    async def _call_ollama_with_retry(
        self,
        client: Any,
        model: str,
        system_prompt: str,
        user_message: str,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Calls ModelRouter with role='planning' and retries once with a stricter prompt if JSON parsing fails.
        """
        # Attempt 1
        try:
            resp = await model_router.complete(
                role="planning",
                system=system_prompt,
                user=user_message,
                max_tokens=2000,
                temperature=0.1
            )
            return self._clean_and_parse_json(resp.content)
        except (json.JSONDecodeError, KeyError, ValueError) as parse_err:
            logger.warning(f"Model JSON parse failed on attempt 1: {parse_err}. Retrying with stricter prompt...")
        except Exception as call_err:
            logger.warning(f"Model call failed on attempt 1: {call_err}. Retrying...")

        # Attempt 2 (Retry with strict instruction)
        retry_system = system_prompt + " Output raw valid JSON only without markdown or explanations."
        retry_user = (
            user_message
            + "\n\nCRITICAL: Your previous output was invalid or timed out. "
            "You MUST respond concisely ONLY with a parseable JSON object matching the exact keys requested."
        )

        resp = await model_router.complete(
            role="planning",
            system=retry_system,
            user=retry_user,
            max_tokens=2000,
            temperature=0.1
        )
        return self._clean_and_parse_json(resp.content)


    async def compile(
        self,
        raw_requirement: str,
        project_summary: str,
        relevant_context: List[FileContext],
        impact_report: ImpactReport,
        task_id: Optional[str] = None,
        event_callback: Optional[Callable[[Dict[str, Any]], Awaitable[None]]] = None,
    ) -> CompiledSpec:
        """
        Compiles raw natural language requirement into a structured CompiledSpec.
        Executes a 4-step compilation pipeline with WebSocket status streaming and fault tolerance.
        """
        client = ollama.AsyncClient(host=settings.ollama_url)
        model = await self._resolve_ollama_model(client)
        error_message: Optional[str] = None

        async def emit(ev: Dict[str, Any]):
            if task_id:
                try:
                    await agent_manager.broadcast_raw_event(task_id, ev)
                except Exception as b_err:
                    logger.warning(f"Error broadcasting websocket event: {b_err}")
            if event_callback:
                try:
                    await event_callback(ev)
                except Exception as cb_err:
                    logger.warning(f"Error invoking compiler event callback: {cb_err}")

        # Prepare deduplicated affected files from impact report
        affected_files_dict = {f: True for f in (impact_report.directly_affected_files + impact_report.transitively_affected_files)}
        affected_files = list(affected_files_dict.keys())

        # Top relevant files context (up to 3 files)
        top_files_text_list = []
        for fc in relevant_context[:3]:
            top_files_text_list.append(f"File: {fc.file_path}\nSymbols/Snippet:\n{fc.content_snippet}")
        files_context_str = "\n\n".join(top_files_text_list) if top_files_text_list else "No specific file context found."

        # Initialize default values
        intent = f"Implement requirement: {raw_requirement[:80]}"
        intent_category = "feature_add"
        scope = "multi_file" if len(impact_report.directly_affected_files) > 1 else "single_file"
        explicit_requirements: List[str] = []
        ambiguities: List[str] = []
        missing_info: List[str] = []
        assumptions: List[str] = []
        implementation_steps: List[ImplementationStep] = []
        new_files_needed: List[str] = []
        acceptance_criteria: List[str] = []
        test_cases: List[str] = []

        # ==========================================
        # Step 1 — Intent Detection
        # ==========================================
        await emit({
            "type": "compiler_step",
            "step": "intent_detection",
            "status": "running",
        })

        step1_system = "You are a software requirements analyst. Given a natural language request and project context, extract the developer's true intent. Return ONLY valid JSON."
        step1_user = (
            f"Project context: {project_summary}\n"
            f"Raw requirement: {raw_requirement}\n\n"
            "Return JSON with these exact keys:\n"
            "{\n"
            '  "intent": "<one sentence describing what the developer wants to accomplish>",\n'
            '  "intent_category": "<one of: feature_add, bug_fix, refactor, performance, security, test, doc>",\n'
            '  "scope": "<one of: single_file, multi_file, system_wide>"\n'
            "}"
        )

        try:
            step1_res = await self._call_ollama_with_retry(client, model, step1_system, step1_user)
            intent = step1_res.get("intent") or intent
            cat = str(step1_res.get("intent_category", "")).lower()
            if cat in ["feature_add", "bug_fix", "refactor", "performance", "security", "test", "doc"]:
                intent_category = cat
            sc = str(step1_res.get("scope", "")).lower()
            if sc in ["single_file", "multi_file", "system_wide"]:
                scope = sc
        except Exception as e:
            logger.error(f"Intent detection failed: {e}")
            error_message = f"Intent detection fallback: {str(e)}"

        await emit({
            "type": "compiler_step",
            "step": "intent_detection",
            "status": "done",
            "result": {
                "intent": intent,
                "intent_category": intent_category,
                "scope": scope,
            },
        })

        # ==========================================
        # Step 2 — Requirement Extraction
        # ==========================================
        await emit({
            "type": "compiler_step",
            "step": "requirement_extraction",
            "status": "running",
        })

        step2_system = "You are a software architect. Break down requirements into unambiguous, testable specifications. Return ONLY valid JSON."
        step2_user = (
            f"Project context: {project_summary}\n\n"
            f"Relevant file context:\n{files_context_str}\n\n"
            f"Raw requirement: {raw_requirement}\n\n"
            "Return JSON with these exact keys:\n"
            "{\n"
            '  "explicit_requirements": ["<requirement 1>", "<requirement 2>", ...],\n'
            '  "ambiguities": ["<ambiguity 1>", ...],\n'
            '  "missing_info": ["<missing info 1>", ...],\n'
            '  "assumptions": ["<assumption 1>", ...]\n'
            "}"
        )

        try:
            step2_res = await self._call_ollama_with_retry(client, model, step2_system, step2_user)
            explicit_requirements = [str(r) for r in step2_res.get("explicit_requirements", []) if r]
            ambiguities = [str(a) for a in step2_res.get("ambiguities", []) if a]
            missing_info = [str(m) for m in step2_res.get("missing_info", []) if m]
            assumptions = [str(asmp) for asmp in step2_res.get("assumptions", []) if asmp]
        except Exception as e:
            logger.error(f"Requirement extraction failed: {e}")
            if not error_message:
                error_message = f"Requirement extraction fallback: {str(e)}"

        if not explicit_requirements:
            explicit_requirements = [
                f"Implement {raw_requirement}",
                "Ensure robust input validation and error handling",
                "Maintain compatibility with existing interfaces",
            ]
        if not assumptions:
            assumptions = [
                "Target environment follows established codebase conventions",
                "Changes preserve backward compatibility where possible",
            ]

        await emit({
            "type": "compiler_step",
            "step": "requirement_extraction",
            "status": "done",
            "result": {
                "explicit_requirements": explicit_requirements,
                "ambiguities": ambiguities,
                "missing_info": missing_info,
                "assumptions": assumptions,
            },
        })

        # ==========================================
        # Step 3 — Technical Planning
        # ==========================================
        await emit({
            "type": "compiler_step",
            "step": "technical_planning",
            "status": "running",
        })

        impact_summary = (
            f"Directly affected: {', '.join(impact_report.directly_affected_files) or 'None identified'}. "
            f"Risk level: {impact_report.risk_level}. "
            f"Risk reasons: {', '.join(impact_report.risk_reasons) or 'None'}."
        )

        step3_system = "You are a lead developer creating an execution plan for an AI coding agent. Return ONLY valid JSON."
        step3_user = (
            f"Extracted Intent: {intent} (Category: {intent_category}, Scope: {scope})\n"
            f"Explicit Requirements: {json.dumps(explicit_requirements)}\n"
            f"Relevant Files: {', '.join([fc.file_path for fc in relevant_context[:5]])}\n"
            f"Impact Report Summary: {impact_summary}\n\n"
            "Return JSON with these exact keys:\n"
            "{\n"
            '  "implementation_steps": [\n'
            '    {"step": 1, "action": "<what to do>", "file": "<path>", "type": "create|modify|delete"}\n'
            "  ],\n"
            '  "new_files_needed": ["<path 1>", ...],\n'
            '  "acceptance_criteria": ["<criterion 1>", ...],\n'
            '  "test_cases": ["<test case description>", ...]\n'
            "}"
        )

        try:
            step3_res = await self._call_ollama_with_retry(client, model, step3_system, step3_user)
            raw_steps = step3_res.get("implementation_steps", [])
            for idx, s in enumerate(raw_steps):
                if isinstance(s, dict):
                    stype = str(s.get("type", "modify")).lower()
                    if stype not in ["create", "modify", "delete"]:
                        stype = "modify"
                    default_file = impact_report.directly_affected_files[0] if impact_report.directly_affected_files else "src/App.tsx"
                    implementation_steps.append(
                        ImplementationStep(
                            step=s.get("step", idx + 1),
                            action=str(s.get("action", f"Modify {s.get('file', default_file)}")),
                            file=str(s.get("file", default_file)),
                            type=stype,
                        )
                    )
            new_files_needed = [str(f) for f in step3_res.get("new_files_needed", []) if f]
            acceptance_criteria = [str(ac) for ac in step3_res.get("acceptance_criteria", []) if ac]
            test_cases = [str(tc) for tc in step3_res.get("test_cases", []) if tc]
        except Exception as e:
            logger.error(f"Technical planning failed: {e}")
            if not error_message:
                error_message = f"Technical planning fallback: {str(e)}"

        if not implementation_steps:
            if impact_report.directly_affected_files:
                for idx, f in enumerate(impact_report.directly_affected_files[:4]):
                    implementation_steps.append(
                        ImplementationStep(
                            step=idx + 1,
                            action=f"Update and verify implementation in {f}",
                            file=f,
                            type="modify",
                        )
                    )
            else:
                implementation_steps.append(
                    ImplementationStep(
                        step=1,
                        action=f"Implement updates for: {raw_requirement[:60]}",
                        file="workspace",
                        type="modify",
                    )
                )

        if not acceptance_criteria:
            acceptance_criteria = [
                f"Feature satisfies core requirement: {raw_requirement}",
                "No regression in associated unit tests or module imports",
                "Code adheres to project typing and structure conventions",
            ]

        if not test_cases:
            test_cases = [
                f"Verify valid execution flow for {intent}",
                "Verify error handling for invalid or edge-case inputs",
            ]

        await emit({
            "type": "compiler_step",
            "step": "technical_planning",
            "status": "done",
            "result": {
                "implementation_steps": [s.model_dump() if hasattr(s, "model_dump") else s for s in implementation_steps],
                "new_files_needed": new_files_needed,
                "acceptance_criteria": acceptance_criteria,
                "test_cases": test_cases,
            },
        })

        # ==========================================
        # Step 4 — Build CompiledSpec
        # ==========================================
        calc_score = 1.0 - (0.15 * len(ambiguities)) - (0.2 * len(missing_info)) - (0.1 if scope == "system_wide" else 0.0)
        confidence_score = max(0.1, min(1.0, round(calc_score, 2)))

        compiled_spec = CompiledSpec(
            task_id=task_id,
            raw_requirement=raw_requirement,
            intent=intent,
            intent_category=intent_category,
            scope=scope,
            explicit_requirements=explicit_requirements,
            ambiguities=ambiguities,
            missing_info=missing_info,
            assumptions=assumptions,
            implementation_steps=implementation_steps,
            new_files_needed=new_files_needed,
            acceptance_criteria=acceptance_criteria,
            test_cases=test_cases,
            affected_files=affected_files,
            impact_report=impact_report,
            confidence_score=confidence_score,
            error=error_message,
        )

        await emit({
            "type": "compiler_step",
            "step": "spec_complete",
            "status": "done",
            "spec": compiled_spec.model_dump(),
        })

        return compiled_spec

    def compile_specification(
        self,
        raw_prompt: str,
        project_name: Optional[str] = None,
        project_language: Optional[str] = None,
        project_framework: Optional[str] = None,
        detected_database: Optional[str] = None,
        test_framework: Optional[str] = None,
    ) -> PromptSpecificationResponse:
        cleaned_prompt = raw_prompt.strip()
        spec_id = f"spec-{uuid.uuid4().hex[:8]}"

        title = self._generate_title(cleaned_prompt)
        intent = self._classify_intent(cleaned_prompt)
        quality_score = self._compute_quality_score(cleaned_prompt)
        detected_requirements = self._extract_requirements(cleaned_prompt)
        ambiguities = self._detect_ambiguities(cleaned_prompt)
        missing_information = self._detect_missing_information(cleaned_prompt)
        assumptions = self._derive_assumptions(cleaned_prompt)
        technical_plan = self._build_technical_plan(
            cleaned_prompt,
            project_language=project_language,
            project_framework=project_framework,
            detected_database=detected_database,
            test_framework=test_framework,
        )
        acceptance_criteria = self._generate_acceptance_criteria(cleaned_prompt, detected_requirements)

        return PromptSpecificationResponse(
            id=spec_id,
            rawPrompt=cleaned_prompt,
            title=title,
            qualityScore=quality_score,
            intent=intent,
            detectedRequirements=detected_requirements,
            ambiguities=ambiguities,
            missingInformation=missing_information,
            assumptions=assumptions,
            technicalPlan=technical_plan,
            acceptanceCriteria=acceptance_criteria,
        )

    def _generate_title(self, prompt: str) -> str:
        cleaned = re.sub(
            r"^(please\s+)?(add|implement|create|build|integrate|fix|update|refactor)\s+",
            "",
            prompt,
            flags=re.IGNORECASE
        ).strip()
        if not cleaned:
            cleaned = prompt

        words = cleaned.split()
        short_title = " ".join(words[:7])
        if len(words) > 7:
            short_title += " Subsystem"
        else:
            short_title = short_title.title()
        return short_title

    def _classify_intent(self, prompt: str) -> str:
        lowered = prompt.lower()
        if any(w in lowered for w in ["fix", "bug", "broken", "error", "fail", "crash", "issue", "repair"]):
            return "Bug Fix & Fault Recovery"
        if any(w in lowered for w in ["refactor", "clean", "optimize", "performance", "reorganize", "decouple"]):
            return "Refactoring & Architecture Optimization"
        if any(w in lowered for w in ["test", "spec", "coverage", "mock", "assert"]):
            return "Testing & Verification Pipeline"
        if any(w in lowered for w in ["auth", "login", "jwt", "token", "permission", "security", "role"]):
            return "Security & Access Governance"
        if any(w in lowered for w in ["api", "endpoint", "route", "graphql", "rest", "webhook"]):
            return "API & Interface Integration"
        if any(w in lowered for w in ["database", "schema", "table", "migration", "model", "sql"]):
            return "Data Modeling & Persistence"
        return "Feature Addition & System Enhancement"

    def _compute_quality_score(self, prompt: str) -> int:
        score = 55
        length = len(prompt)
        if length > 25:
            score += 10
        if length > 60:
            score += 10
        if length > 120:
            score += 5

        lowered = prompt.lower()
        if any(k in lowered for k in ["table", "model", "schema", "database", "sql"]):
            score += 5
        if any(k in lowered for k in ["ui", "component", "button", "view", "modal", "page"]):
            score += 5
        if any(k in lowered for k in ["api", "endpoint", "route", "service", "handler"]):
            score += 5
        if any(k in lowered for k in ["test", "verify", "validate", "assert"]):
            score += 5

        return min(95, max(45, score))

    def _extract_requirements(self, prompt: str) -> List[str]:
        requirements = []
        lowered = prompt.lower()

        clauses = re.split(r",\s*|\s+and\s+|\s+with\s+|\s+including\s+", prompt, flags=re.IGNORECASE)
        for clause in clauses:
            clause_clean = clause.strip().rstrip(".")
            if len(clause_clean) > 8 and clause_clean.lower() not in [r.lower() for r in requirements]:
                requirements.append(f"Implement {clause_clean}")

        if "attendance" in lowered:
            requirements = [
                "Attendance records model & relational schema",
                "Student association and course mapping",
                "Teacher marking interface with date picker and batch actions",
                "Student personal attendance view and percentage calculations"
            ]
        elif "phone" in lowered and "student" in lowered:
            requirements = [
                "Add phone number attribute with validation to Student data model",
                "Update database schema / migration script for new phone column",
                "Expose phone field in REST API request/response serializers",
                "Display and edit student phone number in frontend management forms"
            ]
        elif len(requirements) < 2:
            requirements.append(f"Core logic for: {prompt}")
            requirements.append("Input validation and error handling boundary")
            requirements.append("UI state synchronization and response rendering")

        return requirements[:6]

    def _detect_ambiguities(self, prompt: str) -> List[str]:
        lowered = prompt.lower()
        ambiguities = []
        if "attendance" in lowered:
            ambiguities.append("Attendance calculation method (strict percentage vs weighted sessions)")
            ambiguities.append("Teacher permission boundaries across cross-department courses")
        elif "user" in lowered or "student" in lowered:
            ambiguities.append("Authorization scope and role permission boundaries for modifications")
            ambiguities.append("Duplicate identifier conflict resolution policy")
        else:
            ambiguities.append("Behavior when target records or dependencies are uninitialized")
            ambiguities.append("Concurrency handling when multiple modifications occur simultaneously")

        return ambiguities

    def _detect_missing_information(self, prompt: str) -> List[str]:
        lowered = prompt.lower()
        missing = []
        if "database" in lowered or "model" in lowered or "attendance" in lowered:
            missing.append("Database migration strategy for historical data")
            missing.append("Data retention rules and automated archival thresholds")
        else:
            missing.append("Detailed error status codes and localization requirements")
            missing.append("Automated notification or alert thresholds")

        return missing

    def _derive_assumptions(self, prompt: str) -> List[str]:
        lowered = prompt.lower()
        if "attendance" in lowered:
            return [
                "Teachers can mark attendance for assigned courses only",
                "Students have read-only access to their own attendance records",
                "Attendance records are stored per course session date"
            ]
        return [
            "Authenticated session context is available for all privileged requests",
            "Non-destructive schema migrations are permitted in current environment",
            "Client optimistic updates will roll back on server API error"
        ]

    def _build_technical_plan(
        self,
        prompt: str,
        project_language: Optional[str] = None,
        project_framework: Optional[str] = None,
        detected_database: Optional[str] = None,
        test_framework: Optional[str] = None,
    ) -> TechnicalPlan:
        fe = project_framework or "React + TypeScript + Tailwind CSS"
        be = "FastAPI async router" if project_language == "Python" else "FastAPI / Node async service"
        db = detected_database or "PostgreSQL / SQLite via SQLAlchemy"
        test = test_framework or "Pytest API integration tests + Vitest frontend unit tests"

        notes = [
            "Indexed query access for fast date/ID range filtering",
            "Strict Pydantic / TypeScript type validations on incoming payloads",
            "Atomic transactions to prevent partial writes during state mutations"
        ]

        return TechnicalPlan(
            frontend=f"{fe} (Interactive tables, status pills, and reactive forms)",
            backend=f"{be} with structured request validation and error handlers",
            database=f"{db} with foreign keys and unique constraints",
            testing=f"{test}",
            architectureNotes=notes,
        )

    def _generate_acceptance_criteria(self, prompt: str, requirements: List[str]) -> List[AcceptanceCriteriaItem]:
        criteria = []
        if requirements:
            for idx, req in enumerate(requirements[:4]):
                clean_text = re.sub(r"^Implement\s+", "", req, flags=re.IGNORECASE)
                criteria.append(AcceptanceCriteriaItem(
                    id=f"ac-{idx + 1}",
                    text=f"System successfully supports: {clean_text}",
                    completed=False
                ))
        else:
            criteria = [
                AcceptanceCriteriaItem(id="ac-1", text=f"Feature satisfies core prompt requirements: {prompt}", completed=False),
                AcceptanceCriteriaItem(id="ac-2", text="All unit and integration regression tests pass cleanly", completed=False),
                AcceptanceCriteriaItem(id="ac-3", text="State persistence succeeds across restarts without data loss", completed=False)
            ]
        return criteria


prompt_compiler = PromptCompiler()
