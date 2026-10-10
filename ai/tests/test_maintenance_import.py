import base64
from io import BytesIO
from types import SimpleNamespace
from urllib.request import Request
from zipfile import ZIP_DEFLATED, ZipFile

import pytest
from fastapi.testclient import TestClient

import app.main as main
import app.workspace.manager as workspace_manager
from app.workspace.maintenance import (
    MaintenanceImportError,
    _GithubRedirectHandler,
    import_project_zip,
    import_public_github_project,
)


def _zip_base64(files: dict[str, str]) -> str:
    archive_buffer = BytesIO()
    with ZipFile(archive_buffer, "w", ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return base64.b64encode(archive_buffer.getvalue()).decode("ascii")


def test_import_zip_strips_archive_root_and_writes_manifest(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "a8e0d62b-71e8-4bc9-8141-3270bda63de6"
    archive = _zip_base64(
        {
            "repo-main/package.json": '{"dependencies":{"next":"16.0.0"}}',
            "repo-main/README.md": "# Existing app",
            "repo-main/src/page.tsx": "export default function Page() {}",
        }
    )

    imported = import_project_zip(project_id, "Existing app", archive)

    assert imported["success"] is True
    assert imported["files"] == ["README.md", "package.json", "src/page.tsx"]
    assert imported["project"]["stack"] == "Next.js / JavaScript"
    assert workspace_manager.read_file(project_id, "package.json").startswith("{")


def test_import_zip_rejects_path_traversal_before_creating_workspace(tmp_path, monkeypatch):
    workspace_root = tmp_path / "workspaces"
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", workspace_root)
    project_id = "a8e0d62b-71e8-4bc9-8141-3270bda63de6"

    with pytest.raises(MaintenanceImportError, match="unsafe"):
        import_project_zip(
            project_id,
            "Unsafe app",
            _zip_base64({"repo/../../outside.txt": "not allowed"}),
        )

    assert not (workspace_root / project_id).exists()


def test_github_redirect_handler_rejects_untrusted_redirect_before_following():
    handler = _GithubRedirectHandler({"api.github.com"})
    request = Request("https://api.github.com/repos/owner/repo")
    response = SimpleNamespace(headers={})

    with pytest.raises(MaintenanceImportError, match="untrusted"):
        handler.redirect_request(
            request,
            response,
            302,
            "Found",
            {},
            "https://attacker.example/archive.zip",
        )


def test_public_github_import_rejects_non_repository_urls():
    with pytest.raises(MaintenanceImportError, match="repository URL"):
        import_public_github_project(
            "a8e0d62b-71e8-4bc9-8141-3270bda63de6",
            "https://github.com/owner/repo/tree/main",
        )


def test_github_import_endpoint_validates_request_and_returns_import(monkeypatch):
    project_id = "a8e0d62b-71e8-4bc9-8141-3270bda63de6"
    expected = {
        "success": True,
        "project": {"id": project_id, "name": "repo"},
        "files": ["README.md"],
        "message": "Imported safely.",
    }
    calls: list[tuple[str, str]] = []

    def import_project(received_id: str, repository_url: str):
        calls.append((received_id, repository_url))
        return expected

    monkeypatch.setattr(main, "import_public_github_project", import_project)
    client = TestClient(main.app)
    response = client.post(
        "/projects/maintenance/import-github",
        json={
            "projectId": project_id,
            "repositoryUrl": "https://github.com/owner/repo",
        },
    )
    invalid = client.post(
        "/projects/maintenance/import-github",
        json={
            "projectId": "not-a-uuid",
            "repositoryUrl": "https://github.com/owner/repo",
        },
    )

    assert response.status_code == 200
    assert response.json() == expected
    assert calls == [(project_id, "https://github.com/owner/repo")]
    assert invalid.status_code == 422
