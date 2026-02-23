# Content Production System Design

**Date**: 2026-02-23
**Status**: Approved
**Scope**: magnetlab (primary), gtm-system (intake sync)

## Overview

Enable daily content production at scale: 1 LinkedIn post/day per team profile (2+ profiles), 1 newsletter email/day to consolidated subscriber list, 1 lead magnet/week. All content flows through magnetlab with an AI style-learning system that improves from every CEO edit.

## Architecture Decision

**magnetlab = single content command center.** CEO and team members use magnetlab for all content creation, editing, approval, and publishing. gtm-system remains the intake engine (cold email, webhooks, reply pipeline) and pushes warm leads to magnetlab's subscriber list.

```
CSV files ───────────────────────┐
Resend audience (one-time pull)  ┤
magnetlab funnel leads ──────────┤──→ magnetlab email_subscribers
PlusVibe positive replies ───────┤    (team_id scoped, deduped by email)
HeyReach positive replies ───────┤
Low-ticket purchasers (Stripe) ──┘
                                      ↓
                               Daily newsletter sends (Resend)

gtm-system (ongoing) ──webhook──→ magnetlab /api/webhooks/subscriber-sync
  (positive reply, meeting booked, purchase)
```

## Part 1: Edit-Tracking & Style-Learning System

The core innovation. Every content surface captures edits and feeds an evolving style profile.

### New Table: `cp_edit_history`

```sql
CREATE TABLE cp_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'email', 'lead_magnet', 'sequence')),
  content_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_diff JSONB DEFAULT '{}',
  edit_tags TEXT[] DEFAULT '{}',
  ceo_note TEXT,
  auto_classified_changes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Indexes: `team_id`, `profile_id`, `content_type`, `created_at`.

### Edit Capture Flow

1. User saves content (post, email, lead magnet, sequence step)
2. If text changed meaningfully (not just whitespace/typo — use Levenshtein threshold):
   a. Compute structured diff (word-level)
   b. Fire async AI classification: "shortened hook", "removed jargon", "added personal story", "changed CTA from soft to hard"
   c. Store in `cp_edit_history`
3. After save, show non-blocking toast: "Style note (optional)" + quick-tag chips
   - Chips: "Too formal", "Too long", "Wrong tone", "Missing story", "Too salesy", "Good as-is"
   - CEO can ignore — edit-diff capture works regardless

### Enhanced Voice Profile

Expand `team_profiles.voice_profile` JSONB:

```json
{
  "tone": "conversational but authoritative",
  "vocabulary_preferences": {
    "avoid": ["leverage", "synergy", "utilize"],
    "prefer": ["build", "grow", "ship"]
  },
  "structure_patterns": {
    "linkedin": ["short paragraphs", "one-line hooks", "end with question CTA"],
    "email": ["longer form", "subheadings", "actionable takeaways", "personal opener"]
  },
  "cta_style": "soft ask, never pushy",
  "storytelling_preference": "personal anecdotes > case studies",
  "content_length": {
    "linkedin": "800-1200 chars",
    "email": "300-500 words"
  },
  "topics_to_emphasize": [],
  "topics_to_avoid": [],
  "edit_patterns": [
    {
      "pattern": "CEO consistently removes bullet points in favor of narrative",
      "confidence": 0.85,
      "count": 12,
      "first_seen": "2026-02-23",
      "last_seen": "2026-02-23"
    }
  ],
  "positive_examples": [
    { "content_id": "...", "type": "post", "note": "CEO marked 'Good as-is'" }
  ],
  "last_evolved": "2026-02-23T00:00:00Z",
  "evolution_version": 1
}
```

### Style Evolution Task (Trigger.dev)

`evolve-writing-style`: Runs weekly (Sunday) or after 10+ unprocessed edits.

1. Pull all unprocessed edits from `cp_edit_history` for the profile
2. Group by pattern (recurring changes)
3. Feed accumulated patterns + current voice_profile to Claude
4. Claude produces updated voice_profile:
   - New/strengthened patterns
   - Adjusted preferences
   - Confidence scores updated
5. Store new version (keep `evolution_version` for rollback)
6. Mark processed edits

### Prompt Injection

All AI writing modules include voice_profile context:

```
## Writing Style (learned from author edits)
Tone: {tone}
Vocabulary: AVOID: {avoid list}. PREFER: {prefer list}.
Structure ({content_type}): {structure_patterns[content_type]}
CTA style: {cta_style}
Length target: {content_length[content_type]}

