# HEXAWAVE - IMMEDIATE ACTION ITEMS

**Priority:** CRITICAL  
**Timeline:** Week 1 (Start Immediately)  
**Status:** Ready for Execution

---

## EXECUTIVE SUMMARY

The HexaWave repository has **CRITICAL security and data persistence issues** that **MUST be fixed before any production deployment**. These issues represent **immediate blockers** that prevent the system from being secure or reliable.

**Do NOT deploy to production until these are resolved.**

---

## CRITICAL ISSUES (Must Fix in Week 1)

### Issue #1: NO Tenant Isolation
**Severity:** CRITICAL - Security Vulnerability  
**Impact:** All companies can see each other's data  
**Current State:** No tenant/company filtering in any query  

**What Happens Now:**
- Company A logs in and can see Company B's leads
- Company A can access Company B's projects
- Freelancers can see all leads
- Clients can see all projects

**What Must Be Fixed:**
- Add `company_id` to all database tables
- Add `@Tenant()` decorator to inject tenant context
- Add `TenantGuard` to set `request.tenant`
- Filter ALL queries by `company_id = current tenant`
- Add authorization checks to all controllers

---

### Issue #2: In-Memory Storage for Critical Data
**Severity:** CRITICAL - Data Loss Risk  
**Impact:** All leads, discovery state, queues lost on restart  
**Current State:** LeadsService uses `Map<string, Lead>()` as primary storage  

**What Happens Now:**
- Restart backend → All leads disappear
- Restart backend → Discovery state resets
- Restart backend → All in-memory counters reset

**What Must Be Fixed:**
- Migrate LeadsService from Map to PostgreSQL
- Migrate AutoDiscoveryService to use database
- Create persistent job queue (Redis + BullMQ)
- Ensure all critical data survives restarts

---

### Issue #3: Disconnected Workflow
**Severity:** CRITICAL - Core Functionality Missing  
**Impact:** No automation between discovery, scoring, and email  
**Current State:** Each step requires manual intervention  

**What Happens Now:**
1. User manually triggers discovery
2. User manually scores leads with AI
3. User manually clicks "Send Email" for each lead
4. No automatic workflow

**What Must Be Fixed:**
- Connect AutoDiscoveryService → AI scoring
- Connect AI scoring → Email queue
- Connect Email queue → Email sending
- Make it fully automatic

---

## WEEK 1 IMPLEMENTATION PLAN

### Day 1-2: Tenant Context and Authorization

**Objective:** Add tenant isolation to all requests

#### Tasks:
1. ✅ **Create Tenant Module**
   - `backend/src/tenant/tenant.module.ts`
   - `backend/src/tenant/tenant.service.ts`
   - `backend/src/tenant/tenant.decorator.ts`
   - `backend/src/tenant/tenant.guard.ts`

2. ✅ **Create Company Guard**
   - `backend/src/common/guards/company.guard.ts`

3. ✅ **Update AuthService**
   - Add `tenantId` to `AuthenticatedUser`
   - Ensure all users have workspace/company context

4. ✅ **Apply Guards Globally**
   - Add `@UseGuards(TenantGuard)` to AppModule
   - Add `@UseGuards(CompanyGuard)` where needed

**Deliverable:** All requests have tenant context

---

### Day 3-4: Database Schema Updates

**Objective:** Add company_id to all tables for tenant isolation

#### Tasks:
1. ✅ **Update Schema**
   - Add `company_id` to `leads` table
   - Add `company_id` to `ai_projects` table
   - Add `company_id` to `lead_audit` table
   - Add `company_id` to `users` table

2. ✅ **Create Missing Tables**
   - `company_members` (user-company relationship)
   - `freelancers` (freelancer profiles)
   - `clients` (client profiles)

3. ✅ **Add Indexes**
   - Index all `company_id` columns
   - Index foreign keys

**Deliverable:** Database schema supports tenant isolation

---

### Day 5-6: Migrate Services to Database

**Objective:** Replace in-memory storage with PostgreSQL

#### Tasks:
1. ✅ **Update LeadsService**
   - Replace `Map<string, Lead>()` with PostgreSQL queries
   - Add `company_id` parameter to all methods
   - Filter all queries by `company_id`

2. ✅ **Update AutoDiscoveryService**
   - Accept `companyId` parameter
   - Save leads with `company_id`
   - Filter discovery by company rules

3. ✅ **Update All Controllers**
   - Add `@Tenant()` parameter to all methods
   - Pass `tenantId` to service calls
   - Add authorization checks

**Deliverable:** All data persisted to PostgreSQL with tenant filtering

---

### Day 7: Testing and Validation

**Objective:** Verify all fixes work correctly

#### Tasks:
1. ✅ **Unit Tests**
   - Test tenant isolation
   - Test authorization guards

2. ✅ **Integration Tests**
   - Test complete workflow

3. ✅ **Manual Testing**
   - Create two companies
   - Create leads for each
   - Verify isolation

**Deliverable:** All acceptance criteria pass

---

## ACCEPTANCE CRITERIA FOR WEEK 1

**MUST ALL PASS before proceeding to Week 2:**

1. ✅ **Tenant Isolation**
   - Company A user cannot see Company B's leads
   - Company A user cannot see Company B's projects
   - All queries include tenant filtering

2. ✅ **Data Persistence**
   - Leads survive backend restart
   - Discovery state survives restart
   - All critical data persisted

