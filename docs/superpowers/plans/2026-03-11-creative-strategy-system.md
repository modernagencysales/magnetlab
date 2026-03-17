# Creative Strategy System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static swipe file with a signal-to-play pipeline that automates content strategy scouting, analysis, validation, and distribution.

**Architecture:** New `cs_*` domain built on magnetlab's layered architecture (Route → Service → Repository → DB). Extends the existing Signal Engine's Harvest API scraping and content pipeline's post generation. Shared tables (no `user_id` RLS) managed by super admins, with an opt-in data sharing gate for SaaS users.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL + pgvector), Trigger.dev v4, Claude Sonnet/Haiku (AI analysis), Harvest API (LinkedIn scraping), Zod validation, Jest tests.

**Spec:** `docs/superpowers/specs/2026-03-11-creative-strategy-system-design.md`

**Coding Standards:** Follow `coding-quality-standards.md` exactly — JSDoc headers, section dividers, named column constants, ALLOWED_UPDATE_FIELDS whitelists, logError(), DataScope pattern, literal union types (never enums), route handlers max 30 lines.

**Important: DataScope deviation.** The `cs_*` tables are shared resources (no `user_id`), unlike `cp_*` tables which are user-scoped. Services and repos in this domain do NOT take `DataScope` as a first parameter. This is intentional — signals and plays are managed by super admins and read by all opted-in users. Document this in each service's JSDoc header: `"Shared resource — no DataScope. Auth gated by isSuperAdmin() in route layer."`

**Important: Super admin auth.** All write routes (POST, PATCH, DELETE, PUT) and the signal queue GET must verify the user is a super admin using `isSuperAdmin()` from `@/lib/auth/super-admin`. Pattern:
```typescript
import { isSuperAdmin } from '@/lib/auth/super-admin';
// After auth check:
if (!(await isSuperAdmin(session.user.id))) return ApiErrors.unauthorized();
```
Read-only routes for public plays (GET plays with visibility='public') do NOT require super admin — they require `plays_data_sharing = true` on the user, enforced via RLS.

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/YYYYMMDD_creative_strategy.sql` | All cs_* tables, RLS policies, ALTER existing tables |
| `src/lib/types/creative-strategy.ts` | All types, literal unions, interfaces, const arrays |
| `src/lib/validations/creative-strategy.ts` | All Zod schemas + inferred types |
| `src/server/repositories/cs-signals.repo.ts` | Supabase queries for cs_signals + cs_scrape_config |
| `src/server/repositories/cs-plays.repo.ts` | Supabase queries for cs_plays, cs_play_signals, cs_play_results, cs_play_templates, cs_play_feedback, cs_play_assignments |
| `src/server/services/cs-signals.service.ts` | Signal ingestion, manual submission, review actions |
| `src/server/services/cs-plays.service.ts` | Play CRUD, validation mechanics, assignment, feedback |
| `src/app/api/creative-strategy/signals/route.ts` | GET (list), POST (manual submit) |
| `src/app/api/creative-strategy/signals/[id]/route.ts` | PATCH (review actions) |
| `src/app/api/creative-strategy/plays/route.ts` | GET (list), POST (create) |
| `src/app/api/creative-strategy/plays/[id]/route.ts` | GET, PATCH (update), DELETE |
| `src/app/api/creative-strategy/plays/[id]/results/route.ts` | GET (performance data) |
| `src/app/api/creative-strategy/plays/[id]/feedback/route.ts` | GET, POST |
| `src/app/api/creative-strategy/plays/[id]/assign/route.ts` | POST |
| `src/app/api/creative-strategy/templates/route.ts` | GET, POST |
| `src/app/api/creative-strategy/templates/[id]/route.ts` | PATCH, DELETE |
| `src/app/api/creative-strategy/config/route.ts` | GET, PUT |
| `src/lib/ai/creative-strategy/media-classifier.ts` | Claude Vision media classification |
| `src/lib/ai/creative-strategy/signal-analyzer.ts` | Hook detection, format fingerprint, exploit hypothesis |
| `src/trigger/analyze-signal.ts` | AI pre-analysis on new signals |
| `src/trigger/evaluate-play-results.ts` | Daily play validation + promotion suggestions |
| `src/trigger/scan-own-account-performance.ts` | Daily own-account outlier detection |
| `src/frontend/api/creative-strategy.ts` | Client API module |
| `src/__tests__/lib/validations/creative-strategy.test.ts` | Zod schema tests |
| `src/__tests__/api/creative-strategy/signals.test.ts` | Signal API route tests |
| `src/__tests__/api/creative-strategy/plays.test.ts` | Play API route tests |
| `src/__tests__/server/services/cs-signals.service.test.ts` | Signal service tests |
| `src/__tests__/server/services/cs-plays.service.test.ts` | Play service tests |

### Modified files

| File | Change |
|------|--------|
| `src/trigger/signal-keyword-scan.ts` | Add cs_signals write for high-engagement posts, fix select('*') |
| `src/trigger/signal-profile-scan.ts` | Add cs_signals write for content_strategy monitors, fix select('*') |
| `src/trigger/scrape-engagement.ts` | Add cs_play_results upsert for posts with play_id |

---

## Chunk 1: Foundation (Database + Types + Validation)

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260311000000_creative_strategy.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Creative Strategy System
-- Signal-to-play pipeline for content strategy automation.
-- Shared tables (no user_id) managed by super admins.

-- ─── cs_signals ──────────────────────────────────────────────────────────────

CREATE TABLE cs_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('own_account', 'scraped', 'manual')),
  source_account_id uuid,
  linkedin_url text UNIQUE,
  author_name text NOT NULL,
  author_headline text,
  author_follower_count int,
  content text NOT NULL,
  media_type text NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'carousel', 'video', 'document', 'poll')),
  media_description text,
  media_urls jsonb DEFAULT '[]'::jsonb,
  impressions int,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  shares int,
  engagement_multiplier float,
  niche text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'used', 'dismissed')),
  ai_analysis jsonb,
  submitted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_signals_status ON cs_signals(status);
CREATE INDEX idx_cs_signals_engagement ON cs_signals(engagement_multiplier DESC NULLS LAST);
CREATE INDEX idx_cs_signals_created ON cs_signals(created_at DESC);

-- ─── cs_plays ────────────────────────────────────────────────────────────────

CREATE TABLE cs_plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  thesis text NOT NULL,
  exploit_type text NOT NULL CHECK (exploit_type IN ('media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite')),
  format_instructions text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'proven', 'declining', 'archived')),
  visibility text NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal', 'public')),
  niches text[],
  last_used_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_plays_status ON cs_plays(status);
CREATE INDEX idx_cs_plays_visibility ON cs_plays(visibility);

-- ─── cs_play_signals (junction) ──────────────────────────────────────────────

CREATE TABLE cs_play_signals (
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES cs_signals(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (play_id, signal_id)
);

-- ─── cs_play_results ─────────────────────────────────────────────────────────

CREATE TABLE cs_play_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES cp_pipeline_posts(id) ON DELETE CASCADE,
  account_id uuid,
  is_anonymous boolean NOT NULL DEFAULT false,
  baseline_impressions int,
  actual_impressions int,
  multiplier float,
  likes int NOT NULL DEFAULT 0,
  comments int NOT NULL DEFAULT 0,
  niche text,
  tested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_play_results_play ON cs_play_results(play_id);

-- ─── cs_play_templates ───────────────────────────────────────────────────────

CREATE TABLE cs_play_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  name text NOT NULL,
  structure jsonb NOT NULL,
  media_instructions text NOT NULL,
  example_output text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_play_templates_play ON cs_play_templates(play_id);

-- ─── cs_play_feedback ────────────────────────────────────────────────────────

CREATE TABLE cs_play_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (play_id, user_id)
);

-- ─── cs_play_assignments ─────────────────────────────────────────────────────

CREATE TABLE cs_play_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES cs_plays(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_play_assignments_user ON cs_play_assignments(user_id, status);

-- ─── cs_scrape_config ────────────────────────────────────────────────────────

CREATE TABLE cs_scrape_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL CHECK (config_type IN ('own_account', 'watchlist', 'niche_discovery')),
  outlier_threshold_multiplier float NOT NULL DEFAULT 5.0,
  min_reactions int NOT NULL DEFAULT 500,
  min_comments int NOT NULL DEFAULT 50,
  target_niches text[] DEFAULT '{}',
  search_keywords text[] DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (config_type)
);

-- Insert default configs
INSERT INTO cs_scrape_config (config_type, outlier_threshold_multiplier, min_reactions, min_comments)
VALUES
  ('own_account', 5.0, 0, 0),
  ('watchlist', 0, 500, 50),
  ('niche_discovery', 0, 500, 50);

-- ─── ALTER existing tables ───────────────────────────────────────────────────

-- Add play_id to pipeline posts
ALTER TABLE cp_pipeline_posts ADD COLUMN play_id uuid REFERENCES cs_plays(id);

-- Add data sharing opt-in to users
ALTER TABLE users ADD COLUMN plays_data_sharing boolean NOT NULL DEFAULT false;

-- Expand signal_profile_monitors monitor_type
ALTER TABLE signal_profile_monitors
  DROP CONSTRAINT IF EXISTS signal_profile_monitors_monitor_type_check;
ALTER TABLE signal_profile_monitors
  ADD CONSTRAINT signal_profile_monitors_monitor_type_check
  CHECK (monitor_type IN ('competitor', 'influencer', 'content_strategy'));

-- ─── RLS policies ────────────────────────────────────────────────────────────

ALTER TABLE cs_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_play_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cs_scrape_config ENABLE ROW LEVEL SECURITY;

-- Super admin write access (all cs_ tables)
CREATE POLICY cs_signals_admin_all ON cs_signals
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_plays_admin_all ON cs_plays
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_signals_admin_all ON cs_play_signals
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_results_admin_all ON cs_play_results
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_templates_admin_all ON cs_play_templates
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_feedback_admin_all ON cs_play_feedback
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_play_assignments_admin_all ON cs_play_assignments
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

CREATE POLICY cs_scrape_config_admin_all ON cs_scrape_config
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE is_super_admin = true));

-- Public read: signals with reviewed/used status
CREATE POLICY cs_signals_public_read ON cs_signals
  FOR SELECT USING (status IN ('reviewed', 'used'));

-- Public read: proven/declining public plays for opted-in users
CREATE POLICY cs_plays_public_read ON cs_plays
  FOR SELECT USING (
    visibility = 'public'
    AND status IN ('proven', 'declining')
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: templates for visible plays
CREATE POLICY cs_play_templates_public_read ON cs_play_templates
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: play results (aggregated, no PII)
CREATE POLICY cs_play_results_public_read ON cs_play_results
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Public read: play signals for visible plays
CREATE POLICY cs_play_signals_public_read ON cs_play_signals
  FOR SELECT USING (
    play_id IN (
      SELECT id FROM cs_plays
      WHERE visibility = 'public' AND status IN ('proven', 'declining')
    )
    AND auth.uid() IN (SELECT id FROM users WHERE plays_data_sharing = true)
  );

-- Users can read their own assignments
CREATE POLICY cs_play_assignments_user_read ON cs_play_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert/update their own feedback
CREATE POLICY cs_play_feedback_user_write ON cs_play_feedback
  FOR ALL USING (user_id = auth.uid());
```

