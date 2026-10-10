import os


def is_production_environment() -> bool:
    return any(
        os.getenv(name, "").strip().lower() == "production"
        for name in ("HEXAWAVE_ENV", "NODE_ENV", "APP_ENV")
    )


def project_execution_block_message() -> str | None:
    if is_production_environment():
        return (
            "Project build and run are disabled in production until an "
            "OS-level sandbox is configured."
        )
    return None
