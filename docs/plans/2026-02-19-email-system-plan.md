# Email System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email flows (multi-step drip sequences), broadcasts (one-off sends), and subscriber management (with CSV import and audience segmentation) to magnetlab.

**Architecture:** Extends existing Resend + Trigger.dev + whitelabeling infrastructure. New normalized tables (email_flows, email_flow_steps, email_subscribers, email_flow_contacts, email_broadcasts) with team_id scoping and RLS. Coexists with old email_sequences — new system takes priority when both exist. Audience filtering for broadcasts via joins against email_events table.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS), Trigger.dev v4, Resend, Zod, TypeScript, shadcn/ui, Tailwind CSS.

**Design Doc:** `docs/plans/2026-02-19-email-system-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260219200000_email_system.sql`

**Step 1: Write the migration**

```sql
-- Email System: flows, steps, subscribers, contacts, broadcasts

-- 1. Email Flows
CREATE TABLE IF NOT EXISTS email_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('lead_magnet', 'manual')),
  trigger_lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_flows_team ON email_flows(team_id);
CREATE INDEX idx_email_flows_trigger ON email_flows(trigger_type, trigger_lead_magnet_id) WHERE trigger_type = 'lead_magnet';

-- 2. Email Flow Steps
CREATE TABLE IF NOT EXISTS email_flow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, step_number)
);

CREATE INDEX idx_email_flow_steps_flow ON email_flow_steps(flow_id);

-- 3. Email Subscribers
CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('lead_magnet', 'manual', 'import')),
  source_id UUID,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(team_id, email)
);

CREATE INDEX idx_email_subscribers_team ON email_subscribers(team_id);
CREATE INDEX idx_email_subscribers_status ON email_subscribers(team_id, status);

-- 4. Email Flow Contacts
CREATE TABLE IF NOT EXISTS email_flow_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  trigger_task_id TEXT,
  UNIQUE(flow_id, subscriber_id)
);

CREATE INDEX idx_email_flow_contacts_flow ON email_flow_contacts(flow_id);
CREATE INDEX idx_email_flow_contacts_subscriber ON email_flow_contacts(subscriber_id);

-- 5. Email Broadcasts
CREATE TABLE IF NOT EXISTS email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  audience_filter JSONB,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_broadcasts_team ON email_broadcasts(team_id);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['email_flows', 'email_flow_steps', 'email_broadcasts']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- RLS
ALTER TABLE email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;

-- Policies: team members can manage their team's email data
-- Flows
CREATE POLICY "Team members can view flows" ON email_flows
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "Team members can insert flows" ON email_flows
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Team members can update flows" ON email_flows
  FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "Team members can delete flows" ON email_flows
  FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Steps (via flow ownership)
CREATE POLICY "Team members can view steps" ON email_flow_steps
  FOR SELECT USING (
    flow_id IN (
      SELECT id FROM email_flows WHERE
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
        OR user_id = auth.uid()
    )
  );
CREATE POLICY "Team members can manage steps" ON email_flow_steps
  FOR ALL USING (
    flow_id IN (
      SELECT id FROM email_flows WHERE
        team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
        OR user_id = auth.uid()
    )
  );

-- Subscribers
CREATE POLICY "Team members can view subscribers" ON email_subscribers
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );
CREATE POLICY "Team members can manage subscribers" ON email_subscribers
  FOR ALL USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Flow contacts
CREATE POLICY "Team members can view flow contacts" ON email_flow_contacts
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );
CREATE POLICY "Team members can manage flow contacts" ON email_flow_contacts
  FOR ALL USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  );

-- Broadcasts
CREATE POLICY "Team members can view broadcasts" ON email_broadcasts
  FOR SELECT USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "Team members can insert broadcasts" ON email_broadcasts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Team members can update broadcasts" ON email_broadcasts
  FOR UPDATE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "Team members can delete broadcasts" ON email_broadcasts
  FOR DELETE USING (
    team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- Service role bypass for Trigger.dev tasks
CREATE POLICY "Service role full access flows" ON email_flows FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access steps" ON email_flow_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access subscribers" ON email_subscribers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access contacts" ON email_flow_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access broadcasts" ON email_broadcasts FOR ALL USING (true) WITH CHECK (true);

-- Function to build filtered subscriber query for broadcasts
CREATE OR REPLACE FUNCTION get_filtered_subscriber_count(
  p_team_id UUID,
  p_filter JSONB DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  result INTEGER;
  engagement_filter TEXT;
  source_filter TEXT;
  days_back INTEGER;
BEGIN
  -- Base: active subscribers for team
  IF p_filter IS NULL THEN
    SELECT count(*) INTO result FROM email_subscribers
    WHERE team_id = p_team_id AND status = 'active';
    RETURN result;
  END IF;

  engagement_filter := p_filter->>'engagement';
  source_filter := p_filter->>'source';

  -- Build dynamic query
  CREATE TEMP TABLE _filtered_subs ON COMMIT DROP AS
  SELECT es.id FROM email_subscribers es
  WHERE es.team_id = p_team_id AND es.status = 'active';

  -- Source filter
  IF source_filter IS NOT NULL THEN
    IF source_filter LIKE 'lead_magnet:%' THEN
      DELETE FROM _filtered_subs WHERE id NOT IN (
        SELECT id FROM email_subscribers
        WHERE source = 'lead_magnet' AND source_id = (split_part(source_filter, ':', 2))::UUID
      );
    ELSE
      DELETE FROM _filtered_subs WHERE id NOT IN (
        SELECT id FROM email_subscribers WHERE source = source_filter
      );
    END IF;
  END IF;

  -- Engagement filter
  IF engagement_filter IS NOT NULL THEN
    IF engagement_filter = 'never_opened' THEN
      DELETE FROM _filtered_subs WHERE id IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'opened'
      );
    ELSIF engagement_filter LIKE 'opened_%' THEN
      days_back := (regexp_replace(engagement_filter, '[^0-9]', '', 'g'))::INTEGER;
      DELETE FROM _filtered_subs WHERE id NOT IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'opened' AND ee.created_at > now() - (days_back || ' days')::INTERVAL
      );
    ELSIF engagement_filter LIKE 'clicked_%' THEN
      days_back := (regexp_replace(engagement_filter, '[^0-9]', '', 'g'))::INTEGER;
      DELETE FROM _filtered_subs WHERE id NOT IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'clicked' AND ee.created_at > now() - (days_back || ' days')::INTERVAL
      );
    END IF;
  END IF;

  SELECT count(*) INTO result FROM _filtered_subs;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get filtered subscriber IDs for broadcast sending
CREATE OR REPLACE FUNCTION get_filtered_subscribers(
  p_team_id UUID,
  p_filter JSONB DEFAULT NULL
) RETURNS TABLE(subscriber_id UUID, email TEXT, first_name TEXT) AS $$
DECLARE
  engagement_filter TEXT;
  source_filter TEXT;
  days_back INTEGER;
BEGIN
  IF p_filter IS NULL THEN
    RETURN QUERY SELECT es.id, es.email, es.first_name
    FROM email_subscribers es
    WHERE es.team_id = p_team_id AND es.status = 'active';
    RETURN;
  END IF;

  engagement_filter := p_filter->>'engagement';
  source_filter := p_filter->>'source';

  CREATE TEMP TABLE _broadcast_subs ON COMMIT DROP AS
  SELECT es.id AS sub_id, es.email AS sub_email, es.first_name AS sub_first_name
  FROM email_subscribers es
  WHERE es.team_id = p_team_id AND es.status = 'active';

  -- Source filter
  IF source_filter IS NOT NULL THEN
    IF source_filter LIKE 'lead_magnet:%' THEN
      DELETE FROM _broadcast_subs WHERE sub_id NOT IN (
        SELECT id FROM email_subscribers
        WHERE source = 'lead_magnet' AND source_id = (split_part(source_filter, ':', 2))::UUID
      );
    ELSE
      DELETE FROM _broadcast_subs WHERE sub_id NOT IN (
        SELECT id FROM email_subscribers WHERE source = source_filter
      );
    END IF;
  END IF;

  -- Engagement filter
  IF engagement_filter IS NOT NULL THEN
    IF engagement_filter = 'never_opened' THEN
      DELETE FROM _broadcast_subs WHERE sub_id IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'opened'
      );
    ELSIF engagement_filter LIKE 'opened_%' THEN
      days_back := (regexp_replace(engagement_filter, '[^0-9]', '', 'g'))::INTEGER;
      DELETE FROM _broadcast_subs WHERE sub_id NOT IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'opened' AND ee.created_at > now() - (days_back || ' days')::INTERVAL
      );
    ELSIF engagement_filter LIKE 'clicked_%' THEN
      days_back := (regexp_replace(engagement_filter, '[^0-9]', '', 'g'))::INTEGER;
      DELETE FROM _broadcast_subs WHERE sub_id NOT IN (
        SELECT es.id FROM email_subscribers es
        JOIN email_events ee ON ee.recipient_email = es.email
        WHERE ee.event_type = 'clicked' AND ee.created_at > now() - (days_back || ' days')::INTERVAL
      );
    END IF;
  END IF;

  RETURN QUERY SELECT sub_id, sub_email, sub_first_name FROM _broadcast_subs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Step 2: Push migration**

Run: `npm run db:push` (from magnetlab directory)
Expected: Migration applied, tables created.

**Step 3: Commit**

```bash
git add supabase/migrations/20260219200000_email_system.sql
git commit -m "feat: add email system tables (flows, steps, subscribers, contacts, broadcasts)"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types/email-system.ts`

**Step 1: Write types**

```typescript
// Types for the email system: flows, steps, subscribers, contacts, broadcasts

