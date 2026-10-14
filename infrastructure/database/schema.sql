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

-- Lead Audit Table for tracking all actions
CREATE TABLE IF NOT EXISTS lead_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_token VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  result VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discovery Automation Settings
CREATE TABLE IF NOT EXISTS discovery_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discovery Execution Logs
CREATE TABLE IF NOT EXISTS discovery_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_type VARCHAR(50) NOT NULL, -- 'manual', 'scheduled', 'daily'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  leads_added INTEGER DEFAULT 0,
  leads_skipped INTEGER DEFAULT 0,
  errors TEXT[],
  status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'stopped'
  error_message TEXT,
  targets JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Discovery Deduplication Table
CREATE TABLE IF NOT EXISTS lead_deduplication (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_website VARCHAR(500) NOT NULL,
  normalized_email VARCHAR(255),
  company_name_hash VARCHAR(64) NOT NULL,
  source VARCHAR(120) NOT NULL,
  first_discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  discovery_count INTEGER DEFAULT 1,
  UNIQUE(normalized_website, normalized_email, company_name_hash)
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
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_verified ON leads(is_verified);

-- Indexes for Lead Audit
CREATE INDEX IF NOT EXISTS idx_lead_audit_lead_token ON lead_audit(lead_token);
CREATE INDEX IF NOT EXISTS idx_lead_audit_timestamp ON lead_audit(timestamp);
CREATE INDEX IF NOT EXISTS idx_lead_audit_action ON lead_audit(action);

-- Indexes for Discovery
CREATE INDEX IF NOT EXISTS idx_discovery_executions_started ON discovery_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_discovery_executions_status ON discovery_executions(status);
CREATE INDEX IF NOT EXISTS idx_discovery_settings_key ON discovery_settings(setting_key);

-- Indexes for Deduplication
CREATE INDEX IF NOT EXISTS idx_dedup_website ON lead_deduplication(normalized_website);
CREATE INDEX IF NOT EXISTS idx_dedup_email ON lead_deduplication(normalized_email);

-- =============================================================================
-- Client Portal - Projects
-- =============================================================================

-- Client-specific projects (separate from AI projects)
CREATE TABLE IF NOT EXISTS client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_token VARCHAR(50) UNIQUE NOT NULL,
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  technology_stack TEXT[],
  service_type VARCHAR(100),
  budget DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'INR',
  deadline DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  assigned_team_id TEXT,
  assigned_developer_id TEXT,
  files JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'AWAITING_PAYMENT', 'PAID', 'UNDER_REVIEW', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'))
);

-- Project Status History
CREATE TABLE IF NOT EXISTS project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  previous_status VARCHAR(50) NOT NULL,
  new_status VARCHAR(50) NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Project Milestones
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'PENDING',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project Messages/Communication
CREATE TABLE IF NOT EXISTS project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES client_projects(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  sender_role VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Client Projects
CREATE INDEX IF NOT EXISTS idx_client_projects_client ON client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_client_projects_status ON client_projects(status);
CREATE INDEX IF NOT EXISTS idx_client_projects_token ON client_projects(project_token);
CREATE INDEX IF NOT EXISTS idx_client_projects_created ON client_projects(created_at);

CREATE INDEX IF NOT EXISTS idx_project_status_history_project ON project_status_history(project_id);
CREATE INDEX IF NOT EXISTS idx_project_status_history_changed ON project_status_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_messages_project ON project_messages(project_id);

-- =============================================================================
-- Payment System (Razorpay Integration)
-- =============================================================================

-- Payment Orders
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(100) UNIQUE NOT NULL, -- Razorpay order ID
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_id VARCHAR(100), -- Razorpay payment ID
  signature VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Constraints
  CONSTRAINT valid_order_status CHECK (status IN ('CREATED', 'PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'))
);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  transaction_id VARCHAR(100) UNIQUE, -- Razorpay transaction ID
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  gateway VARCHAR(50) DEFAULT 'razorpay',
  method VARCHAR(50), -- card, netbanking, upi, wallet, etc.
  bank_reference VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  failure_reason TEXT,
  webhook_received BOOLEAN DEFAULT false,
  webhook_signature VARCHAR(500),
  raw_webhook_payload TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refunds
CREATE TABLE IF NOT EXISTS payment_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  refund_id VARCHAR(100) UNIQUE NOT NULL, -- Razorpay refund ID
  amount DECIMAL(12, 2) NOT NULL,
  reason TEXT,
  status VARCHAR(50) DEFAULT 'CREATED',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Events (webhook history)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL, -- 'payment_captured', 'payment_failed', 'refund_created', etc.
  entity_type VARCHAR(50), -- 'order', 'payment', 'refund'
  entity_id VARCHAR(100) NOT NULL,
  order_id UUID REFERENCES payment_orders(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Payments
CREATE INDEX IF NOT EXISTS idx_payment_orders_client ON payment_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_project ON payment_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created ON payment_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON payment_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction ON payment_refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_entity ON payment_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at);

-- =============================================================================
-- Client Management
-- =============================================================================

-- Client-specific settings
CREATE TABLE IF NOT EXISTS client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB DEFAULT '{}',
  notification_preferences JSONB DEFAULT '{}',
  last_active_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Client Dashboard Stats Cache
CREATE TABLE IF NOT EXISTS client_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_key VARCHAR(100) NOT NULL,
  stat_value JSONB NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, stat_key)
);

-- =============================================================================
-- Audit and Security
-- =============================================================================

