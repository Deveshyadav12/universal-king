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
SELECT
  'razorpay',
  'placeholder_hash_replace_in_production',
  'Razorpay webhook secret for signature verification'
WHERE NOT EXISTS (
  SELECT 1
  FROM webhook_secrets
  WHERE provider = 'razorpay'
);

-- Comment on the database schema
COMMENT ON TABLE leads IS 'Stores all discovered leads with AI scoring and qualification data';
COMMENT ON TABLE client_projects IS 'Stores projects created by clients through the portal';
COMMENT ON TABLE payment_orders IS 'Stores Razorpay order information';
COMMENT ON TABLE payment_transactions IS 'Stores payment transaction details from Razorpay';
COMMENT ON TABLE discovery_executions IS 'Tracks all lead discovery execution runs';
COMMENT ON TABLE audit_log IS 'Audit trail for all sensitive administrative actions';