- [ ] **Step 2: Verify migration syntax**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm db:push`
Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260311000000_creative_strategy.sql
git commit -m "feat(cs): add creative strategy database migration

8 new tables, 3 ALTER existing tables, RLS policies for super admin
write + opted-in user read."
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types/creative-strategy.ts`

- [ ] **Step 1: Write type definitions**

```typescript
/**
 * Creative Strategy Types
 * Type definitions for the creative strategy system (cs_* tables).
 * Literal union types only — never TypeScript enums.
 */

// ─── Signal types ────────────────────────────────────────────────────────────

export type SignalSource = 'own_account' | 'scraped' | 'manual';

export type SignalMediaType = 'none' | 'image' | 'carousel' | 'video' | 'document' | 'poll';

export type SignalStatus = 'pending' | 'reviewed' | 'used' | 'dismissed';

export interface CsSignal {
  id: string;
  source: SignalSource;
  source_account_id: string | null;
  linkedin_url: string | null;
  author_name: string;
  author_headline: string | null;
  author_follower_count: number | null;
  content: string;
  media_type: SignalMediaType;
  media_description: string | null;
  media_urls: string[];
  impressions: number | null;
  likes: number;
  comments: number;
  shares: number | null;
  engagement_multiplier: number | null;
  niche: string | null;
  status: SignalStatus;
  ai_analysis: SignalAiAnalysis | null;
  submitted_by: string | null;
  created_at: string;
}

export interface SignalAiAnalysis {
  media_classification: string | null;
  hook_pattern: string | null;
  format_fingerprint: {
    length: 'short' | 'medium' | 'long';
    line_break_style: string;
    emoji_usage: 'none' | 'light' | 'heavy';
    cta_type: string | null;
  } | null;
  trending_topic: string | null;
  exploit_hypothesis: string | null;
  similar_play_ids: string[];
}

// ─── Play types ──────────────────────────────────────────────────────────────

export type ExploitType = 'media_format' | 'hook_pattern' | 'topic_trend' | 'engagement_hack' | 'cta_pattern' | 'composite';

export const EXPLOIT_TYPES: ExploitType[] = [
  'media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite',
];

export const EXPLOIT_TYPE_LABELS: Record<ExploitType, string> = {
  media_format: 'Media Format',
  hook_pattern: 'Hook Pattern',
  topic_trend: 'Topic Trend',
  engagement_hack: 'Engagement Hack',
  cta_pattern: 'CTA Pattern',
  composite: 'Composite',
};

export type PlayStatus = 'draft' | 'testing' | 'proven' | 'declining' | 'archived';

export type PlayVisibility = 'internal' | 'public';

export interface CsPlay {
  id: string;
  title: string;
  thesis: string;
  exploit_type: ExploitType;
  format_instructions: string;
  status: PlayStatus;
  visibility: PlayVisibility;
  niches: string[] | null;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlayWithStats extends CsPlay {
  signal_count: number;
  test_count: number;
  avg_multiplier: number | null;
  usage_count: number;
  feedback_up: number;
  feedback_down: number;
  promotion_suggestion: 'promote' | 'decline' | null;
}

// ─── Play results ────────────────────────────────────────────────────────────

export interface CsPlayResult {
  id: string;
  play_id: string;
  post_id: string;
  account_id: string | null;
  is_anonymous: boolean;
  baseline_impressions: number | null;
  actual_impressions: number | null;
  multiplier: number | null;
  likes: number;
  comments: number;
  niche: string | null;
  tested_at: string;
}

// ─── Play templates ──────────────────────────────────────────────────────────

export interface CsPlayTemplate {
  id: string;
  play_id: string;
  name: string;
  structure: PlayTemplateStructure;
  media_instructions: string;
  example_output: string;
  created_at: string;
}

export interface PlayTemplateStructure {
  hook_pattern: string;
  body_format: string;
  cta_style: string;
  line_count_range: [number, number];
}

// ─── Play feedback ───────────────────────────────────────────────────────────

export type FeedbackRating = 'up' | 'down';

export interface CsPlayFeedback {
  id: string;
  play_id: string;
  user_id: string;
  rating: FeedbackRating;
  note: string | null;
  created_at: string;
}

// ─── Play assignments ────────────────────────────────────────────────────────

export type AssignmentStatus = 'active' | 'completed';

export interface CsPlayAssignment {
  id: string;
  play_id: string;
  user_id: string;
  assigned_by: string;
  status: AssignmentStatus;
  assigned_at: string;
  updated_at: string;
}

// ─── Scrape config ───────────────────────────────────────────────────────────

export type ScrapeConfigType = 'own_account' | 'watchlist' | 'niche_discovery';

export interface CsScrapeConfig {
  id: string;
  config_type: ScrapeConfigType;
  outlier_threshold_multiplier: number;
  min_reactions: number;
  min_comments: number;
  target_niches: string[];
  search_keywords: string[];
  active: boolean;
}

// ─── Filter interfaces ──────────────────────────────────────────────────────

export interface SignalFilters {
  status?: SignalStatus;
  source?: SignalSource;
  niche?: string;
  min_multiplier?: number;
  limit?: number;
  offset?: number;
}

export interface PlayFilters {
  status?: PlayStatus;
  visibility?: PlayVisibility;
  exploit_type?: ExploitType;
  niche?: string;
  limit?: number;
  offset?: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors related to creative-strategy types.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/creative-strategy.ts
git commit -m "feat(cs): add creative strategy TypeScript types"
```

---

### Task 3: Zod Validation Schemas + Tests

**Files:**
- Create: `src/lib/validations/creative-strategy.ts`
- Create: `src/__tests__/lib/validations/creative-strategy.test.ts`

- [ ] **Step 1: Write the test file first (TDD)**

