import os
from openai import OpenAI


class LLMEngine:
    def __init__(self):
        self.provider = os.getenv("HEXAWAVE_LLM_PROVIDER", "ollama").strip().lower()
        if self.provider not in {"openai", "ollama"}:
            raise ValueError("HEXAWAVE_LLM_PROVIDER must be openai or ollama.")
        if self.provider == "ollama":
            self.model = os.getenv(
                "HEXAWAVE_MODEL",
                os.getenv("OLLAMA_MODEL", "qwen2.5:1.5b"),
            )
            base_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1").rstrip("/")
            self.client = OpenAI(api_key="ollama", base_url=base_url)
        else:
            self.model = os.getenv("HEXAWAVE_MODEL", "gpt-5.6")
            api_key = os.getenv("OPENAI_API_KEY")
            self.client = OpenAI(api_key=api_key) if api_key else None

    def generate(
        self,
        system: str,
        prompt: str,
    ) -> str:
        if self.client is None:
            raise RuntimeError("OPENAI_API_KEY is not configured for the OpenAI provider.")

        if self.provider == "ollama":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
            )
            content = response.choices[0].message.content
            if not content:
                raise RuntimeError("Ollama returned an empty response.")
            return content

        response = self.client.responses.create(
            model=self.model,
            instructions=system,
            input=prompt,
        )
        return response.output_text
