"""Halo API — FastAPI application (T-010 lifespan, T-060 /api/v1 prefix)."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRouter
from starlette.responses import JSONResponse

from halo_api.core.db import check_db, engine
from halo_api.core.redis import check_redis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan — init DB/Redis, clean up on shutdown."""
    # Touch engine so the pool is ready; SQLite pragmas are applied via
    # the connect event listeners registered in core.db.
    yield
    await engine.dispose()


app = FastAPI(
    title="Halo API",
    version="0.0.1",
    lifespan=lifespan,
)

# --- /api/v1 router ---
v1_router = APIRouter(prefix="/api/v1")


@v1_router.get("/health")
async def health() -> JSONResponse:
    """Liveness probe (T-181). Returns static ok."""
    return JSONResponse(content={"status": "ok"})


@v1_router.get("/ready")
async def ready() -> JSONResponse:
    """Readiness probe (T-181). Checks DB + Redis connectivity."""
    db_ok = await check_db()
    redis_ok = await check_redis()

    if db_ok and redis_ok:
        return JSONResponse(
            content={"status": "ok", "database": True, "redis": True}
        )
    return JSONResponse(
        content={"status": "error", "database": db_ok, "redis": redis_ok},
        status_code=503,
    )


app.include_router(v1_router)
