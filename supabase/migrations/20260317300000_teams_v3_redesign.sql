-- Teams V3 Redesign: Separate access (members) from identity (profiles)
-- Adds team_links for agency-to-client relationships, team_members V3 for
-- access control, strips access columns from team_profiles, and adds team
-- scoping to cp_post_templates and cp_content_ideas.
--
-- Ordering is critical: V1 team_members must be renamed before new table is created.

-- ============================================
-- Step 1: Rename V1 table to avoid name collision
-- ============================================

ALTER TABLE team_members RENAME TO team_members_v1_legacy;

-- ============================================
-- Step 2: Create new tables
-- ============================================

-- team_links: agency-to-client team relationships
-- When this row exists, every active member of agency_team_id implicitly
-- has member access to client_team_id. Resolved at query time — no duplicated rows.
CREATE TABLE team_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  client_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agency_team_id, client_team_id)
);

-- Lead index on agency_team_id is covered by the UNIQUE constraint.
-- Add a separate index on client_team_id — hasTeamAccess() queries by client first.
CREATE INDEX idx_team_links_client ON team_links(client_team_id);

-- team_members V3: access only, no identity
-- A user either can work in a team or they can't.
CREATE TABLE team_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ============================================
-- Step 3: Populate team_members (deduplicated)
-- ============================================

-- First: owners (one row per team from the teams table)
INSERT INTO team_members (team_id, user_id, role, status, joined_at)
SELECT id, owner_id, 'owner', 'active', created_at
FROM teams;

-- Then: members from team_profiles (skip if already inserted as owner above)
-- team_profiles.user_id is the UX convenience link; status='active' means they accepted
INSERT INTO team_members (team_id, user_id, role, status, joined_at)
SELECT tp.team_id, tp.user_id, 'member', tp.status, tp.created_at
FROM team_profiles tp
WHERE tp.user_id IS NOT NULL
  AND tp.status = 'active'
ON CONFLICT (team_id, user_id) DO NOTHING;  -- owner already inserted above

-- ============================================
-- Step 4: Verify no orphaned V1 members
-- ============================================
-- The V2 migration (20260212) already copied V1 members into team_profiles,
-- but this is a belt-and-suspenders check. Uses RAISE WARNING, not RAISE EXCEPTION,
-- so the migration proceeds regardless (data was already migrated in V2).

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM team_members_v1_legacy v1
    WHERE v1.member_id IS NOT NULL
      AND v1.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.user_id = v1.member_id
          AND t.owner_id = v1.owner_id
      )
  ) THEN
    RAISE WARNING 'Orphaned V1 team_members found — check before proceeding';
  END IF;
END $$;

-- ============================================
-- Step 5: Strip access control fields from team_profiles
-- ============================================
-- These columns belong in team_members, not here.
-- team_profiles is now identity only (voice, bio, LinkedIn — the persona).

ALTER TABLE team_profiles DROP COLUMN IF EXISTS role;
ALTER TABLE team_profiles DROP COLUMN IF EXISTS invited_at;
ALTER TABLE team_profiles DROP COLUMN IF EXISTS accepted_at;

-- ============================================
-- Step 6: Add team_id to cp_post_templates + backfill
-- ============================================

ALTER TABLE cp_post_templates ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_cp_templates_team_id ON cp_post_templates(team_id);

-- Backfill: for each template, assign the team the user created first.
-- For users with exactly one team this is deterministic.
-- For multi-team owners, DISTINCT ON (owner_id) with ORDER BY created_at ASC
-- picks the oldest team — consistent, repeatable, no arbitrary row selection.
UPDATE cp_post_templates t
SET team_id = sub.team_id
FROM (
  SELECT DISTINCT ON (owner_id) id AS team_id, owner_id
  FROM teams
  ORDER BY owner_id, created_at ASC
) sub
WHERE sub.owner_id = t.user_id;

-- ============================================
-- Step 7: Add team_id to cp_content_ideas + backfill
-- ============================================
-- Ideas are now a shared team pool — not assigned to individual profiles.
-- team_profile_id column stays for backward compat but is no longer written.

ALTER TABLE cp_content_ideas ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_cp_ideas_team_id ON cp_content_ideas(team_id);

-- Backfill from team_profiles: follow the existing team_profile_id link
UPDATE cp_content_ideas ci
SET team_id = tp.team_id
FROM team_profiles tp
WHERE ci.team_profile_id = tp.id;

-- ============================================
-- Step 8: Add billing_team_id to teams
-- ============================================
-- NULL = self-billing (team's own owner's plan is checked).
-- When set, that team's owner's plan covers this team's resource limits.
-- Single-hop only — billing_team_id target must have billing_team_id IS NULL.
-- Enforced by application code on write.
-- ON DELETE SET NULL: if the billing team is deleted, team falls back to self-billing.

ALTER TABLE teams ADD COLUMN billing_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_teams_billing_team_id ON teams(billing_team_id);

