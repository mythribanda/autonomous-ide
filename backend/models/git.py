from datetime import datetime, timezone
import uuid
from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from backend.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class GitCheckpoint(Base):
    __tablename__ = "git_checkpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String(1024), nullable=False)
    author: Mapped[str] = mapped_column(String(255), default="AutonomousDev Agent", nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="ai_post_change", nullable=False)
    files_changed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)
