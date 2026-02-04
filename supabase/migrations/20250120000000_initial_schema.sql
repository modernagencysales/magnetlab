-- MagnetLab Database Schema
-- Core tables for the lead magnet generator SaaS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTH
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS & BILLING
-- ============================================

CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'unlimited');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan subscription_plan DEFAULT 'free' NOT NULL,
  status subscription_status DEFAULT 'active' NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Usage tracking for free tier limits
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL, -- Format: YYYY-MM
  lead_magnets_created INTEGER DEFAULT 0,
  posts_scheduled INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- ============================================
-- BRAND KITS
-- ============================================

CREATE TABLE brand_kits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Business Context (from lead-magnet-generator BusinessContext)
  business_description TEXT NOT NULL,
  business_type TEXT NOT NULL, -- coach-consultant, agency-owner, etc.
  credibility_markers TEXT[] DEFAULT '{}',
  urgent_pains TEXT[] DEFAULT '{}',
  templates TEXT[] DEFAULT '{}',
  processes TEXT[] DEFAULT '{}',
  tools TEXT[] DEFAULT '{}',
  frequent_questions TEXT[] DEFAULT '{}',
  results TEXT[] DEFAULT '{}',
  success_example TEXT,
  audience_tools TEXT[] DEFAULT '{}',

  -- Style preferences
  preferred_tone TEXT DEFAULT 'conversational',
  style_profile JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- LEAD MAGNETS
-- ============================================

CREATE TYPE lead_magnet_status AS ENUM ('draft', 'published', 'scheduled', 'archived');
CREATE TYPE lead_magnet_archetype AS ENUM (
  'single-breakdown',
  'single-system',
  'focused-toolkit',
  'single-calculator',
  'focused-directory',
  'mini-training',
  'one-story',
  'prompt',
  'assessment',
  'workflow'
);

CREATE TABLE lead_magnets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Basic info
  title TEXT NOT NULL,
  archetype lead_magnet_archetype NOT NULL,

  -- AI-generated content (JSONB for flexibility)
  concept JSONB, -- IdeationResult single concept
  extracted_content JSONB, -- ExtractedContent from extraction phase
  generated_content JSONB, -- VAR structured content

  -- LinkedIn post content
  linkedin_post TEXT,
  post_variations JSONB, -- Array of PostVariation
  dm_template TEXT,
  cta_word TEXT,

  -- Publishing info
  notion_page_id TEXT,
  notion_page_url TEXT,
  thumbnail_url TEXT,

  -- LeadShark integration
  leadshark_post_id TEXT,
  leadshark_automation_id TEXT,
  scheduled_time TIMESTAMPTZ,

  -- Status tracking
  status lead_magnet_status DEFAULT 'draft',
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user queries
CREATE INDEX idx_lead_magnets_user_id ON lead_magnets(user_id);
CREATE INDEX idx_lead_magnets_status ON lead_magnets(status);
CREATE INDEX idx_lead_magnets_created_at ON lead_magnets(created_at DESC);

-- ============================================
-- ANALYTICS
-- ============================================

CREATE TABLE lead_magnet_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL,

  -- LinkedIn metrics (from LeadShark)
  linkedin_views INTEGER DEFAULT 0,
  linkedin_likes INTEGER DEFAULT 0,
  linkedin_comments INTEGER DEFAULT 0,
  linkedin_shares INTEGER DEFAULT 0,

  -- Automation metrics
  dms_sent INTEGER DEFAULT 0,
  dms_replied INTEGER DEFAULT 0,
  connections_made INTEGER DEFAULT 0,

  -- Lead capture
  leads_captured INTEGER DEFAULT 0,

  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(lead_magnet_id, captured_at)
);

CREATE INDEX idx_analytics_lead_magnet ON lead_magnet_analytics(lead_magnet_id);

-- ============================================
-- NOTION INTEGRATION
-- ============================================

CREATE TABLE notion_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  access_token TEXT NOT NULL,
  workspace_id TEXT,
  workspace_name TEXT,
  workspace_icon TEXT,
  bot_id TEXT,

  -- Default parent page for new lead magnets
  default_parent_page_id TEXT,
  default_parent_page_name TEXT,

  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================
-- EXTRACTION SESSIONS (for wizard state)
-- ============================================

CREATE TABLE extraction_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE,

  -- Current step in wizard
  current_step INTEGER DEFAULT 1,

  -- Accumulated answers from extraction questions
  extraction_answers JSONB DEFAULT '{}',

  -- Chat history for conversational extraction
  chat_messages JSONB DEFAULT '[]',

  -- Selected concept from ideation
  selected_concept_index INTEGER,

  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extraction_sessions_user ON extraction_sessions(user_id);
CREATE INDEX idx_extraction_sessions_expires ON extraction_sessions(expires_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_magnet_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON usage_tracking FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own brand kit" ON brand_kits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own lead magnets" ON lead_magnets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own analytics" ON lead_magnet_analytics FOR SELECT
  USING (lead_magnet_id IN (SELECT id FROM lead_magnets WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own Notion connection" ON notion_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own extraction sessions" ON extraction_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_kits_updated_at BEFORE UPDATE ON brand_kits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_magnets_updated_at BEFORE UPDATE ON lead_magnets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notion_connections_updated_at BEFORE UPDATE ON notion_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_extraction_sessions_updated_at BEFORE UPDATE ON extraction_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID, p_limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan subscription_plan;
  v_current_usage INTEGER;
  v_limit INTEGER;
  v_month_year TEXT;
BEGIN
  -- Get user's plan
  SELECT plan INTO v_plan FROM subscriptions WHERE user_id = p_user_id;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;

  -- Get current month
  v_month_year := TO_CHAR(NOW(), 'YYYY-MM');

  -- Get current usage
  SELECT
    CASE p_limit_type
      WHEN 'lead_magnets' THEN lead_magnets_created
      WHEN 'posts' THEN posts_scheduled
    END
  INTO v_current_usage
  FROM usage_tracking
  WHERE user_id = p_user_id AND month_year = v_month_year;

  IF v_current_usage IS NULL THEN v_current_usage := 0; END IF;

  -- Set limits based on plan
  CASE v_plan
    WHEN 'free' THEN
      v_limit := CASE p_limit_type WHEN 'lead_magnets' THEN 2 WHEN 'posts' THEN 0 END;
    WHEN 'pro' THEN
      v_limit := CASE p_limit_type WHEN 'lead_magnets' THEN 15 WHEN 'posts' THEN 15 END;
    WHEN 'unlimited' THEN
      v_limit := 999999; -- Effectively unlimited
  END CASE;

  RETURN v_current_usage < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(p_user_id UUID, p_limit_type TEXT)
RETURNS VOID AS $$
DECLARE
  v_month_year TEXT;
BEGIN
  v_month_year := TO_CHAR(NOW(), 'YYYY-MM');

  INSERT INTO usage_tracking (user_id, month_year, lead_magnets_created, posts_scheduled)
  VALUES (p_user_id, v_month_year,
    CASE p_limit_type WHEN 'lead_magnets' THEN 1 ELSE 0 END,
    CASE p_limit_type WHEN 'posts' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, month_year) DO UPDATE SET
    lead_magnets_created = usage_tracking.lead_magnets_created +
      CASE p_limit_type WHEN 'lead_magnets' THEN 1 ELSE 0 END,
    posts_scheduled = usage_tracking.posts_scheduled +
      CASE p_limit_type WHEN 'posts' THEN 1 ELSE 0 END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
