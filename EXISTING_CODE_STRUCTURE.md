# HEXAWAVE - EXISTING CODE STRUCTURE REFERENCE

**Purpose:** Quick reference to understand what exists in the repository  
**Date:** 2026-10-13  
**Status:** Current State Snapshot

---

## 📁 BACKEND STRUCTURE (NestJS)

```
backend/
├── src/
│   ├── app.module.ts              # Root module - IMPORTS: Database, Auth, Projects, AI, Leads, CRM, Email, Trading, King
│   ├── app.controller.ts          # Basic app controller with health check
│   ├── main.ts                    # Server entry point - PORT 4000, CORS for jaipurstore.tech & localhost:3000
│   │
│   ├── ai/                        # AI Service Integration
│   │   ├── ai.module.ts           # AI module - imports HttpModule
│   │   ├── ai.controller.ts       # AI endpoints - /api/ai/*
│   │   └── ai.service.ts          # AI service client - calls HEXAWAVE_AI_URL
│   │
│   ├── auth/                      # Authentication
│   │   ├── auth.module.ts         # Auth module
│   │   ├── auth.service.ts        # JWT-based auth, session management, registration, login
│   │   ├── auth.controller.ts      # /api/auth/* - register, login, me, company
│   │   ├── auth.guard.ts          # Role-based access control
│   │   ├── auth.decorators.ts     # @Public(), @Roles() decorators
│   │   ├── jwt.strategy.ts        # JWT validation strategy
│   │   └── guards/                # Empty directory
│   │
│   ├── users/                     # User Management
│   │   ├── users.module.ts        # Users module
│   │   ├── users.service.ts       # **IMPORTANT** - User CRUD, company management, PostgreSQL integration
│   │   └── users.controller.ts    # /api/users/*
│   │
│   ├── database/                  # PostgreSQL Integration
│   │   ├── database.module.ts     # Database module
│   │   └── database.service.ts    # **IMPORTANT** - PostgreSQL pool, schema auto-creation
│   │
│   ├── leads/                     # Lead Discovery & CRM
│   │   ├── leads.module.ts        # Leads module - providers: LeadsService, DiscoveryService, AutoDiscoveryService
│   │   ├── leads.service.ts       # **IMPORTANT** - Lead CRUD, in-memory Map storage (NEEDS MIGRATION)
│   │   ├── leads.controller.ts    # /api/leads/* - CRUD, scoring, bulk operations
│   │   ├── discovery.service.ts   # **IMPORTANT** - Tavily-based lead discovery, in-memory (NEEDS PERSISTENCE)
│   │   └── auto-discovery.service.ts # **IMPORTANT** - Continuous background discovery, PostgreSQL
│   │
│   ├── crm/                       # CRM Module
│   │   ├── crm.module.ts         # CRM module - imports LeadsModule
│   │   ├── crm.controller.ts      # /api/crm/* - stats, audit (MINIMAL)
│   │   └── crm.service.ts         # **EMPTY FILE** - needs implementation
│   │
│   ├── email/                     # Email Service (Brevo)
│   │   ├── email.module.ts        # Email module
│   │   ├── email.service.ts       # **IMPORTANT** - Brevo SMTP, sendLeadEmail, Cloudflare webhook
│   │   ├── email.controller.ts    # /api/email/* - Cloudflare inbound, send email
│   │   └── email.service.spec.ts  # Tests for email service
│   │
│   ├── billing/                   # Billing Module
│   │   ├── billing.module.ts      # Billing module
│   │   ├── billing.service.ts     # **STUB** - Razorpay integration (NOT IMPLEMENTED)
│   │   └── billing.controller.ts  # /api/billing/*
│   │
│   ├── deployments/               # Deployment Module
│   │   ├── deployments.module.ts  # Deployments module
│   │   ├── deployments.service.ts # Deployment logic
│   │   └── deployments.controller.ts
│   │
│   ├── projects/                  # Project Management
│   │   ├── projects.module.ts     # Projects module
│   │   ├── projects.service.ts    # **PARTIAL** - Project management
│   │   ├── projects.controller.ts # /api/projects/*
│   │   └── deployment.service.ts  # Project deployment
│   │
│   ├── notifications/            # Notifications
│   │   ├── notifications.module.ts
│   │   └── notifications.service.ts
│   │
│   ├── organizations/             # Organizations
│   │   ├── organizations.module.ts
│   │   ├── organizations.service.ts
│   │   └── organizations.controller.ts
│   │
│   ├── king/                      # King Module (custom feature)
│   │   ├── king.module.ts
│   │   ├── king.service.ts
│   │   ├── king.controller.ts
│   │   └── king.catalog.ts
│   │
│   ├── trading/                   # Trading Module
│   │   ├── trading.module.ts
│   │   ├── trading.service.ts
│   │   ├── trading.controller.ts
│   │   ├── trading.types.ts
│   │   ├── trading.constants.ts
│   │   ├── trading-feature.service.ts
│   │   ├── trading-feature.guard.ts
│   │   ├── baseline.strategy.ts
│   │   └── market-data.service.ts
│   │
│   ├── queues/                    # Queue Module
│   │   ├── ai.queue.ts           # **EMPTY FILE** - needs implementation
│   │   ├── build.queue.ts        # **EMPTY FILE** - needs implementation
│   │   └── deployment.queue.ts   # **EMPTY FILE** - needs implementation
│   │
│   ├── workers/                   # Worker Module
│   │   ├── ai.worker.ts          # **EMPTY FILE** - needs implementation
│   │   ├── build.worker.ts       # **EMPTY FILE** - needs implementation
│   │   └── deployment.worker.ts  # **EMPTY FILE** - needs implementation
│   │
│   └── common/                    # Common utilities
│       ├── ...                   # Various decorators, filters, interceptors
│
├── infrastructure/               # Infrastructure
│   └── database/
│       ├── schema.sql            # **IMPORTANT** - PostgreSQL schema (NEEDS EXTENSION)
│       └── seed/                 # Database seeds
│
├── data/                        # Local storage (LEGACY - to be migrated)
│   ├── users.json
│   ├── project-owners.json
│   ├── king-requests.json
│   ├── trading-feature.json
│   └── session.key
│
├── .env.example                 # **IMPORTANT** - All environment variables
├── package.json                 # Backend dependencies
└── ...
```

