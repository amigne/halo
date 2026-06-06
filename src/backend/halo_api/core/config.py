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

    # --- Database (populated in étape 1b) ---
    database_url: str = ""

    # --- Redis (populated in étape 1b) ---
    redis_url: str = ""


settings = Settings()
