/*
# Add RLS Policies to 6 Tables Missing Policies

## Summary
Six tables had RLS enabled but no policies, meaning they were completely locked
down (no role could read or write via the Data API). These tables are either
internal/system tables accessed via SECURITY DEFINER functions or service-role
edge functions, so they need service-role-only access.

## Tables and Policies
1. `agent_posting_queue` — internal queue table, accessed by edge functions. Deny all anon/authenticated access.
2. `agent_routing_config` — internal config table, accessed by edge functions. Admin-only access.
3. `email_confirmation_tokens` — token table for email confirmation, accessed by confirm-email edge function. Deny all anon/authenticated direct access.
4. `password_reset_attempts` — rate limiting table, accessed by edge functions. Deny all anon/authenticated direct access.
5. `processed_stripe_events` — idempotency table for Stripe webhooks, accessed by stripe-webhook edge function. Deny all anon/authenticated direct access.
6. `workspace_seed_threads` — seed data table, accessed by edge functions. Deny all anon/authenticated direct access.

## Security
- All 6 tables now have explicit deny-by-default policies.
- These tables are only accessed through SECURITY DEFINER functions or service-role
  edge functions, so direct anon/authenticated access is not needed.
- This resolves the Supabase advisor "RLS Enabled No Policy" warnings.
*/

-- agent_posting_queue: internal, deny direct access
CREATE POLICY "deny_agent_posting_queue" ON agent_posting_queue
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- agent_routing_config: admin-only read, deny writes
CREATE POLICY "admin_read_agent_routing_config" ON agent_routing_config
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()));
CREATE POLICY "deny_agent_routing_config_write" ON agent_routing_config
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "deny_agent_routing_config_update" ON agent_routing_config
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "deny_agent_routing_config_delete" ON agent_routing_config
  FOR DELETE TO authenticated USING (false);

-- email_confirmation_tokens: deny all direct access (edge function uses service role)
CREATE POLICY "deny_email_confirmation_tokens" ON email_confirmation_tokens
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- password_reset_attempts: deny all direct access
CREATE POLICY "deny_password_reset_attempts" ON password_reset_attempts
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- processed_stripe_events: deny all direct access (webhook uses service role)
CREATE POLICY "deny_processed_stripe_events" ON processed_stripe_events
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);

-- workspace_seed_threads: deny all direct access
CREATE POLICY "deny_workspace_seed_threads" ON workspace_seed_threads
  FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
