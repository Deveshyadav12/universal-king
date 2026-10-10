import json

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.agents.builder import BuildAgent
from app.agents.planner import PlannerAgent
from app.agents.tester import TesterAgent
import app.workspace.manager as workspace_manager
import app.workspace.runner as workspace_runner


@pytest.mark.parametrize(
    "unsafe_path",
    [
        "../outside.txt",
        "..\\outside.txt",
        "C:\\outside.txt",
        "\\\\server\\share\\outside.txt",
    ],
)
def test_workspace_rejects_paths_outside_project_root(tmp_path, monkeypatch, unsafe_path):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)

    with pytest.raises(ValueError):
        workspace_manager.write_files(
            project_id,
            [{"name": unsafe_path, "content": "must not be written"}],
        )

    assert not (tmp_path / "outside.txt").exists()


def test_missing_run_script_returns_actionable_error_without_ai_repair(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path)
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [
            {
                "name": "package.json",
                "content": json.dumps({"scripts": {"build": "echo build"}}),
            }
        ],
    )
    workspace_manager.set_status(project_id, "ready")

    install_called = False

    def unexpected_install(_project_id):
        nonlocal install_called
        install_called = True
        return {"success": True}

    monkeypatch.setattr(main, "install", unexpected_install)
    monkeypatch.setattr(
        main,
        "run_project",
        lambda _project_id: {
            "success": False,
            "message": "Application has no runnable dev or start script.",
            "stdout": "",
            "stderr": "",
        },
    )

    repair_calls = []

    def fail_repair(*_args, **_kwargs):
        repair_calls.append(True)
        raise RuntimeError(
            "401 invalid_api_key Incorrect API key provided: SECRET_VALUE"
        )

    monkeypatch.setattr(main.builder, "fix", fail_repair)
    client = TestClient(main.app)

    run_response = client.post(f"/projects/{project_id}/run")
    status_response = client.get(f"/projects/{project_id}/status")

    assert run_response.status_code == 422
    assert status_response.status_code == 200
    assert status_response.json()["status"] == "failed"
    assert (
        "no dev or start script"
        in status_response.json()["output"]
    )
    assert run_response.json()["detail"]["repairable"] is False
    assert repair_calls == []
    assert install_called is False
    assert "SECRET_VALUE" not in run_response.text
    assert "SECRET_VALUE" not in status_response.json()["output"]


def test_generate_does_not_report_success_when_model_authentication_fails(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path)

    def fail_llm(*_args, **_kwargs):
        raise RuntimeError(
            "401 invalid_api_key Incorrect API key provided: SECRET_VALUE"
        )

    monkeypatch.setattr(main.planner.llm, "generate", fail_llm)
    client = TestClient(main.app)

    response = client.post(
        "/generate",
        json={
            "projectName": "Smoke test",
            "projectType": "Web App",
            "stack": "Next.js + TypeScript",
            "prompt": "Create a page with a heading.",
            "generationMode": "full",
        },
    )

    assert response.status_code == 500
    assert response.json()["detail"] == (
        "Project generation failed: model provider rejected the configured "
        "API credential (HTTP 401)."
    )
    assert "SECRET_VALUE" not in response.text


