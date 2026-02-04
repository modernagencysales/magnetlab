-- Funnel Pages Schema
-- Tables for opt-in pages, thank-you pages, qualification questions, leads, and webhooks

-- ============================================
-- ADD USERNAME TO USERS
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Index for username lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- FUNNEL PAGES
-- ============================================

CREATE TABLE funnel_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,

  -- Opt-in page configuration
  optin_headline TEXT NOT NULL,
  optin_subline TEXT,
  optin_button_text TEXT DEFAULT 'Get Free Access',
  optin_social_proof TEXT,

  -- Thank-you page configuration
  thankyou_headline TEXT DEFAULT 'Thanks! Check your email.',
  thankyou_subline TEXT,
  vsl_url TEXT,
  calendly_url TEXT,
  qualification_pass_message TEXT DEFAULT 'Great! Book a call below.',
  qualification_fail_message TEXT DEFAULT 'Thanks for your interest!',

  -- Publishing state
  is_published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one slug
  UNIQUE(user_id, slug)
);

-- Indexes for funnel pages
CREATE INDEX idx_funnel_pages_user_id ON funnel_pages(user_id);
CREATE INDEX idx_funnel_pages_lead_magnet_id ON funnel_pages(lead_magnet_id);
CREATE INDEX idx_funnel_pages_slug ON funnel_pages(slug);
CREATE INDEX idx_funnel_pages_published ON funnel_pages(is_published) WHERE is_published = TRUE;

-- ============================================
-- QUALIFICATION QUESTIONS
-- ============================================

CREATE TABLE qualification_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_page_id UUID REFERENCES funnel_pages(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  question_order INTEGER DEFAULT 0,
  qualifying_answer TEXT NOT NULL CHECK (qualifying_answer IN ('yes', 'no')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qualification_questions_funnel ON qualification_questions(funnel_page_id);
CREATE INDEX idx_qualification_questions_order ON qualification_questions(funnel_page_id, question_order);

-- ============================================
-- FUNNEL LEADS
-- ============================================

CREATE TABLE funnel_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_page_id UUID REFERENCES funnel_pages(id) ON DELETE CASCADE NOT NULL,
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,

  -- Lead info
  email TEXT NOT NULL,
  name TEXT,

  -- Qualification data
  qualification_answers JSONB,
  is_qualified BOOLEAN,

  -- UTM tracking
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_funnel_leads_funnel ON funnel_leads(funnel_page_id);
CREATE INDEX idx_funnel_leads_lead_magnet ON funnel_leads(lead_magnet_id);
CREATE INDEX idx_funnel_leads_user ON funnel_leads(user_id);
CREATE INDEX idx_funnel_leads_email ON funnel_leads(email);
CREATE INDEX idx_funnel_leads_qualified ON funnel_leads(is_qualified);
CREATE INDEX idx_funnel_leads_created ON funnel_leads(created_at DESC);

-- ============================================
-- WEBHOOK CONFIGS
-- ============================================

CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_configs_user ON webhook_configs(user_id);
CREATE INDEX idx_webhook_configs_active ON webhook_configs(user_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE funnel_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

-- Funnel pages: users can manage their own, public read for published pages
CREATE POLICY "Users can manage own funnel pages" ON funnel_pages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published funnel pages" ON funnel_pages
  FOR SELECT USING (is_published = TRUE);

-- Qualification questions: users can manage through funnel ownership
CREATE POLICY "Users can manage own questions" ON qualification_questions
  FOR ALL USING (funnel_page_id IN (SELECT id FROM funnel_pages WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can view questions for published pages" ON qualification_questions
  FOR SELECT USING (funnel_page_id IN (SELECT id FROM funnel_pages WHERE is_published = TRUE));

-- Funnel leads: only owner can view
CREATE POLICY "Users can view own leads" ON funnel_leads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert leads" ON funnel_leads
  FOR INSERT WITH CHECK (TRUE);

-- Webhook configs: only owner
CREATE POLICY "Users can manage own webhooks" ON webhook_configs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_funnel_pages_updated_at BEFORE UPDATE ON funnel_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_configs_updated_at BEFORE UPDATE ON webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RESERVED USERNAMES
-- ============================================

-- Function to check if username is reserved
CREATE OR REPLACE FUNCTION is_username_reserved(p_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  reserved_names TEXT[] := ARRAY[
    'admin', 'api', 'www', 'app', 'mail', 'email',
    'support', 'help', 'info', 'contact', 'sales',
    'marketing', 'billing', 'account', 'accounts',
    'login', 'logout', 'signup', 'register', 'auth',
    'dashboard', 'settings', 'profile', 'user', 'users',
    'static', 'assets', 'public', 'private', 'internal',
    'system', 'root', 'null', 'undefined', 'test',
    'demo', 'example', 'sample', 'magnetlab', 'funnel',
    'lead', 'leads', 'magnet', 'magnets', 'webhook',
    'webhooks', 'library', 'create', 'edit', 'delete',
    'new', 'p', 'page', 'pages', 'post', 'posts'
  ];
BEGIN
  RETURN LOWER(p_username) = ANY(reserved_names);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Constraint to prevent reserved usernames
ALTER TABLE users ADD CONSTRAINT check_username_not_reserved
  CHECK (username IS NULL OR NOT is_username_reserved(username));

-- Constraint for valid username format (alphanumeric, underscores, hyphens, 3-30 chars)
ALTER TABLE users ADD CONSTRAINT check_username_format
  CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9_-]{3,30}$');
