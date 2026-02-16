-- Add interactive config to lead_magnets
ALTER TABLE lead_magnets ADD COLUMN interactive_config JSONB DEFAULT NULL;

-- Chat persistence for GPT-type interactive lead magnets
CREATE TABLE interactive_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_magnet_id UUID NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  funnel_lead_id UUID REFERENCES funnel_leads(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_magnet_id, session_token)
);

CREATE TABLE interactive_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES interactive_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactive_chats_lead_magnet ON interactive_chats(lead_magnet_id);
CREATE INDEX idx_interactive_chats_session ON interactive_chats(session_token);
CREATE INDEX idx_interactive_chat_messages_chat ON interactive_chat_messages(chat_id);
