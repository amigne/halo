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

    # --- Security ---
    secret_key: str = "change-me-generate-with-secrets-token-urlsafe-64"

    # --- Argon2id (T-080) ---
    argon2_time_cost: int = 3
    argon2_memory_cost: int = 65536  # 64 MiB
    argon2_parallelism: int = 4
    argon2_hash_len: int = 32
    argon2_salt_len: int = 16

    # --- Sessions (T-070) ---
    session_ttl_minutes: int = 1440  # 24 hours
    session_cookie_name: str = "halo_session"
    session_secure_cookie: bool = True  # Set to False for localhost HTTP dev

    # --- Tokens (T-081/T-082) ---
    token_ttl_minutes: int = 60  # 1 hour for verify/reset tokens

    # --- SMTP (T-113) ---
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@halo.local"
    smtp_use_tls: bool = False

    # --- CORS ---
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # --- Rate limiting (T-086) ---
    rate_limit_login_per_minute: int = 5
    rate_limit_register_per_hour: int = 3
    rate_limit_reset_per_hour: int = 3

    # --- App URL (for email links) ---
    app_url: str = "http://localhost:5173"


settings = Settings()