export type EmailFlowStatus = 'draft' | 'active' | 'paused';
export type EmailFlowTriggerType = 'lead_magnet' | 'manual';

export interface EmailFlow {
  id: string;
  team_id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_type: EmailFlowTriggerType;
  trigger_lead_magnet_id: string | null;
  status: EmailFlowStatus;
  created_at: string;
  updated_at: string;
}

export interface EmailFlowStep {
  id: string;
  flow_id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  created_at: string;
  updated_at: string;
}

export interface EmailFlowWithSteps extends EmailFlow {
  steps: EmailFlowStep[];
}

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';
export type SubscriberSource = 'lead_magnet' | 'manual' | 'import';

export interface EmailSubscriber {
  id: string;
  team_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: SubscriberStatus;
  source: SubscriberSource;
  source_id: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export type FlowContactStatus = 'active' | 'completed' | 'paused' | 'unsubscribed';

export interface EmailFlowContact {
  id: string;
  team_id: string;
  flow_id: string;
  subscriber_id: string;
  current_step: number;
  status: FlowContactStatus;
  entered_at: string;
  last_sent_at: string | null;
  trigger_task_id: string | null;
}

export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed';

export interface AudienceFilter {
  engagement?: 'opened_30d' | 'opened_60d' | 'opened_90d' | 'clicked_30d' | 'clicked_60d' | 'clicked_90d' | 'never_opened';
  source?: string; // 'lead_magnet' | 'lead_magnet:{id}' | 'manual' | 'import'
  subscribed_after?: string; // ISO date
  subscribed_before?: string; // ISO date
}

export interface EmailBroadcast {
  id: string;
  team_id: string;
  user_id: string;
  subject: string;
  body: string;
  status: BroadcastStatus;
  audience_filter: AudienceFilter | null;
  recipient_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Zod schemas for API validation
import { z } from 'zod';

export const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  trigger_type: z.enum(['lead_magnet', 'manual']),
  trigger_lead_magnet_id: z.string().uuid().optional(),
});

