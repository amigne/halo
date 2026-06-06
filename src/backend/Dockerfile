# Halo Backend — multi-stage, non-root (T-153)
#
# Build:  docker build -t halo-backend .
# Run:    docker run -p 8000:8000 --env-file .env halo-backend

# --- Stage 1: build dependencies ---
FROM python:3.14-slim AS builder

WORKDIR /build

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install system deps needed for python packages
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY pyproject.toml uv.lock .python-version ./

# Install only production dependencies into a venv
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY halo_api/ ./halo_api/

# Install the project itself
RUN uv sync --frozen --no-dev


# --- Stage 2: runtime (non-root) ---
FROM python:3.14-slim AS runtime

# Create non-root user
RUN groupadd --system --gid 1000 halo && \
    useradd --system --uid 1000 --gid halo --no-create-home --shell /sbin/nologin halo

WORKDIR /app

# Copy the virtual environment from builder
COPY --from=builder --chown=halo:halo /build/.venv /app/.venv

# Copy application source
COPY --from=builder --chown=halo:halo /build/halo_api /app/halo_api
COPY --from=builder --chown=halo:halo /build/pyproject.toml /app/pyproject.toml

# Set PATH to use the venv
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Drop to non-root
USER halo

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

CMD ["python", "-m", "uvicorn", "halo_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
