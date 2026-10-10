import json

import pytest

from app.agents.developer import DeveloperAgent


def test_developer_accepts_json_fenced_project_response(monkeypatch):
    agent = DeveloperAgent()
    monkeypatch.setattr(
        agent.llm,
        "generate",
        lambda _system, _prompt: (
            "```json\n"
            + json.dumps(
                {
                    "files": [
                        {
                            "name": "src/app.py",
                            "language": "python",
                            "content": "print('hello')\n",
                        },
                    ],
                },
            )
            + "\n```"
        ),
    )

    files = agent.run({"features": []}, {"backend": "Python"})

    assert files == [
        {
            "name": "src/app.py",
            "language": "python",
            "content": "print('hello')\n",
        },
    ]


def test_developer_reports_truncated_json_as_actionable_error(monkeypatch):
    agent = DeveloperAgent()
    monkeypatch.setattr(
        agent.llm,
        "generate",
        lambda _system, _prompt: '{"files":[{"name":"src/app.py","content":"unfinished',
    )

    with pytest.raises(RuntimeError, match="invalid or truncated JSON"):
        agent.run({"features": []}, {"backend": "Python"})


def test_developer_rejects_unsafe_file_paths(monkeypatch):
    agent = DeveloperAgent()
    monkeypatch.setattr(
        agent.llm,
        "generate",
        lambda _system, _prompt: json.dumps(
            {
                "files": [
                    {
                        "name": r"..\outside.py",
                        "language": "python",
                        "content": "unsafe",
                    },
                ],
            },
        ),
    )

    with pytest.raises(RuntimeError, match="unsafe file path"):
        agent.run({"features": []}, {"backend": "Python"})
