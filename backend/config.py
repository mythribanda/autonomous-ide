from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from pathlib import Path

class Settings(BaseSettings):
    ollama_url: str = "http://localhost:11434"
    db_path: str = "./data/autonomous_ide.db"
    database_url: str = "sqlite+aiosqlite:///./data/autonomous_ide.db"
    workspace_max_file_size_mb: int = 10
    max_terminal_timeout_seconds: int = 60
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "file://"
    ]

    model_config = SettingsConfigDict(
        env_prefix="AUTONOMOUS_IDE_",
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
