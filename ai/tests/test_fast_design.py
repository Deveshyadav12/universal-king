import json

import pytest
from pydantic import ValidationError

import app.main as main
from app.agents.fast_design import FastDesignAgent


def _design_response() -> dict:
    return {
        "plan": {
            "features": ["Create and manage tasks"],
            "requirements": ["Responsive interface"],
            "user_flows": ["Create a task"],
            "risks": [],
        },
        "architecture": {
            "frontend": "React",
            "backend": "FastAPI",
            "database": "SQLite",
            "api": ["GET /tasks"],
            "modules": ["tasks"],
            "architecture": ["Browser calls API"],
        },
    }


def test_fast_designer_combines_plan_and_architecture_in_one_llm_call(monkeypatch):
    agent = FastDesignAgent()
    calls: list[tuple[str, str]] = []

    def generate(system: str, prompt: str) -> str:
        calls.append((system, prompt))
        return json.dumps(_design_response())

    monkeypatch.setattr(agent.llm, "generate", generate)

    plan, architecture = agent.run(
        project_name="Task board",
        project_type="Web App",
        stack="React",
        prompt="Create a task manager",
    )

    assert len(calls) == 1
    assert json.loads(calls[0][1])["request"] == "Create a task manager"
    assert plan["agent"] == "planner"
    assert plan["features"] == ["Create and manage tasks"]
    assert architecture["agent"] == "architect"
    assert architecture["backend"] == "FastAPI"


def test_fast_designer_rejects_incomplete_model_response(monkeypatch):
    agent = FastDesignAgent()
    monkeypatch.setattr(
        agent.llm,
        "generate",
        lambda _system, _prompt: json.dumps({"plan": {}, "architecture": {}}),
    )

    with pytest.raises(RuntimeError, match="Fast designer agent"):
        agent.run("Task board", "Web App", "React", "Create a task manager")


def test_fast_generation_pipeline_uses_one_designer_then_validates_and_builds(monkeypatch):
    events: list[str] = []
    files = [{"name": "README.md", "language": "markdown", "content": "# Task board"}]
    expected_design = _design_response()

    class Designer:
        def run(self, **_kwargs):
            events.append("fast_design")
            return expected_design["plan"], expected_design["architecture"]

    class DisallowedAgent:
        def run(self, *_args, **_kwargs):
            raise AssertionError("Fast mode must not make separate plan or architecture calls.")

    class Developer:
        def run(self, **_kwargs):
            events.append("developer")
            return files

    class Tester:
        def run(self, _files):
            events.append("tester")
            return {"passed": True, "errors": []}

    class Builder:
        def run(self, _files, _project_id):
            events.append("builder")
            return {"passed": True, "errors": [], "stage": "build"}

    monkeypatch.setattr(main, "fast_designer", Designer())
    monkeypatch.setattr(main, "planner", DisallowedAgent())
    monkeypatch.setattr(main, "architect", DisallowedAgent())
    monkeypatch.setattr(main, "developer", Developer())
    monkeypatch.setattr(main, "tester", Tester())
    monkeypatch.setattr(main, "builder", Builder())
    monkeypatch.setattr(main, "set_status", lambda _project_id, status: events.append(status))
    monkeypatch.setattr(main, "write_files", lambda _project_id, _files: None)

    result = main.run_pipeline(
        main.GenerateRequest(
            projectName="Task board",
            projectType="Web App",
            stack="React",
            prompt="Create a task manager",
            generationMode="fast",
        ),
        "project-id",
    )

    assert result[0]["features"] == ["Create and manage tasks"]
    assert result[1]["backend"] == "FastAPI"
    assert events == [
        "planning",
        "fast_design",
        "coding",
        "developer",
        "testing",
        "tester",
        "building",
        "builder",
        "ready",
    ]


def test_generation_mode_only_accepts_fast_or_full():
    with pytest.raises(ValidationError):
        main.GenerateRequest(
            projectName="Task board",
            projectType="Web App",
            stack="React",
            prompt="Create a task manager",
            generationMode="infinite",
        )
