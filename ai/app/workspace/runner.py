import json
import os
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.workspace import (
    get_process,
    get_root,
    read_meta,
    safe_process_environment,
    set_process,
    set_status,
)
from app.security import project_execution_block_message


def npm_command(*arguments: str) -> list[str]:
    if sys.platform == "win32":
        npm = shutil.which("npm")
        node = shutil.which("node")
        if npm and node:
            npm_cli = Path(npm).parent / "node_modules" / "npm" / "bin" / "npm-cli.js"
            if npm_cli.is_file():
                return [node, str(npm_cli), *arguments]
    return ["npm", *arguments]


def _find_free_port(start: int = 3001, end: int = 3200) -> int:
    for port in range(start, end):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError(f"No free port available in range {start}-{end - 1}.")


def _run_sync(command: list[str], cwd: Path, timeout: int = 300) -> dict[str, Any]:
    if message := project_execution_block_message():
        return {"returncode": -1, "stdout": "", "stderr": message}
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
            env=safe_process_environment(),
            check=False,
        )
        return {
            "returncode": result.returncode,
            "stdout": result.stdout[-12000:],
            "stderr": result.stderr[-12000:],
        }
    except subprocess.TimeoutExpired as error:
        stdout = error.stdout or ""
        stderr = error.stderr or ""
        if isinstance(stdout, bytes):
            stdout = stdout.decode(errors="replace")
        if isinstance(stderr, bytes):
            stderr = stderr.decode(errors="replace")
        return {
            "returncode": -1,
            "stdout": stdout[-12000:],
            "stderr": f"{stderr[-12000:]}\nCommand timed out after {timeout} seconds.".strip(),
        }
    except FileNotFoundError as error:
        return {"returncode": -1, "stdout": "", "stderr": str(error)}


def _read_log(project_id: str) -> str:
    log_path = get_root(project_id) / "runner.log"
    if not log_path.is_file():
        return ""
    with log_path.open("rb") as log_file:
        log_file.seek(max(0, log_path.stat().st_size - 12000))
        return log_file.read().decode("utf-8", errors="replace")


def _is_process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False


