# HEXAWAVE - IMPLEMENTATION PLAN - PHASE 0
# Emergency Fixes: Multi-Tenant Isolation & Data Persistence

**Duration:** Week 1 (5-7 days)  
**Priority:** CRITICAL - Must complete before any production use  
**Goal:** Secure the system with proper tenant isolation and persistent storage

---

## OVERVIEW

Phase 0 addresses the **CRITICAL security and data persistence issues** that currently prevent HexaWave from being deployed to production. Without these fixes, the system would allow cross-tenant data access and lose all data on restart.

---

## PHASE 0.1: Add Tenant Context to Requests

**Objective:** Every request knows which tenant/company it belongs to

### Tasks:

1. **Create Tenant Module**
   - File: `backend/src/tenant/tenant.module.ts`
   - File: `backend/src/tenant/tenant.service.ts`
   - File: `backend/src/tenant/tenant.decorator.ts`
   - File: `backend/src/tenant/tenant.guard.ts`

### Implementation:

```typescript
// tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
```

```typescript
// tenant.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private usersService: UsersService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }
    
    // Get tenant ID from user
    const tenantId = user.workspaceId || user.id;
    request.tenant = tenantId;
    
    return true;
  }
}
```

**Acceptance Criteria:**
- [ ] All authenticated requests have `request.tenant` set
- [ ] `@Tenant()` decorator returns tenant ID
- [ ] TenantGuard works with existing auth

---

## PHASE 0.2: Add Company ID to Database Schema

**Objective:** Every database record belongs to a specific company/tenant

### Tasks:

1. **Extend Companies Table**
2. **Add Tenant ID to All Tables**
3. **Create Missing Tables**
4. **Add Company to Users Table**

### SQL Schema Updates:

```sql
-- Extend companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS:
  domain VARCHAR(255),
  subscription_tier VARCHAR(50) DEFAULT 'free',
  max_leads INTEGER DEFAULT 1000,
  max_projects INTEGER DEFAULT 10,
  daily_discovery_limit INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add company_id to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);

-- Add company_id to ai_projects
ALTER TABLE ai_projects ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
ALTER TABLE ai_projects ADD COLUMN IF NOT EXISTS user_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_ai_projects_company_id ON ai_projects(company_id);

-- Add company_id to lead_audit
ALTER TABLE lead_audit ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_lead_audit_company_id ON lead_audit(company_id);

-- Add company_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Create company_members table
CREATE TABLE IF NOT EXISTS company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'employee')),
  permissions TEXT[] DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Create freelancers table
CREATE TABLE IF NOT EXISTS freelancers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL UNIQUE,
  bio TEXT,
  skills TEXT[],
  experience INTEGER DEFAULT 0,
  hourly_rate DECIMAL(10,2),
  availability VARCHAR(50) DEFAULT 'available',
  portfolio_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(50) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  industry VARCHAR(120),
  size VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Acceptance Criteria:**
- [ ] All tables have company_id/tenant_id column
- [ ] Indexes created for all tenant columns
- [ ] Schema migration works without errors

---

## PHASE 0.3: Migrate LeadsService to PostgreSQL with Tenant Filtering

**Objective:** Replace in-memory storage with database, filter by tenant

### Tasks:

1. Update LeadsService to use Database
2. Update all LeadsController methods
3. Update AutoDiscoveryService
4. Create database migration script

### Implementation Example:

```typescript
// leads.service.ts - Updated
@Injectable()
export class LeadsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenant: TenantService,
  ) {}
  
  async list(
    tenantId: string,
    status?: LeadStatus,
    limit?: number,
    offset?: number,
  ): Promise<Lead[]> {
    const query = `
      SELECT * FROM leads 
      WHERE company_id = $1
      ${status ? 'AND status = $2' : ''}
      ORDER BY created_at DESC
      ${limit ? 'LIMIT $3' : ''}
      ${offset ? 'OFFSET $4' : ''}
    `;
    const params = [tenantId, ...(status ? [status] : []), ...(limit ? [limit] : []), ...(offset ? [offset] : [])];
    const result = await this.database.query<Lead>(query, params);
    return result.rows;
  }
  
  async get(id: string, tenantId: string): Promise<Lead> {
    const result = await this.database.query<Lead>(
      'SELECT * FROM leads WHERE id = $1 AND company_id = $2',
      [id, tenantId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException(`Lead not found or not authorized: ${id}`);
    }
    return result.rows[0];
  }
}
```

**Acceptance Criteria:**
- [ ] Leads are saved to PostgreSQL
- [ ] Leads are filtered by company_id
- [ ] Company A cannot see Company B's leads
- [ ] Data survives backend restart

---

## PHASE 0.4: Add Authorization Middleware

**Objective:** Ensure users can only access their own data

### Tasks:

1. Create Company Guard
2. Create Resource Ownership Guard
3. Apply guards to all controllers

### Implementation:

```typescript
// company.guard.ts
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}
  
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.companyId || request.body.companyId;
    
    if (!user || !companyId) {
      return false;
    }
    
    const company = await this.usersService.getCompany(user.id);
    if (!company || company.id !== companyId) {
      throw new ForbiddenException('Not authorized for this company');
    }
    
    return true;
  }
}
```

**Acceptance Criteria:**
- [ ] Company user cannot access another company's leads
- [ ] Company user cannot access another company's projects
- [ ] Unauthorized access returns 403

---

## PHASE 0.5: Add Audit Logging

**Objective:** Track all important actions for compliance and debugging

### Tasks:

1. Create Audit Service
2. Add Audit Log Table
3. Add Audit Decorator
4. Create Audit Interceptor

### SQL:

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  result VARCHAR(20) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
```

**Acceptance Criteria:**
- [ ] All important actions are logged
- [ ] Audit logs include tenant_id, user_id, action, resource
- [ ] Failed actions are logged with error

---

## PHASE 0.6: Testing and Validation

**Objective:** Ensure Phase 0 works correctly

### Tasks:

1. Write Unit Tests
2. Write Integration Tests
3. Manual Testing

### Acceptance Criteria (MUST ALL PASS):

1. ✅ A company user cannot access another company's leads
2. ✅ A company user cannot access another company's projects
3. ✅ Data survives application restarts
4. ✅ All queries include tenant filtering
5. ✅ Authorization checks work correctly
6. ✅ Audit logs are created for important actions

---

## SUCCESS METRICS

### Phase 0 Completion
- All acceptance criteria pass
- Security review passes
- Ready for Phase 1

### Test Commands

```bash
# Run backend tests
cd backend
npm test

# Run integration tests
npm run test:e2e

# Manual testing
# 1. Register two companies
# 2. Login as each company
# 3. Create leads for each
# 4. Verify isolation
```

---

## NEXT STEPS

**Start Phase 0 immediately.** The following files need to be created/modified:

1. Create: `backend/src/tenant/tenant.module.ts`
2. Create: `backend/src/tenant/tenant.service.ts`
3. Create: `backend/src/tenant/tenant.decorator.ts`
4. Create: `backend/src/tenant/tenant.guard.ts`
5. Create: `backend/src/common/guards/company.guard.ts`
6. Create: `backend/src/audit/audit.module.ts`
7. Create: `backend/src/audit/audit.service.ts`
8. Update: `infrastructure/database/schema.sql`
9. Update: `backend/src/leads/leads.service.ts`
10. Update: `backend/src/leads/leads.controller.ts`
11. Update: `backend/src/leads/auto-discovery.service.ts`
12. Update: All controller files to add guards

**Once Phase 0 is complete, proceed to Phase 1 (Core CRM & Automation).**