export const updateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'paused']).optional(),
  trigger_type: z.enum(['lead_magnet', 'manual']).optional(),
  trigger_lead_magnet_id: z.string().uuid().nullable().optional(),
});

export const createStepSchema = z.object({
  step_number: z.number().int().min(0),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  delay_days: z.number().int().min(0).max(365),
});

export const updateStepSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  delay_days: z.number().int().min(0).max(365).optional(),
  step_number: z.number().int().min(0).optional(),
});

export const createSubscriberSchema = z.object({
  email: z.string().email(),
  first_name: z.string().max(200).optional(),
  last_name: z.string().max(200).optional(),
});

export const audienceFilterSchema = z.object({
  engagement: z.enum(['opened_30d', 'opened_60d', 'opened_90d', 'clicked_30d', 'clicked_60d', 'clicked_90d', 'never_opened']).optional(),
  source: z.string().optional(),
  subscribed_after: z.string().datetime().optional(),
  subscribed_before: z.string().datetime().optional(),
}).optional();

export const createBroadcastSchema = z.object({
  subject: z.string().max(500).optional(),
  body: z.string().optional(),
});

export const updateBroadcastSchema = z.object({
  subject: z.string().max(500).optional(),
  body: z.string().optional(),
  audience_filter: audienceFilterSchema.nullable(),
});
```

**Step 2: Commit**

```bash
git add src/lib/types/email-system.ts
git commit -m "feat: add TypeScript types and Zod schemas for email system"
```

---

## Task 3: Subscriber API Routes

**Files:**
- Create: `src/app/api/email/subscribers/route.ts` (GET list, POST add)
- Create: `src/app/api/email/subscribers/[id]/route.ts` (DELETE)
- Create: `src/app/api/email/subscribers/import/route.ts` (POST CSV import)

**Step 1: Write subscriber list + add route**

`src/app/api/email/subscribers/route.ts`:
- GET: List subscribers for team. Query params: `search` (email/name filter), `status` (active/unsubscribed/bounced), `source` (lead_magnet/manual/import), `page` (default 1), `limit` (default 50). Auth via `auth()`, scope to team_id. Return `{ subscribers, total, page, limit }`.
- POST: Add single subscriber. Validate with `createSubscriberSchema`. Upsert on (team_id, email) — don't overwrite existing names unless blank. Source = 'manual'. Return created/updated subscriber.

**Step 2: Write subscriber delete route**

`src/app/api/email/subscribers/[id]/route.ts`:
- DELETE: Soft-delete by setting status = 'unsubscribed'. Also update any active flow contacts for this subscriber to 'unsubscribed'. Auth + team scope check.

**Step 3: Write CSV import route**

`src/app/api/email/subscribers/import/route.ts`:
- POST: Accept `multipart/form-data` with a CSV file. Parse CSV (first row = headers: email, first_name, last_name). Validate emails with Zod. Return preview: `{ valid: [{email, first_name, last_name}], invalid: [{row, reason}], total }`.
- POST with `?confirm=true` query param: Actually upsert all valid rows into email_subscribers. Source = 'import'. Return `{ imported: number, skipped: number }`.

**Step 4: Write tests for subscriber routes**

`src/__tests__/api/email/subscribers.test.ts`:
- Test GET returns paginated list scoped to team
- Test POST creates subscriber with validation
- Test POST rejects invalid email
- Test CSV import parses correctly, flags invalid rows
- Test CSV confirm upserts subscribers

**Step 5: Run tests**

Run: `npx jest src/__tests__/api/email/subscribers.test.ts --no-coverage -v`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/app/api/email/subscribers/ src/__tests__/api/email/subscribers.test.ts
git commit -m "feat: add subscriber API routes (list, add, delete, CSV import)"
```

