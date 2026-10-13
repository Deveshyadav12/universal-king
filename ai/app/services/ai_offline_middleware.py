            return

        try:
            headers = {}
            if token:
                headers["X-Hexawave-Service-Token"] = token

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{ai_url}/health", headers=headers)

            self.is_online = response.status_code < 400
        except (httpx.HTTPError, ValueError) as exc:
            self.is_online = False
            print(f"AI service availability check failed: {exc}")


def create_ai_offline_middleware(app):
    """Factory for Starlette's middleware stack."""
    return AIOfflineMiddleware(app)


class FallbackResponse:
    """Helper methods for predictable fallback payloads."""

    @staticmethod
    def create_ai_unavailable_response(endpoint: str, task: str):
        return {
            "success": False,
            "error": "ai_unavailable",
            "message": f"AI service is currently offline. {task} functionality is limited.",
            "endpoint": endpoint,
            "fallback_available": True,
            "timestamp": datetime.now().isoformat(),
        }

    @staticmethod
    def create_offline_generation_response(project_name: str, project_type: str):
        safe_project_name = project_name.replace("\\n", " ").replace("\\r", " ")
        safe_project_type = project_type.replace("\\n", " ").replace("\\r", " ")
        return {
            "success": True,
            "projectId": f"offline-{datetime.now().timestamp()}",
            "fallback": True,
            "offline": True,
            "files": [
                {
                    "name": "main.py",
                    "language": "python",
                    "content": (
                        f"# {safe_project_name}\n"
                        "# Generated in offline mode\n\n"
                        "def main():\n"
                        f'    print("Hello from {safe_project_name}!")\n'
                        f"    # TODO: Implement your {safe_project_type} logic here\n\n"
                        'if __name__ == "__main__":\n'
                        "    main()\n"
                    ),
                },
                {
                    "name": "README.md",
                    "language": "markdown",
                    "content": (
                        f"# {safe_project_name}\n\n"
                        "This project was generated in offline mode.\n\n"
                        f"## Project Type: {safe_project_type}\n\n"
                        "## Next Steps\n"
                        "1. Review the generated code\n"
                        "2. Customize the implementation\n"
                        "3. Test your application\n\n"
                        "---\n"
                        "*AI service was offline during generation*\n"
                    ),
                },
            ],
            "message": "Generated in offline mode",
            "warning": "AI service is offline. This is a template response.",
        }

    @staticmethod
    def create_offline_score_response(lead_data: dict):
        score = 0
        reasons = []

        if lead_data.get("companyName"):
            score += 10
            reasons.append("+10: Company name is present")
        if lead_data.get("email"):
            score += 20
            reasons.append("+20: Contact email is available")
        if lead_data.get("website"):
            score += 15
            reasons.append("+15: Company website is available")
        if lead_data.get("industry"):
            score += 5
            reasons.append("+5: Industry information is available")

        score = min(score, 100)
        qualification = (
            "HIGH_PRIORITY" if score >= 80 else
            "GOOD" if score >= 60 else
            "MEDIUM" if score >= 35 else
            "LOW"
        )
        return {
            "score": score,
            "reasons": reasons,
            "qualification": qualification,
            "fallback": True,
            "offline": True,
            "message": "Lead scored using fallback logic (AI offline)",
        }
