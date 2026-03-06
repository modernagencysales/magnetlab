<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Content Production System (Feb 2026)

Daily content operations for Modern Agency Sales: 1 LinkedIn post/day per team member (different voice/topics), 1 newsletter email/day, 1 lead magnet/week. Core unlock: edit-tracking + style learning baked into every content surface.

### Architecture

magnetlab is the single content command center. gtm-system remains the intake engine, pushing warm leads via webhook.

### Edit-Tracking + Style Learning (Phases 1-4)

Every content save captures before/after diffs, auto-classifies patterns via AI, and evolves the team's voice profile over time.

**Data Flow:**
```
CEO edits post → captureAndClassifyEdit() (fire-and-forget)
  → isSignificantEdit() (5% word-level threshold)
  → INSERT cp_edit_history
  → classifyEditPatterns() (Claude Haiku, async)
  → UPDATE auto_classified_changes
  → StyleFeedbackToast (optional quick-tag: "Too formal", "Wrong tone", etc.)

Weekly (Sunday 3:30 AM UTC):
  evolve-writing-style task → aggregateEditPatterns()
  → Claude evolves voice_profile JSONB on team_profiles
  → buildVoicePromptSection() injects into ALL AI writing
```

**Key Tables:**
- `cp_edit_history` — team_id, profile_id, content_type, content_id, field_name, original_text, edited_text, edit_diff, edit_tags, ceo_note, auto_classified_changes, processed

**Key Files:**
- `src/lib/services/edit-capture.ts` — `captureEdit()`, `captureAndClassifyEdit()`, `isSignificantEdit()`, `computeEditDiff()`
- `src/lib/ai/content-pipeline/edit-classifier.ts` — `classifyEditPatterns()` (Claude Haiku)
- `src/lib/services/style-evolution.ts` — `aggregateEditPatterns()` pure function
- `src/trigger/evolve-writing-style.ts` — `evolveWritingStyle` + `weeklyStyleEvolution` cron
- `src/lib/ai/content-pipeline/voice-prompt-builder.ts` — `buildVoicePromptSection(profile, contentType)` injected into post-writer, post-polish, briefing-agent, email-writer, promotion-post-writer
- `src/components/content-pipeline/StyleFeedbackToast.tsx` — quick-tag chips
- `src/app/api/content-pipeline/edit-feedback/route.ts` — POST (team-scoped, 500 char note limit)

**Edit capture hooked into:** post save (PATCH), email broadcast save (PUT), email sequence save (PUT), lead magnet content save (PUT)

### Email List Consolidation (Phase 5)

**Sources:** lead_magnet, manual, import, csv_import, resend_import, positive_reply, purchaser, meeting, heyreach, plusvibe, gtm_sync, organic

**Key Files:**
- `src/app/api/admin/import-subscribers/route.ts` — CSV import (5MB max, RFC-4180, batched upserts)
- `src/app/api/webhooks/subscriber-sync/route.ts` — inbound webhook from gtm-system (timing-safe secret, "keep richest record" merge)
- `supabase/migrations/20260223100000_subscriber_sources.sql` — expanded source constraint + metadata JSONB + company TEXT

**Env Vars:** `SUBSCRIBER_SYNC_WEBHOOK_SECRET` (Vercel + Trigger.dev)

### Daily Newsletter Email (Phase 6)

Distinct from LinkedIn posts: 300-500 words, subheadings, actionable takeaways, soft CTA. Uses today's approved LinkedIn post for topic consistency.

**Key Files:**
- `src/lib/ai/content-pipeline/email-writer.ts` — `writeNewsletterEmail()` (Claude Sonnet, voice-injected)
- `src/app/api/email/generate-daily/route.ts` — POST: generates draft broadcast from today's post + knowledge brief

### Lead Magnet Pipeline (Phase 7)

Weekly AI-generated topic suggestions. CEO approves → promotion posts auto-generated.

**Key Files:**
- `src/trigger/suggest-lead-magnet-topics.ts` — `suggest-lead-magnet-topics` (on-demand) + `weekly-lead-magnet-suggestions` (Monday 8 AM UTC cron)
- `src/lib/ai/content-pipeline/promotion-post-writer.ts` — `generatePromotionPosts()` (4 angles: problem_aware, curiosity, value_first, social_proof)
- `supabase/migrations/20260223200000_add_lead_magnet_content_type.sql` — adds 'lead_magnet' to content_type constraint

### gtm-system Subscriber Sync (Phase 8)

Fire-and-forget webhook from gtm-system to magnetlab on positive replies and meetings.

**gtm-system files modified:**
- `src/lib/subscriber-sync.ts` — `syncSubscriberToMagnetlab()` (5s timeout, env-var guard)
- Webhook handlers: plusvibe, heyreach, calcom — all call sync after positive events

**Env Vars (Railway):** `MAGNETLAB_URL`, `MAGNETLAB_SUBSCRIBER_SYNC_SECRET`, `MAGNETLAB_TEAM_ID`

### CEO Guide + Troubleshooting (Phase 9)

- `src/app/(dashboard)/help/page.tsx` + `src/components/help/ContentOpsGuide.tsx` — 4-tab guide (Daily, Weekly, Troubleshoot, Style)
- `docs/troubleshooting-content-production.md` — developer debug guide with SQL queries