-- Audit Log for sensitive administrative actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id TEXT,
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(20) DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook Secrets (for Razorpay and other integrations)
CREATE TABLE IF NOT EXISTS webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Keys (for internal service authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  permissions TEXT[],
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Audit
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Indexes for API Keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- =============================================================================
-- Email and Notifications
-- =============================================================================

-- Email Templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sent Emails Log
CREATE TABLE IF NOT EXISTS sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES client_projects(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'SENT' -- 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED'
);

-- Notification Queue
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'INFO', -- 'INFO', 'WARNING', 'ERROR', 'SUCCESS'
  entity_type VARCHAR(100),
  entity_id TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for Email and Notifications
CREATE INDEX IF NOT EXISTS idx_sent_emails_recipient ON sent_emails(recipient_email);
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent ON sent_emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- =============================================================================
-- Full-Text Search
-- =============================================================================

-- Add full-text search to leads for better querying
ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create trigger to update search vector
CREATE OR REPLACE FUNCTION leads_search_vector_update() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', 
    COALESCE(NEW.company_name, '') || ' ' ||
    COALESCE(NEW.industry, '') || ' ' ||
    COALESCE(NEW.location, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(array_to_string(NEW.technologies, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create index on search vector
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads USING GIN(search_vector);

-- Create trigger
DROP TRIGGER IF EXISTS trigger_leads_search_vector ON leads;
CREATE TRIGGER trigger_leads_search_vector
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION leads_search_vector_update();

-- =============================================================================
-- Functions and Views
-- =============================================================================

-- Function to get discovery statistics
CREATE OR REPLACE FUNCTION get_discovery_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_leads', COUNT(*),
    'verified_leads', SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END),
    'unverified_leads', SUM(CASE WHEN is_verified = false THEN 1 ELSE 0 END),
    'today_discovered', COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE),
    'high_priority', COUNT(*) FILTER (WHERE qualification = 'HIGH_PRIORITY'),
    'good_leads', COUNT(*) FILTER (WHERE qualification = 'GOOD'),
    'average_score', COALESCE(AVG(lead_score), 0)
  ) INTO result FROM leads;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get payment statistics
CREATE OR REPLACE FUNCTION get_payment_stats(p_client_id TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF p_client_id IS NULL THEN
    SELECT json_build_object(
      'total_orders', COUNT(*),
      'total_amount', COALESCE(SUM(amount), 0),
      'paid_orders', COUNT(*) FILTER (WHERE status = 'PAID'),
      'failed_orders', COUNT(*) FILTER (WHERE status = 'FAILED'),
      'pending_orders', COUNT(*) FILTER (WHERE status IN ('CREATED', 'PENDING'))
    ) INTO result FROM payment_orders;
  ELSE
    SELECT json_build_object(
      'total_orders', COUNT(*),
      'total_amount', COALESCE(SUM(amount), 0),
      'paid_orders', COUNT(*) FILTER (WHERE status = 'PAID'),
      'failed_orders', COUNT(*) FILTER (WHERE status = 'FAILED'),
      'pending_orders', COUNT(*) FILTER (WHERE status IN ('CREATED', 'PENDING'))
    ) INTO result FROM payment_orders WHERE client_id = p_client_id;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- View for client dashboard
CREATE OR REPLACE VIEW client_dashboard_view AS
SELECT 
  u.id AS client_id,
  u.name AS client_name,
  u.email AS client_email,
  COUNT(DISTINCT cp.id) AS total_projects,
  COUNT(DISTINCT CASE WHEN cp.status = 'SUBMITTED' THEN cp.id END) AS submitted_projects,
  COUNT(DISTINCT CASE WHEN cp.status = 'IN_PROGRESS' THEN cp.id END) AS in_progress_projects,
  COUNT(DISTINCT CASE WHEN cp.status = 'COMPLETED' THEN cp.id END) AS completed_projects,
  COUNT(DISTINCT po.id) AS total_orders,
  COALESCE(SUM(po.amount), 0) AS total_spent,
  COUNT(DISTINCT CASE WHEN po.status = 'PAID' THEN po.id END) AS paid_orders
FROM users u
LEFT JOIN client_projects cp ON cp.client_id = u.id
LEFT JOIN payment_orders po ON po.client_id = u.id
WHERE u.role = 'client'
GROUP BY u.id, u.name, u.email;

-- =============================================================================
-- Initial Data Setup
-- =============================================================================

-- Insert initial discovery settings if not exists
INSERT INTO discovery_settings (setting_key, setting_value)
VALUES 
  ('daily_enabled', 'false'),
  ('daily_limit', '100'),
  ('industries', 'software,technology,healthcare,manufacturing,finance,education,ecommerce,logistics'),
  ('size_segments', 'small,medium,large'),
  ('timezone', 'Asia/Kolkata')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert webhook secret placeholder for Razorpay
INSERT INTO webhook_secrets (provider, secret_hash, description)
VALUES ('razorpay', 'placeholder_hash_replace_in_production', 'Razorpay webhook secret for signature verification')
ON CONFLICT (provider) DO NOTHING;

-- Comment on the database schema
COMMENT ON TABLE leads IS 'Stores all discovered leads with AI scoring and qualification data';
COMMENT ON TABLE client_projects IS 'Stores projects created by clients through the portal';
COMMENT ON TABLE payment_orders IS 'Stores Razorpay order information';
COMMENT ON TABLE payment_transactions IS 'Stores payment transaction details from Razorpay';
COMMENT ON TABLE discovery_executions IS 'Tracks all lead discovery execution runs';
COMMENT ON TABLE audit_log IS 'Audit trail for all sensitive administrative actions';