## Learned patterns (from recent edits):
{edit_patterns, sorted by confidence desc, top 5}

## Recent approved examples:
{positive_examples, last 3}
```

Injected into: `post-writer`, `post-polish`, `briefing-agent`, email draft generator, lead magnet content generator.

## Part 2: Email List Consolidation

### One-Time Import

Build `/api/admin/import-subscribers` that handles:

1. **CSV upload**: Accept any CSV, map columns (email required, first_name/last_name/company optional). Tag source: `csv_import`.
2. **Resend audience pull**: Call Resend API `GET /audiences/{id}/contacts`, import all. Tag source: `resend_import`.
3. **Positive replies**: Query gtm-system's `reply_pipeline` WHERE status IN ('completed', 'processing') AND email IS NOT NULL. Tag source: `positive_reply`.
4. **Low-ticket purchasers**: Query Stripe API for customers with successful charges on relevant products. Tag source: `purchaser`.
5. **Deduplication**: By email (case-insensitive). Merge metadata on conflict (keep richest record).

### Ongoing Sync

New webhook endpoint: `POST /api/webhooks/subscriber-sync`
- Auth: shared secret (`X-Webhook-Secret` header)
- Payload: `{ email, first_name, last_name, company, source, metadata }`
- Fired by gtm-system when: positive reply received, meeting booked, purchase completed
- Auto-adds to team's `email_subscribers` (dedup by email)

### Subscriber Sources & Tags

Each subscriber has `metadata.source` for filtering:
- `organic` — opted in via magnetlab funnel
- `csv_import` — bulk imported
- `resend_import` — pulled from gtm-system Resend audience
- `positive_reply` — responded to cold outreach
- `purchaser` — bought a low-ticket product
- `meeting` — booked a call
- `heyreach` / `plusvibe` — specific outreach channel

## Part 3: Daily Content Workflow

### LinkedIn Posts (per profile)

1. Autopilot (2 AM UTC) generates drafts using profile's evolved voice_profile
2. Buffer target: 5 posts per profile
3. CEO reviews in Posts dashboard (profile switcher)
4. CEO edits → edits captured → approves → scheduled
5. Auto-publish at posting slot via Unipile
6. Engagement scraped (10-min cron)

**Already built**: All of it except edit capture integration.

### Daily Newsletter Email

Emails are distinct from LinkedIn — longer, more detailed, more utility. The AI treats email as a separate format with its own structure_patterns in the voice_profile.

1. AI generates a daily email draft based on:
   - Today's approved LinkedIn post topic (for thematic consistency, not copy-paste)
   - Knowledge base entries with depth
   - Profile's email-specific voice patterns
2. CEO reviews in Email dashboard
3. CEO edits (captured for style learning)
4. Sends to subscriber list via Resend

**New feature needed**: `generate-daily-email` — AI module that creates newsletter-style content. Pulls from same knowledge base but writes in email register (longer, subheadings, actionable takeaways).

### Weekly Lead Magnet

1. System suggests 3 topics (based on: knowledge gaps, engagement data, subscriber interests)
2. CEO picks one
3. 6-step wizard generates content using evolved voice_profile
4. CEO reviews/edits content blocks (edits captured)
5. Funnel page auto-built with brand kit
6. Published → promotional posts auto-generated for the week

**New feature needed**: `suggest-lead-magnet-topics` — weekly Trigger.dev task that analyzes knowledge base + engagement + subscriber data to recommend high-potential topics.

**New feature needed**: `generate-promotion-posts` — given a published lead magnet, generate 3-5 LinkedIn posts promoting it throughout the week.

## Part 4: Guides

### CEO Content Operations Guide

Lives in-app (help section) and as a standalone document.

**Daily (15-30 min):**
1. Open magnetlab → Posts → switch to your profile
2. Review AI drafts in buffer (3-5 waiting)
3. Edit what needs editing (your edits train the AI — be honest, change what you don't like)
4. Optionally tag: "too formal", "needs story", etc.
5. Approve 1 post → publishes at your scheduled time
6. Switch to Email → review today's AI email draft
7. Edit for depth/utility (emails should be meatier than LinkedIn)
8. Send to subscriber list

**Weekly (30-60 min):**
1. Review 3 suggested lead magnet topics
2. Pick one → AI generates content
3. Review/edit content blocks
4. Approve → funnel page goes live
5. Promotional posts auto-added to your buffer for the week

**When things go wrong:**
- Buffer empty → Schedule tab → "Run Autopilot" button
- Post didn't publish → Settings → Integrations → check Unipile connection
- Email didn't send → check subscriber count, check Resend connection
- AI tone still off after edits → leave detailed style notes, it improves within 1-2 weeks
- Need help → use the feedback button (bottom-right corner)

### Developer Troubleshooting Guide

Technical runbook for debugging the content production pipeline.

| Symptom | Check | Fix |
|---------|-------|-----|
| Posts not auto-publishing | Trigger.dev → `auto-publish-check` | Check Unipile creds, verify `scheduled_time` in `cp_pipeline_posts` |
| Autopilot not generating | Trigger.dev → `nightly-autopilot-batch` | Check `ANTHROPIC_API_KEY`, verify knowledge entries exist |
| Email broadcast fails | `email_events` table, Resend dashboard | Check `RESEND_API_KEY`, verify subscriber count > 0 |
| Subscriber import stuck | Import task logs | Verify CSV format, check email validation errors |
| Style evolution stale | `team_profiles.voice_profile->>'last_evolved'` | Check `cp_edit_history` has entries, manually trigger `evolve-writing-style` |
| LinkedIn connection dropped | Unipile dashboard | Re-auth via Settings → Integrations → Unipile |
| Lead magnet gen fails | Trigger.dev → `create-lead-magnet` | Check `ANTHROPIC_API_KEY`, verify content brief |
| Funnel page 404 | `funnel_pages.status` | Must be 'published', check slug + custom domain DNS |
| Edit tracking not capturing | `cp_edit_history` table | Verify save hooks are firing, check Levenshtein threshold |
| Subscriber sync from gtm-system failing | gtm-system webhook logs | Check webhook secret, verify magnetlab endpoint is up |

**Key dashboards:**
- Trigger.dev: `https://cloud.trigger.dev` → magnetlab project
- Resend: `https://resend.com/emails`
- Supabase: `https://supabase.com/dashboard` → table inspector
- Vercel: `https://vercel.com` → deployment logs

