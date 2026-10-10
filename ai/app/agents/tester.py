import ast


class TesterAgent:
    name = "tester"

    def run(self, files: list):
        errors = []
        warnings = []

        if not files:
            errors.append(
                "Developer generated no files."
            )

            return {
                "agent": self.name,
                "passed": False,
                "errors": errors,
                "warnings": warnings,
                "files_checked": 0,
            }

        names = [
            file.get("name", "")
            for file in files
        ]

        if "README.md" not in names:
            warnings.append(
                "README.md was not generated."
            )

        source_extensions = (
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".py",
        )

        source_files = [
            file
            for file in files
            if file.get("name", "").endswith(
                source_extensions
            )
        ]

        if not source_files:
            errors.append(
                "No source code files generated."
            )

        for file in files:
            name = file.get("name", "")
            content = file.get("content", "")

            if not name:
                errors.append(
                    "A generated file has no name."
                )

            if not content.strip():
                errors.append(
                    f"Empty file: {name}"
                )

            if len(content) > 500000:
                errors.append(
                    f"File is too large: {name}"
                )

            dangerous = [
                "OPENAI_API_KEY=",
                "sk-",
                "password=",
                "secret=",
            ]

            for token in dangerous:
                if token.lower() in content.lower():
                    errors.append(
                        f"Possible secret in: {name}"
                    )

            if "TODO" in content:
                warnings.append(
                    f"TODO found in: {name}"
                )

            if name.endswith(".py"):
                try:
                    ast.parse(content, filename=name)
                except SyntaxError as error:
                    errors.append(
                        f"Python syntax error in {name}:{error.lineno}: {error.msg}"
                    )

        unique_names = set()

        for name in names:
            if name in unique_names:
                errors.append(
                    f"Duplicate file: {name}"
                )

            unique_names.add(name)

        return {
            "agent": self.name,
            "passed": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "files_checked": len(files),
        }
