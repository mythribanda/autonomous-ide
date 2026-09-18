import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import asyncio

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete

from backend.database import get_db, AsyncSessionLocal
from backend.models.project import Project, AgentMemory
from backend.schemas import (
    ProjectOpenRequest,
    ProjectResponse,
    ProjectScanResult,
    ProjectAnalysis,
    FileAnalysis,
    AnalysisJobResponse,
    KnowledgeGraphResult,
    FileContext,
    ProjectSummaryResponse,
    ImpactReport,
    ImpactAnalysisRequest,
)
from backend.services.project_scanner import ProjectScanner
from backend.services.ast_analyzer import ast_analyzer
from backend.services.knowledge_graph import knowledge_graph
from backend.services.impact_analyzer import impact_analyzer

router = APIRouter(prefix="/projects", tags=["projects"])

# In-memory status for active analysis jobs: project_id -> job info
analysis_jobs: Dict[str, Dict[str, Any]] = {}

def _to_project_response(project: Project) -> ProjectResponse:
    scan_res: Optional[ProjectScanResult] = None
    if project.config_json:
        try:
            scan_res = ProjectScanResult.model_validate_json(project.config_json)
        except Exception:
            scan_res = None

    return ProjectResponse(
        id=project.id,
        name=project.name,
        path=project.path,
        language=project.language,
        framework=project.framework,
        last_opened=project.last_opened,
        created_at=project.created_at,
        config_json=project.config_json,
        scan_result=scan_res
    )

async def _run_ast_analysis(project_id: str, project_path: str, languages: Optional[List[str]] = None) -> ProjectAnalysis:
    analysis_jobs[project_id] = {
        "status": "in_progress",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "message": "Analyzing project source files with Tree-Sitter"
    }

    try:
        analysis = await ast_analyzer.analyze_project(project_path, languages)

        # Store in DB as AgentMemory entries with memory_type="architecture"
        async with AsyncSessionLocal() as session:
            # Delete prior architecture memory for this project
            await session.execute(
                delete(AgentMemory).where(
                    AgentMemory.project_id == project_id,
                    AgentMemory.memory_type == "architecture"
                )
            )

            # 1. Store individual file-level analyses
            for fa in analysis.files:
                entry = AgentMemory(
                    project_id=project_id,
                    memory_type="architecture",
                    content=fa.model_dump_json()
                )
                session.add(entry)

            # 2. Store summary entry
            summary_payload = {
                "__summary__": True,
                "total_functions": analysis.total_functions,
                "total_classes": analysis.total_classes,
                "component_tree": analysis.component_tree
            }
            summary_entry = AgentMemory(
                project_id=project_id,
                memory_type="architecture",
                content=json.dumps(summary_payload)
            )
            session.add(summary_entry)

            await session.commit()

        analysis_jobs[project_id] = {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "message": f"Successfully analyzed {len(analysis.files)} files",
            "files_count": len(analysis.files)
        }
        return analysis

    except Exception as e:
        analysis_jobs[project_id] = {
            "status": "failed",
            "message": f"Analysis failed: {str(e)}",
            "files_count": 0
        }
        raise

@router.post("/open", response_model=ProjectResponse)
async def open_project(req: ProjectOpenRequest, db: AsyncSession = Depends(get_db)):
    project_path = str(Path(req.path).resolve())
    folder_path = Path(project_path)

    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project directory does not exist: {req.path}"
        )

    # Perform full scan of the project folder
    scanner = ProjectScanner()
    scan_result = await scanner.scan(project_path)
    scan_json = scan_result.model_dump_json()

    name = req.name or folder_path.name or "Untitled Project"
    primary_language = scan_result.languages[0] if scan_result.languages else "Unknown"
    primary_framework = scan_result.frameworks[0] if scan_result.frameworks else "Standard"

    # Check if project already registered
    stmt = select(Project).where(Project.path == project_path)
    result = await db.execute(stmt)
    project = result.scalars().first()

    now = datetime.now(timezone.utc)

    if project:
        project.last_opened = now
        project.name = name
        project.language = primary_language
        project.framework = primary_framework
        project.config_json = scan_json
    else:
        project = Project(
            name=name,
            path=project_path,
            language=primary_language,
            framework=primary_framework,
            last_opened=now,
            created_at=now,
            config_json=scan_json
        )
        db.add(project)

    await db.commit()
    await db.refresh(project)

    resp = _to_project_response(project)
    resp.scan_result = scan_result
    return resp

