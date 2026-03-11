-- Program Support Tickets
CREATE TABLE IF NOT EXISTS program_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES program_enrollments(id) ON DELETE CASCADE,
  module_id TEXT DEFAULT 'general',
  summary TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE program_support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on program_support_tickets"
  ON program_support_tickets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Index for lookup by enrollment
CREATE INDEX idx_support_tickets_enrollment ON program_support_tickets(enrollment_id);