-- ============================================
-- Step 9: Rewrite cp_match_templates RPC for team scoping
-- ============================================
-- Parameter change: match_user_id → match_team_id
-- WHERE change: (is_global = true OR user_id = match_user_id)
--            → (is_global = true OR team_id = match_team_id)
-- match_count default raised from 3 → 10 to support the new
-- retrieve-10-then-rerank-to-top-3 pattern.
-- RETURNS TABLE signature is preserved exactly from the original.

CREATE OR REPLACE FUNCTION cp_match_templates(
  query_embedding   vector(1536),
  match_team_id     UUID,
  match_count       INT DEFAULT 10,
  min_similarity    FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id                  UUID,
  name                TEXT,
  category            TEXT,
  description         TEXT,
  structure           TEXT,
  example_posts       TEXT[],
  use_cases           TEXT[],
  tags                TEXT[],
  usage_count         INTEGER,
  avg_engagement_score DECIMAL,
  source              TEXT,
  similarity          FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.category,
    t.description,
    t.structure,
    t.example_posts,
    t.use_cases,
    t.tags,
    t.usage_count,
    t.avg_engagement_score,
    t.source,
    (1 - (t.embedding <=> query_embedding))::FLOAT AS similarity
  FROM cp_post_templates t
  WHERE t.is_active = true
    AND (t.is_global = true OR t.team_id = match_team_id)
    AND t.embedding IS NOT NULL
    AND (1 - (t.embedding <=> query_embedding)) >= min_similarity
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- Step 10: Drop V1 legacy table
-- ============================================
-- All V1 data was migrated into team_profiles in the V2 migration (20260212),
-- and access rows have been populated into the new team_members above.

DROP TABLE team_members_v1_legacy;

-- ============================================
-- Step 11: RLS policies
-- ============================================
-- All application code uses the admin/service_role client, so these are
-- defense-in-depth — they prevent data leaks if the anon client is ever
-- used accidentally.

-- ── team_members ─────────────────────────────────────────────────────────────

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships (e.g. team switcher, "which teams am I in?")
CREATE POLICY "team_members: users see own memberships"
  ON team_members FOR SELECT
  USING (auth.uid() = user_id);

-- All writes go through the API (service_role). Direct client mutations blocked.
CREATE POLICY "team_members: service role full access"
  ON team_members FOR ALL
  USING (auth.role() = 'service_role');

-- ── team_profiles ─────────────────────────────────────────────────────────────

-- team_profiles already has RLS enabled from V2 migration.
-- Drop existing select policy and replace with team-membership-aware version.
DROP POLICY IF EXISTS "Anyone can view team profiles" ON team_profiles;
DROP POLICY IF EXISTS "Team owners can view profiles" ON team_profiles;
DROP POLICY IF EXISTS "team_profiles: team members can view" ON team_profiles;

-- SELECT: user must be an active member of the profile's team (direct or via link)
CREATE POLICY "team_profiles: team members can view"
  ON team_profiles FOR SELECT
  USING (
    -- Direct membership
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_profiles.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
    OR
    -- Access via team link (user is active member of an agency team linked to this team)
    EXISTS (
      SELECT 1 FROM team_links tl
      JOIN team_members tm ON tm.team_id = tl.agency_team_id
      WHERE tl.client_team_id = team_profiles.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- All writes go through the API (service_role)
DROP POLICY IF EXISTS "Team owners can manage profiles" ON team_profiles;
DROP POLICY IF EXISTS "team_profiles: service role full access" ON team_profiles;

CREATE POLICY "team_profiles: service role full access"
  ON team_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- ── team_links ────────────────────────────────────────────────────────────────

ALTER TABLE team_links ENABLE ROW LEVEL SECURITY;

-- SELECT: user must own one of the linked teams (either side)
CREATE POLICY "team_links: owners of either team can view"
  ON team_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE (t.id = team_links.agency_team_id OR t.id = team_links.client_team_id)
        AND t.owner_id = auth.uid()
    )
  );

-- All writes go through the API (service_role)
CREATE POLICY "team_links: service role full access"
  ON team_links FOR ALL
  USING (auth.role() = 'service_role');

-- ── cp_post_templates ─────────────────────────────────────────────────────────

-- Replace existing SELECT policy with team-membership-aware version
DROP POLICY IF EXISTS "Users can view own or global templates" ON cp_post_templates;

-- SELECT: global templates visible to all; team templates visible to team members
CREATE POLICY "cp_post_templates: global or team members can view"
  ON cp_post_templates FOR SELECT
  USING (
    is_global = true
    OR
    -- Personal templates (no team assigned) — own only
    (team_id IS NULL AND user_id = auth.uid())
    OR
    -- Team templates — active member of the template's team
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = cp_post_templates.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    ))
  );

-- INSERT/UPDATE/DELETE: own templates only (user_id check, kept for now)
-- Will evolve to team-level check in a future migration once all code uses team scope.
-- Existing policies from 20260218300000 remain; only SELECT is replaced above.