---

## Task 4: Unsubscribe Handler

**Files:**
- Create: `src/app/api/email/unsubscribe/route.ts`
- Modify: `src/lib/integrations/resend.ts` (add unsubscribe link generation)

**Step 1: Add HMAC token generation and unsubscribe link helper**

In `src/lib/integrations/resend.ts`, add:
- `generateUnsubscribeToken(subscriberId: string): string` — HMAC-SHA256 of subscriber ID using `NEXTAUTH_SECRET` as key, truncated to 32 chars.
- `generateUnsubscribeUrl(subscriberId: string): string` — returns `{NEXTAUTH_URL}/api/email/unsubscribe?sid={subscriberId}&token={hmac}`.
- `buildEmailFooterHtml(subscriberId: string): string` — returns HTML footer with unsubscribe link.

**Step 2: Write unsubscribe route**

`src/app/api/email/unsubscribe/route.ts`:
- GET: Validate `sid` and `token` params. Verify HMAC. Set subscriber status = 'unsubscribed', set unsubscribed_at. Update any active flow contacts for this subscriber to 'unsubscribed'. Return a simple HTML page: "You've been unsubscribed."
- No auth required (public endpoint).

**Step 3: Commit**

```bash
git add src/app/api/email/unsubscribe/route.ts src/lib/integrations/resend.ts
git commit -m "feat: add unsubscribe handler with HMAC verification"
```

---

## Task 5: Email Flow API Routes

**Files:**
- Create: `src/app/api/email/flows/route.ts` (GET list, POST create)
- Create: `src/app/api/email/flows/[id]/route.ts` (GET detail, PUT update, DELETE)
- Create: `src/app/api/email/flows/[id]/steps/route.ts` (POST add step)
- Create: `src/app/api/email/flows/[id]/steps/[stepId]/route.ts` (PUT update, DELETE)
- Create: `src/app/api/email/flows/[id]/contacts/route.ts` (GET list contacts)
- Create: `src/app/api/email/flows/[id]/generate/route.ts` (POST AI generate)

**Step 1: Write flow list + create route**

`src/app/api/email/flows/route.ts`:
- GET: List flows for team. Include step count via left join or separate query. Auth + team scope. Return `{ flows: EmailFlow[] }`.
- POST: Create flow. Validate with `createFlowSchema`. If trigger_type = 'lead_magnet', validate trigger_lead_magnet_id exists and belongs to user. Status defaults to 'draft'. Return created flow.

**Step 2: Write flow detail + update + delete route**

`src/app/api/email/flows/[id]/route.ts`:
- GET: Fetch flow + all steps (ordered by step_number). Auth + ownership check. Return `{ flow: EmailFlowWithSteps }`.
- PUT: Update flow fields. Validate with `updateFlowSchema`. If setting status = 'active', validate flow has at least 1 step. Return updated flow.
- DELETE: Only allow if status is 'draft' or 'paused'. Delete cascades to steps + contacts. Return 204.

**Step 3: Write step add route**

`src/app/api/email/flows/[id]/steps/route.ts`:
- POST: Add step to flow. Validate with `createStepSchema`. Flow must be in 'draft' or 'paused' status. Auto-increment step_number if not provided. Return created step.

**Step 4: Write step update + delete route**

`src/app/api/email/flows/[id]/steps/[stepId]/route.ts`:
- PUT: Update step. Validate with `updateStepSchema`. Flow must be in 'draft' or 'paused'. Return updated step.
- DELETE: Remove step. Renumber remaining steps. Flow must be in 'draft' or 'paused'. Return 204.

**Step 5: Write contacts list route**

`src/app/api/email/flows/[id]/contacts/route.ts`:
- GET: List contacts in flow with subscriber details (join email_flow_contacts + email_subscribers). Paginated. Return `{ contacts, total }`.

**Step 6: Write AI generate route**

`src/app/api/email/flows/[id]/generate/route.ts`:
- POST: Generate email steps for a flow using Claude (reuse `generateEmailSequence` from `src/lib/ai/email-sequence-generator.ts`, adapted to accept `stepCount` parameter and return flow steps instead of fixed 5-email array). Accepts optional `{ stepCount: number }` body (default 5). Upserts generated steps into email_flow_steps. Return generated steps.

**Step 7: Write tests for flow routes**

