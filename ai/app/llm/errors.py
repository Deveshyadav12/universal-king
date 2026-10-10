def safe_llm_error(agent: str, error: Exception) -> str:
    message = str(error).casefold()
    if (
        "openai_api_key is not configured" in message
        or "model provider api credential is not configured" in message
    ):
        return f"{agent} failed: model provider API credential is not configured."
    if (
        "model provider rejected the configured api credential" in message
        or any(
            marker in message
            for marker in (
                "invalid_api_key",
                "incorrect api key",
                "authentication_error",
            )
        )
    ):
        return (
            f"{agent} failed: model provider rejected the configured "
            "API credential (HTTP 401)."
        )
    return f"{agent} failed ({type(error).__name__})."
