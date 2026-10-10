import json
from pathlib import PurePosixPath, PureWindowsPath

from app.llm import LLMEngine, safe_llm_error


class DeveloperAgent:
    name = "developer"

    def __init__(self):
        self.llm = LLMEngine()

    def run(self, plan: dict, architecture: dict):
        system = """
You are the Developer agent of HexaWave AI Software Factory.

Generate a complete software project from the supplied plan.

Return ONLY valid JSON:

{
  "files": [
    {
      "name": "relative/path",
      "language": "tsx",
      "content": "complete file content"
    }
  ]
}

Rules:
- Generate complete files.
- Use the requested stack.
- Keep imports internally consistent.
- Include package.json for JavaScript/TypeScript projects.
- For Node.js applications, include runnable scripts.dev and scripts.start, plus
  scripts.build and scripts.test. Use commands that match the selected framework.
- Ensure the app binds to the provided PORT environment variable and localhost.
- Include README.md.
- Never include node_modules.
- Never include secrets.
- Never use absolute paths.
- Never use ../ paths.
"""

        try:
            raw = self.llm.generate(
                system,
                json.dumps(
                    {"plan": plan, "architecture": architecture},
                    indent=2,
                ),
            )
        except Exception as error:
            raise RuntimeError(safe_llm_error("Developer agent", error)) from error

        try:
            response = raw.strip()
            if response.startswith("```"):
                response = response.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            start = response.find("{")
            if start < 0:
                raise ValueError("No JSON object was returned.")
            result, _ = json.JSONDecoder().raw_decode(response[start:])
        except (json.JSONDecodeError, ValueError) as error:
            raise RuntimeError(
                "Developer agent returned invalid or truncated JSON. Retry with a smaller project scope."
            ) from error

        if not isinstance(result, dict) or not isinstance(result.get("files"), list):
            raise RuntimeError("Developer agent response must contain a files array.")

        clean = []
        seen_names: set[str] = set()
        for file in result["files"]:
            if not isinstance(file, dict):
                raise RuntimeError("Developer agent returned an invalid file entry.")
            name = file.get("name")
            content = file.get("content")
            if not isinstance(name, str) or not isinstance(content, str):
                raise RuntimeError("Developer agent files require a name and text content.")

            normalized_name = name.strip().replace("\\", "/")
            posix_path = PurePosixPath(normalized_name)
            windows_path = PureWindowsPath(name.strip())
            if (
                not normalized_name
                or posix_path.is_absolute()
                or windows_path.is_absolute()
                or windows_path.drive
                or ".." in posix_path.parts
            ):
                raise RuntimeError(
                    f"Developer agent returned an unsafe file path: {name!r}."
                )
            if not content.strip():
                raise RuntimeError(
                    f"Developer agent returned empty content for {normalized_name}."
                )
            if normalized_name.casefold() in seen_names:
                raise RuntimeError(
                    f"Developer agent returned a duplicate file path: {normalized_name}."
                )
            seen_names.add(normalized_name.casefold())
            clean.append({
                "name": normalized_name,
                "language": str(file.get("language", "text")),
                "content": content,
            })

        if not clean:
            raise RuntimeError("Developer agent returned no project files.")
        return clean
