import re
from pathlib import Path
from typing import List, Set, Dict, Optional, Tuple
from fnmatch import fnmatch

from backend.schemas import (
    FileContext,
    KnowledgeGraphResult,
    GraphNode,
    GraphEdge,
    ImpactReport,
)

TEST_PATTERNS = [
    "*.test.ts", "*.test.tsx", "*.test.js", "*.test.jsx",
    "*.spec.ts", "*.spec.tsx", "*.spec.js", "*.spec.jsx",
    "test_*.py", "*_test.py"
]

RISK_KEYWORDS = {
    "database": "Database operations mentioned in requirement",
    "schema": "Database or model schema modification mentioned",
    "migration": "Database migration indicated in requirement",
    "auth": "Authentication or authorization logic mentioned",
    "security": "Security mechanisms or policies mentioned",
    "deploy": "Deployment or infrastructure configuration mentioned",
    "credential": "Sensitive credentials or secrets referenced",
    "token": "Authentication token management referenced"
}

AUTH_SECURITY_INDICATORS = ["auth", "security", "permission", "token", "secret", "credential", "session"]

class ImpactAnalyzer:
    """
    Predicts what files, API routes, components, and database models could be affected
    before the agent executes code modifications, and assesses execution risk.
    """

    def analyze_impact(
        self,
        requirement: str,
        relevant_files: List[FileContext],
        graph: KnowledgeGraphResult,
        project_path: Optional[str] = None
    ) -> ImpactReport:
        """
        Analyzes the blast radius of a requirement:
        - directly_affected_files
        - transitively_affected_files (files importing or calling directly affected code)
        - affected_api_routes
        - affected_components
        - affected_database_models
        - tests_to_run
        - risk_level ("low" | "medium" | "high")
        - risk_reasons
        - estimated_files_to_change
        """
        # 1. Determine Directly Affected Files
        directly_affected: List[str] = []
        if relevant_files:
            # Sort relevant files by score descending
            sorted_rf = sorted(relevant_files, key=lambda x: x.relevance_score, reverse=True)
            # Pick files that have high score or top candidates
            top_score = sorted_rf[0].relevance_score
            for rf in sorted_rf:
                # Include if score is at least 30% of top score or score >= 1.0 (max 5)
                if (rf.relevance_score >= 1.0 or rf.relevance_score >= top_score * 0.3) and len(directly_affected) < 5:
                    if rf.file_path not in directly_affected:
                        directly_affected.append(rf.file_path)
            if not directly_affected and sorted_rf:
                directly_affected.append(sorted_rf[0].file_path)

        directly_set = set(directly_affected)
        estimated_files = len(directly_affected)

        # 2. Determine Transitively Affected Files (files that import or call directly affected ones)
        transitively_set: Set[str] = set()
        incoming_reasons: Dict[str, str] = {}

        for edge in graph.edges:
            from_file = edge.from_id.split("::")[0]
            to_file = edge.to_id.split("::")[0]

            if to_file in directly_set and from_file not in directly_set:
                transitively_set.add(from_file)
                incoming_reasons[from_file] = f"{from_file} ({edge.type} -> {to_file})"

        transitively_affected = sorted(list(transitively_set))
        all_affected_files = directly_set | transitively_set

        # 3. Determine Affected API Routes
        affected_routes_set: Set[str] = set()
        for node in graph.nodes:
            if node.type == "api_route":
                if node.file_path in directly_set:
                    affected_routes_set.add(node.name)
                # Also check if route handler is in directly affected files
                handler_name = node.metadata.get("handler_name")
                if handler_name:
                    for edge in graph.edges:
                        if edge.type == "calls" and edge.from_id == node.id:
                            target_file = edge.to_id.split("::")[0]
                            if target_file in directly_set:
                                affected_routes_set.add(node.name)

        affected_api_routes = sorted(list(affected_routes_set))

        # 4. Determine Affected Components
        affected_comps_set: Set[str] = set()
        for node in graph.nodes:
            if node.type == "component":
                if node.file_path in directly_set:
                    affected_comps_set.add(node.name)
                # Also check components rendered by or rendering directly affected components
                for edge in graph.edges:
                    if edge.type == "renders":
                        from_file = edge.from_id.split("::")[0]
                        to_file = edge.to_id.split("::")[0]
                        if to_file in directly_set and node.file_path == from_file:
                            affected_comps_set.add(node.name)
                        elif from_file in directly_set and node.file_path == to_file:
                            affected_comps_set.add(node.name)

        affected_components = sorted(list(affected_comps_set))

        # 5. Determine Affected Database Models
        affected_models_set: Set[str] = set()
        for node in graph.nodes:
            if node.type == "database_model":
                if node.file_path in directly_set:
                    affected_models_set.add(node.name)
                # Also check if directly affected files depend on this model
                for edge in graph.edges:
                    if edge.type in ("depends_on", "imports") and edge.to_id.startswith(node.id):
                        from_file = edge.from_id.split("::")[0]
                        if from_file in directly_set:
                            affected_models_set.add(node.name)

        affected_database_models = sorted(list(affected_models_set))

        # 6. Determine Tests to Run
        # Find all test files in graph or project directory
        all_test_files: Set[str] = set()
        for node in graph.nodes:
            if node.type == "file":
                fname = Path(node.file_path).name
                if any(fnmatch(fname, pat) for pat in TEST_PATTERNS):
                    all_test_files.add(node.file_path)

        # Also discover test files on disk if project_path provided
        if project_path:
            p = Path(project_path)
            for pat in TEST_PATTERNS:
                try:
                    for tf in p.glob(f"**/{pat}"):
                        if "node_modules" not in tf.parts and ".git" not in tf.parts:
                            try:
                                rel = tf.resolve().relative_to(p.resolve()).as_posix()
                                all_test_files.add(rel)
                            except Exception:
                                pass
                except Exception:
                    pass

        # Select tests that import, reference, or match stems of directly affected files
        tests_to_run_set: Set[str] = set()
        directly_stems = {Path(f).stem.lower() for f in directly_affected}

        for tf in all_test_files:
            tf_stem = Path(tf).stem.lower()
            # Match naming pattern: test_foo.py or foo.test.ts for foo.py / foo.ts
            clean_tf_stem = tf_stem.replace("test_", "").replace("_test", "").replace(".test", "").replace(".spec", "")
            if clean_tf_stem in directly_stems:
                tests_to_run_set.add(tf)

            # Check if test file imports directly affected file in graph
            for edge in graph.edges:
                if edge.type == "imports" and edge.from_id == tf:
                    if edge.to_id in directly_set:
                        tests_to_run_set.add(tf)

        tests_to_run = sorted(list(tests_to_run_set))

        # 7. Risk Level Assessment
        # Criteria:
        # - low: <= 2 files, no API routes affected, no DB models affected
        # - medium: 3-7 files OR API routes affected but no schema change
        # - high: >7 files OR DB schema changes OR core auth/security files affected OR >50% of test files affected
        # Requirement keywords: "database", "schema", "migration", "auth", "security", "deploy" -> bump risk level

        risk_reasons: List[str] = []
        total_affected_count = len(all_affected_files)

        # Check for auth/security files
        auth_files = [
            f for f in directly_affected
            if any(ind in f.lower() for ind in AUTH_SECURITY_INDICATORS)
        ]

        # Check test ratio
        test_ratio = len(tests_to_run) / len(all_test_files) if all_test_files else 0.0

        # Check requirement keywords
        req_lower = requirement.lower()
        matched_keywords = []
        for kw, desc in RISK_KEYWORDS.items():
            if re.search(r"\b" + re.escape(kw) + r"\b", req_lower):
                matched_keywords.append((kw, desc))

        # Base risk calculation
        is_high = False
        is_medium = False

        if total_affected_count > 7:
            is_high = True
            risk_reasons.append(f"Large blast radius: {total_affected_count} files affected (> 7 files threshold)")
        elif total_affected_count >= 3:
            is_medium = True
            risk_reasons.append(f"Moderate blast radius: {total_affected_count} files affected (3-7 files)")
        else:
            risk_reasons.append(f"Small blast radius: {total_affected_count} file(s) affected (<= 2 files)")

        if affected_database_models:
            is_high = True
            risk_reasons.append(f"Database schema/model impact detected: {', '.join(affected_database_models)}")

        if auth_files:
            is_high = True
            risk_reasons.append(f"Core security/auth files directly affected: {', '.join(auth_files)}")

        if test_ratio > 0.5 and len(all_test_files) >= 2:
            is_high = True
            risk_reasons.append(f"Extensive test suite impact: {len(tests_to_run)} of {len(all_test_files)} tests affected (> 50%)")

        if affected_api_routes and not is_high:
            is_medium = True
            risk_reasons.append(f"API route contracts affected: {len(affected_api_routes)} endpoint(s)")

        # Keyword escalation
        for kw, desc in matched_keywords:
            risk_reasons.append(f"Risk keyword '{kw}' detected: {desc}")
            if kw in ("migration", "schema", "auth", "security"):
                is_high = True
            else:
                is_medium = True

        # Final risk level assignment
        if is_high:
            risk_level = "high"
        elif is_medium:
            risk_level = "medium"
        else:
            risk_level = "low"

        return ImpactReport(
            directly_affected_files=directly_affected,
            transitively_affected_files=transitively_affected,
            affected_api_routes=affected_api_routes,
            affected_components=affected_components,
            affected_database_models=affected_database_models,
            tests_to_run=tests_to_run,
            risk_level=risk_level,
            risk_reasons=risk_reasons,
            estimated_files_to_change=estimated_files
        )


impact_analyzer = ImpactAnalyzer()
