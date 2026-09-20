import os
import json
import logging
from logging.handlers import RotatingFileHandler
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any

# Ensure backend/logs directory exists
LOGS_DIR = Path("backend/logs").resolve()
LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE_PATH = LOGS_DIR / "agent.jsonl"


class JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage()
        }

        # Merge custom structured fields attached to the record
        if hasattr(record, "structured_data") and isinstance(record.structured_data, dict):
            log_obj.update(record.structured_data)

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj)


def setup_agent_logger() -> logging.Logger:
    """Configures rotating JSONL logger for agent executions."""
    logger = logging.getLogger("autonomous_dev.agent")
    logger.setLevel(logging.INFO)
    logger.propagate = False

    # Prevent duplicate handlers
    if not any(isinstance(h, RotatingFileHandler) and getattr(h, "is_agent_jsonl", False) for h in logger.handlers):
        # 10 MB per file, up to 5 backups
        file_handler = RotatingFileHandler(
            filename=str(LOG_FILE_PATH),
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setFormatter(JSONFormatter())
        file_handler.is_agent_jsonl = True  # type: ignore
        logger.addHandler(file_handler)

    return logger


agent_logger = setup_agent_logger()


def log_agent_action(
    task_id: str,
    action: str,
    duration_ms: float,
    success: bool,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Logs an agent action execution to backend/logs/agent.jsonl with structured schema:
    task_id, action, duration_ms, success, timestamp, metadata.
    """
    structured = {
        "task_id": task_id,
        "action": action,
        "duration_ms": round(duration_ms, 2),
        "success": success,
        "metadata": metadata or {}
    }
    agent_logger.info(
        f"Agent action '{action}' finished in {duration_ms:.1f}ms (success={success})",
        extra={"structured_data": structured}
    )
