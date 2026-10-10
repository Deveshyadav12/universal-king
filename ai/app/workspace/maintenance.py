import base64
import binascii
import json
import re
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import PurePosixPath, PureWindowsPath
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from zipfile import BadZipFile, ZipFile

from app.workspace.manager import create_workspace, update_meta, write_files

MAX_ARCHIVE_BYTES = 5 * 1024 * 1024
MAX_PROJECT_BYTES = 25 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 1000
MAX_COMPRESSION_RATIO = 200
SAFE_TEXT_EXTENSIONS = {
    ".c", ".cc", ".cfg", ".conf", ".cpp", ".cs", ".css", ".csv", ".dockerfile",
    ".go", ".graphql", ".h", ".hpp", ".htm", ".html", ".ini", ".java", ".js",
    ".json", ".jsx", ".kt", ".lock", ".md", ".mjs", ".mts", ".php", ".prisma",
    ".properties", ".py", ".rb", ".rs", ".sass", ".scss", ".sh", ".sql", ".svelte",
    ".toml", ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
}
SAFE_SPECIAL_NAMES = {
    ".dockerignore", ".editorconfig", ".gitignore", ".npmrc.example",
    "dockerfile", "makefile", "procfile",
}
IGNORED_DIRECTORIES = {
    ".git", ".next", ".venv", "build", "coverage", "dist", "node_modules",
    "target", "vendor", "__pycache__",
}
SECRET_PATTERN = re.compile(
    r"(?i)(api[_-]?key|access[_-]?token|token|secret|client[_-]?secret|"
    r"password|credential|private[_-]?key|authorization)\s*[:=]\s*"
    r"[\"']?([a-z0-9_./+=-]{16,})"
)


class _GithubRedirectHandler(HTTPRedirectHandler):
    def __init__(self, allowed_hosts: set[str]) -> None:
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, request, response, code, message, headers, new_url):
        target = urlsplit(new_url)
        if (
            target.scheme != "https"
            or target.hostname not in self.allowed_hosts
            or target.port not in (None, 443)
            or target.username
            or target.password
        ):
            raise MaintenanceImportError("GitHub redirected to an untrusted host.")
        return super().redirect_request(
            request, response, code, message, headers, new_url
        )


def _open_github_url(
    url: str,
    headers: dict[str, str],
    timeout: int,
    allowed_hosts: set[str],
):
    opener = build_opener(_GithubRedirectHandler(allowed_hosts))
    return opener.open(Request(url, headers=headers), timeout=timeout)


class MaintenanceImportError(ValueError):
    pass


def _is_text_project_file(name: str) -> bool:
    leaf = PurePosixPath(name).name
    if leaf.lower().startswith(".env") or leaf.lower() in {
        "id_rsa", "id_ed25519", "credentials.json",
    }:
        return False
    return (
        leaf.lower() in SAFE_SPECIAL_NAMES
        or PurePosixPath(leaf).suffix.lower() in SAFE_TEXT_EXTENSIONS
    )


def _project_stack(file_contents: dict[str, str]) -> str:
    package = file_contents.get("package.json")
    if package:
        try:
            manifest = json.loads(package)
        except json.JSONDecodeError:
            return "JavaScript/TypeScript (package.json needs review)"
        dependencies = {
            **manifest.get("dependencies", {}),
            **manifest.get("devDependencies", {}),
        }
        for package_name, stack in (
            ("next", "Next.js"),
            ("react", "React"),
            ("@angular/core", "Angular"),
            ("vue", "Vue"),
            ("svelte", "Svelte"),
            ("express", "Node.js / Express"),
        ):
            if package_name in dependencies:
                return f"{stack} / JavaScript"
        return "Node.js / JavaScript"
    if any(name == "pyproject.toml" or name == "requirements.txt" for name in file_contents):
        return "Python"
    if any(name.endswith(".csproj") for name in file_contents):
        return ".NET"
    if any(name.endswith(".go") for name in file_contents):
        return "Go"
    if any(name.endswith(".java") or name.endswith(".gradle") for name in file_contents):
        return "Java"
    return "Other / needs review"


