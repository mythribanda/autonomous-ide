from datetime import datetime, timezone
from typing import Optional
import uuid

from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class GitHubAccount(Base):
    __tablename__ = "github_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, onupdate=utc_now)