`src/__tests__/api/email/flows.test.ts`:
- Test CRUD operations for flows
- Test step management (add, update, delete, renumber)
- Test activation validation (requires at least 1 step)
- Test deletion only allowed for draft/paused

**Step 8: Run tests**

Run: `npx jest src/__tests__/api/email/flows.test.ts --no-coverage -v`
Expected: All tests pass.

**Step 9: Commit**

```bash
git add src/app/api/email/flows/ src/__tests__/api/email/flows.test.ts
git commit -m "feat: add email flow API routes (CRUD, steps, contacts, AI generate)"
```

---

## Task 6: Broadcast API Routes

**Files:**
- Create: `src/app/api/email/broadcasts/route.ts` (GET list, POST create)
- Create: `src/app/api/email/broadcasts/[id]/route.ts` (GET, PUT, DELETE)
- Create: `src/app/api/email/broadcasts/[id]/send/route.ts` (POST send)
- Create: `src/app/api/email/broadcasts/[id]/preview-count/route.ts` (GET count)

**Step 1: Write broadcast list + create route**

`src/app/api/email/broadcasts/route.ts`:
- GET: List broadcasts for team, ordered by created_at desc. Return `{ broadcasts }`.
- POST: Create draft broadcast. Validate with `createBroadcastSchema`. Status = 'draft'. Return created broadcast.

**Step 2: Write broadcast detail + update + delete route**

`src/app/api/email/broadcasts/[id]/route.ts`:
- GET: Fetch broadcast. Auth + team scope. Return broadcast.
- PUT: Update broadcast (subject, body, audience_filter). Validate with `updateBroadcastSchema`. Only allow if status = 'draft'. Return updated broadcast.
- DELETE: Only if status = 'draft'. Return 204.

**Step 3: Write preview count route**

`src/app/api/email/broadcasts/[id]/preview-count/route.ts`:
- GET: Call `get_filtered_subscriber_count` RPC with the broadcast's audience_filter. Return `{ count }`. This powers the live recipient count in the UI.

**Step 4: Write send route**

`src/app/api/email/broadcasts/[id]/send/route.ts`:
- POST: Validate broadcast has subject and body. Validate status = 'draft'. Trigger `send-broadcast` Trigger.dev task. Update status to 'sending'. Return `{ message: 'Broadcast queued for sending' }`.

**Step 5: Write tests**

`src/__tests__/api/email/broadcasts.test.ts`:
- Test CRUD operations
- Test send validation (requires subject + body)
- Test preview count returns number

**Step 6: Run tests and commit**

Run: `npx jest src/__tests__/api/email/broadcasts.test.ts --no-coverage -v`

```bash
git add src/app/api/email/broadcasts/ src/__tests__/api/email/broadcasts.test.ts
git commit -m "feat: add broadcast API routes (CRUD, send, preview count)"
```

---

## Task 7: Trigger.dev Task — Execute Email Flow

**Files:**
- Create: `src/trigger/email-flow.ts`

**Step 1: Write the execute-email-flow task**

