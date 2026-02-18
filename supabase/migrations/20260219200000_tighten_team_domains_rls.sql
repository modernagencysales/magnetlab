-- Remove overly-permissive public read policy on team_domains
-- The middleware uses createSupabaseAdminClient() which bypasses RLS,
-- so the public read policy is unnecessary and leaks domain mappings.

DROP POLICY IF EXISTS team_domains_public_read ON team_domains;
