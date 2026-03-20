-- DM Reply Coach tables
-- Provides AI-coached DM conversations: contacts, message threads, and AI suggestions.

-- ─── dmc_contacts ───────────────────────────────────────────────────────────

CREATE TABLE dmc_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid,
  name text NOT NULL,
  linkedin_url text,
  headline text,
  company text,
  location text,
  conversation_goal text NOT NULL DEFAULT 'book_meeting'
    CHECK (conversation_goal IN ('book_meeting', 'build_relationship', 'promote_content', 'explore_partnership', 'nurture_lead', 'close_deal')),
  qualification_stage text NOT NULL DEFAULT 'unknown'
    CHECK (qualification_stage IN ('unknown', 'situation', 'pain', 'impact', 'vision', 'capability', 'commitment')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'closed_won', 'closed_lost')),
  notes text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dmc_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own contacts" ON dmc_contacts FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_dmc_contacts_user_id ON dmc_contacts(user_id);
CREATE INDEX idx_dmc_contacts_status ON dmc_contacts(user_id, status);

-- ─── dmc_messages ───────────────────────────────────────────────────────────

CREATE TABLE dmc_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES dmc_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('them', 'me')),
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dmc_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages" ON dmc_messages FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_dmc_messages_contact_id ON dmc_messages(contact_id, timestamp);

-- ─── dmc_suggestions ────────────────────────────────────────────────────────

CREATE TABLE dmc_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES dmc_contacts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggested_response text NOT NULL,
  reasoning jsonb NOT NULL,
  conversation_goal text NOT NULL,
  stage_before text NOT NULL,
  stage_after text NOT NULL,
  was_used boolean DEFAULT false,
  user_edited_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dmc_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own suggestions" ON dmc_suggestions FOR ALL USING (user_id = auth.uid());
CREATE INDEX idx_dmc_suggestions_contact_id ON dmc_suggestions(contact_id);