```typescript
import { task, wait } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { sendEmail, personalizeEmail, emailBodyToHtml, generateUnsubscribeUrl, buildEmailFooterHtml } from "@/lib/integrations/resend";
import { getSenderInfo, getUserResendConfig } from "@/lib/services/email-sequence-trigger";

interface ExecuteEmailFlowPayload {
  team_id: string;
  flow_id: string;
  contact_id: string;
  subscriber_id: string;
  subscriber_email: string;
  subscriber_first_name: string | null;
  user_id: string; // flow owner, for sender resolution
}

export const executeEmailFlow = task({
  id: "execute-email-flow",
  retry: { maxAttempts: 2 },
  run: async (payload: ExecuteEmailFlowPayload) => {
    const supabase = createSupabaseAdminClient();

    // Fetch flow steps
    const { data: steps } = await supabase
      .from('email_flow_steps')
      .select('id, step_number, subject, body, delay_days')
      .eq('flow_id', payload.flow_id)
      .order('step_number', { ascending: true });

    if (!steps || steps.length === 0) return { status: 'no_steps' };

    // Resolve sender info once
    const [senderInfo, resendConfig] = await Promise.all([
      getSenderInfo(payload.user_id),
      getUserResendConfig(payload.user_id),
    ]);

    const fromName = resendConfig?.fromName || senderInfo.senderName;
    const fromEmail = resendConfig?.fromEmail || senderInfo.senderEmail;

    // Update contact to active
    await supabase
      .from('email_flow_contacts')
      .update({ status: 'active' })
      .eq('id', payload.contact_id);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Check if subscriber still active
      const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('status')
        .eq('id', payload.subscriber_id)
        .single();

      if (!subscriber || subscriber.status !== 'active') {
        await supabase
          .from('email_flow_contacts')
          .update({ status: 'unsubscribed' })
          .eq('id', payload.contact_id);
        return { status: 'unsubscribed', stoppedAt: step.step_number };
      }

      // Wait for delay (skip for first step if delay_days = 0)
      if (step.delay_days > 0) {
        await wait.for({ days: step.delay_days });
      }

      // Re-check subscriber after wait
      const { data: subAfterWait } = await supabase
        .from('email_subscribers')
        .select('status')
        .eq('id', payload.subscriber_id)
        .single();

      if (!subAfterWait || subAfterWait.status !== 'active') {
        await supabase
          .from('email_flow_contacts')
          .update({ status: 'unsubscribed' })
          .eq('id', payload.contact_id);
        return { status: 'unsubscribed', stoppedAt: step.step_number };
      }

      // Personalize and send
      const personalizedBody = personalizeEmail(step.body, {
        firstName: payload.subscriber_first_name || undefined,
        email: payload.subscriber_email,
      });
      const personalizedSubject = step.subject.replace(
        /\{\{first_name\}\}/g,
        payload.subscriber_first_name || 'there'
      );

      const footerHtml = buildEmailFooterHtml(payload.subscriber_id);
      const bodyHtml = emailBodyToHtml(personalizedBody) + footerHtml;

      const result = await sendEmail({
        to: payload.subscriber_email,
        subject: personalizedSubject,
        html: bodyHtml,
        fromName,
        fromEmail,
        resendConfig,
      });

      // Track in email_events
      if (result.success && result.id) {
        await supabase.from('email_events').insert({
          email_id: result.id,
          lead_magnet_id: null,
          user_id: payload.user_id,
          event_type: 'sent',
          recipient_email: payload.subscriber_email,
          subject: personalizedSubject,
          metadata: { flow_id: payload.flow_id, step_number: step.step_number },
        });
      }

      // Update contact progress
      await supabase
        .from('email_flow_contacts')
        .update({
          current_step: step.step_number,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', payload.contact_id);
    }

    // Mark completed
    await supabase
      .from('email_flow_contacts')
      .update({ status: 'completed' })
      .eq('id', payload.contact_id);

    return { status: 'completed', stepsSent: steps.length };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/email-flow.ts
git commit -m "feat: add execute-email-flow Trigger.dev task"
```

---

## Task 8: Trigger.dev Task — Send Broadcast

**Files:**
- Create: `src/trigger/send-broadcast.ts`

**Step 1: Write the send-broadcast task**

```typescript
import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { sendEmail, personalizeEmail, emailBodyToHtml, buildEmailFooterHtml } from "@/lib/integrations/resend";
import { getSenderInfo, getUserResendConfig } from "@/lib/services/email-sequence-trigger";

interface SendBroadcastPayload {
  broadcast_id: string;
  team_id: string;
  user_id: string;
}

export const sendBroadcast = task({
  id: "send-broadcast",
  retry: { maxAttempts: 1 },
  run: async (payload: SendBroadcastPayload) => {
    const supabase = createSupabaseAdminClient();

    // Fetch broadcast
    const { data: broadcast } = await supabase
      .from('email_broadcasts')
      .select('*')
      .eq('id', payload.broadcast_id)
      .single();

    if (!broadcast) return { status: 'not_found' };

    // Get filtered subscribers
    const { data: subscribers } = await supabase.rpc('get_filtered_subscribers', {
      p_team_id: payload.team_id,
      p_filter: broadcast.audience_filter,
    });

    if (!subscribers || subscribers.length === 0) {
      await supabase
        .from('email_broadcasts')
        .update({ status: 'sent', recipient_count: 0, sent_at: new Date().toISOString() })
        .eq('id', payload.broadcast_id);
      return { status: 'sent', count: 0 };
    }

    // Update recipient count
    await supabase
      .from('email_broadcasts')
      .update({ recipient_count: subscribers.length })
      .eq('id', payload.broadcast_id);

    // Resolve sender
    const [senderInfo, resendConfig] = await Promise.all([
      getSenderInfo(payload.user_id),
      getUserResendConfig(payload.user_id),
    ]);
    const fromName = resendConfig?.fromName || senderInfo.senderName;
    const fromEmail = resendConfig?.fromEmail || senderInfo.senderEmail;

    // Send in batches of 50
    const BATCH_SIZE = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (sub: { subscriber_id: string; email: string; first_name: string | null }) => {
          const personalizedBody = personalizeEmail(broadcast.body, {
            firstName: sub.first_name || undefined,
            email: sub.email,
          });
          const personalizedSubject = broadcast.subject.replace(
            /\{\{first_name\}\}/g,
            sub.first_name || 'there'
          );

          const footerHtml = buildEmailFooterHtml(sub.subscriber_id);
          const bodyHtml = emailBodyToHtml(personalizedBody) + footerHtml;

          return sendEmail({
            to: sub.email,
            subject: personalizedSubject,
            html: bodyHtml,
            fromName,
            fromEmail,
            resendConfig,
          });
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          sent++;
        } else {
          failed++;
        }
      }

      // Brief pause between batches to respect rate limits
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Update broadcast status
    await supabase
      .from('email_broadcasts')
      .update({
        status: failed === subscribers.length ? 'failed' : 'sent',
        recipient_count: sent,
        sent_at: new Date().toISOString(),
      })
      .eq('id', payload.broadcast_id);

    return { status: 'sent', sent, failed };
  },
});
```

