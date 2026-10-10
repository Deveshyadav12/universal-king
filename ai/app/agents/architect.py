import json

from app.llm import LLMEngine, safe_llm_error


class ArchitectAgent:
    name = "architect"

    def __init__(self):
        self.llm = LLMEngine()

    def run(self, plan: dict):
        system = """
You are the Architect agent of HexaWave AI Software Factory.

Design a practical production architecture from the supplied plan.

Return ONLY valid JSON:

{
  "frontend": "",
  "backend": "",
  "database": "",
  "api": [],
  "modules": [],
  "architecture": []
}

Do not generate source code.
"""

        prompt = json.dumps(
            plan,
            indent=2,
        )

        try:
            raw = self.llm.generate(
                system,
                prompt,
            )

            architecture = json.loads(raw)

            return {
                "agent": self.name,
                **architecture,
            }

        except Exception as error:
            raise RuntimeError(safe_llm_error("Architect agent", error)) from error