---

## 🤖 AI SERVICE STRUCTURE (Python/FastAPI)

```
ai/
├── app/
│   ├── main.py                   # **IMPORTANT** - FastAPI app, service token auth, middleware
│   ├── config/
│   │   └── ai_config.py          # AI configuration, model settings
│   │
│   ├── agents/                   # AI Agents
│   │   ├── __init__.py
│   │   ├── architect/             # Architect agent
│   │   ├── deployment/            # Deployment agent
│   │   ├── developer.py          # Developer agent
│   │   ├── editor.py             # Editor agent
│   │   ├── fast_design.py        # Fast design agent
│   │   ├── planner.py            # Planner agent
│   │   ├── researcher            # Researcher directory
│   │   ├── reviewer              # Reviewer directory
│   │   └── tester.py            # Tester agent
│   │
│   ├── api/                      # API Routes
│   │   ├── __init__.py
│   │   ├── routes.py             # API route definitions
│   │   ├── generate.py           # Generation endpoints
│   │   └── health.py             # Health check
│   │
│   ├── services/                 # AI Services
│   │   ├── __init__.py
│   │   ├── ai_database.py       # **IMPORTANT** - PostgreSQL for AI projects
│   │   ├── ai_client_handler.py  # **IMPORTANT** - Multi-model AI client
│   │   ├── ai_offline_middleware.py # **IMPORTANT** - Offline fallback
│   │   ├── ai_service.py         # AI service client
│   │   └── project_service.py    # Project service
│   │
│   ├── tools/                    # AI Tools
│   │   ├── __init__.py
│   │   ├── code_generator.py
│   │   ├── file_manager.py
│   │   └── project_scanner.py
│   │
│   ├── workflows/                # Workflows
│   │   ├── __init__.py
│   │   └── software_factory.py   # Software factory workflow
│   │
│   ├── models/                   # Data Models
│   │   ├── __init__.py
│   │   ├── generation.py
│   │   └── project.py
│   │
│   ├── schemas/                  # Pydantic Schemas
│   │   ├── __init__.py
│   │   ├── generation.py
│   │   └── project.py
│   │
│   ├── llm/                      # LLM Engine
│   │   ├── __init__.py
│   │   ├── engine.py
│   │   └── errors.py
│   │
│   ├── workspace/                 # Workspace Management
│   │   ├── __init__.py
│   │   ├── manager.py           # Workspace manager
│   │   ├── runner.py             # Code runner
│   │   └── maintenance.py        # Maintenance utilities
│   │
│   ├── Dockerfile
│   └── requirements.txt
│
├── workspaces/                  # Workspace storage
│   ├── <workspace-id>/
│   │   ├── .hexawave.json       # Workspace metadata
│   │   ├── app/                  # Generated app
│   │   └── ...
│
├── tests/                      # AI Service Tests
│   ├── test_ai_editor.py
│   ├── test_ai_generation.py
│   ├── test_fast_design.py
│   ├── test_generation.py
│   ├── test_health.py
│   ├── test_lead_scoring.py
│   ├── test_llm_engine.py
│   ├── test_maintenance_import.py
│   ├── test_runner_diagnostics.py
│   └── test_security.py
│
├── .env.example                 # AI service environment variables
└── ...
```

