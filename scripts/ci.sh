#!/usr/bin/env bash
# Halo — Local CI script (T-161)
#
# Reproduces the same checks as the GitHub Actions CI workflow.
# Usage:
#   ./scripts/ci.sh              # all checks
#   ./scripts/ci.sh --lint       # lint + typecheck only
#   ./scripts/ci.sh --test       # tests only
#   ./scripts/ci.sh --smoke      # Docker dev smoke test only
#
# Requires: uv, python 3.14, node 24, npm, docker compose.

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Colour

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$REPO_ROOT/src/backend"
FRONTEND_DIR="$REPO_ROOT/src/frontend"
PASSED=0
FAILED=0

# ── Helpers ──────────────────────────────────────────────────────────────────

section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $*${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

pass() {
    echo -e "  ${GREEN}✓ PASS${NC} — $*"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "  ${RED}✗ FAIL${NC} — $*"
    FAILED=$((FAILED + 1))
}

warn() {
    echo -e "  ${YELLOW}⚠ WARN${NC} — $*"
}

summary() {
    echo ""
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
    echo -e "  Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
    echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
    if [ "$FAILED" -gt 0 ]; then
        exit 1
    fi
}

# ── Lint & typecheck ────────────────────────────────────────────────────────

run_lint_backend() {
    section "Backend: ruff format --check"
    cd "$BACKEND_DIR"
    if uv run ruff format --check .; then
        pass "ruff format --check"
    else
        fail "ruff format --check"
    fi

    section "Backend: ruff check"
    if uv run ruff check .; then
        pass "ruff check"
    else
        fail "ruff check"
    fi

    section "Backend: mypy"
    if uv run mypy halo_api/ tests/; then
        pass "mypy"
    else
        fail "mypy"
    fi
}

run_lint_frontend() {
    section "Frontend: ESLint"
    cd "$FRONTEND_DIR"
    if npm run lint; then
        pass "eslint"
    else
        fail "eslint"
    fi

    section "Frontend: TypeScript typecheck"
    if npx tsc --noEmit; then
        pass "tsc --noEmit"
    else
        fail "tsc --noEmit"
    fi
}

# ── Tests ───────────────────────────────────────────────────────────────────

run_tests() {
    section "Backend: pytest"
    cd "$BACKEND_DIR"

    # Check if Postgres is available
    if python -c "
import psycopg
try:
    conn = psycopg.connect('postgresql://postgres:halotest@localhost:5432/halotest', connect_timeout=3)
    conn.close()
    print('postgres_available')
except Exception:
    print('postgres_unavailable')
" 2>/dev/null | grep -q "postgres_available"; then
        echo "  Postgres 18 detected — running full matrix (SQLite + Postgres)"
    else
        warn "Postgres 18 not reachable — running SQLite-only tests"
        warn "Start Postgres for full matrix: docker run -d --name pg-test -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=halotest -e POSTGRES_DB=halotest postgres:18-alpine"
    fi

    # Check if Redis is available
    if redis-cli ping >/dev/null 2>&1; then
        echo "  Redis detected"
    else
        warn "Redis not reachable — /ready probe will report unhealthy (non-fatal for most tests)"
        warn "Start Redis: docker run -d --name redis-test -p 6379:6379 redis:8.8.0-alpine"
    fi

    if uv run pytest -v; then
        pass "pytest"
    else
        fail "pytest"
    fi
}

# ── Build frontend ──────────────────────────────────────────────────────────

run_build_frontend() {
    section "Frontend: build"
    cd "$FRONTEND_DIR"
    if npm run build; then
        pass "npm run build"
    else
        fail "npm run build"
    fi
}

# ── Audit ───────────────────────────────────────────────────────────────────

run_audit() {
    section "Frontend: npm audit"
    cd "$FRONTEND_DIR"
    if npm audit --audit-level=high; then
        pass "npm audit (frontend)"
    else
        warn "npm audit found high/critical vulnerabilities (non-blocking)"
    fi

    section "Backend: uv lock --check"
    cd "$BACKEND_DIR"
    if uv lock --check; then
        pass "uv lock --check"
    else
        fail "uv lock --check (lockfile out of date)"
    fi
}

# ── Docker dev smoke ────────────────────────────────────────────────────────

run_smoke() {
    section "Docker dev: build & start"
    cd "$REPO_ROOT"

    # Ensure .env.dev exists
    if [ ! -f .env.dev ]; then
        echo "  Creating .env.dev from .env.dev.example..."
        cp .env.dev.example .env.dev
    fi

    echo "  Starting services (this may take a few minutes on first run)..."
    if docker compose -f docker-compose.dev.yml up -d --build --wait 2>&1; then
        pass "docker compose up --build --wait"
    else
        fail "docker compose up — services did not become healthy"
        echo ""
        echo "  Container logs:"
        docker compose -f docker-compose.dev.yml logs --tail=50
        docker compose -f docker-compose.dev.yml down -v 2>/dev/null || true
        return
    fi

    section "Docker dev: health checks"

    echo "  Checking backend /api/v1/health..."
    if curl -fsS --retry 5 --retry-delay 3 http://localhost:8000/api/v1/health; then
        echo ""
        pass "backend /api/v1/health"
    else
        fail "backend /api/v1/health"
    fi

    echo "  Checking backend /api/v1/ready..."
    if curl -fsS --retry 5 --retry-delay 3 http://localhost:8000/api/v1/ready; then
        echo ""
        pass "backend /api/v1/ready"
    else
        fail "backend /api/v1/ready"
    fi

    echo "  Checking frontend..."
    if curl -fsS --retry 5 --retry-delay 3 http://localhost:5173/ > /dev/null; then
        pass "frontend (Vite dev server)"
    else
        fail "frontend (Vite dev server)"
    fi

    echo "  Checking Mailpit..."
    if curl -fsS --retry 5 --retry-delay 3 http://localhost:8025/ > /dev/null; then
        pass "mailpit"
    else
        fail "mailpit"
    fi

    echo "  Checking Redis..."
    if docker exec halo-redis-dev redis-cli ping | grep -q PONG; then
        pass "redis"
    else
        fail "redis"
    fi

    section "Docker dev: tear down"
    docker compose -f docker-compose.dev.yml down -v
    pass "docker compose down"
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
    local mode="${1:-all}"

    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  Halo CI — Local Runner (T-161)                                  ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════╝${NC}"

    case "$mode" in
        --lint)
            run_lint_backend
            run_lint_frontend
            ;;
        --test)
            run_tests
            ;;
        --build)
            run_build_frontend
            ;;
        --audit)
            run_audit
            ;;
        --smoke)
            run_smoke
            ;;
        all)
            run_lint_backend
            run_lint_frontend
            run_tests
            run_build_frontend
            run_audit
            run_smoke
            ;;
        *)
            echo "Usage: $0 [--lint|--test|--build|--audit|--smoke|all]"
            exit 1
            ;;
    esac

    summary
}

main "$@"
