import json

from app.llm import LLMEngine, safe_llm_error


class PlannerAgent:
    name = "planner"

    def __init__(self):
        self.llm = LLMEngine()

    def run(
        self,
        project_name: str,
        project_type: str,
        stack: str,
        prompt: str,
    ):
        system = """
You are the Planner agent of HexaWave AI Software Factory.

Analyze the user's software request.

Return ONLY valid JSON.

Required fields:
{
  "features": [],
  "requirements": [],
  "user_flows": [],
  "risks": []
}

Do not write source code.
"""

        user_prompt = f"""
Project name: {project_name}
Project type: {project_type}
Stack: {stack}

User request:
{prompt}
"""

        try:
            raw = self.llm.generate(
                system,
                user_prompt,
            )

            result = json.loads(raw)

            return {
                "agent": self.name,
                "project_name": project_name,
                "project_type": project_type,
                "stack": stack,
                "prompt": prompt,
                **result,
            }

        except Exception as error:
            raise RuntimeError(safe_llm_error("Planner agent", error)) from error