3. ✅ **Authorization**
   - Authorization checks work correctly
   - Unauthorized access returns 403
   - Users can only access their own data

4. ✅ **Audit Trail**
   - All important actions logged
   - Audit logs include tenant_id, user_id, resource
   - Failed actions logged with errors

---

## TESTING CHECKLIST

### Test 1: Tenant Isolation
```bash
# 1. Register Company A
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","name":"Company A","password":"password123","accountType":"company","companyName":"Company A"}'

# 2. Register Company B
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"b@test.com","name":"Company B","password":"password123","accountType":"company","companyName":"Company B"}'

# 3. Login as Company A, get token
TOKEN_A=$(curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@test.com","password":"password123"}' | jq -r '.token')

# 4. Login as Company B, get token
TOKEN_B=$(curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"b@test.com","password":"password123"}' | jq -r '.token')

# 5. Create lead for Company A
curl -X POST http://localhost:4000/api/leads \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Lead A","email":"lead-a@test.com"}'

# 6. Create lead for Company B
curl -X POST http://localhost:4000/api/leads \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Lead B","email":"lead-b@test.com"}'

# 7. Company A tries to list Company B's leads (should return empty or 403)
curl -X GET http://localhost:4000/api/leads \
  -H "Authorization: Bearer $TOKEN_A"

# Expected: Only Company A's leads returned
```

### Test 2: Data Persistence
```bash
# 1. Create lead
curl -X POST http://localhost:4000/api/leads \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Persist Test","email":"persist@test.com"}'

# 2. Restart backend
# (CTRL+C then npm run start:dev)

# 3. List leads again
curl -X GET http://localhost:4000/api/leads \
  -H "Authorization: Bearer $TOKEN_A"

# Expected: Lead still exists
```

---

## FILES TO CREATE/MODIFY

### Create New Files:
- [ ] `backend/src/tenant/tenant.module.ts`
- [ ] `backend/src/tenant/tenant.service.ts`
- [ ] `backend/src/tenant/tenant.decorator.ts`
- [ ] `backend/src/tenant/tenant.guard.ts`
- [ ] `backend/src/common/guards/company.guard.ts`
- [ ] `backend/src/audit/audit.module.ts`
- [ ] `backend/src/audit/audit.service.ts`
- [ ] `backend/src/audit/audit.decorator.ts`
- [ ] `backend/src/audit/audit.interceptor.ts`

### Modify Existing Files:
- [ ] `infrastructure/database/schema.sql` (add columns, tables, indexes)
- [ ] `backend/src/leads/leads.service.ts` (add database queries, tenant filtering)
- [ ] `backend/src/leads/leads.controller.ts` (add tenant context, guards)
- [ ] `backend/src/leads/auto-discovery.service.ts` (add tenant context)
- [ ] `backend/src/users/users.service.ts` (add tenant to AuthenticatedUser)
- [ ] `backend/src/app.module.ts` (add global guards)
- [ ] All other controllers (add guards)

---

## DEPENDENCIES

### Required for Week 1:
1. PostgreSQL running and accessible
2. Backend can connect to PostgreSQL
3. Existing auth system works

### Setup PostgreSQL:
```bash
# Using Docker
docker run --name hexawave-db \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_USER=hexawave \
  -e POSTGRES_DB=hexawave \
  -p 5432:5432 \
  -d postgres:15

# Verify connection
psql -h localhost -U hexawave -d hexawave
```

### Configure Backend:
```bash
# backend/.env
DATABASE_URL=postgresql://hexawave:yourpassword@localhost:5432/hexawave
HEXAWAVE_AUTH_SECRET=your-48-char-secret
HEXAWAVE_ADMIN_EMAIL=admin@hexawave.ai
HEXAWAVE_ADMIN_PASSWORD=your-admin-password
```

---

## RISK MITIGATION

### Risk: Tenant Isolation Too Complex
**Mitigation:**
- Start with simple approach (company_id in all tables)
- Use decorator pattern for consistency
- Test thoroughly at each step

### Risk: Data Migration Issues
**Mitigation:**
- Create backup before migration
- Write migration scripts
- Test migration on staging first

### Risk: Performance Issues
**Mitigation:**
- Add indexes for all tenant columns
- Use connection pooling (already configured)
- Test with realistic data volumes

---

## SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tenant Isolation | 100% | All queries filtered by company_id |
| Data Persistence | 100% | All data survives restart |
| Authorization | 100% | All access checked |
| Test Coverage | 80% | Unit + integration tests |

---

## WHAT COMES NEXT (After Week 1)

Once Phase 0 is complete, proceed to **Phase 1: Core CRM & Automation** (Week 2-3):

1. Implement persistent job queue (Redis + BullMQ)
2. Connect automatic workflow (Discovery → AI Scoring → Email Queue)
3. Enhance CRM features (tags, priority, search, export)
4. Add per-company automation rules

**Do NOT start Phase 1 until ALL Phase 0 acceptance criteria pass.**

---

## SUMMARY

**Week 1 is CRITICAL.** Without these fixes:
- ❌ System is NOT secure (cross-tenant data access)
- ❌ System is NOT reliable (data loss on restart)
- ❌ System is NOT production-ready

**Action Required:** Start implementing Phase 0 immediately. These are the foundation for all other work.

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-10-13  
**Status:** READY FOR EXECUTION
