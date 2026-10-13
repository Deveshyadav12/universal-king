from dotenv import load_dotenv

load_dotenv()

import hmac
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field
from io import BytesIO
from pathlib import Path, PurePosixPath, PureWindowsPath
from zipfile import ZipFile, ZIP_DEFLATED
import html

from app.agents import (
    PlannerAgent,
    ArchitectAgent,
    DeveloperAgent,
    TesterAgent,
    BuildAgent,
    EditorAgent,
    FastDesignAgent,
)
from app.llm import safe_llm_error
from app.services.ai_database import AIDatabaseService
from app.services.ai_client_handler import client_handler, offline_handler
from app.services.ai_offline_middleware import create_ai_offline_middleware, FallbackResponse
from app.config.ai_config import get_config
from app.workspace import (
    append_runner_output,
    create_workspace,
    write_files,
    read_file,
    list_files,
    set_status,
    get_status,
    get_process,
    get_root,
    read_meta,
    update_meta,
    list_workspaces,
    workspace_exists,
)
from app.workspace.runner import (
    build,
    get_run_preflight_error,
    get_process_status,
    get_runner_output,
    install,
    run_project,
    stop_project,
)
from app.workspace.maintenance import (
    IGNORED_DIRECTORIES,
    MAX_ARCHIVE_BYTES,
    SECRET_PATTERN,
    MaintenanceImportError,
    _is_text_project_file,
    import_public_github_project,
    import_project_zip,
)
from app.security import is_production_environment, project_execution_block_message


app = FastAPI(title="HexaWave AI", version="0.6.0")

# Initialize services
ai_database = AIDatabaseService()

# Add AI offline middleware for automatic fallback
app.add_middleware(create_ai_offline_middleware)

# Global config reference
config = get_config()


@app.middleware("http")
async def require_internal_service_token(request: Request, call_next):
    if request.url.path == "/health":
        return await call_next(request)

    expected_token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN", "")
    if not expected_token:
        if is_production_environment():
            return JSONResponse(
                status_code=503,
                content={"detail": "AI service authentication is not configured."},
            )
        return await call_next(request)

    supplied_token = request.headers.get("X-Hexawave-Service-Token", "")
    if not hmac.compare_digest(supplied_token, expected_token):
        return JSONResponse(
            status_code=401,
            content={"detail": "A valid internal service token is required."},
        )
    return await call_next(request)


planner = PlannerAgent()
architect = ArchitectAgent()
developer = DeveloperAgent()
tester = TesterAgent()
builder = BuildAgent()
editor = EditorAgent()
fast_designer = FastDesignAgent()


# ── Request models ────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    projectName: str
    projectType: str
    stack: str
    prompt: str
    projectId: str | None = None
    generationMode: str = Field(default="fast", pattern=r"^(fast|full)$")


class GeneratedFile(BaseModel):
    name: str
    language: str
    content: str


class CreateProjectRequest(BaseModel):
    projectId: str
    name: str
    type: str
    stack: str
    description: str