```typescript
/**
 * @jest-environment node
 */
import {
  submitSignalSchema,
  createPlaySchema,
  updatePlaySchema,
  playFeedbackSchema,
  scrapeConfigSchema,
  updateSignalSchema,
} from '@/lib/validations/creative-strategy';

describe('submitSignalSchema', () => {
  it('accepts valid signal with URL', () => {
    const result = submitSignalSchema.safeParse({
      linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
      content: 'Great post about sales',
      author_name: 'John Doe',
    });
    expect(result.success).toBe(true);
  });

  it('requires content', () => {
    const result = submitSignalSchema.safeParse({
      author_name: 'John',
    });
    expect(result.success).toBe(false);
  });

  it('requires author_name', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Some content',
    });
    expect(result.success).toBe(false);
  });

  it('validates linkedin_url format', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Content',
      author_name: 'John',
      linkedin_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = submitSignalSchema.safeParse({
      content: 'Content',
      author_name: 'John',
      media_urls: ['https://example.com/image.png'],
      niche: 'B2B SaaS',
      notes: 'Interesting format',
    });
    expect(result.success).toBe(true);
  });
});

describe('createPlaySchema', () => {
  const validPlay = {
    title: 'Tweet Screenshot Exploit',
    thesis: 'LinkedIn algorithm boosts posts with tweet screenshots',
    exploit_type: 'media_format' as const,
    format_instructions: 'Use a screenshot of a tweet related to the post topic',
    signal_ids: ['550e8400-e29b-41d4-a716-446655440000'],
  };

  it('accepts valid play', () => {
    const result = createPlaySchema.safeParse(validPlay);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, title: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid exploit_type', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, exploit_type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('requires at least one signal_id', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, signal_ids: [] });
    expect(result.success).toBe(false);
  });

  it('validates signal_ids are UUIDs', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, signal_ids: ['not-a-uuid'] });
    expect(result.success).toBe(false);
  });

  it('accepts optional niches', () => {
    const result = createPlaySchema.safeParse({ ...validPlay, niches: ['B2B SaaS', 'Agency'] });
    expect(result.success).toBe(true);
  });
});

describe('updatePlaySchema', () => {
  it('accepts partial update', () => {
    const result = updatePlaySchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updatePlaySchema.safeParse({ status: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid visibility', () => {
    const result = updatePlaySchema.safeParse({ visibility: 'secret' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid fields', () => {
    const result = updatePlaySchema.safeParse({
      title: 'Updated',
      thesis: 'New thesis',
      status: 'proven',
      visibility: 'public',
      format_instructions: 'New instructions',
      niches: ['Agency'],
    });
    expect(result.success).toBe(true);
  });
});

describe('playFeedbackSchema', () => {
  it('accepts up rating', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'up' });
    expect(result.success).toBe(true);
  });

  it('accepts down rating with note', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'down', note: 'Did not work for my niche' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'maybe' });
    expect(result.success).toBe(false);
  });

  it('rejects note over 500 chars', () => {
    const result = playFeedbackSchema.safeParse({ rating: 'up', note: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe('scrapeConfigSchema', () => {
  it('accepts valid config', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'watchlist',
      outlier_threshold_multiplier: 5.0,
      min_reactions: 500,
      min_comments: 50,
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects multiplier below 1', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'own_account',
      outlier_threshold_multiplier: 0.5,
      min_reactions: 0,
      min_comments: 0,
      active: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative reactions', () => {
    const result = scrapeConfigSchema.safeParse({
      config_type: 'watchlist',
      outlier_threshold_multiplier: 5,
      min_reactions: -1,
      min_comments: 0,
      active: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateSignalSchema', () => {
  it('accepts dismiss action', () => {
    const result = updateSignalSchema.safeParse({ status: 'dismissed' });
    expect(result.success).toBe(true);
  });

  it('accepts reviewed action', () => {
    const result = updateSignalSchema.safeParse({ status: 'reviewed' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = updateSignalSchema.safeParse({ status: 'approved' });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="creative-strategy.test" --no-coverage`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validation schemas**

```typescript
/**
 * Creative Strategy Validation Schemas
 * Zod schemas for creative strategy API request bodies.
 * Never imports from Next.js HTTP layer.
 */

import { z } from 'zod';

// ─── Signal schemas ──────────────────────────────────────────────────────────

export const submitSignalSchema = z.object({
  linkedin_url: z.string().url('Invalid URL format'),
  content: z.string({ required_error: 'Content is required' }).min(1, 'Content cannot be empty'),
  author_name: z.string({ required_error: 'Author name is required' }).min(1, 'Author name cannot be empty'),
  media_urls: z.array(z.string().url()).optional(),
  niche: z.string().optional(),
  notes: z.string().optional(),
});

export type SubmitSignalInput = z.infer<typeof submitSignalSchema>;

export const updateSignalSchema = z.object({
  status: z.enum(['reviewed', 'used', 'dismissed'], {
    errorMap: () => ({ message: 'Status must be reviewed, used, or dismissed' }),
  }),
});

export type UpdateSignalInput = z.infer<typeof updateSignalSchema>;

// ─── Play schemas ────────────────────────────────────────────────────────────

export const createPlaySchema = z.object({
  title: z.string({ required_error: 'Title is required' }).min(1, 'Title cannot be empty').max(200, 'Title must be under 200 characters'),
  thesis: z.string({ required_error: 'Thesis is required' }).min(1, 'Thesis cannot be empty'),
  exploit_type: z.enum(['media_format', 'hook_pattern', 'topic_trend', 'engagement_hack', 'cta_pattern', 'composite'], {
    errorMap: () => ({ message: 'Invalid exploit type' }),
  }),
  format_instructions: z.string({ required_error: 'Format instructions required' }).min(1, 'Format instructions cannot be empty'),
  signal_ids: z.array(z.string().uuid('Invalid signal ID format')).min(1, 'At least one signal is required'),
  niches: z.array(z.string()).optional(),
});

export type CreatePlayInput = z.infer<typeof createPlaySchema>;

export const updatePlaySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  thesis: z.string().min(1).optional(),
  status: z.enum(['draft', 'testing', 'proven', 'declining', 'archived']).optional(),
  visibility: z.enum(['internal', 'public']).optional(),
  format_instructions: z.string().min(1).optional(),
  niches: z.array(z.string()).optional(),
});

export type UpdatePlayInput = z.infer<typeof updatePlaySchema>;

// ─── Feedback schema ─────────────────────────────────────────────────────────

export const playFeedbackSchema = z.object({
  rating: z.enum(['up', 'down'], {
    errorMap: () => ({ message: 'Rating must be up or down' }),
  }),
  note: z.string().max(500, 'Note must be under 500 characters').optional(),
});

export type PlayFeedbackInput = z.infer<typeof playFeedbackSchema>;

// ─── Config schema ───────────────────────────────────────────────────────────

export const scrapeConfigSchema = z.object({
  config_type: z.enum(['own_account', 'watchlist', 'niche_discovery']),
  outlier_threshold_multiplier: z.number().min(1, 'Multiplier must be at least 1').max(100, 'Multiplier must be under 100'),
  min_reactions: z.number().int().min(0, 'Min reactions cannot be negative'),
  min_comments: z.number().int().min(0, 'Min comments cannot be negative'),
  target_niches: z.array(z.string()).optional(),
  search_keywords: z.array(z.string()).optional(),
  active: z.boolean(),
});

export type ScrapeConfigInput = z.infer<typeof scrapeConfigSchema>;

// ─── Template schema ─────────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  play_id: z.string().uuid('Invalid play ID'),
  name: z.string().min(1).max(200),
  structure: z.object({
    hook_pattern: z.string().min(1),
    body_format: z.string().min(1),
    cta_style: z.string().min(1),
    line_count_range: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  }),
  media_instructions: z.string().min(1),
  example_output: z.string().min(1),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.partial();
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="creative-strategy.test" --no-coverage`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/creative-strategy.ts src/__tests__/lib/validations/creative-strategy.test.ts
git commit -m "feat(cs): add creative strategy Zod schemas + tests"
```

---

## Chunk 2: Repository + Service Layer (Signals)

### Task 4: Signals Repository

**Files:**
- Create: `src/server/repositories/cs-signals.repo.ts`

- [ ] **Step 1: Write the repository**

```typescript
/**
 * Creative Strategy Signals Repository
 * ALL Supabase queries for cs_signals and cs_scrape_config.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { CsSignal, CsScrapeConfig, SignalFilters } from '@/lib/types/creative-strategy';

// ─── Column sets ────────────────────────────────────────────────────────────

const SIGNAL_COLUMNS =
  'id, source, source_account_id, linkedin_url, author_name, author_headline, author_follower_count, content, media_type, media_description, media_urls, impressions, likes, comments, shares, engagement_multiplier, niche, status, ai_analysis, submitted_by, created_at';

const CONFIG_COLUMNS =
  'id, config_type, outlier_threshold_multiplier, min_reactions, min_comments, target_niches, search_keywords, active';

// ─── Signal reads ───────────────────────────────────────────────────────────

export async function findSignals(
  filters: SignalFilters,
): Promise<{ data: CsSignal[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS, { count: 'exact' })
    .order('engagement_multiplier', { ascending: false, nullsFirst: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.source) query = query.eq('source', filters.source);
  if (filters.niche) query = query.eq('niche', filters.niche);
  if (filters.min_multiplier) query = query.gte('engagement_multiplier', filters.min_multiplier);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`cs-signals.findSignals: ${error.message}`);
  return { data: (data ?? []) as CsSignal[], count: count ?? 0 };
}

export async function findSignalById(id: string): Promise<CsSignal | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as CsSignal;
}

export async function findSignalByUrl(url: string): Promise<CsSignal | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .select(SIGNAL_COLUMNS)
    .eq('linkedin_url', url)
    .single();
  if (error) return null;
  return data as CsSignal;
}

// ─── Signal writes ──────────────────────────────────────────────────────────

export async function createSignal(
  insert: Omit<CsSignal, 'id' | 'created_at' | 'ai_analysis'>,
): Promise<CsSignal> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .insert(insert)
    .select(SIGNAL_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.createSignal: ${error.message}`);
  return data as CsSignal;
}

export async function updateSignalStatus(
  id: string,
  status: string,
): Promise<CsSignal> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_signals')
    .update({ status })
    .eq('id', id)
    .select(SIGNAL_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.updateSignalStatus: ${error.message}`);
  return data as CsSignal;
}

export async function updateSignalAnalysis(
  id: string,
  ai_analysis: Record<string, unknown>,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cs_signals')
    .update({ ai_analysis })
    .eq('id', id);
  if (error) throw new Error(`cs-signals.updateSignalAnalysis: ${error.message}`);
}

// ─── Config reads ───────────────────────────────────────────────────────────

export async function findScrapeConfigs(): Promise<CsScrapeConfig[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_scrape_config')
    .select(CONFIG_COLUMNS);
  if (error) throw new Error(`cs-signals.findScrapeConfigs: ${error.message}`);
  return (data ?? []) as CsScrapeConfig[];
}

export async function findScrapeConfigByType(
  configType: string,
): Promise<CsScrapeConfig | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_scrape_config')
    .select(CONFIG_COLUMNS)
    .eq('config_type', configType)
    .single();
  if (error) return null;
  return data as CsScrapeConfig;
}

// ─── Config writes ──────────────────────────────────────────────────────────

export async function upsertScrapeConfig(
  config: Omit<CsScrapeConfig, 'id'>,
): Promise<CsScrapeConfig> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_scrape_config')
    .upsert(config, { onConflict: 'config_type' })
    .select(CONFIG_COLUMNS)
    .single();
  if (error) throw new Error(`cs-signals.upsertScrapeConfig: ${error.message}`);
  return data as CsScrapeConfig;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/repositories/cs-signals.repo.ts
git commit -m "feat(cs): add signals repository layer"
```

---

### Task 5: Signals Service

**Files:**
- Create: `src/server/services/cs-signals.service.ts`

- [ ] **Step 1: Write the service**

```typescript
/**
 * Creative Strategy Signals Service
 * Business logic for signal ingestion, review, and scrape config.
 * Never imports from Next.js HTTP layer.
 */