---

## 🌐 FRONTEND STRUCTURE (Next.js)

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   ├── globals.css           # Global styles
│   │   │
│   │   ├── ai-developer/        # AI Developer Portal
│   │   │   └── page.tsx
│   │   │
│   │   ├── crm/                 # CRM Dashboard
│   │   │   └── page.tsx
│   │   │
│   │   ├── dashboard/           # Main Dashboard
│   │   │   └── page.tsx
│   │   │
│   │   ├── deployments/         # Deployments
│   │   │   └── page.tsx
│   │   │
│   │   ├── email/               # Email
│   │   │   └── page.tsx
│   │   │
│   │   ├── forgot-password/     # Forgot Password
│   │   │   └── page.tsx
│   │   │
│   │   ├── leads/               # Leads
│   │   │   └── page.tsx
│   │   │
│   │   ├── login/               # Login
│   │   │   └── page.tsx
│   │   │
│   │   ├── projects/            # Projects
│   │   │   └── page.tsx
│   │   │
│   │   ├── register/            # Register
│   │   │   └── page.tsx
│   │   │
│   │   ├── reset-password/      # Reset Password
│   │   │   └── page.tsx
│   │   │
│   │   └── settings/            # Settings
│   │       └── page.tsx
│   │
│   ├── components/              # React Components
│   │   ├── ui/                  # shadcn/ui components
│   │   └── ...
│   │
│   ├── config/                  # Configuration
│   ├── hooks/                   # React Hooks
│   ├── lib/                     # Utilities
│   ├── services/                # API Services
│   ├── stores/                  # State Management
│   ├── types/                   # TypeScript Types
│   └── utils/                   # Utility Functions
│
├── public/                     # Static files
├── package.json                 # Frontend dependencies
└── ...
```

---

## 📊 KEY FILES SUMMARY

### Critical Files (Must Review)

| File | Purpose | Status | Notes |
|------|---------|--------|-------|
| `backend/.env.example` | Environment variables | ✅ Complete | All variables documented |
| `backend/src/app.module.ts` | Root module | ✅ Working | Imports all modules |
| `backend/src/main.ts` | Server entry | ✅ Working | PORT 4000, CORS configured |
| `backend/src/database/database.service.ts` | PostgreSQL | ✅ Working | Auto-creates schema |
| `backend/src/users/users.service.ts` | Users | ✅ Working | Company invites, auth |
| `backend/src/auth/auth.service.ts` | Auth | ✅ Working | JWT, sessions |
| `backend/src/leads/leads.service.ts` | Leads | ⚠️ Partial | **In-memory storage** |
| `backend/src/leads/discovery.service.ts` | Discovery | ⚠️ Partial | **In-memory counters** |
| `backend/src/leads/auto-discovery.service.ts` | Auto Discovery | ⚠️ Partial | PostgreSQL, no tenant isolation |
| `backend/src/email/email.service.ts` | Email | ⚠️ Partial | Manual only, no queue |
| `ai/app/main.py` | AI Service | ✅ Working | FastAPI, token auth |
| `ai/app/services/ai_database.py` | AI DB | ✅ Working | PostgreSQL for AI |
| `ai/app/services/ai_client_handler.py` | AI Client | ✅ Working | Multi-model |
| `ai/app/services/ai_offline_middleware.py` | Offline | ✅ Working | Fallback |
| `infrastructure/database/schema.sql` | Schema | ⚠️ Partial | **Missing ~15 tables** |

### Empty/Stub Files (Need Implementation)

| File | Purpose | Priority |
|------|---------|----------|
| `backend/src/crm/crm.service.ts` | CRM Service | High |
| `backend/src/billing/billing.service.ts` | Billing | Medium |
| `backend/src/queues/ai.queue.ts` | AI Queue | High |
| `backend/src/queues/build.queue.ts` | Build Queue | High |
| `backend/src/queues/deployment.queue.ts` | Deployment Queue | High |
| `backend/src/workers/ai.worker.ts` | AI Worker | High |
| `backend/src/workers/build.worker.ts` | Build Worker | High |
| `backend/src/workers/deployment.worker.ts` | Deployment Worker | High |

---

## 🔧 ENVIRONMENT VARIABLES REFERENCE

### Backend Variables (Node.js)

```bash
# Authentication
HEXAWAVE_AUTH_SECRET=              # JWT signing secret (48+ chars)
HEXAWAVE_AI_SERVICE_TOKEN=        # AI service auth token (64 hex chars)
HEXAWAVE_ADMIN_EMAIL=              # Admin email
HEXAWAVE_ADMIN_PASSWORD=          # Admin password (12+ chars)

