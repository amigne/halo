"""Application configuration via pydantic-settings, sourced from .env (T-089, T-152)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Halo backend settings.

    All values are loaded from environment variables / .env file.
    Secrets never committed (T-089).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Environment ---
    app_env: str = "development"

    # --- Database ---
    # Default: SQLite in the current directory (dev).  Set to
    # postgresql+psycopg://user:pass@host:5432/dbname for prod (T-141).
    database_url: str = "sqlite+aiosqlite:///./halo.db"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"


settings = Settings()
