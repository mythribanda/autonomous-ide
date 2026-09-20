import re
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Dict, Set, Optional, Tuple, Any
from collections import defaultdict

from sqlalchemy import select, delete

from backend.database import AsyncSessionLocal
from backend.models.project import AgentMemory
from backend.schemas import (
    FileAnalysis,
    ProjectScanResult,
    GraphNode,
    GraphEdge,
    KnowledgeGraphResult,
    FileContext,
)
from backend.services.ast_analyzer import ast_analyzer
from backend.services.cache_service import cache_service

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "cannot", "could", "did", "do", "does", "doing", "down", "during", "each",
    "few", "for", "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself",
    "let", "me", "more", "most", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
    "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
    "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
    "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
    "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
}

class KnowledgeGraph:
    """
    Constructs and queries the project knowledge graph, connecting files, functions,
    classes, components, API routes, and database models. Provides graph-informed
    semantic context retrieval and architectural summaries.
    """

    def _norm_path(self, p: str, base_dir: Path) -> str:
        """Normalize file path to a relative forward-slash path relative to base_dir if possible."""
        try:
            path_obj = Path(p).resolve()
            rel = path_obj.relative_to(base_dir).as_posix()
            return rel
        except Exception:
            return Path(p).as_posix()

    def _resolve_import_target(
        self,
        importing_file: str,
        import_module: str,
        known_files: Dict[str, FileAnalysis],
        proj_root: Path
    ) -> Optional[str]:
        """
        Resolves an imported module string to a known project file path.
        Handles relative imports (JS/TS and Python) and module paths.
        """
        importing_dir = (proj_root / importing_file).parent

        # 1. JS/TS Relative imports (./foo, ../foo)
        if import_module.startswith("."):
            candidate_base = (importing_dir / import_module).resolve()
            candidates = [
                candidate_base,
                candidate_base.with_suffix(".ts"),
                candidate_base.with_suffix(".tsx"),
                candidate_base.with_suffix(".js"),
                candidate_base.with_suffix(".jsx"),
                candidate_base / "index.ts",
                candidate_base / "index.tsx",
                candidate_base / "index.js",
                candidate_base.with_suffix(".py"),
                candidate_base / "__init__.py"
            ]
            for cand in candidates:
                cand_rel = self._norm_path(str(cand), proj_root)
                if cand_rel in known_files:
                    return cand_rel

        # 2. Python module style (e.g. backend.services.ast_analyzer or routers.projects)
        if "." in import_module and not import_module.startswith("."):
            parts = import_module.split(".")
            candidate_path = proj_root.joinpath(*parts)
            for cand in [candidate_path.with_suffix(".py"), candidate_path / "__init__.py"]:
                cand_rel = self._norm_path(str(cand), proj_root)
                if cand_rel in known_files:
                    return cand_rel

        # 3. Direct path or root-relative (e.g. src/App or backend/main)
        direct_base = (proj_root / import_module).resolve()
        for cand in [
            direct_base,
            direct_base.with_suffix(".ts"),
            direct_base.with_suffix(".tsx"),
            direct_base.with_suffix(".js"),
            direct_base.with_suffix(".jsx"),
            direct_base / "index.ts",
            direct_base / "index.tsx",
            direct_base.with_suffix(".py")
        ]:
            cand_rel = self._norm_path(str(cand), proj_root)
            if cand_rel in known_files:
                return cand_rel

        # 4. Check if import_module matches stem of any known file path (e.g. 'ast_analyzer' -> 'backend/services/ast_analyzer.py')
        for kf in known_files:
            stem = Path(kf).stem
            if stem == import_module:
                return kf

        return None

    def build_graph(
        self,
        project_path: str,
        file_analyses: List[FileAnalysis],
        scan_result: Optional[ProjectScanResult] = None
    ) -> KnowledgeGraphResult:
        """
        Builds graph nodes and edges from file analyses and optionally a ProjectScanResult.
        """
        proj_root = Path(project_path).resolve()
        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []
        node_ids: Set[str] = set()
        edge_keys: Set[Tuple[str, str, str]] = set()

        def add_node(node: GraphNode):
            if node.id not in node_ids:
                node_ids.add(node.id)
                nodes.append(node)

        def add_edge(from_id: str, to_id: str, edge_type: str):
            key = (from_id, to_id, edge_type)
            if key not in edge_keys:
                edge_keys.add(key)
                edges.append(GraphEdge(from_id=from_id, to_id=to_id, type=edge_type))

        # Index file analyses by normalized relative path
        norm_analyses: Dict[str, FileAnalysis] = {}
        for fa in file_analyses:
            norm_fp = self._norm_path(fa.file_path, proj_root)
            norm_analyses[norm_fp] = fa

        # Map of exported symbols for cross-file call resolution: symbol_name -> list of (file_path, symbol_type)
        exported_symbols: Dict[str, List[Tuple[str, str]]] = defaultdict(list)

        # 1. Create File and Internal Symbol Nodes
        for norm_fp, fa in norm_analyses.items():
            # File Node
            file_meta = {
                "language": fa.language,
                "complexity_score": fa.complexity_score,
                "functions_count": len(fa.functions),
                "classes_count": len(fa.classes),
                "components_count": len(fa.components),
                "routes_count": len(fa.api_routes)
            }
            add_node(GraphNode(
                id=norm_fp,
                type="file",
                name=Path(norm_fp).name,
                file_path=norm_fp,
                metadata=file_meta
            ))

            # Function Nodes
            for fn in fa.functions:
                fn_id = f"{norm_fp}::{fn.name}"
                fn_meta = {
                    "line_start": fn.line_start,
                    "line_end": fn.line_end,
                    "parameters": fn.parameters,
                    "is_async": fn.is_async,
                    "is_exported": fn.is_exported
                }
                add_node(GraphNode(
                    id=fn_id,
                    type="function",
                    name=fn.name,
                    file_path=norm_fp,
                    metadata=fn_meta
                ))
                add_edge(norm_fp, fn_id, "defines")
                if fn.is_exported or fn.name in fa.exports:
                    exported_symbols[fn.name].append((norm_fp, "function"))

            # Class / Database Model Nodes
            is_model_file = any(part in norm_fp.lower() for part in ("models/", "model.py", "entities/", "entity.py", "tables/"))
            for cls in fa.classes:
                cls_id = f"{norm_fp}::{cls.name}"
                extends_base = cls.extends or ""
                is_pydantic = "basemodel" in extends_base.lower()
                is_orm = any(base in extends_base for base in ("Base", "DeclarativeBase", "Document", "Entity", "db.Model"))
                is_db_model = not is_pydantic and (is_model_file or is_orm)
                node_type = "database_model" if is_db_model else "class"
                cls_meta = {
                    "line_start": cls.line_start,
                    "line_end": cls.line_end,
                    "methods": cls.methods,
                    "extends": cls.extends
                }
                add_node(GraphNode(
                    id=cls_id,
                    type=node_type,
                    name=cls.name,
                    file_path=norm_fp,
                    metadata=cls_meta
                ))
                add_edge(norm_fp, cls_id, "defines")
                exported_symbols[cls.name].append((norm_fp, node_type))

                if cls.extends:
                    add_edge(cls_id, cls.extends, "extends")

            # Component Nodes (React / UI)
            for comp in fa.components:
                comp_id = f"{norm_fp}::{comp}"
                add_node(GraphNode(
                    id=comp_id,
                    type="component",
                    name=comp,
                    file_path=norm_fp,
                    metadata={}
                ))
                add_edge(norm_fp, comp_id, "defines")
                exported_symbols[comp].append((norm_fp, "component"))

            # API Route Nodes
            for r in fa.api_routes:
                route_id = f"{norm_fp}::{r.method}:{r.path}"
                route_meta = {
                    "method": r.method,
                    "path": r.path,
                    "handler_name": r.handler_name,
                    "line": r.line
                }
                add_node(GraphNode(
                    id=route_id,
                    type="api_route",
                    name=f"{r.method} {r.path}",
                    file_path=norm_fp,
                    metadata=route_meta
                ))
                add_edge(norm_fp, route_id, "defines_route")
                if r.handler_name:
                    add_edge(route_id, f"{norm_fp}::{r.handler_name}", "calls")

        # 2. Build Dependency and Cross-File Edges from Imports
        for norm_fp, fa in norm_analyses.items():
            for imp in fa.imports:
                target_fp = self._resolve_import_target(norm_fp, imp.module, norm_analyses, proj_root)
                if target_fp and target_fp != norm_fp:
                    # Edge between files
                    add_edge(norm_fp, target_fp, "imports")

                    # Check imported symbol references
                    for sym_name in imp.names:
                        target_fa = norm_analyses.get(target_fp)
                        if target_fa:
                            # Component rendering
                            if sym_name in target_fa.components:
                                add_edge(norm_fp, f"{target_fp}::{sym_name}", "renders")
                            # Function call
                            elif any(f.name == sym_name for f in target_fa.functions):
                                add_edge(norm_fp, f"{target_fp}::{sym_name}", "calls")
                            # Class/Model dependency
                            elif any(c.name == sym_name for c in target_fa.classes):
                                add_edge(norm_fp, f"{target_fp}::{sym_name}", "depends_on")

        # Generate human-readable architectural summary
        summary = self.generate_project_summary(
            graph=KnowledgeGraphResult(nodes=nodes, edges=edges, summary=""),
            scan_result=scan_result
        )

        return KnowledgeGraphResult(nodes=nodes, edges=edges, summary=summary)

    def _tokenize(self, text: str) -> List[str]:
        """Tokenizes and decompounds text into lowercase keywords without stop words."""
        raw_tokens = re.findall(r"[A-Za-z0-9_]+", text)
        keywords = set()

        for tok in raw_tokens:
            tok_clean = tok.strip("_").lower()
            if not tok_clean or tok_clean in STOP_WORDS or len(tok_clean) < 2:
                continue
            keywords.add(tok_clean)

            # Decompound camelCase: 'getProjectScan' -> ['get', 'project', 'scan']
            camel_parts = re.findall(r"[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z][a-z]|\b)", tok)
            for cp in camel_parts:
                cpl = cp.lower()
                if cpl not in STOP_WORDS and len(cpl) >= 2:
                    keywords.add(cpl)

            # Decompound snake_case: 'project_scanner' -> ['project', 'scanner']
            snake_parts = tok.split("_")
            for sp in snake_parts:
                spl = sp.lower()
                if spl not in STOP_WORDS and len(spl) >= 2:
                    keywords.add(spl)

        return list(keywords)

    def get_relevant_context(
        self,
        requirement: str,
        graph: KnowledgeGraphResult,
        max_files: int = 8,
        project_path: Optional[str] = None
    ) -> List[FileContext]:
        """
        Performs semantic retrieval:
        1. Tokenizes requirement into keywords
        2. Scores each file by keyword matches across filenames, function/class names, routes
        3. Follows dependency edges to propagate relevance
        4. Returns top max_files FileContext objects
        """
        keywords = self._tokenize(requirement)
        if not keywords:
            keywords = [requirement.strip().lower()[:20]]

        file_nodes: Dict[str, GraphNode] = {}
        nodes_by_file: Dict[str, List[GraphNode]] = defaultdict(list)
        for n in graph.nodes:
            if n.type == "file":
                file_nodes[n.file_path] = n
            nodes_by_file[n.file_path].append(n)

        # Base scoring per file
        file_scores: Dict[str, float] = defaultdict(float)
        file_reasons: Dict[str, List[str]] = defaultdict(list)

        for fp, nodes in nodes_by_file.items():
            path_lower = fp.lower()
            fname_lower = Path(fp).name.lower()

            # 1. Match file name and path
            for kw in keywords:
                if kw in fname_lower:
                    file_scores[fp] += 4.0
                    file_reasons[fp].append(f"Filename matches keyword '{kw}'")
                elif kw in path_lower:
                    file_scores[fp] += 1.5
                    file_reasons[fp].append(f"Path matches keyword '{kw}'")

            # 2. Match symbols inside file
            for node in nodes:
                node_name_lower = node.name.lower()
                for kw in keywords:
                    if kw in node_name_lower:
                        if node.type == "api_route":
                            file_scores[fp] += 5.0
                            file_reasons[fp].append(f"Route '{node.name}' matches '{kw}'")
                        elif node.type == "database_model":
                            file_scores[fp] += 3.5
                            file_reasons[fp].append(f"Model '{node.name}' matches '{kw}'")
                        elif node.type == "component":
                            file_scores[fp] += 3.0
                            file_reasons[fp].append(f"Component '{node.name}' matches '{kw}'")
                        elif node.type in ("function", "class"):
                            file_scores[fp] += 2.5
                            file_reasons[fp].append(f"{node.type.capitalize()} '{node.name}' matches '{kw}'")

        # 3. Follow Dependency Edges (Graph Neighborhood Propagation)
        propagation_scores: Dict[str, float] = defaultdict(float)
        propagation_reasons: Dict[str, List[str]] = defaultdict(list)

        for edge in graph.edges:
            from_file = edge.from_id.split("::")[0]
            to_file = edge.to_id.split("::")[0]

            if from_file in file_scores and from_file != to_file:
                source_score = file_scores[from_file]
                if source_score > 0 and to_file in file_nodes:
                    boost = source_score * 0.35
                    propagation_scores[to_file] += boost
                    propagation_reasons[to_file].append(
                        f"Imported by '{from_file}' ({edge.type})"
                    )

            if to_file in file_scores and from_file != to_file:
                target_score = file_scores[to_file]
                if target_score > 0 and from_file in file_nodes:
                    boost = target_score * 0.20
                    propagation_scores[from_file] += boost
                    propagation_reasons[from_file].append(
                        f"Imports '{to_file}' ({edge.type})"
                    )

        # Combine scores
        all_candidate_files = set(file_scores.keys()) | set(propagation_scores.keys())
        total_scores: Dict[str, float] = {}
        for fp in all_candidate_files:
            total_scores[fp] = file_scores[fp] + propagation_scores[fp]

        # Rank files
        sorted_files = sorted(
            [fp for fp in all_candidate_files if total_scores[fp] > 0],
            key=lambda x: total_scores[x],
            reverse=True
        )[:max_files]

        if not sorted_files:
            sorted_files = list(file_nodes.keys())[:max_files]

        results: List[FileContext] = []
        for fp in sorted_files:
            score = total_scores.get(fp, 0.5)

            # Compile concise reason
            reasons = file_reasons.get(fp, []) + propagation_reasons.get(fp, [])
            seen_r = set()
            clean_reasons = []
            for r in reasons:
                if r not in seen_r:
                    seen_r.add(r)
                    clean_reasons.append(r)
            reason_str = "; ".join(clean_reasons[:3]) if clean_reasons else "Identified via project knowledge graph"

            # Generate content snippet
            snippet = self._generate_content_snippet(fp, project_path, nodes_by_file.get(fp, []))

            results.append(FileContext(
                file_path=fp,
                relevance_score=round(score, 3),
                content_snippet=snippet,
                reason=reason_str
            ))

        return results

    def _generate_content_snippet(
        self,
        file_path: str,
        project_path: Optional[str],
        file_nodes: List[GraphNode],
        max_lines: int = 35
    ) -> str:
        """Reads file excerpt from disk or constructs summary snippet from graph nodes."""
        if project_path:
            full_path = Path(project_path) / file_path
            if full_path.exists() and full_path.is_file():
                try:
                    lines = full_path.read_text(encoding="utf-8", errors="replace").splitlines()
                    excerpt = "\n".join(lines[:max_lines])
                    if len(lines) > max_lines:
                        excerpt += f"\n... [{len(lines) - max_lines} more lines]"
                    return excerpt
                except Exception:
                    pass

        # Fallback snippet from symbols
        symbols_summary = [f"# File: {file_path}"]
        functions = [n.name for n in file_nodes if n.type == "function"]
        classes = [n.name for n in file_nodes if n.type == "class"]
        components = [n.name for n in file_nodes if n.type == "component"]
        routes = [n.name for n in file_nodes if n.type == "api_route"]
        models = [n.name for n in file_nodes if n.type == "database_model"]

        if routes:
            symbols_summary.append(f"# Routes: {', '.join(routes)}")
        if components:
            symbols_summary.append(f"# Components: {', '.join(components)}")
        if models:
            symbols_summary.append(f"# Models: {', '.join(models)}")
        if classes:
            symbols_summary.append(f"# Classes: {', '.join(classes)}")
        if functions:
            symbols_summary.append(f"# Functions: {', '.join(functions[:10])}")

        return "\n".join(symbols_summary)

    def generate_project_summary(
        self,
        graph: KnowledgeGraphResult,
        scan_result: Optional[ProjectScanResult] = None
    ) -> str:
        """
        Generates a 5-10 sentence human-readable architecture summary.
        """
        file_nodes = [n for n in graph.nodes if n.type == "file"]
        comp_nodes = [n for n in graph.nodes if n.type == "component"]
        route_nodes = [n for n in graph.nodes if n.type == "api_route"]
        model_nodes = [n for n in graph.nodes if n.type == "database_model"]
        func_nodes = [n for n in graph.nodes if n.type == "function"]
        class_nodes = [n for n in graph.nodes if n.type == "class"]
        import_edges = [e for e in graph.edges if e.type == "imports"]
        call_edges = [e for e in graph.edges if e.type == "calls"]

        languages = ", ".join(scan_result.languages[:3]) if scan_result and scan_result.languages else "TypeScript and Python"
        frameworks = ", ".join(scan_result.frameworks[:3]) if scan_result and scan_result.frameworks else "React and FastAPI"
        pkg_manager = scan_result.package_manager if scan_result and scan_result.package_manager else "npm"
        entry_points = ", ".join(scan_result.entry_points[:2]) if scan_result and scan_result.entry_points else "src/main.tsx and backend/main.py"
        detected_db = scan_result.detected_database if scan_result and scan_result.detected_database else "SQLite"
        api_style = scan_result.api_style if scan_result and scan_result.api_style else "REST"

        s1 = f"This is a {frameworks} application built with {languages} using {pkg_manager}."
        s2 = f"The primary entry points are {entry_points}."
        s3 = (
            f"The codebase contains {len(file_nodes)} analyzed files comprising "
            f"{len(comp_nodes)} UI components, {len(route_nodes)} {api_style} API routes, "
            f"and {len(func_nodes)} functions across {len(class_nodes)} classes."
        )

        if comp_nodes:
            top_comps = ", ".join([c.name for c in comp_nodes[:4]])
            s4 = f"The frontend is structured around a component-driven architecture featuring components such as {top_comps}."
        else:
            s4 = "The frontend follows modern modular practices with typed client-side application logic."

        if route_nodes:
            s5 = f"The backend provides a modular {api_style} service architecture with {len(route_nodes)} exposed endpoints."
        else:
            s5 = "The backend service layer is organized into structured API routers and background execution services."

        if model_nodes:
            models_list = ", ".join([m.name for m in model_nodes[:4]])
            s6 = f"Data persistence is managed using {detected_db} with entity models including {models_list}."
        else:
            s6 = f"Data persistence and agent state management utilize {detected_db}."

        s7 = (
            f"Project interdependencies form a connected graph of {len(import_edges)} cross-file imports "
            f"and {len(call_edges)} verified inter-module invocations."
        )
        s8 = "The architecture separates client presentation, server coordination, and agentic workflows to enable clean reasoning and rapid maintenance."

        return " ".join([s1, s2, s3, s4, s5, s6, s7, s8])

    async def update_for_files(
        self,
        project_id: str,
        changed_files: List[str],
        graph: KnowledgeGraphResult,
        project_path: Optional[str] = None
    ) -> KnowledgeGraphResult:
        """
        Incrementally updates the KnowledgeGraph by re-analyzing ONLY changed files,
        removing obsolete nodes and edges, adding new symbols, and returning the updated graph.
        """
        proj_root = Path(project_path).resolve() if project_path else Path(".").resolve()
        norm_changed = set()
        for f in changed_files:
            rel = self._norm_path(f, proj_root)
            norm_changed.add(rel)

        # 1. Filter out stale nodes and edges associated with the changed files
        remaining_nodes = [
            n for n in graph.nodes
            if self._norm_path(n.file_path, proj_root) not in norm_changed
            and not any(n.id.startswith(f"{cf}::") or n.id == cf for cf in norm_changed)
        ]

        # Keep edges where neither source nor target is a stale node
        stale_node_ids = {
            n.id for n in graph.nodes
            if self._norm_path(n.file_path, proj_root) in norm_changed
            or any(n.id.startswith(f"{cf}::") or n.id == cf for cf in norm_changed)
        }
        remaining_edges = [
            e for e in graph.edges
            if e.source not in stale_node_ids and e.target not in stale_node_ids
        ]

        # 2. Re-analyze changed files using ast_analyzer
        new_analyses: Dict[str, FileAnalysis] = {}
        for cf in changed_files:
            full_p = proj_root / cf if not Path(cf).is_absolute() else Path(cf)
            if full_p.exists() and full_p.is_file():
                try:
                    fa = ast_analyzer.analyze_file(str(full_p))
                    rel_p = self._norm_path(str(full_p), proj_root)
                    new_analyses[rel_p] = fa
                except Exception:
                    pass

        # 3. Build sub-graph for updated files
        if new_analyses:
            sub_graph = self.build_graph(new_analyses, proj_root=proj_root)
            # Merge nodes & edges without duplicate IDs
            existing_node_ids = {n.id for n in remaining_nodes}
            for n in sub_graph.nodes:
                if n.id not in existing_node_ids:
                    remaining_nodes.append(n)
                    existing_node_ids.add(n.id)

            existing_edge_keys = {(e.source, e.target, e.type) for e in remaining_edges}
            for e in sub_graph.edges:
                edge_key = (e.source, e.target, e.type)
                if edge_key not in existing_edge_keys:
                    remaining_edges.append(e)
                    existing_edge_keys.add(edge_key)

        updated_graph = KnowledgeGraphResult(
            nodes=remaining_nodes,
            edges=remaining_edges,
            total_nodes=len(remaining_nodes),
            total_edges=len(remaining_edges),
            summary=graph.summary
        )
        cache_service.set_knowledge_graph(project_id, updated_graph)
        return updated_graph


