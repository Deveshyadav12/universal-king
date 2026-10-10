import json
import os
import re
import uuid
from pathlib import Path
from pathlib import PurePosixPath, PureWindowsPath
from typing import Optional

WORKSPACES_ROOT = Path(__file__).parent.parent.parent / "workspaces"

VALID_STATUSES = {
    "created",
    "planning",
    "architecting",
    "coding",
    "testing",
    "building",
    "fixing",
    "ready",
    "failed",
    "running",
    "stopped",
}

PROJECT_ID_PATTERN = re.compile(r"^[0-9a-fA-F-]{36}$")


def _safe_path(root: Path, name: str) -> Path:
    if not name or "\x00" in name:
        raise ValueError("A valid relative file path is required.")

    posix_path = PurePosixPath(name.replace("\\", "/"))
    windows_path = PureWindowsPath(name)
    if posix_path.is_absolute() or windows_path.is_absolute() or windows_path.drive:
        raise ValueError(f"Absolute path not allowed: {name}")

    if ".." in posix_path.parts or ".." in windows_path.parts:
        raise ValueError(f"Path traversal not allowed: {name}")

    target = (root / Path(*posix_path.parts)).resolve()
    resolved_root = root.resolve()

    if not target.is_relative_to(resolved_root):
        raise ValueError(f"Path escapes workspace: {name}")
    if target == resolved_root / ".hexawave.json":
        raise ValueError("The workspace metadata file is reserved.")

    return target


def _project_root(project_id: str) -> Path:
    if not PROJECT_ID_PATTERN.fullmatch(project_id):
        raise ValueError("Project ID must be a UUID.")

    root = (WORKSPACES_ROOT / project_id).resolve()
    if not root.is_relative_to(WORKSPACES_ROOT.resolve()):
        raise ValueError("Project path escapes the workspaces directory.")
    return root


def create_workspace(project_id: Optional[str] = None) -> dict:
    pid = project_id or str(uuid.uuid4())
    root = _project_root(pid)
    root.mkdir(parents=True, exist_ok=True)

    if not (root / ".hexawave.json").exists():
        _write_meta(root, {
            "id": pid,
            "status": "created",
            "files": [],
            "process": None,
        })

    return {"id": pid, "path": str(root)}


def write_files(project_id: str, files: list[dict[str, str]]) -> None:
    root = _get_root(project_id)

    for file in files:
        name = file.get("name", "")
        content = file.get("content", "")

        if not name:
            raise ValueError("Generated files must include a relative name.")
        if not isinstance(content, str):
            raise ValueError(f"File content must be text: {name}")

        target = _safe_path(root, name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    meta = read_meta(project_id)
    meta["files"] = list_files(project_id)
    _write_meta(root, meta)


def read_file(project_id: str, file_path: str) -> str:
    root = _get_root(project_id)
    target = _safe_path(root, file_path)

    if not target.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    return target.read_text(encoding="utf-8")


def list_files(project_id: str) -> list:
    root = _get_root(project_id)

    if not root.exists():
        return []

    result = []
    excluded_directories = {
        ".git",
        ".next",
        ".hexawave-deps",
        "__pycache__",
        "build",
        "dist",
        "node_modules",
    }

    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if (
            path.is_file()
            and path.name not in {".hexawave.json", "runner.log"}
            and not excluded_directories.intersection(relative.parts)
        ):
            result.append(str(relative).replace("\\", "/"))

    return result


def set_status(project_id: str, status: str) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")

    root = _get_root(project_id)
    meta = read_meta(project_id)
    meta["status"] = status
    _write_meta(root, meta)


def update_meta(project_id: str, values: dict) -> dict:
    root = _get_root(project_id)
    meta = read_meta(project_id)
    meta.update(values)
    _write_meta(root, meta)
    return meta


def get_status(project_id: str) -> str:
    return read_meta(project_id).get("status", "created")


def set_process(project_id: str, process_info: Optional[dict]) -> None:
    root = _get_root(project_id)
    meta = read_meta(project_id)
    meta["process"] = process_info
    _write_meta(root, meta)


def get_process(project_id: str) -> Optional[dict]:
    return read_meta(project_id).get("process")


def read_meta(project_id: str) -> dict:
    root = _get_root(project_id)
    meta_file = root / ".hexawave.json"

    if not meta_file.exists():
        raise FileNotFoundError(f"Workspace metadata not found: {project_id}")

    try:
        return json.loads(meta_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Workspace metadata is invalid: {project_id}") from error


def workspace_exists(project_id: str) -> bool:
    try:
        return _project_root(project_id).is_dir()
    except ValueError:
        return False


def list_workspaces() -> list[dict]:
    WORKSPACES_ROOT.mkdir(parents=True, exist_ok=True)
    return [
        read_meta(path.name)
        for path in sorted(WORKSPACES_ROOT.iterdir())
        if path.is_dir()
        and (path / ".hexawave.json").is_file()
        and workspace_exists(path.name)
    ]


def get_root(project_id: str) -> Path:
    return _get_root(project_id)


def safe_process_environment() -> dict[str, str]:
    sensitive_markers = (
        "KEY",
        "TOKEN",
        "SECRET",
        "PASSWORD",
        "CREDENTIAL",
        "CONNECTION",
        "OPENAI",
        "AZURE_CLIENT",
        "AWS_",
    )
    return {
        name: value
        for name, value in os.environ.items()
        if not any(marker in name.upper() for marker in sensitive_markers)
    }


def _get_root(project_id: str) -> Path:
    root = _project_root(project_id)

    if not root.exists():
        raise FileNotFoundError(f"Workspace not found: {project_id}")

    return root


def _write_meta(root: Path, meta: dict) -> None:
    (root / ".hexawave.json").write_text(
        json.dumps(meta, indent=2), encoding="utf-8"
    )