def _port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def install(project_id: str) -> dict[str, Any]:
    if message := project_execution_block_message():
        return {"success": False, "message": message, "stdout": "", "stderr": message}
    root = get_root(project_id)
    package_json = root / "package.json"

    if not package_json.is_file():
        if not any(root.rglob("*.py")):
            return {
                "success": False,
                "message": "Cannot install dependencies: package.json or Python source is missing.",
                "stdout": "",
                "stderr": "No supported project manifest was found.",
            }

        requirements = root / "requirements.txt"
        if not requirements.is_file():
            return {"success": True, "message": "No Python dependencies to install."}

        dependency_root = root / ".hexawave-deps"
        marker = dependency_root / ".installed"
        if marker.is_file():
            return {"success": True, "message": "Python dependencies are already installed."}

        result = _run_sync(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "--target",
                str(dependency_root),
                "-r",
                str(requirements),
            ],
            root,
            timeout=300,
        )
        if result["returncode"] != 0:
            return {
                "success": False,
                "message": "Python dependency installation failed.",
                "stdout": result["stdout"],
                "stderr": result["stderr"],
            }

        dependency_root.mkdir(parents=True, exist_ok=True)
        marker.write_text("installed\n", encoding="utf-8")
        return {
            "success": True,
            "message": "Python dependencies installed.",
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    node_modules = root / "node_modules"
    if node_modules.is_dir() and any(node_modules.iterdir()):
        return {"success": True, "message": "Dependencies are already installed."}

    lock_file = root / "package-lock.json"
    command = npm_command("ci" if lock_file.is_file() else "install")
    result = _run_sync(command, root, timeout=300)
    if result["returncode"] != 0:
        return {
            "success": False,
            "message": "Dependency installation failed.",
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }
    return {
        "success": True,
        "message": "Dependencies installed.",
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }


def get_run_preflight_error(project_id: str) -> str | None:
    root = get_root(project_id)
    package_json = root / "package.json"
    if _python_project(root) or not package_json.is_file():
        return None
    try:
        package = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return f"Invalid package.json: {error}"
    if not isinstance(package, dict):
        return "Invalid package.json: the root value must be an object."
    scripts = package.get("scripts", {})
    if not isinstance(scripts, dict):
        return "Invalid package.json: scripts must be an object."
    if not any(name in scripts for name in ("dev", "start")):
        return (
            "Cannot run this project: package.json has no dev or start script. "
            "Add scripts.dev or scripts.start, then run again."
        )
    return None


def _python_project(root: Path) -> bool:
    return not (root / "package.json").is_file() and any(root.rglob("*.py"))


def _python_environment(root: Path) -> dict[str, str]:
    env = safe_process_environment()
    dependency_root = root / ".hexawave-deps"
    if dependency_root.is_dir():
        existing = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = os.pathsep.join(
            part for part in (str(dependency_root), existing) if part
        )
    return env


def build(project_id: str) -> dict[str, Any]:
    if message := project_execution_block_message():
        return {"success": False, "message": message, "stdout": "", "stderr": message}
    root = get_root(project_id)
    package_json = root / "package.json"

    if _python_project(root):
        try:
            for source in root.rglob("*.py"):
                if ".hexawave-deps" in source.parts or "__pycache__" in source.parts:
                    continue
                compile(source.read_text(encoding="utf-8"), str(source), "exec")
        except (OSError, SyntaxError) as error:
            return {
                "success": False,
                "message": "Python source validation failed.",
                "stdout": "",
                "stderr": str(error),
            }
        return {
            "success": True,
            "message": "Python syntax validation passed.",
            "stdout": "",
            "stderr": "",
        }

    if not package_json.is_file():
        return {
            "success": False,
            "message": "Build unavailable: package.json or Python source is missing.",
            "stdout": "",
            "stderr": "No supported project manifest was found.",
        }

    try:
        package = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        return {
            "success": False,
            "message": f"Invalid package.json: {error}",
            "stdout": "",
            "stderr": str(error),
        }

    scripts = package.get("scripts", {})
    if not isinstance(scripts, dict) or "build" not in scripts:
        return {
            "success": False,
            "message": "Build unavailable: package.json has no build script.",
            "stdout": "",
            "stderr": "Add a configured package.json scripts.build command.",
        }

    result = _run_sync(npm_command("run", "build"), root, timeout=300)
    if result["returncode"] != 0:
        return {
            "success": False,
            "message": "npm run build failed.",
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }
    return {
        "success": True,
        "message": "Build successful.",
        "stdout": result["stdout"],
        "stderr": result["stderr"],
    }


def run_project(project_id: str) -> dict[str, Any]:
    if message := project_execution_block_message():
        return {"success": False, "message": message, "stdout": "", "stderr": message}
    root = get_root(project_id)
    package_json = root / "package.json"
    is_python = _python_project(root)
    if not package_json.is_file() and not is_python:
        return {"success": False, "message": "No supported project manifest or Python entrypoint found."}

    existing = get_process(project_id)
    if existing and existing.get("pid") and _is_process_alive(int(existing["pid"])):
        return {
            "success": True,
            "status": "running",
            "pid": existing["pid"],
            "port": existing["port"],
            "url": f"http://localhost:{existing['port']}",
            "message": "Project is already running.",
        }
    if existing:
        set_process(project_id, None)

    if is_python:
        entrypoint = root / "app" / "main.py"
        if not entrypoint.is_file():
            entrypoint = root / "main.py"
        if not entrypoint.is_file():
            return {"success": False, "message": "Python project must include app/main.py or main.py."}
        try:
            port = _find_free_port()
        except RuntimeError as error:
            return {"success": False, "message": str(error)}
        metadata = read_meta(project_id)
        requirements = root / "requirements.txt"
        requirements_text = requirements.read_text(encoding="utf-8").lower() if requirements.is_file() else ""
        is_fastapi = "fastapi" in metadata.get("stack", "").lower() or "fastapi" in requirements_text
        if is_fastapi:
            module = "app.main:app" if (root / "app" / "main.py").is_file() else "main:app"
            command = [
                sys.executable, "-m", "uvicorn", module,
                "--host", "127.0.0.1", "--port", str(port),
            ]
            script = "uvicorn"
        else:
            command = [sys.executable, str(entrypoint)]
            script = "python"
    else:
        try:
            package = json.loads(package_json.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            return {"success": False, "message": f"Invalid package.json: {error}"}

        scripts = package.get("scripts", {})
        script = "dev" if "dev" in scripts else "start" if "start" in scripts else None
        if not script:
            return {"success": False, "message": "No dev or start script in package.json."}
        try:
            port = _find_free_port()
        except RuntimeError as error:
            return {"success": False, "message": str(error)}
        command = npm_command("run", script)

    env = _python_environment(root) if is_python else safe_process_environment()
    env.update({"PORT": str(port), "HOST": "127.0.0.1", "HOSTNAME": "127.0.0.1"})
    log_path = root / "runner.log"
    process: subprocess.Popen[bytes] | None = None

    try:
        with log_path.open("wb") as log_file:
            popen_options: dict[str, Any] = {
                "cwd": str(root),
                "stdin": subprocess.DEVNULL,
                "stdout": log_file,
                "stderr": subprocess.STDOUT,
                "shell": False,
                "env": env,
            }
            if sys.platform == "win32":
                popen_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
            else:
                popen_options["start_new_session"] = True
            process = subprocess.Popen(command, **popen_options)
    except (OSError, subprocess.SubprocessError) as error:
        return {
            "success": False,
            "message": f"Could not start project: {error}",
            "stdout": "",
            "stderr": str(error),
        }

    process_info = {
        "pid": process.pid,
        "port": port,
        "status": "running",
        "script": script,
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    set_process(project_id, process_info)
    set_status(project_id, "running")

    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            output = _read_log(project_id)
            set_process(project_id, None)
            set_status(project_id, "failed")
            return {
                "success": False,
                "status": "failed",
                "message": "Application process exited before becoming ready.",
                "stdout": output,
                "stderr": output,
            }
        if _port_is_open(port):
            return {
                "success": True,
                "status": "running",
                **process_info,
                "url": f"http://localhost:{port}",
            }
        time.sleep(0.25)

    output = _read_log(project_id)
    stop_project(project_id)
    return {
        "success": False,
        "status": "failed",
        "message": "Application did not open its allocated port within 30 seconds.",
        "stdout": output,
        "stderr": output,
    }


def stop_project(project_id: str) -> dict[str, Any]:
    process_info = get_process(project_id)
    if not process_info or not process_info.get("pid"):
        set_process(project_id, None)
        set_status(project_id, "stopped")
        return {"success": True, "status": "stopped", "message": "No running process found."}

    pid = int(process_info["pid"])
    if _is_process_alive(pid):
        if sys.platform == "win32":
            result = subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                capture_output=True,
                text=True,
                timeout=15,
                shell=False,
                check=False,
            )
            if result.returncode != 0 and _is_process_alive(pid):
                return {
                    "success": False,
                    "status": "running",
                    "message": "Could not stop the project process.",
                    "stderr": result.stderr[-4000:] or result.stdout[-4000:],
                }
        else:
            try:
                os.killpg(os.getpgid(pid), 15)
            except ProcessLookupError:
                pass
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline and _is_process_alive(pid):
                time.sleep(0.1)
            if _is_process_alive(pid):
                os.killpg(os.getpgid(pid), 9)

    set_process(project_id, None)
    set_status(project_id, "stopped")
    return {"success": True, "status": "stopped", "message": "Project process stopped."}


def get_process_status(project_id: str) -> dict[str, Any] | None:
    process_info = get_process(project_id)
    if process_info and not _is_process_alive(int(process_info["pid"])):
        set_process(project_id, None)
        set_status(project_id, "failed")
        return None
    return process_info


def get_runner_output(project_id: str) -> str:
    return _read_log(project_id)


def append_runner_output(project_id: str, message: str) -> None:
    if not message:
        return

    log_path = get_root(project_id) / "runner.log"
    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(message.rstrip() + "\n")