**Step 2: Commit**

```bash
git add src/trigger/send-broadcast.ts
git commit -m "feat: add send-broadcast Trigger.dev task"
```

---

## Task 9: Wire Up Public Lead Endpoint

**Files:**
- Modify: `src/app/api/public/lead/route.ts`
- Modify: `src/lib/services/email-sequence-trigger.ts`

**Step 1: Add flow trigger function to email-sequence-trigger.ts**

Add a new exported function `triggerEmailFlowIfActive()` that:
1. Queries email_flows for an active flow with `trigger_type = 'lead_magnet'` and `trigger_lead_magnet_id` matching
2. If found: upserts email_subscriber (source = 'lead_magnet', dedup on team_id + email), creates email_flow_contact, triggers `executeEmailFlow` task
3. Returns `{ triggered: boolean }`

**Step 2: Modify public/lead route to check new flow first**

In the email trigger chain (around line 210), add the new flow check BEFORE the old sequence check:

```typescript
// 1. Try new email flow system first
const flowResult = await triggerEmailFlowIfActive({
  teamId: funnel.team_id,
  userId: funnel.user_id,
  email: lead.email,
  name: lead.name,
  leadMagnetId: funnel.lead_magnet_id,
});

if (flowResult.triggered) return;

// 2. Fall back to old email sequence system
const seqResult = await triggerEmailSequenceIfActive({ ... });
if (seqResult.triggered) return;

// 3. Fall back to resource email
// ... existing code
```

**Step 3: Add subscriber upsert on all lead captures**

Even when no flow is active, upsert the lead into email_subscribers for the team. This ensures the subscriber list grows with every opt-in regardless of whether a flow is set up.

**Step 4: Commit**

```bash
git add src/app/api/public/lead/route.ts src/lib/services/email-sequence-trigger.ts
git commit -m "feat: wire email flows into lead capture, auto-populate subscribers"
```

---

## Task 10: Subscribers UI Page

**Files:**
- Create: `src/app/(dashboard)/email/subscribers/page.tsx`
- Create: `src/components/email/SubscriberTable.tsx`
- Create: `src/components/email/AddSubscriberDialog.tsx`
- Create: `src/components/email/CsvImportDialog.tsx`

**Step 1: Write the subscribers page**

Server component that fetches initial subscriber data. Renders `SubscriberTable` client component.

**Step 2: Write SubscriberTable component**

Client component with:
- Table displaying email, first_name, last_name, status, source, subscribed_at
- Search input (debounced, filters by email/name)
- Status filter dropdown (all, active, unsubscribed, bounced)
- Pagination controls
- "Add Subscriber" button → opens AddSubscriberDialog
- "Import CSV" button → opens CsvImportDialog
- Row actions: delete (unsubscribe)

Use existing shadcn Table, Input, Button, Select, Dialog components.

**Step 3: Write AddSubscriberDialog component**

Dialog with form: email (required), first_name, last_name. Validates with Zod client-side. POST to `/api/email/subscribers`. Refreshes table on success.

**Step 4: Write CsvImportDialog component**

Multi-step dialog:
1. Upload step: file input accepting .csv. Parse client-side with `FileReader` + split by newlines.
2. Preview step: show table of parsed rows. Flag invalid emails in red. Show counts: "47 valid, 3 invalid".
3. Confirm step: POST to `/api/email/subscribers/import?confirm=true`. Show result: "45 imported, 2 already existed".

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/email/ src/components/email/
git commit -m "feat: add subscribers UI page with table, manual add, CSV import"
```

---

## Task 11: Flows UI Page

**Files:**
- Create: `src/app/(dashboard)/email/flows/page.tsx`
- Create: `src/app/(dashboard)/email/flows/[id]/page.tsx`
- Create: `src/components/email/FlowList.tsx`
- Create: `src/components/email/FlowEditor.tsx`
- Create: `src/components/email/FlowStepCard.tsx`

**Step 1: Write the flows list page**

Server component. Fetches flows from API. Renders `FlowList` client component.

**Step 2: Write FlowList component**

- Cards/rows for each flow showing: name, status badge (draft=gray, active=green, paused=yellow), trigger type, step count, created date
- "Create Flow" button → creates a new draft flow via POST, then navigates to editor
- Click flow → navigate to `/dashboard/email/flows/[id]`

**Step 3: Write the flow editor page**

Server component at `flows/[id]/page.tsx`. Fetches flow + steps. Renders `FlowEditor`.

**Step 4: Write FlowEditor component**

- Flow name (editable inline)
- Trigger type selector: "Lead Magnet" (shows lead magnet dropdown) or "Manual"
- Status toggle: Draft/Active/Paused (with validation — can't activate with 0 steps)
- "Generate with AI" button: opens dialog, user picks step count (default 5), calls generate endpoint, populates steps
- Step list: ordered `FlowStepCard` components
- "Add Step" button at bottom

**Step 5: Write FlowStepCard component**

- Collapsible card (similar to existing `EmailSequenceTab` pattern)
- Shows: "Step {n}" header, delay badge ("Day 0", "Day 1", etc.), subject preview
- Expanded: editable subject, body (textarea), delay_days (number input)
- Save/Cancel buttons
- Delete button (with confirmation)
- Drag handle for future reorder (not implemented in MVP, just visual)

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/email/flows/ src/components/email/Flow*.tsx
git commit -m "feat: add flows UI pages with editor, step cards, AI generation"
```

