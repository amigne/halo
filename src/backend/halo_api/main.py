"""Halo API — FastAPI application (T-010 lifespan, T-060 /api/v1 prefix)."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.routing import APIRouter
from starlette.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Application lifespan — no database yet (étape 1b)."""
    yield


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


app.include_router(v1_router)
