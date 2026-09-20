from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from backend.services.evaluation_service import (
    evaluation_service,
    BenchmarkResult,
    BenchmarkModeMetrics,
)
from backend.services.report_generator import report_generator

router = APIRouter(prefix="/evaluation", tags=["evaluation"])


class BenchmarkRequest(BaseModel):
    task: str
    modes: List[str] = ["guided", "autonomous"]


@router.post("/benchmark", response_model=BenchmarkResult)
async def run_benchmark(req: BenchmarkRequest):
    """Runs a multi-mode benchmark comparison on the task description."""
    return await evaluation_service.benchmark_task(
        task=req.task,
        modes=req.modes
    )


@router.get("/benchmark/{benchmark_id}", response_model=BenchmarkResult)
async def get_benchmark_result(benchmark_id: str):
    """Retrieves results of a previously executed benchmark."""
    res = evaluation_service.get_benchmark(benchmark_id)
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Benchmark not found with id: {benchmark_id}"
        )
    return res


@router.get("/export/latex")
async def export_latex_tables(project_id: Optional[str] = "demo-project"):
    """Generates publication-quality LaTeX tables for evaluation metrics."""
    content = await report_generator.generate_latex_tables(project_id or "demo-project")
    return {"latex": content, "project_id": project_id}


@router.get("/export/comparison")
async def export_comparison_table(project_id: Optional[str] = None):
    """Generates markdown comparison matrix against GitHub Copilot, Cursor, and Devin."""
    content = report_generator.generate_comparison_table(project_id)
    return {"markdown": content}
