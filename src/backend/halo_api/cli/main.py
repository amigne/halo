"""CLI dispatcher — ``halo`` command (T-075).

Usage:
    halo create-admin
    halo promote-admin <email>
"""

import sys


def main() -> None:
    """Dispatch to the appropriate subcommand."""
    if len(sys.argv) < 2:
        print("Usage: halo <command> [args]")
        print()
        print("Commands:")
        print("  create-admin              Create a new admin user interactively")
        print("  promote-admin <email>     Promote an existing user to admin")
        sys.exit(1)

    command = sys.argv[1]

    if command == "create-admin":
        from halo_api.cli.admin import create_admin

        create_admin()
    elif command == "promote-admin":
        # The promote_admin function reads sys.argv directly
        from halo_api.cli.admin import promote_admin

        # Pop the subcommand so promote_admin sees the email as argv[1]
        sys.argv.pop(1)
        promote_admin()
    else:
        print(f"Unknown command: {command}")
        print("Available commands: create-admin, promote-admin")
        sys.exit(1)
