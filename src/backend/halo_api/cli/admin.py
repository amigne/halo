"""CLI commands for admin management (T-075, F-095b).

Usage:
    halo create-admin          # Interactive — prompts for email, password, name
    halo promote-admin <email> # Promote an existing user to admin
"""

import asyncio
import sys

from sqlalchemy import select

from halo_api.accounts.models import User
from halo_api.accounts.security import hash_password
from halo_api.core.db import async_session


def _get_email(prompt: str) -> str:
    """Prompt for and return a non-empty email."""
    while True:
        value = input(prompt).strip()
        if value and "@" in value:
            return value.lower()
        print("Please enter a valid email address.")


def _get_non_empty(prompt: str) -> str:
    """Prompt for and return a non-empty string."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("This field is required.")


def _get_password() -> str:
    """Prompt for password with confirmation."""
    while True:
        pw = input("Password: ").strip()
        if len(pw) < 8:
            print("Password must be at least 8 characters.")
            continue
        confirm = input("Confirm password: ").strip()
        if pw == confirm:
            return pw
        print("Passwords do not match.")


async def _create_admin() -> None:
    """Create a new admin user interactively."""
    print("Creating a new admin user...")
    email = _get_email("Email: ")
    first_name = _get_non_empty("First name: ")
    last_name = _get_non_empty("Last name: ")
    password = _get_password()

    async with async_session() as session:
        # Check for existing email
        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none() is not None:
            print(f"Error: a user with email {email} already exists.")
            sys.exit(1)

        user = User(
            email=email,
            password_hash=hash_password(password),
            first_name=first_name,
            last_name=last_name,
            is_admin=True,
            is_verified=True,  # Admin accounts are pre-verified
        )
        session.add(user)
        await session.commit()
        print(f"Admin user {email} created successfully.")


async def _promote_admin(email: str) -> None:
    """Promote an existing user to admin."""
    email_lower = email.lower().strip()

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email_lower))
        user = result.scalar_one_or_none()

        if user is None:
            print(f"Error: no user found with email {email_lower}.")
            sys.exit(1)

        if user.is_admin:
            print(f"User {email_lower} is already an admin.")
            return

        user.is_admin = True
        await session.commit()
        print(f"User {email_lower} promoted to admin.")


def create_admin() -> None:
    """Entry point: ``halo create-admin``."""
    asyncio.run(_create_admin())


def promote_admin() -> None:
    """Entry point: ``halo promote-admin <email>``."""
    if len(sys.argv) < 2:
        print("Usage: halo promote-admin <email>")
        sys.exit(1)
    email = sys.argv[1]
    asyncio.run(_promote_admin(email))
