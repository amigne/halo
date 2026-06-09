"""SMTP email sending via aiosmtplib with i18n templates (T-110, T-113).

Captured by Mailpit in dev (SMTP_HOST=mailpit, SMTP_PORT=1025).
"""

import json
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from aiosmtplib import SMTP

from halo_api.core.config import settings

logger = logging.getLogger("halo.worker.email")

# ── Templates (i18n FR/EN) ───────────────────────────────────────────────────

_VERIFY_TEMPLATES = {
    "fr": {
        "subject": "Halo — Vérifiez votre adresse email",
        "body_text": (
            "Bonjour {first_name},\n\n"
            "Merci de vous être inscrit sur Halo.\n"
            "Veuillez vérifier votre adresse email en cliquant sur le lien "
            "ci-dessous :\n\n"
            "{verify_url}\n\n"
            "Ce lien expire dans {expires_minutes} minutes.\n\n"
            "— L'équipe Halo"
        ),
    },
    "en": {
        "subject": "Halo — Verify your email address",
        "body_text": (
            "Hello {first_name},\n\n"
            "Thank you for signing up for Halo.\n"
            "Please verify your email address by clicking the link below:\n\n"
            "{verify_url}\n\n"
            "This link expires in {expires_minutes} minutes.\n\n"
            "— The Halo team"
        ),
    },
}

_RESET_TEMPLATES = {
    "fr": {
        "subject": "Halo — Réinitialisation de votre mot de passe",
        "body_text": (
            "Bonjour {first_name},\n\n"
            "Vous avez demandé la réinitialisation de votre mot de passe Halo.\n"
            "Cliquez sur le lien ci-dessous pour définir un nouveau mot de "
            "passe :\n\n"
            "{reset_url}\n\n"
            "Ce lien expire dans {expires_minutes} minutes.\n"
            "Si vous n'avez pas demandé cette réinitialisation, ignorez ce "
            "message.\n\n"
            "— L'équipe Halo"
        ),
    },
    "en": {
        "subject": "Halo — Reset your password",
        "body_text": (
            "Hello {first_name},\n\n"
            "You requested a password reset for your Halo account.\n"
            "Click the link below to set a new password:\n\n"
            "{reset_url}\n\n"
            "This link expires in {expires_minutes} minutes.\n"
            "If you did not request this reset, please ignore this message.\n\n"
            "— The Halo team"
        ),
    },
}


def _template(
    kind: str,
    locale: str,
    **kwargs: str,
) -> tuple[str, str]:
    """Return (subject, body_text) for the given *kind* and *locale*."""
    templates = {"verify": _VERIFY_TEMPLATES, "reset": _RESET_TEMPLATES}
    tpl = templates[kind].get(locale, templates[kind]["en"])
    body = tpl["body_text"].format(**kwargs)
    return tpl["subject"], body


# ── SMTP client ──────────────────────────────────────────────────────────────


def _build_message(
    to_email: str,
    subject: str,
    body_text: str,
) -> MIMEMultipart:
    """Build a multipart email message (plain-text only)."""
    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    return msg


async def send_email(
    to_email: str,
    subject: str,
    body_text: str,
) -> None:
    """Send an email via the configured SMTP server."""
    msg = _build_message(to_email, subject, body_text)

    smtp = SMTP(
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        use_tls=settings.smtp_use_tls,
    )

    async with smtp:
        if settings.smtp_user and settings.smtp_password:
            await smtp.login(settings.smtp_user, settings.smtp_password)
        await smtp.send_message(msg)

    logger.info("Email sent to %s (subject: %s)", to_email, subject)


async def send_verify_email(
    email: str,
    first_name: str,
    locale: str,
    token: str,
) -> None:
    """Send a verification email with the CSPRNG *token*."""
    verify_url = f"{settings.app_url}/verify-email?token={token}"
    subject, body = _template(
        "verify",
        locale,
        first_name=first_name,
        verify_url=verify_url,
        expires_minutes=str(settings.token_ttl_minutes),
    )
    await send_email(email, subject, body)


async def send_reset_email(
    email: str,
    first_name: str,
    locale: str,
    token: str,
) -> None:
    """Send a password-reset email with the CSPRNG *token*."""
    reset_url = f"{settings.app_url}/reset-password?token={token}"
    subject, body = _template(
        "reset",
        locale,
        first_name=first_name,
        reset_url=reset_url,
        expires_minutes=str(settings.token_ttl_minutes),
    )
    await send_email(email, subject, body)


# ── Job queue (Redis list) ───────────────────────────────────────────────────


async def enqueue_email_job(job: dict[str, object]) -> None:
    """Push an email job onto the Redis queue for the worker to pick up.

    *job* must be a dict with keys: ``kind``, ``email``, ``first_name``,
    ``locale``, and ``token``.

    Fails **open** — if Redis is unreachable the job is silently dropped
    and a warning is logged (does not break the caller).
    """
    try:
        from halo_api.core.redis import get_redis

        redis = await get_redis()
        payload = json.dumps(job)
        await redis.lpush("halo:email_queue", payload)
    except Exception:
        logger.warning("Redis unavailable — email job dropped for %s", job.get("email"))


async def process_email_jobs() -> None:
    """Worker loop — block on the Redis email queue and process jobs.

    Re-queues failed jobs with a delay (simple backoff).
    Should be run in a separate asyncio task or process.
    """
    from halo_api.core.redis import get_redis

    redis = await get_redis()
    logger.info("Email worker started, listening on halo:email_queue")

    while True:
        try:
            # BRPOP blocks until a job arrives (timeout 5s for graceful shutdown)
            result = await redis.brpop("halo:email_queue", timeout=5)
            if result is None:
                continue

            _, payload = result
            job = json.loads(payload)
            kind = job["kind"]
            email_addr = job["email"]
            first_name = job.get("first_name", "")
            locale = job.get("locale", "en")
            token = job.get("token", "")
            retries = job.get("retries", 0)

            try:
                if kind == "verify":
                    await send_verify_email(email_addr, first_name, locale, token)
                elif kind == "reset":
                    await send_reset_email(email_addr, first_name, locale, token)
                else:
                    logger.warning("Unknown email job kind: %s", kind)
            except Exception:
                logger.exception(
                    "Failed to send %s email to %s (attempt %d)",
                    kind,
                    email_addr,
                    retries + 1,
                )
                # Re-queue with backoff (max 3 retries)
                if retries < 3:
                    job["retries"] = retries + 1
                    backoff = 2**retries  # 1, 2, 4 seconds
                    await redis.lpush("halo:email_queue", json.dumps(job))
                    # Add a small delay before the next attempt
                    import asyncio

                    await asyncio.sleep(backoff)

        except Exception:
            logger.exception("Email worker error — continuing")