# Database
DATABASE_URL=                     # PostgreSQL connection string
DATABASE_POOL_MAX=20             # Connection pool size
HEXAWAVE_DATABASE_SCHEMA=        # Path to schema.sql

# AI Service
HEXAWAVE_AI_URL=http://localhost:8000

# Auto Discovery
AUTO_DISCOVERY_ENABLED=true
TAVILY_API_KEY=                  # Tavily API key

# Email (Brevo)
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=                # Brevo SMTP login
BREVO_SMTP_KEY=                 # Brevo SMTP password/key
BREVO_FROM_EMAIL=               # Sender email
BREVO_FROM_NAME=HexaWave
CLOUDFLARE_EMAIL_WEBHOOK_SECRET= # Cloudflare webhook secret

# Deployments
HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY= # 64-char hex
HEXAWAVE_DEPLOYMENT_STORE=data/project-deployments.json

# Legacy Storage (to be migrated)
HEXAWAVE_USER_STORE=data/users.json
HEXAWAVE_PROJECT_OWNER_STORE=data/project-owners.json
HEXAWAVE_KING_REQUEST_STORE=data/king-requests.json
HEXAWAVE_TRADING_FEATURE_STORE=data/trading-feature.json
HEXAWAVE_AUTH_SECRET_FILE=data/session.key

# Payments (Razorpay)
HEXAWAVE_RAZORPAY_KEY_ID=
HEXAWAVE_RAZORPAY_KEY_SECRET=
HEXAWAVE_RAZORPAY_WEBHOOK_SECRET=
HEXAWAVE_RAZORPAY_LIVE_ENABLED=false
HEXAWAVE_BILLING_STORE=data/billing.json
```

### AI Service Variables (Python)

```bash
# Database
DATABASE_URL=                     # PostgreSQL for AI

# Service
HEXAWAVE_AI_SERVICE_TOKEN=        # Must match backend
HEXAWAVE_AI_URL=http://localhost:8000

# AI Models
TAVILY_API_KEY=                  # Tavily API key
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_KEY=
OPENAI_API_KEY=

