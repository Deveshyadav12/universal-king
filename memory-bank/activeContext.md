# Active context

**Current focus**: Wire Razorpay checkout for recurring subscriptions, paid company software requests, and AI credit packs, with server-verified fulfillment and production fail-closed behavior.

**Live run status**: Frontend is available at `http://localhost:3000`, backend at `http://localhost:4000`, Ollama at `http://127.0.0.1:11434`, and the restarted AI service at `http://localhost:8000`. Local Qwen generation and AI health checks passed. Admin credentials remain local in `backend/.env`; never print or commit them.

**In progress**:

- [x] Require the configured service token on AI-service routes and fail closed in production when missing
- [x] Send the service token from NestJS and refuse production AI calls when it is not configured
- [x] Disable generated project install/build/run in production until execution is isolated
- [x] Add tenant-authorized project-wide AI maintenance with bounded, sensitive-file-filtered context
- [x] Validate AI maintenance output before multi-file writes and refresh changed IDE files for review
- [x] Make generation JSON parsing tolerant of fenced output and report malformed/truncated or unsafe responses clearly
- [x] Add a tenant-authorized autonomous IDE endpoint with configured test execution and a maximum of three AI repair attempts
- [x] Keep deployment, production changes, trading, and external actions outside autonomous task execution
- [x] Document production secret and sandbox requirements in `SECURITY.md`
- [ ] Finish review of auth abuse/rate limiting, import validation, and deployment network policy
- [ ] Implement an OS/container sandbox before enabling generated code execution in production
- [x] Gate trading API and automation; default feature to disabled and expose a King-only switch
- [x] Hide the trading link/screen until the King enables the feature
- [x] Add independent frontend/backend hosting, language, and hosting-compatible framework choices to the AI build studio
- [x] Verify trading feature guard tests and frontend/backend builds after final edits
- [x] Add prompt-first AI build studio and quick starts to the empty IDE workspace
- [x] Add live elapsed-time feedback without promising generation under one minute
- [x] Wire IDE activity rail, file search, AI panel toggle, and Terminal/Problems/Output views
- [x] Validate IDE frontend production build and diagnostics
- [ ] Verify project generation/edit/build/run/preview in an authenticated browser session
- [ ] Add fuller editor/language support; Monaco remains deferred per user preference
- [x] Add CEO-only employee roster to the company dashboard, isolated by company workspace ID
- [x] Clarify company-shared IDE/projects versus individual private IDE/projects on workspaces
- [ ] Verify CEO signup, invite-code display/rotation, and employee signup end-to-end in a clean browser context
- [x] Verify registration account-type toggles and conditional company-name/invite-code fields in a fresh browser page
- [x] Re-run focused auth, project-isolation, and King regression tests (12 passed)
- [x] Register `TradingModule` and `KingModule`
- [x] `/trading` desk (buy > 200, sell < 200, approval arm)
- [x] Automated quote-listener test for BUY above 200 and SELL below 200
- [x] `/king` company software approval + defensive catalog
- [x] Approved company requests generate a private mixed-language AI workspace
- [x] Persist approval queue and scope request visibility to the requester/admin
- [x] Disable instant navigation for `/king` from a server route wrapper; admin login and API access verified
- [x] Configure the AI service to use local Ollama by default, with OpenAI retained as an explicit alternative
- [x] Hide King dashboard navigation from non-admins and require admin role for King page and catalog/request-list API
- [x] Route admin dashboard entry points to `/king`, route regular users away from King/admin pages, and send admin login directly to `/king`
- [x] Keep company software request submission/status in a regular-user page separate from the King control dashboard; users can only retrieve their own requests
- [x] Verify Ollama generation, frontend/backend builds, AI provider tests, and King/trading regression tests

**Decisions (recent)**:

- Keep the editor lightweight for now; defer Monaco while building IDE workflow/UI.
- Fast mode combines planning and architecture into one model pass but does not promise a one-minute end-to-end completion.
- Communicate current execution support accurately: generated Node/npm and Python projects can build/run; additional runtimes need dedicated runner support.
- Employee registration continues to use a CEO-generated invite code; the code identifies and joins the correct company's private workspace.
- Company identity is resolved from the authenticated user, not from a client-supplied workspace ID.
- Default baseline is the price level 200, not a 200-day moving average.
- Default instrument is `STOCK` so the simulator oscillates around 200.
- Offensive hacking frameworks are excluded from Universal King.
- Deployment is not triggered by code-generation approval.
- King dashboard and decision actions are admin-only. Regular users use a separate company-request page; their requests remain pending until King approval.
- The AI service uses `HEXAWAVE_AI_SERVICE_TOKEN` for backend-to-AI authentication. Production build/run stays disabled until an OS-level sandbox is provided.
- Trading availability defaults off and is persisted in `data/trading-feature.json`; only the King administrator may switch it on. Frontend/backend stack selectors guide generation only and do not imply a deploy or runner exists for every ecosystem.
- Razorpay payment use covers subscriptions, company software-request fees, and AI credit packs. The King sets prices, subscription plan IDs, and credits consumed per successful AI action; company requests require verified payment before entering the King queue.
- Payment provider secrets are backend-only; the live key previously posted in chat must be revoked and replaced. Never read or repeat the local `backend/.env`.
- Billing checkout remains disabled by default and is blocked in production while billing uses its local JSON store. Sandbox tests use stubbed Razorpay API responses and never submit live charges.

**Open questions**:

- Whether to add a real stock-market quote provider later (currently Binance public ticker or simulator).
- Build/run isolation and a separate deployment-approval workflow remain future work.
