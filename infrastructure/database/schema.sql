-- =============================================================================
-- Universal King Database Schema
-- CRM, Autonomous AI Lead Generation, Client Portal & Payments
-- =============================================================================

-- Core tables (existing)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  invite_code_hash CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'king', 'super_admin', 'client')),
  account_type TEXT NOT NULL CHECK (account_type IN ('individual', 'company')),
  workspace_id TEXT NOT NULL,
  company_name TEXT,
  company_role TEXT CHECK (company_role IN ('owner', 'employee')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_owner_user_id_fkey'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS users_workspace_id_idx ON users (workspace_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- =============================================================================
-- CRM - Lead Discovery and Management
-- =============================================================================

-- Lead records with full persistence
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_token VARCHAR(50) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  job_title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  website VARCHAR(2048),
  industry VARCHAR(120),
  company_size VARCHAR(80),
  target_size_segment VARCHAR(20),
  location VARCHAR(255),
  source VARCHAR(120) NOT NULL,
  source_url VARCHAR(2048),
  linkedin_url VARCHAR(2048),
  description TEXT,
  technologies TEXT[],
  lead_score INTEGER DEFAULT 0,
  score_reasons TEXT[],
  qualification VARCHAR(20) DEFAULT 'UNSCORED',
  status VARCHAR(30) DEFAULT 'DISCOVERED',
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  last_response_at TIMESTAMP WITH TIME ZONE,
  next_action_at TIMESTAMP WITH TIME ZONE,
  email_sequence_id UUID,
  ai_processed BOOLEAN DEFAULT false,
  ai_analyzed BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Constraints for validation
  CONSTRAINT valid_qualification CHECK (qualification IN ('UNSCORED', 'HIGH_PRIORITY', 'GOOD', 'MEDIUM', 'LOW')),
  CONSTRAINT valid_lead_score CHECK (lead_score >= 0 AND lead_score <= 100)
);

-- Idempotent migration for databases where the leads table already existed
-- before is_verified was added to the schema. Must run before idx_leads_verified
-- and before get_discovery_stats() references this column.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;


-- Lead Audit Table for tracking all actions
CREATE TABLE IF NOT EXISTS lead_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
