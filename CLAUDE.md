# Claude Code — project context









<!-- cloude-code-toolbox:mcp-skills-awareness-begin -->

### MCP & Skills awareness (Cloude Code ToolBox)

_Last synced: 2026-10-10T06:54:52.679Z._

- **Full report:** `.claude/cloude-code-toolbox-mcp-skills-awareness.md` in this workspace (auto-overwritten on each scan). Use it as ground truth for configured servers and skill folders.
- **MCP:** For **live tools** in Claude Code, enable the matching server via `/mcp`. Servers are configured in `~/.claude.json` (user) and `.mcp.json` (project).
- **When the user’s task matches a server** (e.g. Confluence work and a **Confluence** / **Atlassian** MCP is listed), **prefer that server id** and plan on tool use—not only file search.
- **Skills:** Folders below contain `SKILL.md`; attach or cite paths in chat when relevant.

#### Workspace MCP

- `c:\Users\dy882\Downloads\New folder (4)\.mcp.json` _(workspace: New folder (4))_ — _file missing_

_No active workspace servers in mcp.json._

#### User MCP

- `C:\Users\dy882\.claude.json` — _servers defined_

| Server id | Kind | Detail |
|-----------|------|--------|
| phaser-game-agent | stdio | C:\Users\dy882\AppData\Roaming\npm\node.exe C:\Users\dy882\AppData\Roaming\npm\node_modules\@phaserjs\game-agent\bridge.mjs |

#### Project skills

_None found (or no workspace open)._

#### User skills

- **skill-creator** — `C:\Users\dy882\.claude\skills\skill-creator` — Create new skills, modify and improve existing skills. Use when users want to create a skill from scratch, edit, or optimize an existing skill.

- **airunway-aks-setup** — `C:\Users\dy882\.agents\skills\airunway-aks-setup` — Set up AI Runway on AKS — from bare cluster to running model. Covers cluster verification, controller install, GPU assessment, provider setup, and first deployment. WHEN: \"setup AI Runway\", \"onboard AKS cluster\", \"i

- **appinsights-instrumentation** — `C:\Users\dy882\.agents\skills\appinsights-instrumentation` — Guidance for instrumenting webapps with Azure Application Insights. Provides telemetry patterns, SDK setup, and configuration references. WHEN: how to instrument app, App Insights SDK, telemetry patterns, what is App Ins

- **azure-ai** — `C:\Users\dy882\.agents\skills\azure-ai` — Use for Azure AI: Search, Speech, OpenAI, Document Intelligence. Helps with search, vector/hybrid search, speech-to-text, text-to-speech, transcription, OCR. WHEN: AI Search, query search, vector search, hybrid search, s

- **azure-aigateway** — `C:\Users\dy882\.agents\skills\azure-aigateway` — Configure Azure API Management as an AI Gateway for AI models, MCP tools, and agents. WHEN: semantic caching, token limit, content safety, load balancing, AI model governance, MCP rate limiting, jailbreak detection, add 

- **azure-cloud-migrate** — `C:\Users\dy882\.agents\skills\azure-cloud-migrate` — Assess and migrate cross-cloud workloads to Azure with reports and code conversion. Supports Lambda→Functions, Beanstalk/Heroku/App Engine→App Service, Fargate/Kubernetes/Cloud Run/Spring Boot→Container Apps. WHEN: migra

- **azure-compliance** — `C:\Users\dy882\.agents\skills\azure-compliance` — Run Azure compliance and security audits with azqr plus Key Vault expiration checks. Covers best-practice assessment, resource review, policy/compliance validation, and security posture checks. WHEN: compliance scan, sec

- **azure-compute** — `C:\Users\dy882\.agents\skills\azure-compute` — Azure VM/VMSS router. WHEN: create / provision / deploy / spin-up VM, recommend VM size, compare VM pricing, VMSS, scale set, autoscale, burstable, lightweight server, website, backend, GPU, machine learning, HPC simulat

- **azure-cost** — `C:\Users\dy882\.agents\skills\azure-cost` — Azure cost management: query costs, forecast spending, optimize to reduce waste. WHEN: \"Azure costs\", \"Azure bill\", \"cost breakdown\", \"how much am I spending\", \"forecast spending\", \"optimize costs\", \"reduce 

