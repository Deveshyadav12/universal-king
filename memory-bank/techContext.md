# Tech context

**Stack**

- Language / runtime: TypeScript, Node
- Framework: NestJS 12, Next.js 16
- Package manager: npm
- Major dependencies: lucide-react, vitest

**Environment**

- Backend `http://localhost:4000/api`, frontend `http://localhost:3000`
- Relevant env names: `HEXAWAVE_TRADING_LIVE_ENABLED`, `HEXAWAVE_MARKET_DATA_PROVIDER`, `HEXAWAVE_SIMULATOR_START_PRICE`, `HEXAWAVE_ADMIN_EMAIL`, `HEXAWAVE_ADMIN_PASSWORD`, `HEXAWAVE_KING_REQUEST_STORE`, `NEXT_PUBLIC_API_URL`, `HEXAWAVE_LLM_PROVIDER`, `HEXAWAVE_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `HEXAWAVE_AI_SERVICE_TOKEN`, `HEXAWAVE_ENV`
- Razorpay billing server secrets: `HEXAWAVE_RAZORPAY_KEY_ID`, `HEXAWAVE_RAZORPAY_KEY_SECRET`, `HEXAWAVE_RAZORPAY_WEBHOOK_SECRET`, `HEXAWAVE_RAZORPAY_LIVE_ENABLED`, and `HEXAWAVE_BILLING_STORE`. Never expose these in frontend configuration.
- AI defaults to local Ollama (`http://127.0.0.1:11434/v1`, `qwen2.5:1.5b`); OpenAI remains selectable with `HEXAWAVE_LLM_PROVIDER=openai`.

**Build & test**

- `npm test` in `backend` (vitest)
- `npm run dev` in `frontend` / `backend`

**Constraints**

- CORS origin `http://localhost:3000`. Live trading rejected without a broker adapter.
- IDE generation has a fast single-design-pass mode and a full plan+architecture mode. Generation still runs code generation, tests, build, and up to three AI repair attempts; elapsed time depends on the local/remote model and requested scope.
- Project build/run implementations are currently available for Node/npm and Python projects. Do not imply arbitrary language projects can yet be built or run.
- The AI build studio separately captures frontend/backend hosting, language, and framework choices. Host-dependent framework lists include a custom option; actual deployments and non-Node/Python execution are not implemented by these selectors.
- Trading availability is persisted in `data/trading-feature.json` (override with `HEXAWAVE_TRADING_FEATURE_STORE`), defaults disabled, and is controlled only by King through `/api/trading/availability`.
- AI service routes require a shared `HEXAWAVE_AI_SERVICE_TOKEN` when configured and fail closed without it in production; `/health` remains public.
- Project-wide maintenance is available at `POST /projects/:id/ai-maintain` through the tenant-authorized NestJS API. AI context is capped at 40 files, 12,000 characters per file, and 60,000 characters total; generated replacements are validated before writing.
- `POST /projects/:id/ai-autonomous` runs a bounded maintain → static checks → supported tests → build → up-to-three-repairs workflow. Node tests run only when `package.json` defines a test script; Python unittest discovery runs only when matching test files exist. Reports skipped tests explicitly.
- Project build, dependency installation, and run are disabled when `HEXAWAVE_ENV`, `NODE_ENV`, or `APP_ENV` is `production`, pending OS-level sandboxing.
- Billing checkout, plans, credit packs, payment verification, and paid software-request submission use `/api/billing/*`. Prices and recurring plan IDs are King-managed; billing defaults disabled.
- Razorpay subscription checkout re-fetches the configured plan and compares amount/currency/period before creating a subscription. User credit packs and verified company software-request fees use one-time orders.
- Each successful configured AI action reserves and then charges the user's credits; failed calls release the reservation. User accounts and request payments remain separate. Current billing persistence is a single-instance JSON store, and checkout explicitly fails closed in production pending transactional shared storage.
