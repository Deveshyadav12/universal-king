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
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
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

-- Leads Table for CRM
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
  source VARCHAR(120),
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
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Audit Table
CREATE TABLE IF NOT EXISTS lead_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_token VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  result VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Projects Table
CREATE TABLE IF NOT EXISTS ai_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255),
  project_type VARCHAR(100),
  stack VARCHAR(100),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  generation_mode VARCHAR(20) DEFAULT 'fast',
  architecture JSONB DEFAULT '{}',
  features TEXT[],
  build_passed BOOLEAN DEFAULT false,
  build_attempts INTEGER DEFAULT 0,
  build_errors TEXT[] DEFAULT '{}',
  build_stage VARCHAR(100),
  build_stdout TEXT,
  build_stderr TEXT,
  test_passed BOOLEAN DEFAULT false,
  test_errors TEXT[] DEFAULT '{}',
  file_count INTEGER DEFAULT 0,
  files JSONB DEFAULT '[]',
  process_pid INTEGER,
  process_port INTEGER,
  process_status VARCHAR(50),
  process_started_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Leads
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON leads(qualification);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads(industry);
CREATE INDEX IF NOT EXISTS idx_leads_ai_processed ON leads(ai_processed);

-- Indexes for AI Projects
CREATE INDEX IF NOT EXISTS idx_ai_projects_project_id ON ai_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_projects_status ON ai_projects(status);
CREATE INDEX IF NOT EXISTS idx_ai_projects_created_at ON ai_projects(created_at);

-- Indexes for Lead Audit
CREATE INDEX IF NOT EXISTS idx_lead_audit_lead_token ON lead_audit(lead_token);
CREATE INDEX IF NOT EXISTS idx_lead_audit_timestamp ON lead_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_lead_audit_action ON lead_audit(action);