import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import { tasks } from '@trigger.dev/sdk/v3';
import { logError } from '@/lib/utils/logger';
import type { CsSignal, CsScrapeConfig, SignalFilters, SignalStatus } from '@/lib/types/creative-strategy';
import type { SubmitSignalInput, ScrapeConfigInput } from '@/lib/validations/creative-strategy';

// ─── Validation constants ───────────────────────────────────────────────────

const VALID_REVIEW_STATUSES: SignalStatus[] = ['reviewed', 'used', 'dismissed'];

// ─── Signal reads ───────────────────────────────────────────────────────────

export async function listSignals(filters: SignalFilters) {
  const { data, count } = await signalsRepo.findSignals(filters);
  return {
    signals: data,
    total: count,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function getSignalById(id: string) {
  return signalsRepo.findSignalById(id);
}

// ─── Signal writes ──────────────────────────────────────────────────────────

export async function submitSignal(
  input: SubmitSignalInput,
  submittedBy: string,
): Promise<CsSignal> {
  // Check for duplicate URL
  if (input.linkedin_url) {
    const existing = await signalsRepo.findSignalByUrl(input.linkedin_url);
    if (existing) {
      throw Object.assign(new Error('Signal with this URL already exists'), { statusCode: 409 });
    }
  }

  const signal = await signalsRepo.createSignal({
    source: 'manual',
    source_account_id: null,
    linkedin_url: input.linkedin_url ?? null,
    author_name: input.author_name,
    author_headline: null,
    author_follower_count: null,
    content: input.content,
    media_type: 'none',
    media_description: null,
    media_urls: input.media_urls ?? [],
    impressions: null,
    likes: 0,
    comments: 0,
    shares: null,
    engagement_multiplier: null,
    niche: input.niche ?? null,
    status: 'pending',
    submitted_by: submittedBy,
  });

  // Fire analyze-signal task (non-blocking)
  try {
    await tasks.trigger('analyze-signal', { signalId: signal.id });
  } catch (error) {
    // Analysis trigger must never block signal creation
    logError('cs-signals.submitSignal', error, { signalId: signal.id, step: 'trigger_analysis' });
  }

  return signal;
}

export async function reviewSignal(
  id: string,
  status: SignalStatus,
): Promise<CsSignal> {
  if (!VALID_REVIEW_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid review status'), { statusCode: 400 });
  }

  const existing = await signalsRepo.findSignalById(id);
  if (!existing) {
    throw Object.assign(new Error('Signal not found'), { statusCode: 404 });
  }

  return signalsRepo.updateSignalStatus(id, status);
}

// ─── Config operations ──────────────────────────────────────────────────────

export async function listScrapeConfigs(): Promise<CsScrapeConfig[]> {
  return signalsRepo.findScrapeConfigs();
}

export async function updateScrapeConfig(
  input: ScrapeConfigInput,
): Promise<CsScrapeConfig> {
  return signalsRepo.upsertScrapeConfig(input);
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/cs-signals.service.ts
git commit -m "feat(cs): add signals service layer"
```

---

### Task 6: Signals API Routes + Tests

**Files:**
- Create: `src/app/api/creative-strategy/signals/route.ts`
- Create: `src/app/api/creative-strategy/signals/[id]/route.ts`
- Create: `src/__tests__/api/creative-strategy/signals.test.ts`

- [ ] **Step 1: Write the test file first**

```typescript
/**
 * @jest-environment node
 */

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-1' }),
}));

jest.mock('@/server/services/cs-signals.service');

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as signalsService from '@/server/services/cs-signals.service';
import { GET, POST } from '@/app/api/creative-strategy/signals/route';
import { PATCH } from '@/app/api/creative-strategy/signals/[id]/route';

const mockSignal = {
  id: 'sig-1',
  source: 'manual',
  content: 'Test post',
  author_name: 'John',
  status: 'pending',
  likes: 100,
  comments: 20,
  created_at: '2026-03-11T00:00:00Z',
};

function buildRequest(body?: object, method = 'GET') {
  return new Request('http://localhost/api/creative-strategy/signals', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('GET /api/creative-strategy/signals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it('returns 401 when user is not super admin', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (isSuperAdmin as jest.Mock).mockResolvedValue(false);
    const response = await GET(buildRequest());
    expect(response.status).toBe(401);
  });

  it('returns signals for authenticated super admin', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (isSuperAdmin as jest.Mock).mockResolvedValue(true);
    (signalsService.listSignals as jest.Mock).mockResolvedValue({
      signals: [mockSignal],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const response = await GET(buildRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.signals).toHaveLength(1);
  });
});

describe('POST /api/creative-strategy/signals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const response = await POST(buildRequest({ content: 'test', author_name: 'John' }, 'POST'));
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    const response = await POST(buildRequest({}, 'POST'));
    expect(response.status).toBe(400);
  });

  it('creates signal for valid input', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (signalsService.submitSignal as jest.Mock).mockResolvedValue(mockSignal);
    const response = await POST(buildRequest({
      content: 'Great post',
      author_name: 'John',
    }, 'POST'));
    expect(response.status).toBe(201);
  });
});

