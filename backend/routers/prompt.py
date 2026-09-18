from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.project import Project
from backend.schemas import (
    PromptCompileRequest,
    PromptSpecificationResponse,
    ProjectScanResult,
)
from backend.services.prompt_compiler import prompt_compiler

router = APIRouter(prefix="/prompt", tags=["prompt"])


@router.post("/compile", response_model=PromptSpecificationResponse)
async def compile_prompt(
    req: PromptCompileRequest,
    db: AsyncSession = Depends(get_db)
) -> PromptSpecificationResponse:
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prompt requirement text cannot be empty"
        )

    project_name: Optional[str] = None
    project_lang: Optional[str] = None
    project_fw: Optional[str] = None
    detected_db: Optional[str] = None
    test_fw: Optional[str] = None

    if req.project_id:
        stmt = select(Project).where(Project.id == req.project_id)
        res = await db.execute(stmt)
        project = res.scalars().first()
        if project:
            project_name = project.name
            project_lang = project.language
            project_fw = project.framework
            if project.config_json:
                try:
                    scan = ProjectScanResult.model_validate_json(project.config_json)
                    detected_db = scan.detected_database
                    test_fw = scan.test_framework
                except Exception:
                    pass

    return prompt_compiler.compile(
        raw_prompt=req.prompt,
        project_name=project_name,
        project_language=project_lang,
        project_framework=project_fw,
        detected_database=detected_db,
        test_framework=test_fw,
    )