class MaintenanceImportRequest(BaseModel):
    projectId: str = Field(
        min_length=36,
        max_length=36,
        pattern=r"^[0-9a-fA-F-]{36}$",
    )
    projectName: str = Field(min_length=1, max_length=120)
    archiveBase64: str = Field(
        min_length=4,
        max_length=((MAX_ARCHIVE_BYTES + 2) // 3) * 4,
    )


class GithubMaintenanceImportRequest(BaseModel):
    projectId: str = Field(
        min_length=36,
        max_length=36,
        pattern=r"^[0-9a-fA-F-]{36}$",
    )
    repositoryUrl: str = Field(min_length=1, max_length=2048)


class UpdateFileRequest(BaseModel):
    content: str


class AiEditRequest(BaseModel):
    filePath: str = Field(min_length=1, max_length=512)
    instruction: str = Field(min_length=1, max_length=10000)


class ProjectMaintenanceRequest(BaseModel):
    instruction: str = Field(min_length=1, max_length=10000)


class LeadScoreRequest(BaseModel):
    lead: dict[str, object]


MAX_MAINTENANCE_FILES = 40
MAX_MAINTENANCE_FILE_CHARS = 12000
MAX_MAINTENANCE_CONTEXT_CHARS = 60000
MAX_MAINTENANCE_OUTPUT_CHARS = 250000


def _maintenance_context(project_id: str) -> tuple[list[dict[str, str]], int]:
    root = get_root(project_id)
    context: list[dict[str, str]] = []
    context_chars = 0
    excluded_count = 0

    for name in list_files(project_id):
        relative = PurePosixPath(name)
        if (
            IGNORED_DIRECTORIES.intersection(relative.parts)
            or not _is_text_project_file(name)
        ):
            excluded_count += 1
            continue

        target = root.joinpath(*relative.parts)
        if (
            _has_symlink_component(root, relative)
            or not target.resolve().is_relative_to(root.resolve())
        ):
            excluded_count += 1
            continue

        try:
            content = read_file(project_id, name)
        except (OSError, UnicodeDecodeError, ValueError):
            excluded_count += 1
            continue

        if (
            len(content) > MAX_MAINTENANCE_FILE_CHARS
            or SECRET_PATTERN.search(content)
            or len(context) >= MAX_MAINTENANCE_FILES
            or context_chars + len(content) > MAX_MAINTENANCE_CONTEXT_CHARS
        ):
            excluded_count += 1
            continue

        context.append({"name": name, "content": content})
        context_chars += len(content)

    return context, excluded_count


def _has_symlink_component(root: Path, relative: PurePosixPath) -> bool:
    target = root
    for part in relative.parts:
        target = target / part
        if target.is_symlink():
            return True
    return False


def _validate_maintenance_response(
    response: dict[str, object],
    project_id: str,
) -> tuple[str, list[dict[str, str]]]:
    summary = response.get("summary", "")
    files = response.get("files")
    if not isinstance(summary, str) or not isinstance(files, list):
        raise ValueError("AI project maintenance response must include a summary and files array.")
    if len(files) > MAX_MAINTENANCE_FILES:
        raise ValueError("AI project maintenance returned too many files.")

    validated: list[dict[str, str]] = []
    seen_names: set[str] = set()
    total_chars = 0
    root = get_root(project_id)
    for item in files:
        if not isinstance(item, dict):
            raise ValueError("AI project maintenance returned an invalid file entry.")
        name = item.get("name")
        content = item.get("content")
        if not isinstance(name, str) or not isinstance(content, str) or not name:
            raise ValueError("AI project maintenance files require a relative name and text content.")
        if len(content) > MAX_MAINTENANCE_FILE_CHARS:
            raise ValueError(f"AI project maintenance returned an oversized file: {name}")
        relative = PurePosixPath(name.replace("\\", "/"))
        windows_path = PureWindowsPath(name)
        if (
            relative.is_absolute()
            or windows_path.is_absolute()
            or windows_path.drive
            or not relative.parts
            or "\x00" in name
            or ".." in relative.parts
            or relative.as_posix().casefold() in {".hexawave.json", "runner.log"}
            or not _is_text_project_file(name)
            or IGNORED_DIRECTORIES.intersection(relative.parts)
        ):
            raise ValueError(f"AI project maintenance returned an unsafe file path: {name}")
        target = root.joinpath(*relative.parts)
        if (
            _has_symlink_component(root, relative)
            or not target.resolve().is_relative_to(root.resolve())
        ):
            raise ValueError(f"AI project maintenance returned an unsafe file path: {name}")
        normalized_name = relative.as_posix()
        if normalized_name.casefold() in seen_names:
            raise ValueError(f"AI project maintenance returned a duplicate file path: {name}")
        if SECRET_PATTERN.search(content):
            raise ValueError(f"AI project maintenance returned possible credentials in {name}.")
        seen_names.add(normalized_name.casefold())
        total_chars += len(content)
        if total_chars > MAX_MAINTENANCE_OUTPUT_CHARS:
            raise ValueError("AI project maintenance returned too much content.")
        validated.append({"name": normalized_name, "content": content})

    return summary[:1000], validated


def _lead_text(lead: dict[str, object], key: str) -> str:
    value = lead.get(key)
    return value.strip() if isinstance(value, str) else ""


def score_lead(lead: dict[str, object]) -> dict[str, object]:
    score = 0
    reasons: list[str] = []

    criteria = [
        (_lead_text(lead, "companyName"), 10, "Company name is present"),
        (_lead_text(lead, "email"), 20, "Contact email is available"),
        (_lead_text(lead, "website"), 15, "Company website is available"),
        (_lead_text(lead, "contactName"), 10, "Named contact is available"),
        (_lead_text(lead, "industry"), 5, "Industry information is available"),
        (_lead_text(lead, "companySize"), 5, "Company size is available"),
        (_lead_text(lead, "description"), 10, "Company description is available"),
        (_lead_text(lead, "sourceUrl"), 5, "Research source is recorded"),
    ]
    for value, points, reason in criteria:
        if value:
            score += points
            reasons.append(f"+{points}: {reason}")

    title = _lead_text(lead, "jobTitle").lower()
    if title:
        decision_maker_terms = ("ceo", "founder", "owner", "chief", "president", "vp", "vice president", "director", "head")
        points = 20 if any(term in title for term in decision_maker_terms) else 10
        score += points
        reasons.append(f"+{points}: Job title is available" + (" and indicates a decision-maker" if points == 20 else ""))

    technologies = lead.get("technologies")
    if isinstance(technologies, list):
        count = sum(1 for value in technologies if isinstance(value, str) and value.strip())
        points = min(count * 3, 15)
        if points:
            score += points
            reasons.append(f"+{points}: Technology names are recorded")

    score = min(score, 100)
    qualification = (
        "HIGH_PRIORITY" if score >= 80 else
        "GOOD" if score >= 60 else
        "MEDIUM" if score >= 35 else
        "LOW"
    )
    if not reasons:
        reasons.append("No qualifying lead data is available yet")
    return {"score": score, "reasons": reasons, "qualification": qualification}


# ── Pipeline ──────────────────────────────────────────────────────────────────

def run_pipeline(request: GenerateRequest, project_id: str):
    set_status(project_id, "planning")
    if request.generationMode == "fast":
        plan, architecture = fast_designer.run(
            project_name=request.projectName,
            project_type=request.projectType,
            stack=request.stack,
            prompt=request.prompt,
        )
    else:
        plan = planner.run(
            project_name=request.projectName,
            project_type=request.projectType,
            stack=request.stack,
            prompt=request.prompt,
        )

        set_status(project_id, "architecting")
        architecture = architect.run(plan)

    set_status(project_id, "coding")
    files = developer.run(plan=plan, architecture=architecture)
    write_files(project_id, files)

    set_status(project_id, "testing")
    test_result = tester.run(files)

    set_status(project_id, "building")
    build_result = builder.run(files, project_id)

    attempts = 0
    max_attempts = 3

    while not build_result["passed"] and attempts < max_attempts:
        attempts += 1
        set_status(project_id, "fixing")

        files = builder.fix(
            files=files,
            errors=build_result["errors"],
            stdout=build_result.get("stdout", ""),
            stderr=build_result.get("stderr", ""),
        )
        write_files(project_id, files)

        test_result = tester.run(files)

        if not test_result["passed"]:
            build_result = {
                "agent": "builder",
                "passed": False,
                "stage": "tester",
                "errors": test_result["errors"],
                "stdout": "",
                "stderr": "",
            }
            continue

        set_status(project_id, "building")
        build_result = builder.run(files, project_id)

    write_files(project_id, files)

    final_status = "ready" if (test_result["passed"] and build_result["passed"]) else "failed"
    set_status(project_id, final_status)

    return plan, architecture, files, test_result, build_result, attempts


# ── Health ────────────────────────────────────────────────────────────────────

def _runtime_repair_error_message(error: Exception) -> str:
    return safe_llm_error("AI runtime repair", error)


@app.get("/health")
def health():
    # Check AI service availability
    available_models = client_handler.get_available_models()
    ai_online = len(available_models) > 0
    
    return {
        "success": True,
        "service": "hexawave-ai",
        "status": "online",
        "version": "0.7.0",
        "workspaces": len(list_workspaces()),
        "ai_online": ai_online,
        "ai_models": available_models,
        "database_enabled": ai_database.connection_pool is not None,
        "auto_discovery_enabled": config.auto_discovery_enabled,
    }


@app.post("/lead/score")
async def lead_score(request: LeadScoreRequest):
    """Score a lead using AI with automatic offline fallback"""
    try:
        # Try to use AI client handler first
        result = await offline_handler.execute_with_fallback(
            "score",
            request.lead
        )
        return result
    except Exception as e:
        # Fallback to heuristic scoring if AI fails
        print(f"AI lead scoring failed, using fallback: {e}")
        return score_lead(request.lead)


# ── Generate ──────────────────────────────────────────────────────────────────

@app.post("/generate")
def generate(request: GenerateRequest):
    ws = create_workspace(request.projectId)
    project_id = ws["id"]

    try:
        plan, architecture, files, test_result, build_result, attempts = run_pipeline(request, project_id)
    except Exception as error:
        set_status(project_id, "failed")
        raise HTTPException(
            status_code=500,
            detail=safe_llm_error("Project generation", error),
        ) from error

    success = test_result["passed"] and build_result["passed"]

    return {
        "success": success,
        "projectId": project_id,
        "generationMode": request.generationMode,
        "pipeline": (
            ["fast_designer", "developer", "tester", "builder"]
            if request.generationMode == "fast"
            else ["planner", "architect", "developer", "tester", "builder"]
        ),
        "build": {
            "passed": build_result["passed"],
            "attempts": attempts,
            "errors": build_result["errors"],
            "stage": build_result.get("stage", ""),
        },
        "analysis": {
            "projectName": request.projectName,
            "projectType": request.projectType,
            "stack": request.stack,
            "features": plan.get("features", []),
            "architecture": architecture,
        },
        "test": test_result,
        "files": [GeneratedFile(**f) for f in files],
    }


@app.post("/projects")
def create_project(request: CreateProjectRequest):
    try:
        workspace = create_workspace(request.projectId)
        meta = update_meta(workspace["id"], {
            "name": request.name,
            "type": request.type,
            "stack": request.stack,
            "description": request.description,
        })
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {"success": True, "project": meta}


@app.post("/projects/maintenance/import")
def import_maintenance_project(request: MaintenanceImportRequest):
    try:
        imported = import_project_zip(
            request.projectId,
            request.projectName,
            request.archiveBase64,
        )
    except MaintenanceImportError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return imported


@app.post("/projects/maintenance/import-github")
def import_github_maintenance_project(request: GithubMaintenanceImportRequest):
    try:
        imported = import_public_github_project(
            request.projectId,
            request.repositoryUrl,
        )
    except MaintenanceImportError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return imported


@app.post("/generate/zip")
def generate_zip(request: GenerateRequest):
    ws = create_workspace(request.projectId)
    project_id = ws["id"]

    try:
        plan, architecture, files, test_result, build_result, attempts = run_pipeline(request, project_id)
    except Exception as error:
        set_status(project_id, "failed")
        raise HTTPException(
            status_code=500,
            detail=safe_llm_error("ZIP generation", error),
        ) from error

    if not (test_result["passed"] and build_result["passed"]):
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Generated project failed build validation.",
                "projectId": project_id,
                "test": test_result,
                "build": build_result,
            },
        )

    buffer = BytesIO()

    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for file in files:
            archive.writestr(file["name"], file["content"])

        archive.writestr(
            "HEXAWAVE_ARCHITECTURE.md",
            f"""# HexaWave Architecture

Project: {request.projectName}
Type: {request.projectType}
Stack: {request.stack}
Build attempts: {attempts}
Frontend: {architecture.get("frontend", "")}
Backend: {architecture.get("backend", "")}
Database: {architecture.get("database", "")}
AI: HexaWave AI
""",
        )

    buffer.seek(0)

    filename = (
        request.projectName.strip().replace(" ", "-").lower() or "hexawave-project"
    )

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'},
    )


