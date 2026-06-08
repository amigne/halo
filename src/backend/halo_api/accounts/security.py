"""Cryptographic utilities for passwords and tokens (T-080, T-081, T-082).

- Password hashing via Argon2id, parameterisable through env (T-080).
- CSPRNG token generation with SHA-256 storage (T-081).
- Constant-time token verification (T-082).
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from halo_api.core.config import settings

# ── Argon2id password hasher ─────────────────────────────────────────────────

_ph = PasswordHasher(
    time_cost=settings.argon2_time_cost,
    memory_cost=settings.argon2_memory_cost,
    parallelism=settings.argon2_parallelism,
    hash_len=settings.argon2_hash_len,
    salt_len=settings.argon2_salt_len,
)


def hash_password(password: str) -> str:
    """Return an Argon2id hash of *password*."""
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify *password* against *password_hash* (Argon2id).

    Returns ``False`` for invalid/malformed hashes instead of raising.
    """
    try:
        return _ph.verify(password_hash, password)
    except VerificationError, InvalidHashError:
        return False


# ── CSPRNG tokens (T-081) ────────────────────────────────────────────────────


def generate_token() -> tuple[str, str]:
    """Generate a cryptographically-secure token.

    Returns:
        (cleartext_token, sha256_hash)
        - ``cleartext_token`` — sent to the user (email/URL), never stored.
        - ``sha256_hash`` — stored in the database for later verification.
    """
    # 256 bits of entropy via secrets.token_urlsafe (43 chars base64-url)
    cleartext = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(cleartext.encode()).hexdigest()
    return cleartext, token_hash


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of *token*."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(token: str, stored_hash: str) -> bool:
    """Constant-time comparison of *token* against *stored_hash* (T-082)."""
    computed = hash_token(token)
    return hmac.compare_digest(computed, stored_hash)


# ── Token expiry ─────────────────────────────────────────────────────────────


def token_expires_at() -> datetime:
    """Return a UTC datetime *token_ttl_minutes* from now."""
    return datetime.now(UTC) + timedelta(minutes=settings.token_ttl_minutes)