def test_ai_service_stays_healthy_when_model_credential_is_missing(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path)
    monkeypatch.setenv("HEXAWAVE_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setattr(main, "planner", PlannerAgent())
    client = TestClient(main.app)

    health_response = client.get("/health")
    generate_response = client.post(
        "/generate",
        json={
            "projectName": "Smoke test",
            "projectType": "Web App",
            "stack": "Next.js + TypeScript",
            "prompt": "Create a page with a heading.",
            "generationMode": "full",
        },
    )

    assert health_response.status_code == 200
    assert generate_response.status_code == 500
    assert generate_response.json()["detail"] == (
        "Project generation failed: model provider API credential is not configured."
    )


def test_python_tester_reports_syntax_errors():
    result = TesterAgent().run(
        [{"name": "main.py", "content": "def broken(:\n    pass\n"}]
    )

    assert not result["passed"]
    assert any("Python syntax error in main.py:1" in error for error in result["errors"])


def test_python_builder_validates_source_without_node_manifest():
    result = BuildAgent().run(
        [
            {"name": "main.py", "content": "def main():\n    return 'ok'\n"},
            {"name": "README.md", "content": "# Python project"},
        ]
    )

    assert result["passed"]
    assert result["stage"] == "python-validation"


def test_python_builder_disables_execution_in_production(monkeypatch):
    monkeypatch.setenv("HEXAWAVE_ENV", "production")
    agent = BuildAgent()

    def unexpected_command(*_args, **_kwargs):
        raise AssertionError("Production build must not execute commands.")

    monkeypatch.setattr(agent, "_run_command", unexpected_command)
    result = agent.run(
        [
            {"name": "package.json", "content": json.dumps({"scripts": {"build": "echo unsafe"}})},
            {"name": "index.js", "content": "process.exit(1);\n"},
        ]
    )

    assert not result["passed"]
    assert result["stage"] == "sandbox-required"


def test_builder_runs_configured_node_tests_without_watch_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [
            {
                "name": "package.json",
                "content": json.dumps({"scripts": {"test": "vitest"}}),
            },
        ],
    )
    agent = BuildAgent()
    captured = {}

    def run_command(command, _cwd, timeout=180, extra_environment=None):
        captured["command"] = command
        captured["timeout"] = timeout
        captured["environment"] = extra_environment
        return {"returncode": 0, "stdout": "tests passed", "stderr": ""}

    monkeypatch.setattr(agent, "_run_command", run_command)

    result = agent.run_tests(project_id)

    assert result["passed"] is True
    assert result["skipped"] is False
    assert captured["command"] == workspace_runner.npm_command(
        "test",
        "--",
        "--watch=false",
    )
    assert captured["timeout"] == 300
    assert captured["environment"] == {"CI": "true"}


def test_builder_reports_runtime_tests_skipped_when_not_configured(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path / "workspaces")
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.write_files(
        project_id,
        [
            {
                "name": "package.json",
                "content": json.dumps({"scripts": {"build": "echo build"}}),
            },
        ],
    )

    result = BuildAgent().run_tests(project_id)

    assert result["passed"] is True
    assert result["skipped"] is True
    assert "No package.json test script" in result["stderr"]


def test_project_runner_disables_execution_in_production(monkeypatch):
    monkeypatch.setenv("HEXAWAVE_ENV", "production")

    install_result = workspace_runner.install("invalid-project-id")
    run_result = workspace_runner.run_project("invalid-project-id")

    assert not install_result["success"]
    assert not run_result["success"]
    assert "sandbox" in install_result["message"]
    assert "sandbox" in run_result["message"]


def test_python_builder_installs_requirements_without_shell(tmp_path, monkeypatch):
    agent = BuildAgent()
    captured = {}

    def fake_run(command, cwd, timeout=180):
        captured["command"] = command
        captured["cwd"] = cwd
        captured["timeout"] = timeout
        return {"returncode": 0, "stdout": "", "stderr": ""}

    monkeypatch.setattr(agent, "_run_command", fake_run)
    result = agent.run(
        [
            {"name": "main.py", "content": "print('ready')\n"},
            {"name": "requirements.txt", "content": "fastapi\n"},
        ]
    )

    assert result["passed"]
    assert captured["command"][:3] == [
        workspace_runner.sys.executable,
        "-m",
        "pip",
    ]
    assert captured["command"][-2:] == ["-r", str(captured["cwd"] / "requirements.txt")]
    assert captured["timeout"] == 300


def test_python_fastapi_runner_uses_safe_uvicorn_arguments(
    tmp_path, monkeypatch
):
    monkeypatch.setattr(workspace_manager, "WORKSPACES_ROOT", tmp_path)
    project_id = "963b1576-6d44-4ce2-a1a5-0948e4cd6481"
    workspace_manager.create_workspace(project_id)
    workspace_manager.update_meta(
        project_id,
        {"stack": "Python + FastAPI"},
    )
    workspace_manager.write_files(
        project_id,
        [{"name": "app/main.py", "content": "from fastapi import FastAPI\napp = FastAPI()\n"}],
    )

    class FakeProcess:
        pid = 4321

        def poll(self):
            return None

    captured = {}

    def fake_popen(command, **options):
        captured["command"] = command
        captured["options"] = options
        return FakeProcess()

    monkeypatch.setattr(workspace_runner, "_find_free_port", lambda: 3001)
    monkeypatch.setattr(workspace_runner, "_port_is_open", lambda _port: True)
    monkeypatch.setattr(workspace_runner.subprocess, "Popen", fake_popen)

    result = workspace_runner.run_project(project_id)

    assert result["success"]
    assert result["port"] == 3001
    assert captured["command"] == [
        workspace_runner.sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "3001",
    ]
    assert captured["options"]["shell"] is False