@app.post("/preview", response_class=HTMLResponse)
def preview(request: GenerateRequest):
    ws = create_workspace(request.projectId)
    project_id = ws["id"]

    try:
        plan, architecture, files, test_result, build_result, attempts = run_pipeline(request, project_id)
    except Exception as error:
        set_status(project_id, "failed")
        raise HTTPException(
            status_code=500,
            detail=safe_llm_error("Preview generation", error),
        ) from error

    if not (test_result["passed"] and build_result["passed"]):
        raise HTTPException(status_code=422, detail="Project failed validation.")

    project_name = html.escape(request.projectName)
    prompt_text = html.escape(request.prompt)

    features_html = "".join(
        f'<div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);color:rgba(255,255,255,.72);">'
        f'\u2713 {html.escape(feature)}</div>'
        for feature in plan.get("features", [])
    )

    document = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{project_name}</title>
<style>
* {{ box-sizing:border-box; }}
body {{ margin:0; min-height:100vh; background: radial-gradient(circle at 50% -20%, rgba(34,211,238,.15), transparent 40%), #05070b; color:#fff; font-family: Inter, system-ui, sans-serif; }}
main {{ width:min(1100px,calc(100% - 40px)); margin:auto; padding:80px 0; }}
.badge {{ display:inline-block; padding:8px 12px; border-radius:999px; border:1px solid rgba(34,211,238,.25); background:rgba(34,211,238,.08); color:#67e8f9; font-size:13px; }}
h1 {{ margin:20px 0 0; font-size:clamp(42px,7vw,78px); line-height:.95; letter-spacing:-.05em; }}
.description {{ max-width:750px; margin-top:24px; color:rgba(255,255,255,.55); line-height:1.7; font-size:18px; }}
.grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-top:48px; }}
.card {{ padding:24px; border-radius:20px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.035); }}
.label {{ color:rgba(255,255,255,.4); font-size:13px; }}
.value {{ margin-top:8px; font-weight:600; }}
.features {{ margin-top:20px; padding:28px; border-radius:24px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); }}
@media(max-width:700px) {{ .grid {{ grid-template-columns:1fr; }} main {{ padding:50px 0; }} }}
</style>
</head>
<body>
<main>
  <span class="badge">HexaWave AI \u2014 Project ID: {html.escape(project_id)}</span>
  <h1>{project_name}</h1>
  <p class="description">{prompt_text}</p>
  <section class="grid">
    <div class="card"><div class="label">Frontend</div><div class="value">{html.escape(str(architecture.get("frontend", "React")))}</div></div>
    <div class="card"><div class="label">Backend</div><div class="value">{html.escape(str(architecture.get("backend", "NestJS")))}</div></div>
    <div class="card"><div class="label">Build</div><div class="value">\u2713 Passed ({attempts} fix attempt{"s" if attempts != 1 else ""})</div></div>
  </section>
  <section class="features"><h2>Generated Features</h2>{features_html}</section>
