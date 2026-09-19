from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices
from typing import List
from pathlib import Path

class Settings(BaseSettings):
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:latest"
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

    # GitHub OAuth & integration settings
    github_client_id: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_CLIENT_ID", "AUTONOMOUS_IDE_GITHUB_CLIENT_ID")
    )
    github_client_secret: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_CLIENT_SECRET", "AUTONOMOUS_IDE_GITHUB_CLIENT_SECRET")
    )
    github_encryption_key: str = Field(
        default="",
        validation_alias=AliasChoices("GITHUB_ENCRYPTION_KEY", "AUTONOMOUS_IDE_GITHUB_ENCRYPTION_KEY")
    )
    github_redirect_uri: str = Field(
        default="http://localhost:8000/api/github/auth/callback",
        validation_alias=AliasChoices("GITHUB_REDIRECT_URI", "AUTONOMOUS_IDE_GITHUB_REDIRECT_URI")
    )

    model_config = SettingsConfigDict(
        env_prefix="AUTONOMOUS_IDE_",
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
