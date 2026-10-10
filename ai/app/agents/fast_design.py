import json
from typing import Any

from app.llm import LLMEngine, safe_llm_error


class FastDesignAgent:
    name = "fast_design"

    def __init__(self):
        self.llm = LLMEngine()

    def run(
        self,
        project_name: str,
        project_type: str,
        stack: str,
        prompt: str,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        system = """
You are HexaWave's fast product designer. In one focused pass, plan the
requested application and design its practical architecture for the requested
stack. Be specific, prioritize the user's core workflow, and avoid unnecessary
features. Return ONLY valid JSON in this exact shape:
{
  "plan": {
    "features": [],
    "requirements": [],
    "user_flows": [],
    "risks": []
  },
  "architecture": {
    "frontend": "",
    "backend": "",
    "database": "",
    "api": [],
    "modules": [],
    "architecture": []
  }
}
Do not generate source code. Keep every required field, using an empty list or
empty string only when genuinely not applicable.
"""
        user_prompt = json.dumps(
            {
                "project_name": project_name,
                "project_type": project_type,
                "stack": stack,
                "request": prompt,
            },
            ensure_ascii=False,
        )

        try:
            result = json.loads(self.llm.generate(system, user_prompt))
            plan = result.get("plan")
            architecture = result.get("architecture")
            if not isinstance(plan, dict) or not isinstance(architecture, dict):
                raise ValueError("Fast designer response is missing plan or architecture.")

            for field in ("features", "requirements", "user_flows", "risks"):
                if not isinstance(plan.get(field), list):
                    raise ValueError(f"Fast designer returned an invalid plan field: {field}.")
            for field in ("frontend", "backend", "database"):
                if not isinstance(architecture.get(field), str):
                    raise ValueError(
                        f"Fast designer returned an invalid architecture field: {field}."
                    )
            for field in ("api", "modules", "architecture"):
                if not isinstance(architecture.get(field), list):
                    raise ValueError(
                        f"Fast designer returned an invalid architecture field: {field}."
                    )

            plan.update(
                {
                    "agent": "planner",
                    "project_name": project_name,
                    "project_type": project_type,
                    "stack": stack,
                    "prompt": prompt,
                }
            )
            architecture["agent"] = "architect"
            return plan, architecture
        except Exception as error:
            raise RuntimeError(safe_llm_error("Fast designer agent", error)) from error