</main>
</body>
</html>"""

    return HTMLResponse(content=document)


# ── Project workspace endpoints ───────────────────────────────────────────────

@app.get("/projects/{project_id}")
def get_project(project_id: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    meta = read_meta(project_id)
    return {"success": True, "project": meta}


@app.get("/projects")
def get_projects():
    return {"success": True, "projects": list_workspaces()}


@app.get("/projects/{project_id}/status")
def get_project_status(project_id: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    process = get_process_status(project_id)
    status = get_status(project_id)

    return {
        "success": True,
        "projectId": project_id,
        "status": status,
        "process": process,
        "output": get_runner_output(project_id),
    }


@app.get("/projects/{project_id}/files")
def get_project_files(project_id: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    files = list_files(project_id)
    return {"success": True, "projectId": project_id, "files": files}


@app.get("/projects/{project_id}/files/{file_path:path}")
def get_project_file(project_id: str, file_path: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    try:
        content = read_file(project_id, file_path)
        return {"success": True, "path": file_path, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.put("/projects/{project_id}/files/{file_path:path}")
def update_project_file(project_id: str, file_path: str, request: UpdateFileRequest):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        write_files(project_id, [{"name": file_path, "content": request.content}])
        return {"success": True, "path": file_path}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/projects/{project_id}/ai-edit")
def ai_edit_project_file(project_id: str, request: AiEditRequest):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    if not request.instruction.strip():
        raise HTTPException(status_code=400, detail="An AI editing instruction is required.")

    try:
        current_content = read_file(project_id, request.filePath)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {request.filePath}")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    try:
        edited_content = editor.edit(
            request.filePath,
            current_content,
            request.instruction,
        )
        write_files(
            project_id,
            [{"name": request.filePath, "content": edited_content}],
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=safe_llm_error("AI editor", error),
        ) from error

    return {
        "success": True,
        "path": request.filePath,
        "content": edited_content,
    }


@app.post("/projects/{project_id}/ai-maintain")
def maintain_project_with_ai(
    project_id: str,
    request: ProjectMaintenanceRequest,
):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    if not request.instruction.strip():
        raise HTTPException(status_code=400, detail="A project maintenance instruction is required.")

    context, excluded_count = _maintenance_context(project_id)
    if not context:
        raise HTTPException(
            status_code=422,
            detail="No safe, supported project files were available for AI maintenance.",
        )

    try:
        model_response = editor.maintain(context, request.instruction)
        summary, files = _validate_maintenance_response(model_response, project_id)
        if files:
            write_files(project_id, files)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=safe_llm_error("AI project maintenance", error),
        ) from error

    return {
        "success": True,
        "summary": summary,
        "changedFiles": [file["name"] for file in files],
        "excludedFileCount": excluded_count,
    }


@app.post("/projects/{project_id}/ai-autonomous")
def run_autonomous_project_task(
    project_id: str,
    request: ProjectMaintenanceRequest,
):
    if message := project_execution_block_message():
        raise HTTPException(status_code=503, detail=message)
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    if not request.instruction.strip():
        raise HTTPException(status_code=400, detail="An autonomous task instruction is required.")

    context, excluded_count = _maintenance_context(project_id)
    if not context:
        raise HTTPException(
            status_code=422,
            detail="No safe, supported project files were available for an autonomous task.",
        )

    original_files = {file["name"]: file["content"] for file in context}
    summary = ""
    attempts = 0
    max_attempts = 3

    def validate_project(files: list[dict[str, str]]):
        set_status(project_id, "testing")
        static_test = tester.run(files)
        if not static_test["passed"]:
            return static_test, {
                "passed": False,
                "skipped": True,
                "errors": [],
                "stdout": "",
                "stderr": "Project tests were not run because static checks failed.",
            }, {
                "passed": False,
                "stage": "tester",
                "errors": static_test["errors"],
                "stdout": "",
                "stderr": "",
            }

        set_status(project_id, "building")
        build_result = builder.run(files, project_id)
        if not build_result["passed"]:
            return static_test, {
                "passed": False,
                "skipped": True,
                "errors": [],
                "stdout": "",
                "stderr": "Project tests were not run because the build failed.",
            }, build_result

        runtime_tests = builder.run_tests(project_id)
        if not runtime_tests["passed"] and not build_result.get("errors"):
            build_result = {
                **build_result,
                "stage": "project-tests",
                "errors": runtime_tests["errors"],
                "stdout": runtime_tests.get("stdout", ""),
                "stderr": runtime_tests.get("stderr", ""),
            }
        return static_test, runtime_tests, build_result

    try:
        model_response = editor.maintain(context, request.instruction)
        summary, updated_files = _validate_maintenance_response(
            model_response,
            project_id,
        )
        if updated_files:
            write_files(project_id, updated_files)
        files, newly_excluded = _maintenance_context(project_id)
        excluded_count = max(excluded_count, newly_excluded)
        test_result, runtime_test_result, build_result = validate_project(files)

        while (
            not test_result["passed"]
            or not runtime_test_result["passed"]
            or not build_result["passed"]
        ) and attempts < max_attempts:
            attempts += 1
            set_status(project_id, "fixing")
            repair_errors = [
                *test_result.get("errors", []),
                *runtime_test_result.get("errors", []),
                *build_result.get("errors", []),
            ]
            fixed_files = builder.fix(
                files,
                repair_errors,
                "\n".join(
                    value for value in (
                        runtime_test_result.get("stdout", ""),
                        build_result.get("stdout", ""),
                    ) if value
                ),
                "\n".join(
                    value for value in (
                        runtime_test_result.get("stderr", ""),
                        build_result.get("stderr", ""),
                    ) if value
                ),
            )
            _, fixed_files = _validate_maintenance_response(
                {"summary": "Build repair", "files": fixed_files},
                project_id,
            )
            if not fixed_files:
                raise ValueError("AI build repair returned no validated files.")
            write_files(project_id, fixed_files)
            files, newly_excluded = _maintenance_context(project_id)
            excluded_count = max(excluded_count, newly_excluded)
            test_result, runtime_test_result, build_result = validate_project(files)

        success = bool(
            test_result["passed"]
            and runtime_test_result["passed"]
            and build_result["passed"]
        )
        set_status(project_id, "ready" if success else "failed")
        changed_files = sorted(
            file["name"]
            for file in files
            if original_files.get(file["name"]) != file["content"]
        )
        return {
            "success": success,
            "summary": summary,
            "changedFiles": changed_files,
            "excludedFileCount": excluded_count,
            "test": {
                "passed": test_result["passed"],
                "errors": test_result["errors"],
            },
            "runtimeTests": {
                "passed": runtime_test_result["passed"],
                "skipped": runtime_test_result["skipped"],
                "errors": runtime_test_result["errors"],
                "stdout": runtime_test_result.get("stdout", ""),
                "stderr": runtime_test_result.get("stderr", ""),
            },
            "build": {
                "passed": build_result["passed"],
                "attempts": attempts,
                "stage": build_result.get("stage", ""),
                "errors": build_result.get("errors", []),
                "stdout": build_result.get("stdout", ""),
                "stderr": build_result.get("stderr", ""),
            },
        }
    except ValueError as error:
        set_status(project_id, "failed")
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        set_status(project_id, "failed")
        raise HTTPException(
            status_code=502,
            detail=safe_llm_error("Autonomous project task", error),
        ) from error


def _generate_for_workspace(project_id: str, request: GenerateRequest):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")
    try:
        update_meta(project_id, {
            "name": request.projectName,
            "type": request.projectType,
            "stack": request.stack,
            "description": request.prompt,
        })
        plan, architecture, files, test_result, build_result, attempts = run_pipeline(
            request, project_id
        )
    except Exception as error:
        set_status(project_id, "failed")
        raise HTTPException(
            status_code=500,
            detail=safe_llm_error("Project generation", error),
        ) from error
    success = test_result["passed"] and build_result["passed"]
    return {
        "success": success,
        "projectId": project_id,
        "pipeline": ["planner", "architect", "developer", "tester", "builder", "fixer"],
        "build": {
            "passed": build_result["passed"],
            "attempts": attempts,
            "errors": build_result["errors"],
            "stage": build_result.get("stage", ""),
            "stdout": build_result.get("stdout", ""),
            "stderr": build_result.get("stderr", ""),
        },
        "analysis": {
            "projectName": request.projectName,
            "projectType": request.projectType,
            "stack": request.stack,
            "features": plan.get("features", []),
            "architecture": architecture,
        },
        "test": test_result,
        "files": [GeneratedFile(**file) for file in files],
        "status": get_status(project_id),
    }


@app.post("/projects/{project_id}/generate")
def generate_project(project_id: str, request: GenerateRequest):
    return _generate_for_workspace(project_id, request)


@app.post("/projects/{project_id}/build")
def build_project(project_id: str):
    if message := project_execution_block_message():
        raise HTTPException(status_code=503, detail=message)
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    files = [
        {"name": path, "content": read_file(project_id, path)}
        for path in list_files(project_id)
        if path != "runner.log"
    ]
    if not files:
        raise HTTPException(status_code=409, detail="Project has no source files to build.")

    attempts = 0
    set_status(project_id, "testing")
    test_result = tester.run(files)
    set_status(project_id, "building")
    build_result = builder.run(files, project_id)

    while not build_result["passed"] and attempts < 3:
        attempts += 1
        set_status(project_id, "fixing")
        try:
            files = builder.fix(
                files,
                build_result["errors"],
                build_result.get("stdout", ""),
                build_result.get("stderr", ""),
            )
            write_files(project_id, files)
        except Exception as error:
            set_status(project_id, "failed")
            raise HTTPException(
                status_code=500,
                detail=safe_llm_error("AI build repair", error),
            ) from error

        test_result = tester.run(files)
        if not test_result["passed"]:
            build_result = {
                "passed": False,
                "stage": "tester",
                "errors": test_result["errors"],
                "stdout": "",
                "stderr": "",
            }
            continue
        set_status(project_id, "building")
        build_result = builder.run(files, project_id)

    final_status = "ready" if test_result["passed"] and build_result["passed"] else "failed"
    set_status(project_id, final_status)
    return {
        "success": final_status == "ready",
        "status": final_status,
        "attempts": attempts,
        "test": test_result,
        "build": build_result,
    }


@app.get("/projects/{project_id}/download")
def download_project(project_id: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        for file_path in list_files(project_id):
            archive.write(
                get_root(project_id) / file_path,
                arcname=file_path,
            )
    buffer.seek(0)
    metadata = read_meta(project_id)
    project_name = str(metadata.get("name", "hexawave-project"))
    filename = "".join(
        character if character.isalnum() or character in "-_" else "-"
        for character in project_name.lower()
    ).strip("-") or "hexawave-project"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}.zip"'},
    )


@app.post("/projects/{project_id}/run")
def run_project_endpoint(project_id: str):
    if message := project_execution_block_message():
        raise HTTPException(status_code=503, detail=message)
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    status = get_status(project_id)

    if status == "running":
        process = get_process_status(project_id)
        if process:
            return {
                "success": True,
                "status": "running",
                "port": process["port"],
                "url": f"http://localhost:{process['port']}",
                "message": "Already running.",
            }
        status = get_status(project_id)

    if status not in ("ready", "stopped", "failed"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot run project in status: {status}",
        )

    preflight_error = get_run_preflight_error(project_id)
    if preflight_error:
        set_status(project_id, "failed")
        append_runner_output(project_id, f"Run configuration error: {preflight_error}")
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "message": preflight_error,
                "repairable": False,
                "attempts": 0,
            },
        )

    files = [
        {"name": file_path, "content": read_file(project_id, file_path)}
        for file_path in list_files(project_id)
    ]
    attempts = 0

    while True:
        install_result = install(project_id)
        failure = install_result if not install_result["success"] else run_project(project_id)

        if failure["success"]:
            return {**failure, "attempts": attempts}

        if attempts >= 3:
            set_status(project_id, "failed")
            append_runner_output(
                project_id,
                "Application could not be started after 3 AI repair attempts.\n"
                f"Last failure: {failure.get('message', 'Unknown start failure.')}",
            )
            raise HTTPException(
                status_code=422,
                detail={
                    "success": False,
                    "message": "Application could not be started after 3 AI repair attempts.",
                    "attempts": attempts,
                    "failure": failure,
                },
            )

        attempts += 1
        set_status(project_id, "fixing")
        append_runner_output(
            project_id,
            f"Run attempt {attempts} failed: "
            f"{failure.get('message', 'Application startup failed.')}",
        )
        try:
            files = builder.fix(
                files,
                [str(failure.get("message", "Application startup failed."))],
                str(failure.get("stdout", "")),
                str(failure.get("stderr", "")),
            )
            write_files(project_id, files)
        except Exception as error:
            set_status(project_id, "failed")
            safe_message = _runtime_repair_error_message(error)
            append_runner_output(
                project_id,
                safe_message,
            )
            raise HTTPException(
                status_code=500,
                detail=safe_message,
            ) from error

        test_result = tester.run(files)
        if not test_result["passed"]:
            failure = {
                "success": False,
                "message": "Repaired files did not pass project tests.",
                "errors": test_result["errors"],
            }
            continue

        set_status(project_id, "building")
        build_result = builder.run(files, project_id)
        if not build_result["passed"]:
            failure = build_result
            continue
        set_status(project_id, "ready")


@app.post("/projects/{project_id}/stop")
def stop_project_endpoint(project_id: str):
    if not workspace_exists(project_id):
        raise HTTPException(status_code=404, detail="Project not found.")

    result = stop_project(project_id)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result)
    return result