- **azure-deploy** — `C:\Users\dy882\.agents\skills\azure-deploy` — Execute Azure deployments for ALREADY-PREPARED applications that have existing .azure/deployment-plan.md and infrastructure files. DO NOT use this skill when the user asks to CREATE a new application — use azure-prepare 

- **azure-diagnostics** — `C:\Users\dy882\.agents\skills\azure-diagnostics` — Debug Azure production issues on Azure using AppLens, Azure Monitor, resource health, and safe triage. WHEN: debug production issues, troubleshoot app service, app service high CPU, app service deployment failure, troubl

- **azure-enterprise-infra-planner** — `C:\Users\dy882\.agents\skills\azure-enterprise-infra-planner` — Architect and provision enterprise Azure infrastructure from workload descriptions. For cloud architects and platform engineers planning networking, identity, security, compliance, and multi-resource topologies with WAF 

- **azure-hosted-copilot-sdk** — `C:\Users\dy882\.agents\skills\azure-hosted-copilot-sdk` — Build, deploy, and modify GitHub Copilot SDK apps on Azure. MANDATORY when codebase contains @github/copilot-sdk or CopilotClient in package.json. PREFER OVER azure-prepare when copilot-sdk markers detected. WHEN: copilo

- **azure-kubernetes** — `C:\Users\dy882\.agents\skills\azure-kubernetes` — Plan, create, and configure production-ready Azure Kubernetes Service (AKS) clusters. Covers Day-0 checklist, SKU selection (Automatic vs Standard), networking options (private API server, Azure CNI Overlay, egress confi

- **azure-kusto** — `C:\Users\dy882\.agents\skills\azure-kusto` — Query and analyze data in Azure Data Explorer (Kusto/ADX) using KQL for log analytics, telemetry, and time series analysis. WHEN: KQL queries, Kusto database queries, Azure Data Explorer, ADX clusters, log analytics, tim

- **azure-messaging** — `C:\Users\dy882\.agents\skills\azure-messaging` — Troubleshoot and resolve issues with Azure Messaging SDKs for Event Hubs and Service Bus. Covers connection failures, authentication errors, message processing issues, and SDK configuration problems. WHEN: event hub SDK 

- **azure-prepare** — `C:\Users\dy882\.agents\skills\azure-prepare` — Prepare azd-based Azure projects for deployment: generates azure.yaml, infrastructure (Bicep/Terraform), and Dockerfiles for the Azure Developer CLI (azd) workflow. USE ONLY when the user explicitly wants to use azd as t

- **azure-quotas** — `C:\Users\dy882\.agents\skills\azure-quotas` — Check/manage Azure quotas and usage across providers. For deployment planning, capacity validation, region selection. WHEN: \"check quotas\", \"service limits\", \"current usage\", \"request quota increase\", \"quota exc

- **azure-rbac** — `C:\Users\dy882\.agents\skills\azure-rbac` — Helps users find the right Azure RBAC role for an identity with least privilege access, then generate CLI commands and Bicep code to assign it. Also provides guidance on permissions required to grant roles. WHEN: bicep f

- **azure-reliability** — `C:\Users\dy882\.agents\skills\azure-reliability` — Assess and improve the reliability posture of PaaS Applications (Azure Functions and Azure App Service). Scans deployed resources for zone redundancy, ZRS storage, health probes, and multi-region failover. Presents a fea

- **azure-resource-lookup** — `C:\Users\dy882\.agents\skills\azure-resource-lookup` — List, find, and show Azure resources across subscriptions or resource groups. Handles prompts like \"list the websites in my subscription\", \"list my web apps\", \"show my app services\", \"list virtual machines\", \"li

- **azure-resource-visualizer** — `C:\Users\dy882\.agents\skills\azure-resource-visualizer` — Analyze Azure resource groups and generate detailed Mermaid architecture diagrams showing the relationships between individual resources. WHEN: create architecture diagram, visualize Azure resources, show resource relati

- **azure-storage** — `C:\Users\dy882\.agents\skills\azure-storage` — Azure Storage Services including Blob Storage, File Shares, Queue Storage, Table Storage, and Data Lake. Answers questions about storage access tiers (hot, cool, cold, archive), when to use each tier, and tier comparison

- **azure-upgrade** — `C:\Users\dy882\.agents\skills\azure-upgrade` — Assess and upgrade Azure workloads between plans, tiers, or SKUs, or modernize Azure SDK dependencies in source code. WHEN: upgrade Consumption to Flex Consumption, upgrade Azure Functions plan, change hosting plan, func

- **azure-validate** — `C:\Users\dy882\.agents\skills\azure-validate` — Pre-deployment validation for Azure readiness. Run deep checks on configuration, infrastructure (Bicep or Terraform), RBAC role assignments, managed identity permissions, and prerequisites before deploying. WHEN: validat

- **entra-agent-id** — `C:\Users\dy882\.agents\skills\entra-agent-id` — Provision Microsoft Entra Agent Identity Blueprints, BlueprintPrincipals, and per-instance Agent Identities via Microsoft Graph, and configure OAuth 2.0 token exchange (fmi_path, OBO, cross-tenant) including the Microsof

- **entra-app-registration** — `C:\Users\dy882\.agents\skills\entra-app-registration` — Guides Microsoft Entra ID app registration, OAuth 2.0 authentication, and MSAL integration. USE FOR: create app registration, register Azure AD app, configure OAuth, set up authentication, add API permissions, generate s

- **microsoft-foundry** — `C:\Users\dy882\.agents\skills\microsoft-foundry` — Deploy, evaluate, fine-tune, and manage Foundry agents end-to-end with azd: hosted agent scaffold/run/deploy, prompt agent create, batch eval, continuous eval, prompt optimizer, Agent Optimizer scaffold, agent.yaml, data

- **python-appservice-deploy** — `C:\Users\dy882\.agents\skills\python-appservice-deploy` — Deploy Python (Flask/Django/FastAPI) code to Azure App Service Linux. WHEN: \"Flask App Service\", \"Django App Service\", \"FastAPI App Service\", \"deploy Python to App Service\". DO NOT USE FOR: Container Apps, Functi

<!-- cloude-code-toolbox:mcp-skills-awareness-end -->
<!-- claude-code-memory-bank:begin -->
# Memory bank (persistent context)

This repository uses a **memory bank** under `./memory-bank/` — structured markdown that survives sessions, similar to Cursor-style workflows.

Context layers (read deeper files after foundations): **projectbrief** → **productContext** / **systemPatterns** / **techContext** → **activeContext** → **progress**.

## What Claude should do

1. **Before substantive work**, read **all** of the following under `./memory-bank/` when the task depends on project state (not optional for non-trivial work). In **Plan mode**, reading for the plan is allowed; **do not edit** these files until **Act mode** unless the user only asked for a documentation/memory update with no code change.
   - `projectbrief.md` — scope and goals
   - `productContext.md` — product intent and UX
   - `systemPatterns.md` — architecture and conventions
   - `techContext.md` — stack and constraints
   - `progress.md` — done / pending / known issues
   - `activeContext.md` — current task and decisions

2. **During Act-mode work**, keep `activeContext.md` aligned with the current task (update when focus shifts).

3. **After meaningful milestones** (in Act mode), update `progress.md` and any affected docs in `./memory-bank/`.

4. When the user asks to **update memory bank** (or similar), **open and review every** file in `./memory-bank/`, then update what changed — especially `activeContext.md` and `progress.md`, even if other files are unchanged. Prefer doing heavy memory-bank writes in **Act mode** unless the user asked for documentation-only updates.

5. Prefer **short, factual updates** over long prose. Reference files, symbols, and tickets instead of duplicating code.

Do not delete these files; evolve them as the project changes.
<!-- claude-code-memory-bank:end -->




<!-- cloude-code-toolbox:token-optimization-begin -->

### Token Optimization (Claude Code ToolBox)

_Active level: concise_

- Respond concisely: 1-3 sentences max unless the user asks for detail.
- Never restate the user's question or echo file contents back verbatim.
- When showing code changes, show only modified lines with 2 lines of context.
- Skip meta-commentary ("I'll now...", "Let me...", "Here's what I did...").
- Before reading a file, check `.claude/project-map.md` for structural context.
- If you already read a file this session and it hasn't changed, reference your memory instead of re-reading.
- Do not read files matching `.claudeignore` patterns unless explicitly asked.

<!-- cloude-code-toolbox:token-optimization-end -->