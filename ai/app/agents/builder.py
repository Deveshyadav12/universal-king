import json
import os
import subprocess
import sys
import tempfile
from contextlib import nullcontext
from pathlib import Path
from pathlib import PurePosixPath, PureWindowsPath
from typing import Any
from app.workspace import get_root, safe_process_environment, write_files
from app.workspace.runner import npm_command
from app.security import project_execution_block_message

from app.llm import LLMEngine, safe_llm_error


class BuildAgent:
    name = "builder"

    def __init__(self):
        self.llm = LLMEngine()

    def _safe_path(self, root: Path, name: str) -> Path:
        if not name or "\x00" in name:
            raise ValueError("A valid relative file path is required.")
        relative = PurePosixPath(name.replace("\\", "/"))
        windows_path = PureWindowsPath(name)

        if relative.is_absolute() or windows_path.is_absolute() or windows_path.drive:
            raise ValueError(f"Absolute path not allowed: {name}")

        if ".." in relative.parts or ".." in windows_path.parts:
            raise ValueError(f"Unsafe path: {name}")

        target = (root / Path(*relative.parts)).resolve()

        if not target.is_relative_to(root.resolve()):
            raise ValueError(f"Unsafe target path: {name}")

        return target

    def _write_files(self, root: Path, files: list[dict[str, Any]]) -> None:
        for file in files:
            target = self._safe_path(root, file["name"])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(file["content"], encoding="utf-8")

    def _run_command(
        self,
        command: list[str],
        cwd: Path,
        timeout: int = 180,
        extra_environment: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if message := project_execution_block_message():
            return {"returncode": -1, "stdout": "", "stderr": message}
        try:
            environment = safe_process_environment()
            if extra_environment:
                environment.update(extra_environment)
            result = subprocess.run(
                command,
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=False,
                env=environment,
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
                "stderr": f"{stderr[-12000:]}\nBuild command timed out.".strip(),
            }
        except FileNotFoundError as error:
            return {"returncode": -1, "stdout": "", "stderr": str(error)}

    def _basic_checks(self, root: Path, files: list[dict[str, Any]]) -> list[str]:
        errors = []

        for file in files:
            name = file.get("name", "")
            content = file.get("content", "")

            if not content.strip():
                errors.append(f"Empty file: {name}")

            if "\x00" in content:
                errors.append(f"Invalid null byte: {name}")

        package_json = root / "package.json"

        if package_json.exists():
            try:
                json.loads(package_json.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                errors.append(f"Invalid package.json: {error}")

        return errors

    def run(self, files: list[dict[str, Any]], project_id: str | None = None):
        if message := project_execution_block_message():
            return {
                "agent": self.name,
                "passed": False,
                "stage": "sandbox-required",
                "errors": [message],
                "stdout": "",
                "stderr": message,
            }
        if project_id:
            root = get_root(project_id)
            write_files(project_id, files)
            temp_context = nullcontext(root)
        else:
            temp_context = tempfile.TemporaryDirectory(prefix="hexawave-build-")

        with temp_context as directory:
            root = directory if isinstance(directory, Path) else Path(directory)
            if not project_id:
                self._write_files(root, files)

            errors = self._basic_checks(root, files)

            if errors:
                return {
                    "agent": self.name,
                    "passed": False,
                    "stage": "validation",
                    "errors": errors,
                    "stdout": "",
                    "stderr": "",
                }

            package_json = root / "package.json"

            if not package_json.is_file() and any(root.rglob("*.py")):
                try:
                    for source in root.rglob("*.py"):
                        if "__pycache__" in source.parts or ".hexawave-deps" in source.parts:
                            continue
                        compile(source.read_text(encoding="utf-8"), str(source), "exec")
                except (OSError, SyntaxError) as error:
                    return {
                        "agent": self.name,
                        "passed": False,
                        "stage": "python-validation",
                        "errors": [str(error)],
                        "stdout": "",
                        "stderr": str(error),
                    }

                requirements = root / "requirements.txt"
                if requirements.is_file():
                    dependency_root = root / ".hexawave-deps"
                    marker = dependency_root / ".installed"
                    if not marker.is_file():
                        install = self._run_command(
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
                        if install["returncode"] != 0:
                            return {
                                "agent": self.name,
                                "passed": False,
                                "stage": "python-install",
                                "errors": ["Python dependency installation failed."],
                                "stdout": install["stdout"],
                                "stderr": install["stderr"],
                            }
                        dependency_root.mkdir(parents=True, exist_ok=True)
                        marker.write_text("installed\n", encoding="utf-8")

                return {
                    "agent": self.name,
                    "passed": True,
                    "stage": "python-validation",
                    "errors": [],
                    "stdout": "",
                    "stderr": "",
                }

            if not package_json.is_file():
                return {
                    "agent": self.name,
                    "passed": False,
                    "stage": "configuration",
                    "errors": ["package.json is missing."],
                    "stdout": "",
                    "stderr": "Generated applications must include a package.json.",
                }

            if package_json.exists():
                install = self._run_command(
                    npm_command("install"),
                    root,
                    timeout=300,
                )

                if install["returncode"] != 0:
                    return {
                        "agent": self.name,
                        "passed": False,
                        "stage": "npm-install",
                        "errors": ["npm install failed."],
                        "stdout": install["stdout"],
                        "stderr": install["stderr"],
                    }

                package = json.loads(package_json.read_text(encoding="utf-8"))

                scripts = package.get("scripts", {})
                if not isinstance(scripts, dict) or "build" not in scripts:
                    return {
                        "agent": self.name,
                        "passed": False,
                        "stage": "configuration",
                        "errors": ["package.json has no build script."],
                        "stdout": "",
                        "stderr": "Add a configured package.json scripts.build command.",
                    }

                build = self._run_command(
                    npm_command("run", "build"),
                    root,
                    timeout=300,
                )

                if build["returncode"] != 0:
                    return {
                        "agent": self.name,
                        "passed": False,
                        "stage": "npm-build",
                        "errors": ["npm run build failed."],
                        "stdout": build["stdout"],
                        "stderr": build["stderr"],
                    }

            return {
                "agent": self.name,
                "passed": True,
                "stage": "complete",
                "errors": [],
                "stdout": "",
                "stderr": "",
            }

    def run_tests(self, project_id: str) -> dict[str, Any]:
        if message := project_execution_block_message():
            return {
                "passed": False,
                "skipped": False,
                "errors": [message],
                "stdout": "",
                "stderr": message,
            }

        root = get_root(project_id)
        package_json = root / "package.json"
        if package_json.is_file():
            try:
                package = json.loads(package_json.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as error:
                return {
                    "passed": False,
                    "skipped": False,
                    "errors": [f"Invalid package.json: {error}"],
                    "stdout": "",
                    "stderr": str(error),
                }
            scripts = package.get("scripts", {})
            if not isinstance(scripts, dict) or not scripts.get("test"):
                return {
                    "passed": True,
                    "skipped": True,
                    "errors": [],
                    "stdout": "",
                    "stderr": "No package.json test script is configured.",
                }
            result = self._run_command(
                npm_command("test", "--", "--watch=false"),
                root,
                timeout=300,
                extra_environment={"CI": "true"},
            )
        else:
            has_python = any(root.rglob("*.py"))
            has_tests = has_python and any(
                path.is_file()
                and (
                    path.name.startswith("test")
                    or path.name.endswith("_test.py")
                )
                and ".hexawave-deps" not in path.parts
                and "__pycache__" not in path.parts
                for path in root.rglob("*.py")
            )
            if not has_tests:
                return {
                    "passed": True,
                    "skipped": True,
                    "errors": [],
                    "stdout": "",
                    "stderr": "No Python test files were found for unittest discovery.",
                }
            result = self._run_command(
                [sys.executable, "-m", "unittest", "discover", "-v"],
                root,
                timeout=300,
                extra_environment={
                    "PYTHONPATH": str(root / ".hexawave-deps")
                    if (root / ".hexawave-deps").is_dir()
                    else "",
                },
            )

        passed = result["returncode"] == 0
        return {
            "passed": passed,
            "skipped": False,
            "errors": [] if passed else ["Project test command failed."],
            "stdout": result["stdout"],
            "stderr": result["stderr"],
        }

    def fix(
        self,
        files: list[dict[str, Any]],
        errors: list[str],
        stdout: str = "",
        stderr: str = "",
    ) -> list[dict[str, Any]]:
        system = """
You are the Build Fix agent of HexaWave AI Software Factory.

A generated software project failed during validation, dependency
installation, build, or application startup.

Analyze the error and return corrected files.

Return ONLY valid JSON:

{
  "files": [
    {
      "name": "relative/path",
      "language": "tsx",
      "content": "complete corrected file"
    }
  ],
  "explanation": "short explanation"
}

Rules:
- Return complete file contents.
- Preserve files that do not need changes.
- Fix the actual reported error.
- Keep imports consistent.
- Never return secrets.
- Never use absolute paths.
- Never use ../ paths.
- Do not invent dependencies unless necessary.
"""

        payload = {
            "files": files,
            "errors": errors,
            "stdout": stdout,
            "stderr": stderr,
        }

        try:
            raw = self.llm.generate(
                system,
                json.dumps(payload, indent=2),
            )
        except Exception as error:
            raise RuntimeError(safe_llm_error("AI fixer", error)) from error

        try:
            response = raw.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            start = response.find("{")
            if start < 0:
                raise ValueError("No JSON object was returned.")
            result, _ = json.JSONDecoder().raw_decode(response[start:])
        except (json.JSONDecodeError, ValueError) as error:
            raise RuntimeError(
                "AI fixer returned invalid or truncated JSON. Retry the build repair."
            ) from error

        if not isinstance(result, dict):
            raise RuntimeError("AI fixer returned an invalid response.")
        fixed_files = result.get("files")
        if not isinstance(fixed_files, list) or not fixed_files:
            raise RuntimeError("AI fixer returned no corrected files.")

        validated: list[dict[str, str]] = []
        seen_names: set[str] = set()
        for file in fixed_files:
            if not isinstance(file, dict):
                raise RuntimeError("AI fixer returned an invalid file entry.")
            name = file.get("name")
            content = file.get("content")
            if not isinstance(name, str) or not isinstance(content, str):
                raise RuntimeError("AI fixer files require a name and text content.")
            name = name.strip().replace("\\", "/")
            relative = PurePosixPath(name)
            windows_path = PureWindowsPath(name)
            if (
                not name
                or "\x00" in name
                or relative.is_absolute()
                or windows_path.is_absolute()
                or windows_path.drive
                or ".." in relative.parts
            ):
                raise RuntimeError(f"AI fixer returned an unsafe file path: {name!r}.")
            if not content.strip():
                raise RuntimeError(f"AI fixer returned empty content for {name}.")
            if name.casefold() in seen_names:
                raise RuntimeError(f"AI fixer returned a duplicate file path: {name}.")
            seen_names.add(name.casefold())
            validated.append({
                "name": name,
                "language": str(file.get("language", "text")),
                "content": content,
            })
        return validated