---

## Task 12: Broadcasts UI Page

**Files:**
- Create: `src/app/(dashboard)/email/broadcasts/page.tsx`
- Create: `src/app/(dashboard)/email/broadcasts/[id]/page.tsx`
- Create: `src/components/email/BroadcastList.tsx`
- Create: `src/components/email/BroadcastEditor.tsx`
- Create: `src/components/email/AudienceFilterBuilder.tsx`

**Step 1: Write the broadcasts list page**

Server component. Fetches broadcasts. Renders `BroadcastList`.

**Step 2: Write BroadcastList component**

- Cards/rows: subject, status badge, recipient_count, sent_at/created_at
- "Create Broadcast" button → POST draft, navigate to editor
- Click → navigate to editor

**Step 3: Write the broadcast editor page**

Server component at `broadcasts/[id]/page.tsx`. Fetches broadcast. Renders `BroadcastEditor`.

**Step 4: Write BroadcastEditor component**

- Subject input
- Body textarea (markdown supported, same rendering as flows)
- AudienceFilterBuilder component (see below)
- Live recipient count display (fetched from preview-count endpoint, debounced on filter change)
- "Send Broadcast" button with confirmation dialog ("Send to {count} subscribers?")
- Status badge (shows 'sending'/'sent' states, non-editable when sent)

**Step 5: Write AudienceFilterBuilder component**

- Engagement filter dropdown: "All subscribers", "Opened in last 30 days", "Opened in last 60 days", "Opened in last 90 days", "Clicked in last 30/60/90 days", "Never opened"
- Source filter dropdown: "All sources", "Lead Magnet" (any), specific lead magnets (fetched from user's magnets), "Manual", "Import"
- Subscribed date range (optional): after date picker, before date picker
- Each filter change triggers a debounced call to preview-count endpoint
- Displays: "Sending to {count} of {total} subscribers"

**Step 6: Commit**

```bash
git add src/app/\(dashboard\)/email/broadcasts/ src/components/email/Broadcast*.tsx src/components/email/AudienceFilterBuilder.tsx
git commit -m "feat: add broadcasts UI pages with editor and audience filtering"
```

---

## Task 13: Dashboard Navigation + Email Layout

**Files:**
- Modify: Dashboard sidebar/navigation component (find the existing nav component)
- Create: `src/app/(dashboard)/email/layout.tsx` (shared layout with sub-nav tabs)

**Step 1: Add email section to dashboard navigation**

Add "Email" entry to the dashboard sidebar with sub-items: Flows, Broadcasts, Subscribers. Use Mail icon from lucide-react.

**Step 2: Write email layout with tab navigation**

`src/app/(dashboard)/email/layout.tsx`:
- Horizontal tab bar with three tabs: Flows, Broadcasts, Subscribers
- Active tab highlighted based on current route
- Children rendered below tabs

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/email/layout.tsx [nav-file]
git commit -m "feat: add email section to dashboard navigation with tab layout"
```

---

## Task 14: Integration Test + Deploy

**Step 1: Run full test suite**

Run: `npm run test -- --no-coverage`
Expected: All tests pass.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No type errors.

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds.

**Step 4: Deploy Trigger.dev tasks**

Run: `TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy`
Expected: `execute-email-flow` and `send-broadcast` tasks deployed.

**Step 5: Push Supabase migration**

Run: Push migration to production Supabase.

**Step 6: Deploy to Vercel**

Run: `vercel --prod`

**Step 7: Commit any remaining changes**

```bash
git add -A
git commit -m "feat: complete email system - flows, broadcasts, subscribers"
```

---

## Task Dependency Order

```
Task 1 (migration) → Task 2 (types) → Tasks 3-6 (API routes, can be parallel)
                                        ↓
                                     Tasks 7-8 (Trigger.dev tasks)
                                        ↓
                                     Task 9 (wire up lead endpoint)
                                        ↓
                                     Tasks 10-12 (UI pages, can be parallel)
                                        ↓
                                     Task 13 (navigation)
                                        ↓
                                     Task 14 (test + deploy)
```

Tasks 3, 4, 5, 6 can be done in parallel after Task 2.
Tasks 10, 11, 12 can be done in parallel after Task 9.