**Debug queries:**
```sql
-- Edit history for a profile
SELECT content_type, field_name, edit_tags, ceo_note, created_at
FROM cp_edit_history WHERE profile_id = '...' ORDER BY created_at DESC LIMIT 20;

-- Subscriber count by source
SELECT metadata->>'source' as source, count(*)
FROM email_subscribers WHERE team_id = '...' GROUP BY 1;

-- Post buffer status per profile
SELECT team_profile_id, status, count(*)
FROM cp_pipeline_posts WHERE user_id = '...' GROUP BY 1, 2;

-- Style evolution version
SELECT full_name, voice_profile->>'evolution_version' as v,
       voice_profile->>'last_evolved' as evolved
FROM team_profiles WHERE team_id = '...';

-- Unprocessed edits (pending style evolution)
SELECT count(*) FROM cp_edit_history
WHERE profile_id = '...' AND created_at > (
  SELECT (voice_profile->>'last_evolved')::timestamptz
  FROM team_profiles WHERE id = '...'
);
```

## Implementation Priority

1. **Edit-tracking system** (new table, save hooks, AI classification, feedback UI) — the unlock
2. **Style evolution task** (Trigger.dev, weekly + on-demand)
3. **Prompt injection** into all AI writing modules
4. **Email list consolidation** (one-time import + ongoing webhook sync)
5. **Daily email generator** (newsletter-style AI module, distinct from LinkedIn)
6. **Weekly lead magnet suggestions** + promotion post generator
7. **CEO guide** (in-app help + standalone doc)
8. **Developer troubleshooting guide** (standalone doc)
