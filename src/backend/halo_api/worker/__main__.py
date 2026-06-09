"""Worker entry point — starts the email processing loop.

Usage:
    uv run python -m halo_api.worker
"""

import asyncio
import logging

from halo_api.worker.email import process_email_jobs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

asyncio.run(process_email_jobs())
