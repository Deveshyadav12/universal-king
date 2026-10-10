from fastapi.testclient import TestClient

import app.main as main
import app.workspace.manager as workspace_manager


def test_ai_edit_updates_only_the_requested_workspace_file(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [
            {"name": "src/page.tsx", "content": "export default function Page() { return null; }"},
            {"name": "README.md", "content": "# Original"},
        ],
    )

    def edit_file(path, content, instruction):
        assert path == "src/page.tsx"
        assert content == "export default function Page() { return null; }"
        assert instruction == "Add a heading"
        return "export default function Page() { return <h1>Hello</h1>; }"

    monkeypatch.setattr(main.editor, "edit", edit_file)
    response = TestClient(main.app).post(
        f"/projects/{project_id}/ai-edit",
        json={"filePath": "src/page.tsx", "instruction": "Add a heading"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["content"] == "export default function Page() { return <h1>Hello</h1>; }"
    assert workspace_manager.read_file(project_id, "src/page.tsx") == response.json()["content"]
    assert workspace_manager.read_file(project_id, "README.md") == "# Original"


def test_ai_edit_rejects_missing_or_outside_workspace_files(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    client = TestClient(main.app)

    missing = client.post(
        f"/projects/{project_id}/ai-edit",
        json={"filePath": "missing.ts", "instruction": "Add a heading"},
    )
    traversal = client.post(
        f"/projects/{project_id}/ai-edit",
        json={"filePath": "../outside.ts", "instruction": "Add a heading"},
    )

    assert missing.status_code == 404
    assert traversal.status_code == 400


def test_ai_maintenance_updates_multiple_files_without_sending_secrets(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [
            {"name": "src/app.py", "content": "def app():\n    return 'old'\n"},
            {"name": "README.md", "content": "# Existing app"},
            {"name": ".env", "content": "API_KEY=not-for-the-model"},
            {"name": "assets/logo.png", "content": "not text"},
            {
                "name": "config/settings.py",
                "content": "password = 'notforsending123456'\n",
            },
        ],
    )

    def maintain(files, instruction):
        assert [file["name"] for file in files] == ["README.md", "src/app.py"]
        assert instruction == "Add a health endpoint"
        return {
            "summary": "Added a health endpoint.",
            "files": [
                {"name": "src/app.py", "content": "def app():\n    return 'healthy'\n"},
                {"name": "src/health.py", "content": "def health():\n    return {'status': 'ok'}\n"},
            ],
        }

    monkeypatch.setattr(main.editor, "maintain", maintain)
    response = TestClient(main.app).post(
        f"/projects/{project_id}/ai-maintain",
        json={"instruction": "Add a health endpoint"},
    )

    assert response.status_code == 200
    assert response.json()["changedFiles"] == ["src/app.py", "src/health.py"]
    assert response.json()["excludedFileCount"] == 3
    assert workspace_manager.read_file(project_id, "src/app.py").endswith("'healthy'\n")
    assert workspace_manager.read_file(project_id, "src/health.py").startswith("def health")
    assert workspace_manager.read_file(project_id, ".env") == "API_KEY=not-for-the-model"


def test_ai_maintenance_rejects_unsafe_model_paths_before_writing(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [{"name": "src/app.py", "content": "original"}],
    )
    monkeypatch.setattr(
        main.editor,
        "maintain",
        lambda _files, _instruction: {
            "summary": "Attempted unsafe change.",
            "files": [
                {"name": "src/app.py", "content": "changed"},
                {"name": "../outside.py", "content": "unsafe"},
            ],
        },
    )

    response = TestClient(main.app).post(
        f"/projects/{project_id}/ai-maintain",
        json={"instruction": "Change the project"},
    )

    assert response.status_code == 422
    assert workspace_manager.read_file(project_id, "src/app.py") == "original"


def test_autonomous_project_task_runs_checks_and_repairs_once(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [{"name": "src/app.py", "content": "def app():\n    return 'old'\n"}],
    )
    monkeypatch.setattr(
        main.editor,
        "maintain",
        lambda _files, _instruction: {
            "summary": "Updated the app.",
            "files": [
                {"name": "src/app.py", "content": "def app():\n    return 'new'\n"},
            ],
        },
    )
    monkeypatch.setattr(
        main.tester,
        "run",
        lambda _files: {"passed": True, "errors": []},
    )
    build_results = iter(
        [
            {
                "passed": False,
                "stage": "test-build",
                "errors": ["Build command failed."],
                "stdout": "",
                "stderr": "missing field",
            },
            {
                "passed": True,
                "stage": "complete",
                "errors": [],
                "stdout": "build passed",
                "stderr": "",
            },
        ],
    )
    monkeypatch.setattr(main.builder, "run", lambda _files, _project_id: next(build_results))
    def repair_once(_files, errors, _stdout, stderr):
        assert errors == ["Build command failed."]
        assert "missing field" in stderr
        return [
            {
                "name": "src/app.py",
                "language": "python",
                "content": "def app():\n    return 'fixed'\n",
            },
        ]

    monkeypatch.setattr(main.builder, "fix", repair_once)

    response = TestClient(main.app).post(
        f"/projects/{project_id}/ai-autonomous",
        json={"instruction": "Improve the app"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["success"] is True
    assert response.json()["summary"] == "Updated the app."
    assert response.json()["changedFiles"] == ["src/app.py"]
    assert response.json()["test"]["passed"] is True
    assert response.json()["build"]["attempts"] == 1
    assert workspace_manager.read_file(project_id, "src/app.py").endswith("'fixed'\n")
    assert workspace_manager.get_status(project_id) == "ready"


def test_autonomous_task_has_a_three_repair_attempt_limit(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [{"name": "src/app.py", "content": "def app():\n    return 'old'\n"}],
    )
    monkeypatch.setattr(
        main.editor,
        "maintain",
        lambda _files, _instruction: {
            "summary": "Updated the app.",
            "files": [
                {"name": "src/app.py", "content": "def app():\n    return 'new'\n"},
            ],
        },
    )
    monkeypatch.setattr(
        main.tester,
        "run",
        lambda _files: {"passed": True, "errors": []},
    )
    monkeypatch.setattr(
        main.builder,
        "run",
        lambda _files, _project_id: {
            "passed": False,
            "stage": "build",
            "errors": ["Build failed."],
            "stdout": "",
            "stderr": "diagnostic",
        },
    )
    repair_calls = []

    def repair(files, _errors, _stdout, _stderr):
        repair_calls.append(len(files))
        return files

    monkeypatch.setattr(main.builder, "fix", repair)

    response = TestClient(main.app).post(
        f"/projects/{project_id}/ai-autonomous",
        json={"instruction": "Improve the app"},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["build"]["attempts"] == 3
    assert len(repair_calls) == 3
    assert workspace_manager.get_status(project_id) == "failed"
