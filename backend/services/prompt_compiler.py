import re
import uuid
from typing import Optional, List, Dict, Any

from backend.schemas import (
    PromptSpecificationResponse,
    TechnicalPlan,
    AcceptanceCriteriaItem,
)


class PromptCompiler:
    """
    Compiles raw natural language requirement prompts into structured engineering
    specifications (PromptSpecification) with quality scoring, requirements breakdown,
    architectural plan, and acceptance criteria.
    """

    def compile(
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