@router.get("/recent", response_model=List[ProjectResponse])
async def get_recent_projects(limit: int = 10, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).order_by(desc(Project.last_opened)).limit(limit)
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return [_to_project_response(p) for p in projects]

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )
    return _to_project_response(project)

@router.get("/{project_id}/scan", response_model=ProjectScanResult)
async def get_project_scan(project_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    # Return cached scan if available
    if project.config_json:
        try:
            return ProjectScanResult.model_validate_json(project.config_json)
        except Exception:
            pass

    # Run scan on-demand if cache is missing or corrupt
    scanner = ProjectScanner()
    scan_result = await scanner.scan(project.path)
    project.config_json = scan_result.model_dump_json()
    await db.commit()
    return scan_result

@router.post("/{project_id}/analyze", response_model=AnalysisJobResponse)
async def trigger_ast_analysis(
    project_id: str,
    background_tasks: BackgroundTasks,
    wait: bool = Query(False, description="Wait for analysis to finish synchronously"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    scan_res = None
    if project.config_json:
        try:
            scan_res = ProjectScanResult.model_validate_json(project.config_json)
        except Exception:
            pass
    langs = [l.lower() for l in scan_res.languages] if scan_res and scan_res.languages else None

    if wait:
        analysis = await _run_ast_analysis(project.id, project.path, langs)
        return AnalysisJobResponse(
            project_id=project.id,
            status="completed",
            message="AST analysis completed successfully",
            files_count=len(analysis.files)
        )
    else:
        # Run asynchronously in background
        background_tasks.add_task(_run_ast_analysis, project.id, project.path, langs)
        return AnalysisJobResponse(
            project_id=project.id,
            status="started",
            message="AST analysis started in background",
            files_count=0
        )

@router.get("/{project_id}/analysis", response_model=ProjectAnalysis)
async def get_project_analysis(project_id: str, db: AsyncSession = Depends(get_db)):
    # 1. Verify project exists
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalars().first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    # 2. Retrieve AgentMemory records with memory_type="architecture"
    mem_stmt = (
        select(AgentMemory)
        .where(
            AgentMemory.project_id == project_id,
            AgentMemory.memory_type == "architecture"
        )
        .order_by(AgentMemory.created_at.asc())
    )
    mem_result = await db.execute(mem_stmt)
    memories = mem_result.scalars().all()

    # 3. If no memories stored yet, run analysis on the fly and store
    if not memories:
        scan_res = None
        if project.config_json:
            try:
                scan_res = ProjectScanResult.model_validate_json(project.config_json)
            except Exception:
                pass
        langs = [l.lower() for l in scan_res.languages] if scan_res and scan_res.languages else None
        return await _run_ast_analysis(project.id, project.path, langs)

    files: List[FileAnalysis] = []
    total_functions = 0
    total_classes = 0
    component_tree: Dict[str, List[str]] = {}

    for m in memories:
        try:
            parsed = json.loads(m.content)
            if isinstance(parsed, dict) and (parsed.get("__summary__") or parsed.get("__knowledge_graph__")):
                if parsed.get("__summary__"):
                    total_functions = parsed.get("total_functions", 0)
                    total_classes = parsed.get("total_classes", 0)
                    component_tree = parsed.get("component_tree", {})
                continue
            files.append(FileAnalysis.model_validate(parsed))
        except Exception:
            pass

    # If summary was missing, aggregate from files
    if not total_functions:
        total_functions = sum(len(f.functions) for f in files)
    if not total_classes:
        total_classes = sum(len(f.classes) for f in files)

    return ProjectAnalysis(
        files=files,
        total_functions=total_functions,
        total_classes=total_classes,
        component_tree=component_tree
    )


async def _build_and_store_knowledge_graph(project: Project, db: AsyncSession, rebuild_ast: bool = True) -> KnowledgeGraphResult:
    # 1. Get ProjectScanResult
    scan_result: Optional[ProjectScanResult] = None
    if project.config_json:
        try:
            scan_result = ProjectScanResult.model_validate_json(project.config_json)
        except Exception:
            pass
    if not scan_result:
        scanner = ProjectScanner()
        scan_result = await scanner.scan(project.path)

    # 2. Fetch stored AST file analyses
    files: List[FileAnalysis] = []
    memories = []
    if not rebuild_ast:
        mem_stmt = (
            select(AgentMemory)
            .where(
                AgentMemory.project_id == project.id,
                AgentMemory.memory_type == "architecture"
            )
            .order_by(AgentMemory.created_at.asc())
        )
        res = await db.execute(mem_stmt)
        memories = res.scalars().all()

        for m in memories:
            try:
                parsed = json.loads(m.content)
                if isinstance(parsed, dict) and (parsed.get("__summary__") or parsed.get("__knowledge_graph__")):
                    continue
                files.append(FileAnalysis.model_validate(parsed))
            except Exception:
                pass

    # If rebuilding or no AST files stored, run AST analysis across all project languages
    if not files:
        langs = [l.lower() for l in scan_result.languages] if scan_result and scan_result.languages else None
        analysis = await _run_ast_analysis(project.id, project.path, langs)
        files = analysis.files

    # 3. Build graph
    kg_result = knowledge_graph.build_graph(project.path, files, scan_result)

    # 4. Store in DB (AgentMemory with memory_type="architecture")
    # Delete prior __knowledge_graph__ records
    mem_stmt = (
        select(AgentMemory)
        .where(
            AgentMemory.project_id == project.id,
            AgentMemory.memory_type == "architecture"
        )
    )
    res = await db.execute(mem_stmt)
    all_mems = res.scalars().all()
    for m in all_mems:
        try:
            parsed = json.loads(m.content)
            if isinstance(parsed, dict) and parsed.get("__knowledge_graph__"):
                await db.delete(m)
        except Exception:
            pass

    kg_entry = AgentMemory(
        project_id=project.id,
        memory_type="architecture",
        content=json.dumps({"__knowledge_graph__": True, "data": kg_result.model_dump()})
    )
    db.add(kg_entry)
    await db.commit()

    return kg_result


async def _get_or_build_knowledge_graph(project: Project, db: AsyncSession) -> KnowledgeGraphResult:
    mem_stmt = (
        select(AgentMemory)
        .where(
            AgentMemory.project_id == project.id,
            AgentMemory.memory_type == "architecture"
        )
        .order_by(AgentMemory.created_at.desc())
    )
    res = await db.execute(mem_stmt)
    memories = res.scalars().all()

    for m in memories:
        try:
            parsed = json.loads(m.content)
            if isinstance(parsed, dict) and parsed.get("__knowledge_graph__") and "data" in parsed:
                return KnowledgeGraphResult.model_validate(parsed["data"])
        except Exception:
            pass

    return await _build_and_store_knowledge_graph(project, db, rebuild_ast=False)


@router.post("/{project_id}/knowledge-graph", response_model=KnowledgeGraphResult)
async def build_knowledge_graph_endpoint(
    project_id: str,
    rebuild: bool = Query(True, description="Whether to perform fresh AST analysis before building graph"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id)
    res = await db.execute(stmt)
    project = res.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )
    return await _build_and_store_knowledge_graph(project, db, rebuild_ast=rebuild)


@router.get("/{project_id}/context", response_model=List[FileContext])
async def get_project_context(
    project_id: str,
    requirement: str = Query(..., description="Task requirement or query for semantic retrieval"),
    max_files: int = Query(8, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id)
    res = await db.execute(stmt)
    project = res.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    graph = await _get_or_build_knowledge_graph(project, db)
    contexts = knowledge_graph.get_relevant_context(
        requirement=requirement,
        graph=graph,
        max_files=max_files,
        project_path=project.path
    )
    return contexts


@router.get("/{project_id}/summary", response_model=ProjectSummaryResponse)
async def get_project_summary(project_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(Project).where(Project.id == project_id)
    res = await db.execute(stmt)
    project = res.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    graph = await _get_or_build_knowledge_graph(project, db)
    return ProjectSummaryResponse(summary=graph.summary)


@router.post("/{project_id}/impact", response_model=ImpactReport)
async def analyze_project_impact(
    project_id: str,
    req: ImpactAnalysisRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id)
    res = await db.execute(stmt)
    project = res.scalars().first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project not found with id: {project_id}"
        )

    # 1. Load or build knowledge graph
    graph = await _get_or_build_knowledge_graph(project, db)

    # 2. Perform context retrieval for requirement
    contexts = knowledge_graph.get_relevant_context(
        requirement=req.requirement,
        graph=graph,
        max_files=10,
        project_path=project.path
    )

    # 3. Analyze impact
    report = impact_analyzer.analyze_impact(
        requirement=req.requirement,
        relevant_files=contexts,
        graph=graph,
        project_path=project.path
    )

    return report
