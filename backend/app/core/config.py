"""
Application configuration using Pydantic Settings
"""

from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, PostgresDsn, field_validator


class Settings(BaseSettings):
    """
    Application settings with environment variable support
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    # Project metadata
    PROJECT_NAME: str = "BOE Replacement System"
    VERSION: str = "0.29.0"
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # CORS settings
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative frontend
    ]

    # Database configuration
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "boe_user"
    POSTGRES_PASSWORD: str = "boe_password"
    POSTGRES_DB: str = "boe_db"
    DATABASE_URL: Optional[PostgresDsn] = None

    @field_validator("DATABASE_URL", mode="before")
    def assemble_db_connection(cls, v: Optional[str], values: dict) -> str:
        if isinstance(v, str):
            return v
        return PostgresDsn.build(
            scheme="postgresql+asyncpg",
            username=values.data.get("POSTGRES_USER"),
            password=values.data.get("POSTGRES_PASSWORD"),
            host=values.data.get("POSTGRES_SERVER"),
            path=values.data.get("POSTGRES_DB"),
        )

    # Redis configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Celery configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # Security settings
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Password hashing
    BCRYPT_ROUNDS: int = 12

    # File storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB

    # Export settings
    EXPORT_TEMP_DIR: str = "./temp/exports"
    EXPORT_RETENTION_HOURS: int = 24

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Feature flags
    ENABLE_REGISTRATION: bool = True
    ENABLE_OAUTH: bool = False
    ENABLE_WEBSOCKETS: bool = True

    # Development settings
    AUTO_CREATE_TABLES: bool = False  # Use Alembic in production
    SEED_DATABASE: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # or "text"

    # Email settings (for notifications)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@boe-system.local"

    # Monitoring
    ENABLE_METRICS: bool = True
    METRICS_PATH: str = "/metrics"


# Create global settings instance
settings = Settings()