# Settings
AUTO_DISCOVERY_ENABLED=true
AI_OFFLINE_MODE=false
AI_REQUIRE_AUTH=true
```

---

## 🎯 IMPORTANT PATTERNS

### Backend Patterns

1. **Module Structure**
   ```typescript
   @Module({
     imports: [Dependencies],
     controllers: [Controllers],
     providers: [Services],
     exports: [ExportedServices],
   })
   export class ModuleName {}
   ```

2. **Service Structure**
   ```typescript
   @Injectable()
   export class ServiceName {
     constructor(private readonly dependencies: Dependencies) {}
     
     methodName(params: Type): ReturnType {
       // Implementation
     }
   }
   ```

3. **Controller Structure**
   ```typescript
   @Controller('route')
   export class ControllerName {
     constructor(private readonly service: Service) {}
     
     @Get('path')
     @Roles('admin')
     methodName(@Query() query: QueryDto): Promise<ReturnType> {
       return this.service.methodName(query);
     }
   }
   ```

4. **Decorator Patterns**
   ```typescript
   @Public()                      // Bypass auth
   @Roles('admin', 'user')        // Role-based access
   @Tenant()                      // Inject tenant (to be added)
   @Company()                     // Check company access (to be added)
   ```

5. **Error Handling**
   ```typescript
   throw new BadRequestException('Message');
   throw new NotFoundException('Message');
   throw new ForbiddenException('Message');
   throw new UnauthorizedException('Message');
   throw new ServiceUnavailableException('Message');
   throw new ConflictException('Message');
   ```

### AI Service Patterns

1. **Endpoint Structure**
   ```python
   @app.post("/endpoint")
   async def endpoint_handler(request: Request):
       # Verify token
       # Process request
       # Return response
   ```

2. **Service Token Auth**
   ```python
   @app.middleware("http")
   async def require_internal_service_token(request: Request, call_next):
       expected_token = os.getenv("HEXAWAVE_AI_SERVICE_TOKEN")
       supplied_token = request.headers.get("X-Hexawave-Service-Token")
       if not hmac.compare_digest(supplied_token, expected_token):
           return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
   ```

3. **AI Client Handler**
   - Multi-model support (Tavily, Azure OpenAI, OpenAI)
   - Load balancing
   - Fallback handling
   - Health checking

---

## 🔍 CODE QUALITY NOTES

### Good Practices in Existing Code:

1. **Input Validation**
   - LeadsService has comprehensive validation
   - EmailService validates email payloads
   - UsersService validates user data

2. **Error Handling**
   - Consistent error types (BadRequest, NotFound, etc.)
   - Clear error messages
   - HTTP status codes

3. **Database Integration**
   - Connection pooling configured
   - Transaction support
   - Schema auto-creation

4. **Service Structure**
   - Clear separation of concerns
   - Dependency injection
   - Testable design

### Areas for Improvement:

1. **Tenant Isolation**
   - ❌ Currently missing
   - ✅ Should be added in Phase 0

2. **In-Memory Storage**
   - ❌ LeadsService uses Map
   - ❌ DiscoveryService uses in-memory counters
   - ✅ Should be migrated to PostgreSQL

3. **Queue System**
   - ❌ Empty files in queues/ directory
   - ✅ Should use BullMQ + Redis

4. **Frontend-Backend Connection**
   - ⚠️ Some controls may not connect to backend
   - ✅ Should verify all buttons/actions

5. **Documentation**
   - ⚠️ Inline documentation varies
   - ✅ Should add consistent JSDoc

---

## 🚀 QUICK START GUIDE

### To Understand the Codebase:

1. **Start with Backend:**
   ```bash
   cd backend
   ls -la src/            # See module structure
   cat src/app.module.ts # See what's imported
   ```

2. **Check Authentication:**
   ```bash
   cat src/auth/auth.service.ts  # Auth logic
   cat src/auth/auth.guard.ts    # Role checking
   ```

3. **Check Leads:**
   ```bash
   cat src/leads/leads.service.ts       # Lead management
   cat src/leads/discovery.service.ts   # Lead discovery
   cat src/leads/auto-discovery.service.ts # Auto discovery
   ```

4. **Check Email:**
   ```bash
   cat src/email/email.service.ts       # Email service
   cat src/email/email.controller.ts    # Email endpoints
   ```

5. **Check AI Service:**
   ```bash
   cd ai/app
   cat main.py          # FastAPI app
   cat services/ai_database.py  # AI PostgreSQL
   cat services/ai_client_handler.py  # Multi-model client
   ```

### To Run the System:

```bash
# PostgreSQL
docker run --name hexawave-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:15

# Backend
cd backend
npm install
npm run start:dev

# AI Service
cd ai/app
source .venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

---

## 📝 SUMMARY

This document provides a **quick reference** to the existing HexaWave codebase structure. For detailed information:

- **REPOSITORY_AUDIT.md** - Complete audit with feature analysis
- **IMPLEMENTATION_PLAN_Phase0.md** - Week 1 implementation details
- **IMMEDIATE_ACTION_ITEMS.md** - Quick start guide for critical fixes

**Use this document to navigate the codebase quickly.**

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-10-13