describe('PATCH /api/creative-strategy/signals/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/creative-strategy/signals/sig-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });
    expect(response.status).toBe(401);
  });

  it('updates signal status', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (signalsService.reviewSignal as jest.Mock).mockResolvedValue({ ...mockSignal, status: 'dismissed' });
    const request = new Request('http://localhost/api/creative-strategy/signals/sig-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });
    expect(response.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="signals.test" --no-coverage`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the signals list + submit route**

```typescript
/**
 * Creative Strategy Signals Route
 * GET: list signals (super admin only). POST: submit signal (super admin only).
 * Max 30 lines per handler.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as signalsService from '@/server/services/cs-signals.service';
import { submitSignalSchema } from '@/lib/validations/creative-strategy';
import type { SignalFilters } from '@/lib/types/creative-strategy';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();
    if (!(await isSuperAdmin(session.user.id))) return ApiErrors.unauthorized();

    const url = new URL(request.url);
    const filters: SignalFilters = {
      status: (url.searchParams.get('status') as SignalFilters['status']) ?? undefined,
      source: (url.searchParams.get('source') as SignalFilters['source']) ?? undefined,
      niche: url.searchParams.get('niche') ?? undefined,
      min_multiplier: url.searchParams.get('min_multiplier') ? Number(url.searchParams.get('min_multiplier')) : undefined,
      limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 50,
      offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : 0,
    };

    const result = await signalsService.listSignals(filters);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('creative-strategy/signals', error);
    return ApiErrors.internalError('Failed to list signals');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();
    if (!(await isSuperAdmin(session.user.id))) return ApiErrors.unauthorized();

    const body = await request.json();
    const parsed = submitSignalSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError('Validation failed', parsed.error.flatten());
    }

    const signal = await signalsService.submitSignal(parsed.data, session.user.id);
    return NextResponse.json({ signal }, { status: 201 });
  } catch (error) {
    const status = signalsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Failed to submit signal';
    logApiError('creative-strategy/signals', error);
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 4: Write the signal review route**

```typescript
/**
 * Creative Strategy Signal Review Route
 * PATCH: update signal status (dismiss, star, use). Super admin only.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as signalsService from '@/server/services/cs-signals.service';
import { updateSignalSchema } from '@/lib/validations/creative-strategy';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();
    if (!(await isSuperAdmin(session.user.id))) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSignalSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError('Validation failed', parsed.error.flatten());
    }

    const signal = await signalsService.reviewSignal(id, parsed.data.status);
    return NextResponse.json({ signal });
  } catch (error) {
    const status = signalsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Failed to update signal';
    logApiError('creative-strategy/signals/[id]', error);
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="signals.test" --no-coverage`
Expected: All tests pass.

- [ ] **Step 6: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/creative-strategy/signals/ src/__tests__/api/creative-strategy/signals.test.ts
git commit -m "feat(cs): add signal API routes + tests"
```

---

## Chunk 3: Repository + Service Layer (Plays)

### Task 7: Plays Repository

**Files:**
- Create: `src/server/repositories/cs-plays.repo.ts`

- [ ] **Step 1: Write the repository**

```typescript
/**
 * Creative Strategy Plays Repository
 * ALL Supabase queries for cs_plays, cs_play_signals, cs_play_results,
 * cs_play_templates, cs_play_feedback, cs_play_assignments.
 * Never imported by 'use client' files.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type {
  CsPlay, CsPlayResult, CsPlayTemplate, CsPlayFeedback,
  CsPlayAssignment, PlayFilters,
} from '@/lib/types/creative-strategy';

// ─── Column sets ────────────────────────────────────────────────────────────

const PLAY_COLUMNS =
  'id, title, thesis, exploit_type, format_instructions, status, visibility, niches, last_used_at, created_by, created_at, updated_at';

const RESULT_COLUMNS =
  'id, play_id, post_id, account_id, is_anonymous, baseline_impressions, actual_impressions, multiplier, likes, comments, niche, tested_at';

const TEMPLATE_COLUMNS =
  'id, play_id, name, structure, media_instructions, example_output, created_at';

const FEEDBACK_COLUMNS =
  'id, play_id, user_id, rating, note, created_at';

const ASSIGNMENT_COLUMNS =
  'id, play_id, user_id, assigned_by, status, assigned_at, updated_at';

// ─── Play reads ─────────────────────────────────────────────────────────────

export async function findPlays(
  filters: PlayFilters,
): Promise<{ data: CsPlay[]; count: number }> {
  const supabase = createSupabaseAdminClient();
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  let query = supabase
    .from('cs_plays')
    .select(PLAY_COLUMNS, { count: 'exact' })
    .order('updated_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.visibility) query = query.eq('visibility', filters.visibility);
  if (filters.exploit_type) query = query.eq('exploit_type', filters.exploit_type);
  if (filters.niche) query = query.contains('niches', [filters.niche]);

  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`cs-plays.findPlays: ${error.message}`);
  return { data: (data ?? []) as CsPlay[], count: count ?? 0 };
}

export async function findPlayById(id: string): Promise<CsPlay | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .select(PLAY_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as CsPlay;
}

// ─── Play writes ────────────────────────────────────────────────────────────

export async function createPlay(
  insert: Omit<CsPlay, 'id' | 'created_at' | 'updated_at' | 'last_used_at'>,
): Promise<CsPlay> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .insert(insert)
    .select(PLAY_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createPlay: ${error.message}`);
  return data as CsPlay;
}

const ALLOWED_PLAY_UPDATE_FIELDS: string[] = [
  'title', 'thesis', 'exploit_type', 'format_instructions',
  'status', 'visibility', 'niches', 'last_used_at',
];

export async function updatePlay(
  id: string,
  body: Record<string, unknown>,
): Promise<CsPlay> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_PLAY_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_plays')
    .update(updates)
    .eq('id', id)
    .select(PLAY_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.updatePlay: ${error.message}`);
  return data as CsPlay;
}

export async function deletePlay(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cs_plays')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`cs-plays.deletePlay: ${error.message}`);
}

// ─── Play signals (junction) ────────────────────────────────────────────────

export async function linkSignalsToPlay(
  playId: string,
  signalIds: string[],
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const rows = signalIds.map((signalId) => ({ play_id: playId, signal_id: signalId }));
  const { error } = await supabase.from('cs_play_signals').insert(rows);
  if (error) throw new Error(`cs-plays.linkSignalsToPlay: ${error.message}`);
}

export async function findSignalsByPlayId(playId: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_signals')
    .select('signal_id')
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.findSignalsByPlayId: ${error.message}`);
  return (data ?? []).map((r) => r.signal_id);
}

export async function countSignalsByPlayId(playId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('cs_play_signals')
    .select('play_id', { count: 'exact', head: true })
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countSignalsByPlayId: ${error.message}`);
  return count ?? 0;
}

// ─── Play results ───────────────────────────────────────────────────────────

export async function findResultsByPlayId(playId: string): Promise<CsPlayResult[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_results')
    .select(RESULT_COLUMNS)
    .eq('play_id', playId)
    .order('tested_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findResultsByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayResult[];
}

export async function createPlayResult(
  insert: Omit<CsPlayResult, 'id' | 'tested_at'>,
): Promise<CsPlayResult> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_results')
    .insert(insert)
    .select(RESULT_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createPlayResult: ${error.message}`);
  return data as CsPlayResult;
}

// ─── Play templates ─────────────────────────────────────────────────────────

export async function findTemplatesByPlayId(playId: string): Promise<CsPlayTemplate[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.findTemplatesByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayTemplate[];
}

export async function createTemplate(
  insert: Omit<CsPlayTemplate, 'id' | 'created_at'>,
): Promise<CsPlayTemplate> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .insert(insert)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createTemplate: ${error.message}`);
  return data as CsPlayTemplate;
}

const ALLOWED_TEMPLATE_UPDATE_FIELDS: string[] = [
  'name', 'structure', 'media_instructions', 'example_output',
];

export async function updateTemplate(
  id: string,
  body: Record<string, unknown>,
): Promise<CsPlayTemplate> {
  const updates: Record<string, unknown> = {};
  for (const field of ALLOWED_TEMPLATE_UPDATE_FIELDS) {
    if (field in body) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    throw new Error('cs-plays.updateTemplate: no valid fields to update');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_templates')
    .update(updates)
    .eq('id', id)
    .select(TEMPLATE_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.updateTemplate: ${error.message}`);
  return data as CsPlayTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('cs_play_templates').delete().eq('id', id);
  if (error) throw new Error(`cs-plays.deleteTemplate: ${error.message}`);
}

// ─── Play feedback ──────────────────────────────────────────────────────────

export async function findFeedbackByPlayId(playId: string): Promise<CsPlayFeedback[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .select(FEEDBACK_COLUMNS)
    .eq('play_id', playId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findFeedbackByPlayId: ${error.message}`);
  return (data ?? []) as CsPlayFeedback[];
}

export async function upsertFeedback(
  playId: string,
  userId: string,
  rating: string,
  note: string | null,
): Promise<CsPlayFeedback> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .upsert(
      { play_id: playId, user_id: userId, rating, note },
      { onConflict: 'play_id,user_id' },
    )
    .select(FEEDBACK_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.upsertFeedback: ${error.message}`);
  return data as CsPlayFeedback;
}

export async function countFeedbackByPlayId(
  playId: string,
): Promise<{ up: number; down: number }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_feedback')
    .select('rating')
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countFeedbackByPlayId: ${error.message}`);
  const ratings = data ?? [];
  return {
    up: ratings.filter((r) => r.rating === 'up').length,
    down: ratings.filter((r) => r.rating === 'down').length,
  };
}

// ─── Play assignments ───────────────────────────────────────────────────────

export async function findAssignmentsByUserId(userId: string): Promise<CsPlayAssignment[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_assignments')
    .select(ASSIGNMENT_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: false });
  if (error) throw new Error(`cs-plays.findAssignmentsByUserId: ${error.message}`);
  return (data ?? []) as CsPlayAssignment[];
}

export async function createAssignment(
  insert: Omit<CsPlayAssignment, 'id' | 'assigned_at' | 'updated_at'>,
): Promise<CsPlayAssignment> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cs_play_assignments')
    .insert(insert)
    .select(ASSIGNMENT_COLUMNS)
    .single();
  if (error) throw new Error(`cs-plays.createAssignment: ${error.message}`);
  return data as CsPlayAssignment;
}

// ─── Aggregation helpers ────────────────────────────────────────────────────

export async function countPostsByPlayId(playId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id', { count: 'exact', head: true })
    .eq('play_id', playId);
  if (error) throw new Error(`cs-plays.countPostsByPlayId: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/repositories/cs-plays.repo.ts
git commit -m "feat(cs): add plays repository layer"
```

---

### Task 8: Plays Service

**Files:**
- Create: `src/server/services/cs-plays.service.ts`

- [ ] **Step 1: Write the service**

```typescript
/**
 * Creative Strategy Plays Service
 * Business logic for plays, templates, feedback, assignments, and validation.
 * Never imports from Next.js HTTP layer.
 */

import * as playsRepo from '@/server/repositories/cs-plays.repo';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import { logError } from '@/lib/utils/logger';
import type {
  CsPlay, PlayWithStats, CsPlayResult, CsPlayTemplate,
  CsPlayFeedback, CsPlayAssignment, PlayFilters,
} from '@/lib/types/creative-strategy';
import type {
  CreatePlayInput, UpdatePlayInput, PlayFeedbackInput, CreateTemplateInput,
} from '@/lib/validations/creative-strategy';

// ─── Play reads ─────────────────────────────────────────────────────────────

export async function listPlays(filters: PlayFilters) {
  const { data, count } = await playsRepo.findPlays(filters);
  return {
    plays: data,
    total: count,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function getPlayById(id: string): Promise<PlayWithStats | null> {
  const play = await playsRepo.findPlayById(id);
  if (!play) return null;

  const [signalCount, results, usageCount, feedback] = await Promise.all([
    playsRepo.countSignalsByPlayId(id),
    playsRepo.findResultsByPlayId(id),
    playsRepo.countPostsByPlayId(id),
    playsRepo.countFeedbackByPlayId(id),
  ]);

  const multipliers = results.filter((r) => r.multiplier != null).map((r) => r.multiplier!);
  const avgMultiplier = multipliers.length > 0
    ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length
    : null;

  const promotionSuggestion = computePromotionSuggestion(play, results);

  return {
    ...play,
    signal_count: signalCount,
    test_count: results.length,
    avg_multiplier: avgMultiplier ? Math.round(avgMultiplier * 10) / 10 : null,
    usage_count: usageCount,
    feedback_up: feedback.up,
    feedback_down: feedback.down,
    promotion_suggestion: promotionSuggestion,
  };
}

// ─── Play writes ────────────────────────────────────────────────────────────

export async function createPlay(
  input: CreatePlayInput,
  createdBy: string,
): Promise<CsPlay> {
  // Verify all signal_ids exist
  for (const signalId of input.signal_ids) {
    const signal = await signalsRepo.findSignalById(signalId);
    if (!signal) {
      throw Object.assign(new Error(`Signal ${signalId} not found`), { statusCode: 404 });
    }
  }

  const play = await playsRepo.createPlay({
    title: input.title,
    thesis: input.thesis,
    exploit_type: input.exploit_type,
    format_instructions: input.format_instructions,
    status: 'draft',
    visibility: 'internal',
    niches: input.niches ?? null,
    created_by: createdBy,
  });

  // Link signals to play
  await playsRepo.linkSignalsToPlay(play.id, input.signal_ids);

  // Mark signals as used
  for (const signalId of input.signal_ids) {
    try {
      await signalsRepo.updateSignalStatus(signalId, 'used');
    } catch (error) {
      // Signal status update must never block play creation
      logError('cs-plays.createPlay', error, { signalId, step: 'mark_signal_used' });
    }
  }

  return play;
}

export async function updatePlay(
  id: string,
  input: UpdatePlayInput,
): Promise<CsPlay> {
  const existing = await playsRepo.findPlayById(id);
  if (!existing) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  return playsRepo.updatePlay(id, input);
}

export async function deletePlay(id: string): Promise<void> {
  const existing = await playsRepo.findPlayById(id);
  if (!existing) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  return playsRepo.deletePlay(id);
}

// ─── Play results ───────────────────────────────────────────────────────────

export async function getPlayResults(playId: string) {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  const results = await playsRepo.findResultsByPlayId(playId);
  const multipliers = results.filter((r) => r.multiplier != null).map((r) => r.multiplier!);

  const avg = multipliers.length > 0
    ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length
    : null;

  const stdDev = multipliers.length > 1
    ? Math.sqrt(multipliers.reduce((sum, m) => sum + (m - avg!) ** 2, 0) / multipliers.length)
    : null;

  // Per-niche breakdown
  const nicheMap = new Map<string, number[]>();
  for (const r of results) {
    if (r.niche && r.multiplier != null) {
      const arr = nicheMap.get(r.niche) ?? [];
      arr.push(r.multiplier);
      nicheMap.set(r.niche, arr);
    }
  }
  const nicheBreakdown = Object.fromEntries(
    [...nicheMap.entries()].map(([niche, mults]) => [
      niche,
      { count: mults.length, avg: Math.round((mults.reduce((a, b) => a + b, 0) / mults.length) * 10) / 10 },
    ]),
  );

  return {
    play_id: playId,
    total_tests: results.length,
    avg_multiplier: avg ? Math.round(avg * 10) / 10 : null,
    std_deviation: stdDev ? Math.round(stdDev * 10) / 10 : null,
    niche_breakdown: nicheBreakdown,
    results,
  };
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(playId: string): Promise<CsPlayTemplate[]> {
  return playsRepo.findTemplatesByPlayId(playId);
}

export async function createTemplate(input: CreateTemplateInput): Promise<CsPlayTemplate> {
  const play = await playsRepo.findPlayById(input.play_id);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  return playsRepo.createTemplate(input);
}

export async function deleteTemplate(id: string): Promise<void> {
  return playsRepo.deleteTemplate(id);
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export async function getPlayFeedback(playId: string) {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  const [feedback, counts] = await Promise.all([
    playsRepo.findFeedbackByPlayId(playId),
    playsRepo.countFeedbackByPlayId(playId),
  ]);
  return { feedback, counts };
}

export async function submitFeedback(
  playId: string,
  userId: string,
  input: PlayFeedbackInput,
): Promise<CsPlayFeedback> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  return playsRepo.upsertFeedback(playId, userId, input.rating, input.note ?? null);
}

// ─── Assignments ────────────────────────────────────────────────────────────

export async function assignPlay(
  playId: string,
  userId: string,
  assignedBy: string,
): Promise<CsPlayAssignment> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }
  return playsRepo.createAssignment({
    play_id: playId,
    user_id: userId,
    assigned_by: assignedBy,
    status: 'active',
  });
}

export async function getAssignmentsForUser(userId: string): Promise<CsPlayAssignment[]> {
  return playsRepo.findAssignmentsByUserId(userId);
}

// ─── Promotion suggestion logic ─────────────────────────────────────────────

function computePromotionSuggestion(
  play: CsPlay,
  results: CsPlayResult[],
): 'promote' | 'decline' | null {
  const multipliers = results.filter((r) => r.multiplier != null).map((r) => r.multiplier!);
  if (multipliers.length < 3) return null;

  const avg = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
  const stdDev = Math.sqrt(multipliers.reduce((sum, m) => sum + (m - avg) ** 2, 0) / multipliers.length);

  if (play.status === 'testing' && avg >= 5 && stdDev < avg * 0.5) {
    return 'promote';
  }

  if (play.status === 'proven') {
    const recent = multipliers.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (recentAvg < 2) return 'decline';
  }

  return null;
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/server/services/cs-plays.service.ts
git commit -m "feat(cs): add plays service layer with validation logic"
```

---

### Task 9: Plays API Routes + Tests

**Files:**
- Create: `src/app/api/creative-strategy/plays/route.ts`
- Create: `src/app/api/creative-strategy/plays/[id]/route.ts`
- Create: `src/app/api/creative-strategy/plays/[id]/results/route.ts`
- Create: `src/app/api/creative-strategy/plays/[id]/feedback/route.ts`
- Create: `src/app/api/creative-strategy/plays/[id]/assign/route.ts`
- Create: `src/app/api/creative-strategy/templates/route.ts`
- Create: `src/app/api/creative-strategy/templates/[id]/route.ts`
- Create: `src/app/api/creative-strategy/config/route.ts`
- Create: `src/__tests__/api/creative-strategy/plays.test.ts`

- [ ] **Step 1: Write the test file first**

Tests follow the same pattern as signals tests. Cover:
- Auth check (401) for each handler
- Validation check (400) for POST/PATCH
- Happy path (200/201) for each handler
- Not found (404) for operations on missing plays

Keep tests focused — mock `cs-plays.service` entirely, test route logic only.

- [ ] **Step 2: Run tests — verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="plays.test" --no-coverage`
Expected: FAIL.

- [ ] **Step 3: Write plays list + create route**

Follow same pattern as signals route. Route handler max 30 lines. **Every write handler must include `isSuperAdmin()` check after auth.** GET plays has two modes:

**Important: GET plays auth model.** The repo uses `createSupabaseAdminClient()` (bypasses RLS). For non-admin users, the service must explicitly filter to `visibility = 'public'` and `status IN ('proven', 'declining')`, and the route must verify `plays_data_sharing = true` on the user's record. For super admins, return all plays unfiltered. Pass `isAdmin: boolean` to the service so it applies the correct filters.

- GET: auth check → check `isSuperAdmin()` → if admin, `playsService.listPlays(filters)` unfiltered; if not admin, verify `plays_data_sharing = true` on user, then `playsService.listPlays({ ...filters, visibility: 'public', status: ['proven', 'declining'] })`
- POST: super admin check → parse body with `createPlaySchema` → `playsService.createPlay(parsed.data, session.user.id)`

- [ ] **Step 4: Write plays [id] route**

- GET: `playsService.getPlayById(id)` → return with stats
- PATCH: parse body with `updatePlaySchema` → `playsService.updatePlay(id, parsed.data)`
- DELETE: `playsService.deletePlay(id)`

- [ ] **Step 5: Write results, feedback, assign routes**

Each follows the thin route pattern. All under 30 lines per handler.

- [ ] **Step 6: Write templates + config routes**

- Templates: GET (list by play_id), POST (create), PATCH [id], DELETE [id]
- Config: GET (list all configs), PUT (upsert config)

- [ ] **Step 7: Run tests — verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="plays.test" --no-coverage`
Expected: All pass.

- [ ] **Step 8: Run typecheck + lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck && pnpm lint`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/creative-strategy/ src/__tests__/api/creative-strategy/plays.test.ts
git commit -m "feat(cs): add plays, templates, config, feedback, assign API routes + tests"
```

---

### Task 9b: Service Tests

**Files:**
- Create: `src/__tests__/server/services/cs-signals.service.test.ts`
- Create: `src/__tests__/server/services/cs-plays.service.test.ts`

- [ ] **Step 1: Write signal service tests**

Mock `cs-signals.repo` and `@trigger.dev/sdk/v3`. Test:
- `submitSignal` — happy path creates signal and triggers analysis
- `submitSignal` — duplicate URL returns 409
- `reviewSignal` — invalid status returns 400
- `reviewSignal` — missing signal returns 404
- `listSignals` — delegates to repo with correct filters

- [ ] **Step 2: Write play service tests**

Mock `cs-plays.repo` and `cs-signals.repo`. Test:
- `createPlay` — happy path creates play, links signals, marks signals as used
- `createPlay` — missing signal_id returns 404
- `updatePlay` — missing play returns 404
- `getPlayById` — returns play with computed stats (signal_count, avg_multiplier, etc.)
- `getPlayById` — promotion_suggestion is 'promote' when avg multiplier >= 5 with low variance (test via mock results with high multipliers)
- `getPlayById` — promotion_suggestion is 'decline' when recent avg multiplier < 2 (test via mock results with low multipliers)
- `getPlayById` — promotion_suggestion is null with < 3 results (test via mock results with 2 entries)
- `getPlayResults` — computes niche breakdown correctly

- [ ] **Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test -- --testPathPattern="cs-signals.service|cs-plays.service" --no-coverage`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/server/services/cs-signals.service.test.ts src/__tests__/server/services/cs-plays.service.test.ts
git commit -m "test(cs): add signal + play service tests"
```

---

### Task 9c: Plays Data Sharing Toggle Route

**Files:**
- Create: `src/app/api/creative-strategy/data-sharing/route.ts`

The spec defines an opt-in gate (`plays_data_sharing` on `users` table) but there is no route to toggle it. Add a simple PATCH route:

- [ ] **Step 1: Write the route**

```typescript
/**
 * Data Sharing Toggle Route
 * PATCH: toggle plays_data_sharing on the user's own record.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const dataSharingSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const parsed = dataSharingSchema.safeParse(body);
    if (!parsed.success) return ApiErrors.badRequest(parsed.error.message);
    const { enabled } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from('users')
      .update({ plays_data_sharing: enabled })
      .eq('id', session.user.id);
    if (error) throw error;

    return NextResponse.json({ plays_data_sharing: enabled });
  } catch (error) {
    logApiError('creative-strategy/data-sharing', error);
    return ApiErrors.internalError('Failed to update data sharing preference');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/creative-strategy/data-sharing/route.ts
git commit -m "feat(cs): add data sharing toggle route"
```

---

## Chunk 4: AI Analysis + Trigger.dev Tasks

### Task 10: AI Modules (Media Classifier + Signal Analyzer)

**Files:**
- Create: `src/lib/ai/creative-strategy/media-classifier.ts`
- Create: `src/lib/ai/creative-strategy/signal-analyzer.ts`

- [ ] **Step 1: Write media classifier**

Uses Claude Sonnet with vision to classify media type from URL. Returns structured classification (e.g., "tweet screenshot", "slack conversation", "infographic").

Pattern: follow `src/lib/ai/content-pipeline/hook-scorer.ts` — create Anthropic client, structured prompt, parse JSON response.

- [ ] **Step 2: Write signal analyzer**

Uses Claude Haiku for hook pattern detection + Claude Sonnet for exploit hypothesis. Takes signal content + media classification as input, returns `SignalAiAnalysis` object.

Includes:
- Hook pattern classification (contrarian, story, bold claim, question, number-led)
- Format fingerprint (length, line breaks, emoji, CTA)
- Trending topic detection
- Exploit hypothesis generation

- [ ] **Step 3: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/creative-strategy/
git commit -m "feat(cs): add AI media classifier + signal analyzer modules"
```

---

### Task 11: Trigger.dev Tasks

**Files:**
- Create: `src/trigger/analyze-signal.ts`
- Create: `src/trigger/evaluate-play-results.ts`
- Create: `src/trigger/scan-own-account-performance.ts`

- [ ] **Step 1: Write analyze-signal task**

Triggered by API routes and scraping tasks after signal insert. Calls media classifier + signal analyzer, stores results in `ai_analysis` jsonb via `signalsRepo.updateSignalAnalysis()`.

```typescript
import { task, logger } from '@trigger.dev/sdk/v3';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import { classifyMedia } from '@/lib/ai/creative-strategy/media-classifier';
import { analyzeSignal as runAnalysis } from '@/lib/ai/creative-strategy/signal-analyzer';

export const analyzeSignal = task({
  id: 'analyze-signal',
  maxDuration: 120,
  run: async ({ signalId }: { signalId: string }) => {
    const signal = await signalsRepo.findSignalById(signalId);
    if (!signal) {
      logger.warn('Signal not found', { signalId });
      return { status: 'skipped', reason: 'not_found' };
    }

    logger.info('Analyzing signal', { signalId, source: signal.source });

    // Step 1: Classify media (if present)
    let mediaClassification: string | null = null;
    if (signal.media_type !== 'none' && signal.media_urls.length > 0) {
      mediaClassification = await classifyMedia(signal.media_urls[0]);
    }

    // Step 2: Analyze content + media
    const analysis = await runAnalysis(signal.content, mediaClassification);

    // Step 3: Store results
    await signalsRepo.updateSignalAnalysis(signalId, {
      media_classification: mediaClassification,
      ...analysis,
    });

    logger.info('Signal analysis complete', { signalId });
    return { status: 'complete', signalId };
  },
});
```

- [ ] **Step 2: Write evaluate-play-results task**

Daily cron (3 AM UTC). For each play in `testing` or `proven` status, compute multiplier stats and check promotion/decline thresholds. Log suggestions (no auto-status-change — strategist confirms).

- [ ] **Step 3: Write scan-own-account-performance task**

Daily cron. For each connected LinkedIn account, pull recent published posts from `cp_pipeline_posts`, compare engagement to 30-day rolling average, create `cs_signals` for outliers exceeding the configured threshold.

- [ ] **Step 4: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add src/trigger/analyze-signal.ts src/trigger/evaluate-play-results.ts src/trigger/scan-own-account-performance.ts
git commit -m "feat(cs): add Trigger.dev tasks — analyze-signal, evaluate-play-results, scan-own-account"
```

---

### Task 12: Extend Existing Signal Engine Tasks

**Files:**
- Modify: `src/trigger/signal-keyword-scan.ts`
- Modify: `src/trigger/signal-profile-scan.ts`

- [ ] **Step 1: Read both existing task files**

Understand current structure before modifying.

- [ ] **Step 2: Fix select('*') in both files**

Replace `select('*')` with explicit column selects.

- [ ] **Step 3: Add cs_signals write to keyword scan**

After processing engagers, check if the source post exceeds scrape config thresholds (`min_reactions`, `min_comments`). If yes, insert into `cs_signals` with `source: 'scraped'`. Fire `analyze-signal` task.

- [ ] **Step 4: Add monitor_type filter to profile scan**

The existing profile scan fetches ALL active monitors. After adding `content_strategy` monitors, the scan must filter them out. Add this filter to the monitors query:

```typescript
// BEFORE (existing code):
const { data: monitors } = await supabase
  .from('signal_profile_monitors')
  .select('...')
  .eq('is_active', true);

// AFTER (add monitor_type filter):
const { data: monitors } = await supabase
  .from('signal_profile_monitors')
  .select('...')
  .eq('is_active', true)
  .in('monitor_type', ['competitor', 'influencer']);  // Exclude content_strategy
```

This is critical — without this filter, `content_strategy` monitors would be processed as engager sources (wrong behavior).

- [ ] **Step 5: Add content_strategy monitor scraping**

Add a new section in the profile scan task (or create a separate `scrape-content-strategy-watchlist` task) that:
1. Queries monitors with `monitor_type = 'content_strategy'`
2. For each monitor, calls `harvestApi.getProfilePosts(url)`
3. Checks each post against `cs_scrape_config` thresholds (`min_reactions`, `min_comments`)
4. Creates `cs_signals` for posts exceeding thresholds with `source: 'scraped'`
5. Fires `analyze-signal` task for each new signal

- [ ] **Step 6: Run typecheck + existing signal tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck && pnpm test -- --testPathPattern="signal" --no-coverage`

- [ ] **Step 7: Commit**

```bash
git add src/trigger/signal-keyword-scan.ts src/trigger/signal-profile-scan.ts
git commit -m "feat(cs): extend signal engine tasks to write to cs_signals + fix select('*')"
```

---

## Chunk 5: Frontend + Client API + Integration

### Task 13: Frontend Client API Module

**Files:**
- Create: `src/frontend/api/creative-strategy.ts`

- [ ] **Step 1: Write the client module**

```typescript
/**
 * Creative Strategy Client API
 * Frontend data layer for creative strategy system.
 * Never imports from src/server/.
 */

import { apiClient } from './client';
import type {
  CsSignal, CsPlay, PlayWithStats, CsPlayTemplate,
  CsPlayFeedback, CsScrapeConfig, SignalFilters, PlayFilters,
} from '@/lib/types/creative-strategy';

// ─── Signals ────────────────────────────────────────────────────────────────

export async function listSignals(filters: SignalFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.min_multiplier) params.set('min_multiplier', String(filters.min_multiplier));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return apiClient.get<{ signals: CsSignal[]; total: number }>(`/creative-strategy/signals?${params}`);
}

export async function submitSignal(input: {
  content: string;
  author_name: string;
  linkedin_url?: string;
  media_urls?: string[];
  niche?: string;
  notes?: string;
}) {
  return apiClient.post<{ signal: CsSignal }>('/creative-strategy/signals', input);
}

export async function reviewSignal(id: string, status: 'reviewed' | 'used' | 'dismissed') {
  return apiClient.patch<{ signal: CsSignal }>(`/creative-strategy/signals/${id}`, { status });
}

// ─── Plays ──────────────────────────────────────────────────────────────────

export async function listPlays(filters: PlayFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.visibility) params.set('visibility', filters.visibility);
  if (filters.exploit_type) params.set('exploit_type', filters.exploit_type);
  if (filters.niche) params.set('niche', filters.niche);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  return apiClient.get<{ plays: CsPlay[]; total: number }>(`/creative-strategy/plays?${params}`);
}

export async function getPlay(id: string) {
  return apiClient.get<PlayWithStats>(`/creative-strategy/plays/${id}`);
}

export async function createPlay(input: {
  title: string;
  thesis: string;
  exploit_type: string;
  format_instructions: string;
  signal_ids: string[];
  niches?: string[];
}) {
  return apiClient.post<{ play: CsPlay }>('/creative-strategy/plays', input);
}

export async function updatePlay(id: string, input: Record<string, unknown>) {
  return apiClient.patch<{ play: CsPlay }>(`/creative-strategy/plays/${id}`, input);
}

export async function deletePlay(id: string) {
  return apiClient.delete(`/creative-strategy/plays/${id}`);
}

// ─── Play results, feedback, assignments ────────────────────────────────────

export async function getPlayResults(playId: string) {
  return apiClient.get<{
    total_tests: number;
    avg_multiplier: number | null;
    std_deviation: number | null;
    niche_breakdown: Record<string, { count: number; avg: number }>;
  }>(`/creative-strategy/plays/${playId}/results`);
}

export async function submitFeedback(playId: string, rating: 'up' | 'down', note?: string) {
  return apiClient.post<{ feedback: CsPlayFeedback }>(`/creative-strategy/plays/${playId}/feedback`, { rating, note });
}

export async function assignPlay(playId: string, userId: string) {
  return apiClient.post(`/creative-strategy/plays/${playId}/assign`, { user_id: userId });
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function listTemplates(playId?: string) {
  const params = playId ? `?play_id=${playId}` : '';
  return apiClient.get<{ templates: CsPlayTemplate[] }>(`/creative-strategy/templates${params}`);
}

// ─── Config ─────────────────────────────────────────────────────────────────

export async function listScrapeConfigs() {
  return apiClient.get<{ configs: CsScrapeConfig[] }>('/creative-strategy/config');
}

export async function updateScrapeConfig(config: {
  config_type: string;
  outlier_threshold_multiplier: number;
  min_reactions: number;
  min_comments: number;
  target_niches?: string[];
  search_keywords?: string[];
  active: boolean;
}) {
  return apiClient.put<{ config: CsScrapeConfig }>('/creative-strategy/config', config);
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/frontend/api/creative-strategy.ts
git commit -m "feat(cs): add frontend client API module"
```

---

### Task 14: Extend Engagement Scraping for Play Results

**Files:**
- Modify: `src/trigger/scrape-engagement.ts`

- [ ] **Step 1: Read the existing scrape-engagement task**

- [ ] **Step 2: Add play results tracking**

After scraping engagement stats for a published post, check if it has a `play_id`. If so:
1. Calculate `multiplier` = actual impressions / account's 30-day average
2. Check if user has `plays_data_sharing = true` → set `is_anonymous: true`, strip `account_id`
3. Upsert into `cs_play_results`

- [ ] **Step 3: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`

- [ ] **Step 4: Commit**

```bash
git add src/trigger/scrape-engagement.ts
git commit -m "feat(cs): extend engagement scraper to populate play results"
```

---

### Task 15: Final Integration — Run All Tests + Typecheck

- [ ] **Step 1: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm test --no-coverage`
Expected: All tests pass (existing + new).

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && pnpm lint`
Expected: No errors.

- [ ] **Step 4: Update CLAUDE.md with feature documentation**

Add Creative Strategy System to the feature documentation table and database tables list in the magnetlab CLAUDE.md.

- [ ] **Step 5: Commit**

```bash
git add src/ CLAUDE.md
git commit -m "docs: add creative strategy system to CLAUDE.md"
```

---

## Out of Scope (Future Tasks)

These are documented in the spec but should be separate plans:

1. **UI Pages** — Signal Workbench, Play Board (kanban), "What's Working Now" page. These are significant frontend work and should be planned separately after the backend is solid.
2. **Content Pipeline Integration** — Extending `run-autopilot` and post writer to use plays. Depends on backend being complete + tested.
3. **MCP Tools** — 8 new tools for `packages/mcp/`. Should be done after API routes are finalized.
4. **LinkedIn OAuth Migration** — Parallel workstream, not part of this system.