knowledge_graph = KnowledgeGraph()



class ProjectMemory:
    """
    Project Memory System:
    Persists architectural decisions, bug fixes, requirements, and codebase knowledge
    across sessions. Integrates directly with the autonomous agent execution cycle.
    """

    def __init__(self):
        pass

    @staticmethod
    def _extract_keywords(text: str) -> Set[str]:
        """Tokenizes text into lowercase alphanumeric keywords excluding stop words."""
        if not text:
            return set()
        tokens = re.findall(r"[a-zA-Z0-9_\-]+", text.lower())
        return {t for t in tokens if len(t) > 2 and t not in STOP_WORDS}

    @staticmethod
    def _serialize_content(summary: str, details: Dict[str, Any]) -> str:
        """Serializes memory data as JSON with a fallback readable summary."""
        payload = {
            "summary": summary,
            **details
        }
        return json.dumps(payload, ensure_ascii=False)

    @staticmethod
    def parse_memory(memory: AgentMemory) -> Dict[str, Any]:
        """Parses an AgentMemory record into a unified dictionary format."""
        raw = memory.content or ""
        created_iso = memory.created_at.isoformat() if memory.created_at else ""

        # Try parsing JSON payload
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return {
                    "id": memory.id,
                    "project_id": memory.project_id,
                    "memory_type": memory.memory_type,
                    "created_at": created_iso,
                    "summary": parsed.get("summary", raw),
                    "tags": parsed.get("tags", []),
                    "task_id": parsed.get("task_id"),
                    "details": parsed
                }
        except Exception:
            pass

        # Plain text fallback
        return {
            "id": memory.id,
            "project_id": memory.project_id,
            "memory_type": memory.memory_type,
            "created_at": created_iso,
            "summary": raw,
            "tags": [memory.memory_type],
            "task_id": None,
            "details": {"summary": raw}
        }

    async def store_architecture_decision(
        self,
        project_id: str,
        decision: str,
        context: str,
        task_id: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> AgentMemory:
        """
        Stores an architectural decision.
        Example: "We chose to use Zustand over Redux because [context]"
        """
        summary = f"Decision: {decision}"
        if context:
            summary += f" — Context: {context}"

        def_tags = tags or ["architecture", "decision"]
        if "architecture" not in def_tags:
            def_tags.append("architecture")

        content_str = self._serialize_content(summary, {
            "decision": decision,
            "context": context,
            "task_id": task_id,
            "tags": def_tags
        })

        async with AsyncSessionLocal() as session:
            mem = AgentMemory(
                project_id=project_id,
                memory_type="decision",
                content=content_str,
                created_at=datetime.now(timezone.utc)
            )
            session.add(mem)
            await session.commit()
            await session.refresh(mem)

        await self.prune_old_memories(project_id, keep_last_n=100, memory_type="decision")
        return mem

    async def store_bug_fix(
        self,
        project_id: str,
        bug: str,
        fix: str,
        affected_files: Optional[List[str]] = None,
        task_id: Optional[str] = None
    ) -> AgentMemory:
        """
        Stores a diagnosed and resolved bug fix with affected files.
        Example: "Fixed null pointer in auth middleware by adding null check before user lookup"
        """
        summary = f"Fixed: {bug} — Resolution: {fix}"
        content_str = self._serialize_content(summary, {
            "bug": bug,
            "fix": fix,
            "affected_files": affected_files or [],
            "task_id": task_id,
            "tags": ["bugfix", "recovery"]
        })

        async with AsyncSessionLocal() as session:
            mem = AgentMemory(
                project_id=project_id,
                memory_type="bug",
                content=content_str,
                created_at=datetime.now(timezone.utc)
            )
            session.add(mem)
            await session.commit()
            await session.refresh(mem)

        await self.prune_old_memories(project_id, keep_last_n=100, memory_type="bug")
        return mem

    async def store_requirement(
        self,
        project_id: str,
        requirement: str,
        spec: Any,
        task_id: Optional[str] = None
    ) -> AgentMemory:
        """Stores a completed requirement specification."""
        intent = "feature"
        acceptance = []
        if hasattr(spec, "intent") and spec.intent:
            intent = spec.intent
        elif isinstance(spec, dict) and spec.get("intent"):
            intent = spec["intent"]

        if hasattr(spec, "acceptance_criteria") and spec.acceptance_criteria:
            acceptance = list(spec.acceptance_criteria)
        elif isinstance(spec, dict) and spec.get("acceptance_criteria"):
            acceptance = spec["acceptance_criteria"]

        summary = f"Completed Requirement: {requirement[:120]}"
        content_str = self._serialize_content(summary, {
            "requirement": requirement,
            "intent": intent,
            "acceptance_criteria": acceptance,
            "task_id": task_id,
            "tags": ["requirement", intent]
        })

        async with AsyncSessionLocal() as session:
            mem = AgentMemory(
                project_id=project_id,
                memory_type="requirement",
                content=content_str,
                created_at=datetime.now(timezone.utc)
            )
            session.add(mem)
            await session.commit()
            await session.refresh(mem)

        await self.prune_old_memories(project_id, keep_last_n=100, memory_type="requirement")
        return mem

    async def get_relevant_memories(
        self,
        project_id: str,
        query: str,
        limit: int = 5
    ) -> List[AgentMemory]:
        """
        Scores memories by keyword match against query and recency.
        Returns top relevant AgentMemory records.
        """
        async with AsyncSessionLocal() as session:
            stmt = (
                select(AgentMemory)
                .where(AgentMemory.project_id == project_id)
                .order_by(AgentMemory.created_at.desc())
            )
            res = await session.execute(stmt)
            all_memories = list(res.scalars().all())

        if not all_memories:
            return []

        query_keywords = self._extract_keywords(query)
        if not query_keywords:
            return all_memories[:limit]

        scored: List[Tuple[float, AgentMemory]] = []
        for mem in all_memories:
            parsed = self.parse_memory(mem)
            content_text = (
                f"{parsed.get('summary', '')} "
                f"{' '.join(parsed.get('tags', []))} "
                f"{json.dumps(parsed.get('details', {}))}"
            ).lower()

            mem_keywords = self._extract_keywords(content_text)
            overlap = query_keywords.intersection(mem_keywords)
            score = float(len(overlap) * 10)

            # Bonus for tag match
            tags_lower = [t.lower() for t in parsed.get("tags", [])]
            for kw in query_keywords:
                if kw in tags_lower:
                    score += 5.0
                if kw in (mem.memory_type or "").lower():
                    score += 3.0

            # Direct substring matches in summary
            summary_lower = parsed.get("summary", "").lower()
            for kw in query_keywords:
                if kw in summary_lower:
                    score += 2.0

            scored.append((score, mem))

        # Sort descending by score; if scores tied, newer memories take precedence
        scored.sort(key=lambda item: item[0], reverse=True)

        # Filter memories that have at least some relevance, or fallback to top recents
        relevant = [m for s, m in scored if s > 0]
        if not relevant:
            return all_memories[:limit]

        return relevant[:limit]

    async def get_architecture_summary(self, project_id: str) -> str:
        """
        Combines: knowledge graph base summary + architecture decisions + important bug fixes.
        Returns a comprehensive project context string for priming new agent tasks.
        """
        async with AsyncSessionLocal() as session:
            # 1. Base architecture summary
            stmt_arch = (
                select(AgentMemory)
                .where(AgentMemory.project_id == project_id)
                .where(AgentMemory.memory_type == "architecture")
                .order_by(AgentMemory.created_at.desc())
                .limit(1)
            )
            res_arch = await session.execute(stmt_arch)
            arch_mem = res_arch.scalars().first()

            # 2. Decisions
            stmt_dec = (
                select(AgentMemory)
                .where(AgentMemory.project_id == project_id)
                .where(AgentMemory.memory_type == "decision")
                .order_by(AgentMemory.created_at.desc())
                .limit(5)
            )
            res_dec = await session.execute(stmt_dec)
            decisions = list(res_dec.scalars().all())

            # 3. Bug fixes
            stmt_bugs = (
                select(AgentMemory)
                .where(AgentMemory.project_id == project_id)
                .where(AgentMemory.memory_type == "bug")
                .order_by(AgentMemory.created_at.desc())
                .limit(5)
            )
            res_bugs = await session.execute(stmt_bugs)
            bug_fixes = list(res_bugs.scalars().all())

        sections: List[str] = []

        # System Architecture
        if arch_mem and arch_mem.content:
            parsed_arch = self.parse_memory(arch_mem)
            sections.append(f"### Codebase Architecture:\n{parsed_arch.get('summary', '')}")
        else:
            sections.append("### Codebase Architecture:\nStandard modular full-stack application structure.")

        # Key Architecture Decisions
        if decisions:
            dec_lines = []
            for d in decisions:
                p = self.parse_memory(d)
                dec_lines.append(f"- {p.get('summary')}")
            sections.append("### Architectural Decisions & Standards:\n" + "\n".join(dec_lines))

        # Important Resolved Bugs & Pitfalls
        if bug_fixes:
            bug_lines = []
            for b in bug_fixes:
                p = self.parse_memory(b)
                bug_lines.append(f"- {p.get('summary')}")
            sections.append("### Previously Resolved Issues & Pitfalls to Avoid:\n" + "\n".join(bug_lines))

        return "\n\n".join(sections)

    async def prune_old_memories(
        self,
        project_id: str,
        keep_last_n: int = 100,
        memory_type: Optional[str] = None
    ):
        """Keeps only the most recent N memories per type per project."""
        types_to_check = [memory_type] if memory_type else ["architecture", "decision", "bug", "requirement"]

        async with AsyncSessionLocal() as session:
            for m_type in types_to_check:
                # Find all IDs ordered by date desc
                stmt = (
                    select(AgentMemory.id)
                    .where(AgentMemory.project_id == project_id)
                    .where(AgentMemory.memory_type == m_type)
                    .order_by(AgentMemory.created_at.desc())
                )
                res = await session.execute(stmt)
                all_ids = [row[0] for row in res.fetchall()]

                if len(all_ids) > keep_last_n:
                    ids_to_delete = all_ids[keep_last_n:]
                    del_stmt = delete(AgentMemory).where(AgentMemory.id.in_(ids_to_delete))
                    await session.execute(del_stmt)

            await session.commit()

    async def get_all_memories_grouped(self, project_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """Returns all memories for a project grouped by type with formatted metadata."""
        async with AsyncSessionLocal() as session:
            stmt = (
                select(AgentMemory)
                .where(AgentMemory.project_id == project_id)
                .order_by(AgentMemory.created_at.desc())
            )
            res = await session.execute(stmt)
            memories = list(res.scalars().all())

        grouped: Dict[str, List[Dict[str, Any]]] = {
            "architecture": [],
            "decision": [],
            "bug": [],
            "requirement": []
        }

        for m in memories:
            m_type = m.memory_type or "architecture"
            if m_type not in grouped:
                grouped[m_type] = []
            grouped[m_type].append(self.parse_memory(m))

        return grouped

    async def delete_memory(self, memory_id: str, project_id: Optional[str] = None) -> bool:
        """Deletes a specific memory entry."""
        async with AsyncSessionLocal() as session:
            stmt = delete(AgentMemory).where(AgentMemory.id == memory_id)
            if project_id:
                stmt = stmt.where(AgentMemory.project_id == project_id)
            await session.execute(stmt)
            await session.commit()
            return True


project_memory = ProjectMemory()

