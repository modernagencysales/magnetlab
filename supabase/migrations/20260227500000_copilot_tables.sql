-- Copilot conversations
CREATE TABLE copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  system_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_conv_user ON copilot_conversations(user_id, updated_at DESC);
CREATE INDEX idx_copilot_conv_entity ON copilot_conversations(user_id, entity_type, entity_id);

ALTER TABLE copilot_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_conv_select ON copilot_conversations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY copilot_conv_insert ON copilot_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY copilot_conv_update ON copilot_conversations FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY copilot_conv_delete ON copilot_conversations FOR DELETE USING (user_id = auth.uid());
CREATE POLICY copilot_conv_service ON copilot_conversations FOR ALL USING (auth.role() = 'service_role');

-- Copilot messages
CREATE TABLE copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES copilot_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool_call', 'tool_result')),
  content TEXT,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  feedback JSONB,
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_msg_conv ON copilot_messages(conversation_id, created_at);

ALTER TABLE copilot_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_msg_select ON copilot_messages FOR SELECT
  USING (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_insert ON copilot_messages FOR INSERT
  WITH CHECK (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_update ON copilot_messages FOR UPDATE
  USING (conversation_id IN (SELECT id FROM copilot_conversations WHERE user_id = auth.uid()));
CREATE POLICY copilot_msg_service ON copilot_messages FOR ALL USING (auth.role() = 'service_role');

-- Copilot memories
CREATE TABLE copilot_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  category TEXT CHECK (category IN ('tone', 'structure', 'vocabulary', 'content', 'general')),
  confidence FLOAT NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL CHECK (source IN ('conversation', 'feedback', 'manual')),
  conversation_id UUID REFERENCES copilot_conversations(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_mem_user ON copilot_memories(user_id, active, category);

ALTER TABLE copilot_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY copilot_mem_select ON copilot_memories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY copilot_mem_insert ON copilot_memories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY copilot_mem_update ON copilot_memories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY copilot_mem_delete ON copilot_memories FOR DELETE USING (user_id = auth.uid());
CREATE POLICY copilot_mem_service ON copilot_memories FOR ALL USING (auth.role() = 'service_role');
