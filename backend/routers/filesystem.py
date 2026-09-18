from pathlib import Path
from typing import List
import difflib
import os
import asyncio

from fastapi import APIRouter, HTTPException, Query, status
from backend.schemas import (
    FileItem,
    FileListResponse,
    FileReadResponse,
    FileWriteRequest,
    FileWriteResponse,
    FileDiffRequest,
    FileDiffResponse,
)

router = APIRouter(prefix="/fs", tags=["filesystem"])

@router.get("/list", response_model=FileListResponse)
async def list_files(
    path: str = Query(..., description="Directory path to list"),
    recursive: bool = Query(False, description="List recursively")
):
    target = Path(path).resolve()
    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path does not exist: {path}"
        )
    if not target.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a directory: {path}"
        )

    items: List[FileItem] = []

    def collect(dir_path: Path, recurse: bool):
        try:
            for entry in dir_path.iterdir():
                # Skip heavy ignored directories
                if entry.name in {"node_modules", ".git", "__pycache__", ".venv", "venv", "dist", "dist-electron"}:
                    continue
                is_dir = entry.is_dir()
                size = None
                if not is_dir:
                    try:
                        size = entry.stat().st_size
                    except OSError:
                        size = 0

                items.append(FileItem(
                    name=entry.name,
                    path=str(entry).replace("\\", "/"),
                    is_dir=is_dir,
                    size=size
                ))

                if is_dir and recurse:
                    collect(entry, True)
        except PermissionError:
            pass

    collect(target, recursive)
    return FileListResponse(path=str(target).replace("\\", "/"), items=items)

@router.get("/read", response_model=FileReadResponse)
async def read_file(path: str = Query(..., description="File path to read")):
    target = Path(path).resolve()
    if not target.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File does not exist: {path}"
        )
    if not target.is_file():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path is not a file: {path}"
        )

    try:
        content = target.read_text(encoding="utf-8", errors="replace")
        return FileReadResponse(
            path=str(target).replace("\\", "/"),
            content=content,
            size=len(content.encode("utf-8"))
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read file: {str(e)}"
        )

@router.post("/write", response_model=FileWriteResponse)
async def write_file(req: FileWriteRequest):
    target = Path(req.path).resolve()
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        encoded = req.content.encode("utf-8")
        target.write_bytes(encoded)
        return FileWriteResponse(
            path=str(target).replace("\\", "/"),
            success=True,
            bytes_written=len(encoded)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write file: {str(e)}"
        )

@router.post("/diff", response_model=FileDiffResponse)
async def compute_diff(req: FileDiffRequest):
    target = Path(req.path).resolve()
    original_lines: List[str] = []

    if target.exists() and target.is_file():
        try:
            original_lines = target.read_text(encoding="utf-8", errors="replace").splitlines(keepends=True)
        except Exception:
            original_lines = []

    modified_lines = req.modified_content.splitlines(keepends=True)

    diff = "".join(
        difflib.unified_diff(
            original_lines,
            modified_lines,
            fromfile=f"a/{target.name}",
            tofile=f"b/{target.name}"
        )
    )

    return FileDiffResponse(
        path=str(target).replace("\\", "/"),
        diff=diff,
        has_changes=len(diff.strip()) > 0
    )
