# Progress

**What works**

- `evaluateBaselineRule`: price > 200 BUY, price < 200 SELL, exactly 200 HOLD
- Paper trading service, approval arm, no live broker
- Quote-triggered paper BUY/SELL flow covered by service-level tests
- Trading and King APIs + pages at `/trading` and `/king`
- King approvals create mixed-language AI workspaces; code generation is retriable and deployment stays separate
- `/king` instant-navigation dev error resolved with a server route wrapper and `instant = false`
- Local admin bootstrap configured and authenticated; frontend, backend, and AI services verified online
- AI provider defaults to Ollama using `qwen2.5:1.5b`; OpenAI remains available by explicitly selecting `HEXAWAVE_LLM_PROVIDER=openai`
- King navigation is hidden for non-admins, `/king` checks the signed-in role, and catalog/request-list APIs require admin role
- Admin login now opens `/king`; attempts to open either dashboard route as admin redirect to King. Regular users are routed to `/workspace` and redirected away from King/admin pages.
- Company request submission and per-user request history live on a separate user page; backend request listing returns only the signed-in user's requests unless the caller is an admin.
- Company and individual dashboards now clearly identify their tenant workspace; company IDE/projects are labelled as team-shared while individual IDE/projects are private. Each company's CEO dashboard shows that tenant's employee roster and invite controls; roster data is only returned to that company's CEO.
- Auth/company profile service and controller tests confirm the CEO sees only their employees and employee users do not receive the roster.
- Registration UI conditionally shows the company-name field for CEOs and invite-code field for employees; switching both options was verified in a fresh browser page. Full browser signup/invite onboarding remains unverified.
- Latest focused backend regression run: 4 test files and 12 tests passed across auth, company tenancy, project isolation, and King service behavior.
- AI Developer IDE now has an empty-project build studio with app prompt input, three quick starts, fast/full mode, elapsed generation status, workspace navigation, working explorer/search/AI/run activity controls, terminal/problems/output tabs, editor file close, and dynamic language status.
- Generation messaging now avoids promising an exact one-minute turnaround; it explains that model response and validation time vary with provider and app scope. Monaco was explicitly deferred in favor of the current lightweight editor.
- IDE frontend production build and file diagnostics pass. No frontend test harness exists yet.
- Verified local Ollama generation and AI health endpoint; focused AI tests (3), King/trading tests (5), frontend production build, and backend build passed
- Added shared-token authentication to the AI service boundary; production fails closed if no `HEXAWAVE_AI_SERVICE_TOKEN` is configured. Backend AI requests send that token, while `/health` remains available.
- Disabled generated project dependency installation, builds, and runtime execution in production until a restricted OS/container sandbox exists. Added focused coverage and deployment notes in `SECURITY.md`.
- Latest security-hardening verification: all 32 AI tests passed; the two new backend AI-auth tests passed; backend build and formatting checks passed. Full backend suite had one unrelated existing lead-discovery assertion failure: expected uppercase `International`, received lowercase `international` (35/36 tests passed).
- Trading is now disabled by default, gated at the API and quote-evaluation layers, and can be enabled only by King from `/king`; disabling stops active automation. The Trading link/screen appears only when enabled.
- The AI build studio now offers separate frontend/backend hosting and language selection with framework options filtered by hosting compatibility, plus custom language/framework entries. Selected stacks are sent to AI generation; selectors do not provision hosting or add runtime support.
- Latest verification for this change: frontend production build and backend build passed; all 7 focused trading/auth tests passed; changed frontend UI/API files passed ESLint.
- The IDE now has a project-wide “Maintain project” action in addition to selected-file AI editing. The new AI endpoint bounds project context, filters known sensitive/unsupported/oversized files, validates all generated file paths and content before writing, and returns a summary plus changed-file list for review. Project generation now accepts fenced JSON and gives actionable errors for malformed/truncated output and unsafe/duplicate paths.
- Added an “Autonomous” IDE action and tenant-authorized endpoint: AI applies multi-file changes, runs static checks, configured Node tests or Python unittest discovery where present, builds, and can attempt at most three repairs. The IDE refreshes workspace files and reports exactly which checks passed, failed, or were skipped. Deployment, production actions, trading, and external actions remain approval-gated.
- Latest autonomous-work validation: all 41 AI service tests passed; 5 focused backend project/AI tests passed; frontend lint and production build passed; backend build passed.
- Added Razorpay subscription, software-request, and AI credit checkout routes with King-only catalog/pricing configuration, account-scoped credit ledger, usage charging on successful AI actions, signed provider callback verification, server-side payment lookups, signed/idempotent webhooks, and payment-gated company request fulfillment.
- Checkout defaults disabled and production checkout is blocked while payment records use the local JSON store. Server-only credentials are documented in `.env.example` and `SECURITY.md`; no live charges or real Razorpay credentials were used.
- King dashboard now manages subscription plan IDs and pricing, software request fees, credit pack amounts/quantities, and credits per AI action. User workspace has an AI credits/payment history page; pricing offers recurring checkout and company requests require payment before entering the King queue.
- Focused billing/AI/project/King tests passed: 14 tests across four test files. Backend build and frontend production build passed. Changed frontend billing files passed targeted ESLint. Full frontend lint remains blocked by existing unrelated errors in trading, workspace, AuthGate, plus pre-existing warning-only files.

**Not started / backlog**

- Monaco-based editor features and deeper language-server support
- End-to-end generation UX check behind authenticated login
- Broker adapter for live execution
- Real equities quote venue (NSE/NYSE)
- Isolated build/run sandbox and a separate deployment-approval workflow
- Complete security audit, including auth abuse/rate limiting and deployment network policy review

**Known issues**

- Generated admin password is available only in the ignored local `backend/.env`; rotate before production
- The admin-only King page is an operator control panel; regular users submit and track their own software requests separately and cannot see the approval queue.
- Browser automation's physical radio click timed out waiting for stability; activating the radio through the element click event updated the controlled UI correctly. This was not reproduced as a React state/hydration failure after loading a fresh page.
