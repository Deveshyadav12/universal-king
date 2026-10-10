from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.llm import engine


def test_ollama_uses_openai_compatible_chat_api(monkeypatch):
    client = Mock()
    client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="Generated locally."))]
    )
    openai_client = Mock(return_value=client)
    monkeypatch.setattr(engine, "OpenAI", openai_client)
    monkeypatch.setenv("HEXAWAVE_LLM_PROVIDER", "ollama")
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://localhost:11434/v1/")
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:1.5b")
    monkeypatch.delenv("HEXAWAVE_MODEL", raising=False)

    llm = engine.LLMEngine()

    openai_client.assert_called_once_with(
        api_key="ollama",
        base_url="http://localhost:11434/v1",
    )
    assert llm.model == "qwen2.5:1.5b"
    assert llm.generate("system instructions", "write a function") == "Generated locally."
    client.chat.completions.create.assert_called_once_with(
        model="qwen2.5:1.5b",
        messages=[
            {"role": "system", "content": "system instructions"},
            {"role": "user", "content": "write a function"},
        ],
    )


def test_openai_provider_keeps_responses_api(monkeypatch):
    client = Mock()
    client.responses.create.return_value = SimpleNamespace(output_text="Generated remotely.")
    openai_client = Mock(return_value=client)
    monkeypatch.setattr(engine, "OpenAI", openai_client)
    monkeypatch.setenv("HEXAWAVE_LLM_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("HEXAWAVE_MODEL", raising=False)

    llm = engine.LLMEngine()

    openai_client.assert_called_once_with(api_key="test-key")
    assert llm.model == "gpt-5.6"
    assert llm.generate("system instructions", "write a function") == "Generated remotely."
    client.responses.create.assert_called_once_with(
        model="gpt-5.6",
        instructions="system instructions",
        input="write a function",
    )


def test_rejects_unknown_provider(monkeypatch):
    monkeypatch.setenv("HEXAWAVE_LLM_PROVIDER", "unknown")

    with pytest.raises(ValueError, match="HEXAWAVE_LLM_PROVIDER"):
        engine.LLMEngine()
