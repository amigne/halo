"""Halo API — FastAPI application (T-010 lifespan, T-060 /api/v1 prefix)."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from starlette.responses import JSONResponse

from halo_api.accounts.router import router as accounts_router
from halo_api.accounts.users import router as users_router
from halo_api.core.config import settings
from halo_api.core.csrf import CSRFCustomHeaderMiddleware
from halo_api.core.db import check_db, engine
from halo_api.core.redis import check_redis, close_redis
import halo_api.modules.lists  # triggers register(ListsModule()) in __init__.py
from halo_api.modules.lists.router import router as lists_router


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan — clean up resources on shutdown."""
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title="Halo API",
    version="0.0.2",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────

cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CSRF (T-071) ─────────────────────────────────────────────────────────────

app.add_middleware(CSRFCustomHeaderMiddleware)

# ── /api/v1 router ───────────────────────────────────────────────────────────

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
        return JSONResponse(content={"status": "ok", "database": True, "redis": True})
    return JSONResponse(
        content={"status": "error", "database": db_ok, "redis": redis_ok},
        status_code=503,
    )


# ── Mount routers ────────────────────────────────────────────────────────────

v1_router.include_router(accounts_router)
v1_router.include_router(users_router)
v1_router.include_router(lists_router)
app.include_router(v1_router)
