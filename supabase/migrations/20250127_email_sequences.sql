-- Email Sequences Schema
-- Tables for email sequences per lead magnet and Loops.so lead sync tracking

-- ============================================
-- EMAIL SEQUENCES
-- ============================================

CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- 5 generated emails as JSONB array
  -- Each email: { day: number, subject: string, body: string, replyTrigger: string }
  emails JSONB NOT NULL DEFAULT '[]',

  -- Loops sync state
  loops_synced_at TIMESTAMPTZ,
  loops_transactional_ids JSONB DEFAULT '[]', -- Array of transactional email IDs from Loops

  -- Status: draft (generated but not synced), synced (pushed to Loops), active (sequence running)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'synced', 'active')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for email sequences
CREATE INDEX idx_email_sequences_user_id ON email_sequences(user_id);
CREATE INDEX idx_email_sequences_lead_magnet_id ON email_sequences(lead_magnet_id);
CREATE INDEX idx_email_sequences_status ON email_sequences(status);

-- ============================================
-- LOOPS LEAD SYNC TRACKING
-- ============================================

CREATE TABLE loops_lead_syncs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES funnel_leads(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Loops contact info
  loops_contact_id TEXT,
  loops_event_sent BOOLEAN DEFAULT FALSE,

  -- Sync status
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for loops lead syncs
CREATE INDEX idx_loops_lead_syncs_lead_id ON loops_lead_syncs(lead_id);
CREATE INDEX idx_loops_lead_syncs_user_id ON loops_lead_syncs(user_id);
CREATE INDEX idx_loops_lead_syncs_synced ON loops_lead_syncs(loops_event_sent);

-- ============================================
-- EXTEND BRAND KITS FOR EMAIL PERSONALIZATION
-- ============================================

-- Sender name for email signatures
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Best video for email 2 (link to best content)
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS best_video_url TEXT;
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS best_video_title TEXT;

-- Content links for email 3 (array of { title: string, url: string })
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS content_links JSONB DEFAULT '[]';

-- Community URL for email 4
ALTER TABLE brand_kits ADD COLUMN IF NOT EXISTS community_url TEXT;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE loops_lead_syncs ENABLE ROW LEVEL SECURITY;

-- Email sequences: users can manage their own
CREATE POLICY "Users can manage own email sequences" ON email_sequences
  FOR ALL USING (auth.uid() = user_id);

-- Loops lead syncs: users can view their own
CREATE POLICY "Users can view own loops syncs" ON loops_lead_syncs
  FOR SELECT USING (user_id = auth.uid());

-- Allow insert for lead sync (happens during lead capture)
CREATE POLICY "Anyone can insert loops syncs" ON loops_lead_syncs
  FOR INSERT WITH CHECK (TRUE);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_email_sequences_updated_at BEFORE UPDATE ON email_sequences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