def _maintenance_findings(file_contents: dict[str, str]) -> list[str]:
    names = set(file_contents)
    findings: list[str] = []
    package = file_contents.get("package.json")
    if package:
        try:
            manifest = json.loads(package)
            scripts = manifest.get("scripts", {})
            if not isinstance(scripts, dict) or not scripts.get("build"):
                findings.append("No build script was found in package.json; verify the build workflow.")
            if not isinstance(scripts, dict) or not any(
                scripts.get(candidate) for candidate in ("test", "test:unit", "test:ci")
            ):
                findings.append("No obvious automated test script was found in package.json.")
        except json.JSONDecodeError:
            findings.append("package.json is not valid JSON and needs inspection.")
        if not any(name in names for name in ("package-lock.json", "pnpm-lock.yaml", "yarn.lock", "bun.lockb", "bun.lock")):
            findings.append("No recognized JavaScript lockfile was included.")
    if not any(name.lower().startswith("readme") for name in names):
        findings.append("No README was found in the imported project.")
    if not findings:
        findings.append("No obvious manifest-level maintenance gaps were detected; this is not a source-code or security audit.")
    return findings


def import_project_zip(
    project_id: str,
    project_name: str,
    archive_base64: str,
    source: str = "zip",
) -> dict:
    if len(archive_base64) > ((MAX_ARCHIVE_BYTES + 2) // 3) * 4:
        raise MaintenanceImportError("Project ZIP exceeds the 5 MiB compressed upload limit.")
    try:
        archive_bytes = base64.b64decode(archive_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise MaintenanceImportError("Project upload is not valid Base64 data.") from error
    if not archive_bytes or len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise MaintenanceImportError("Project ZIP must be between 1 byte and 5 MiB.")

    try:
        archive = ZipFile(BytesIO(archive_bytes))
    except (BadZipFile, OSError) as error:
        raise MaintenanceImportError("Uploaded project is not a valid ZIP archive.") from error

    files: list[dict[str, str]] = []
    contents: dict[str, str] = {}
    total_uncompressed = 0
    with archive:
        entries = archive.infolist()
        if len(entries) > MAX_ARCHIVE_ENTRIES:
            raise MaintenanceImportError("Project ZIP has too many files (maximum 1,000).")
        normalized_names: list[str] = []
        for entry in entries:
            normalized = entry.filename.replace("\\", "/")
            posix_path = PurePosixPath(normalized)
            windows_path = PureWindowsPath(entry.filename)
            if (
                "\x00" in normalized
                or posix_path.is_absolute()
                or windows_path.is_absolute()
                or windows_path.drive
                or ".." in posix_path.parts
            ):
                raise MaintenanceImportError("ZIP contains an unsafe absolute or traversal path.")
            normalized_names.append(normalized)

        common_root = None
        first_parts = [
            PurePosixPath(name).parts[0]
            for name in normalized_names
            if PurePosixPath(name).parts
        ]
        if (
            first_parts
            and len(set(first_parts)) == 1
            and any(len(PurePosixPath(name).parts) > 1 for name in normalized_names)
        ):
            common_root = first_parts[0]

        for entry, original_name in zip(entries, normalized_names):
            normalized_path = PurePosixPath(original_name)
            relative_parts = normalized_path.parts
            if common_root is not None and relative_parts[0] == common_root:
                relative_parts = relative_parts[1:]
            normalized = PurePosixPath(*relative_parts).as_posix()
            if not normalized or normalized == ".":
                continue
            posix_path = PurePosixPath(normalized)
            if entry.is_dir():
                continue
            if (entry.external_attr >> 16) & 0o170000 == 0o120000:
                raise MaintenanceImportError("ZIP contains a symbolic link, which is not permitted.")
            if IGNORED_DIRECTORIES.intersection(posix_path.parts):
                continue
            if not _is_text_project_file(normalized):
                continue
            if entry.file_size > MAX_FILE_BYTES:
                raise MaintenanceImportError(f"Project file exceeds the 2 MiB limit: {normalized}")
            total_uncompressed += entry.file_size
            if total_uncompressed > MAX_PROJECT_BYTES:
                raise MaintenanceImportError("Expanded project exceeds the 25 MiB workspace limit.")
            if (
                entry.file_size > 0
                and entry.compress_size > 0
                and entry.file_size / entry.compress_size > MAX_COMPRESSION_RATIO
            ):
                raise MaintenanceImportError(f"Project file has an unsafe compression ratio: {normalized}")
            try:
                text = archive.read(entry).decode("utf-8")
            except (UnicodeDecodeError, OSError, BadZipFile) as error:
                raise MaintenanceImportError(
                    f"Project source must be valid UTF-8 text: {normalized}"
                ) from error
            if SECRET_PATTERN.search(text):
                raise MaintenanceImportError(
                    f"Possible hard-coded credential detected in {normalized}; remove it before importing."
                )
            files.append({"name": normalized, "content": text})
            contents[normalized] = text

    if not files:
        raise MaintenanceImportError("ZIP did not contain any supported text source or project files.")

    workspace = create_workspace(project_id)
    write_files(project_id, files)
    imported_at = datetime.now(timezone.utc)
    target_at = imported_at + timedelta(hours=48)
    metadata = update_meta(
        project_id,
        {
            "name": project_name.strip() or "Existing application",
            "type": "Existing App Maintenance",
            "stack": _project_stack(contents),
            "description": "Imported existing application; maintenance review requested.",
            "status": "created",
            "maintenance": {
                "source": source,
                "status": "intake_complete",
                "importedAt": imported_at.isoformat(),
                "targetAt": target_at.isoformat(),
                "targetHours": 48,
                "fileCount": len(files),
                "uncompressedBytes": total_uncompressed,
                "findings": _maintenance_findings(contents),
                "codeChanged": False,
            },
        },
    )
    return {
        "success": True,
        "project": metadata,
        "files": sorted(contents),
        "message": (
            "Project imported into an isolated workspace. The 48-hour window is a target, "
            "not a guaranteed completion SLA; review requirements and validation before changes."
        ),
        "workspace": workspace["id"],
    }


def import_public_github_project(
    project_id: str,
    repository_url: str,
) -> dict:
    parsed = urlsplit(repository_url.strip())
    if (
        parsed.scheme != "https"
        or parsed.hostname != "github.com"
        or parsed.port not in (None, 443)
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise MaintenanceImportError(
            "Use a public GitHub repository URL such as https://github.com/owner/repo."
        )
    segments = [segment for segment in parsed.path.strip("/").split("/") if segment]
    if len(segments) != 2:
        raise MaintenanceImportError(
            "Enter the repository URL only, without a branch, file path, query, or fragment."
        )
    owner, repository = segments
    repository = repository.removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}", owner) or not re.fullmatch(
        r"[A-Za-z0-9_.-]{1,100}", repository
    ):
        raise MaintenanceImportError("GitHub owner or repository name is invalid.")
    if not repository:
        raise MaintenanceImportError("GitHub repository name is required.")

    api_url = f"https://api.github.com/repos/{quote(owner)}/{quote(repository)}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "HexaWave-Maintenance-Importer",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        with _open_github_url(
            api_url,
            headers,
            timeout=10,
            allowed_hosts={"api.github.com"},
        ) as response:
            repository_info = json.loads(response.read(256 * 1024))
        if repository_info.get("private") is True:
            raise MaintenanceImportError(
                "Private GitHub repositories require a secure GitHub OAuth connection; "
                "do not paste access tokens here."
            )
        branch = repository_info.get("default_branch")
        if not isinstance(branch, str) or not branch:
            raise MaintenanceImportError("GitHub repository did not provide a default branch.")

        archive_url = f"{api_url}/zipball/{quote(branch, safe='')}"
        with _open_github_url(
            archive_url,
            headers,
            timeout=20,
            allowed_hosts={"api.github.com", "codeload.github.com", "github.com"},
        ) as response:
            archive_bytes = response.read(MAX_ARCHIVE_BYTES + 1)
    except MaintenanceImportError:
        raise
    except HTTPError as error:
        if error.code in {403, 404}:
            raise MaintenanceImportError(
                "Could not access this repository. Confirm it is public and try again later."
            ) from error
        raise MaintenanceImportError(
            f"GitHub could not provide the repository archive (HTTP {error.code})."
        ) from error
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise MaintenanceImportError(
            "Could not retrieve the public GitHub repository; check its URL and try again."
        ) from error

    if len(archive_bytes) > MAX_ARCHIVE_BYTES:
        raise MaintenanceImportError(
            "GitHub archive exceeds the 5 MiB compressed import limit."
        )
    return import_project_zip(
        project_id,
        repository,
        base64.b64encode(archive_bytes).decode("ascii"),
        source="github_public",
    )
