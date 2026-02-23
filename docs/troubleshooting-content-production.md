# Content Production System -- Troubleshooting Guide

Developer reference for diagnosing and fixing issues in the content production pipeline.

## Symptom → Check → Fix

| Symptom | Check | Fix |
|---------|-------|-----|
| Posts not auto-publishing | Trigger.dev → `auto-publish-check` | Check Unipile creds, verify `scheduled_time` in `cp_pipeline_posts` |
| Autopilot not generating | Trigger.dev → `nightly-autopilot-batch` | Check `ANTHROPIC_API_KEY`, verify knowledge entries exist |
| Email broadcast fails | `email_events` table, Resend dashboard | Check `RESEND_API_KEY`, verify subscriber count > 0 |
| Subscriber import stuck | Import task logs | Verify CSV format, check email validation errors |
| Style evolution stale | `team_profiles.voice_profile->>'last_evolved'` | Check `cp_edit_history` has entries, manually trigger `evolve-writing-style` |
| LinkedIn connection dropped | Unipile dashboard | Re-auth via Settings → Integrations → Unipile |
| Lead magnet gen fails | Trigger.dev → `create-lead-magnet` | Check `ANTHROPIC_API_KEY`, verify content brief |
| Funnel page 404 | `funnel_pages.status` | Must be `published`, check slug + custom domain DNS |
| Edit tracking not capturing | `cp_edit_history` table | Verify save hooks are firing, check Levenshtein threshold |
| Subscriber sync from gtm-system failing | gtm-system webhook logs | Check webhook secret, verify magnetlab endpoint is up |

## Key Dashboards

| Dashboard | URL | What to check |
|-----------|-----|---------------|
| Trigger.dev | https://cloud.trigger.dev → magnetlab project | Task runs, failures, queued jobs |
| Resend | https://resend.com/emails | Email delivery status, bounce rates |
| Supabase | https://supabase.com/dashboard → table inspector | Table data, RLS policies, function logs |
| Vercel | https://vercel.com → magnetlab deployment | Build logs, function logs, env vars |

## Debug Queries

### Edit history for a profile

```sql
SELECT content_type, field_name, edit_tags, ceo_note, created_at
FROM cp_edit_history
WHERE profile_id = '...'
ORDER BY created_at DESC
LIMIT 20;
```

### Subscriber count by source

```sql
SELECT source, count(*)
FROM email_subscribers
WHERE team_id = '...'
GROUP BY 1;
```

### Post buffer status per profile

```sql
SELECT team_profile_id, status, count(*)
FROM cp_pipeline_posts
WHERE user_id = '...'
GROUP BY 1, 2;
```

### Style evolution version

```sql
SELECT full_name,
       voice_profile->>'evolution_version' AS v,
       voice_profile->>'last_evolved' AS evolved
FROM team_profiles
WHERE team_id = '...';
```

### Unprocessed edits (pending style evolution)

```sql
SELECT count(*)
FROM cp_edit_history
WHERE profile_id = '...'
  AND created_at > (
    SELECT (voice_profile->>'last_evolved')::timestamptz
    FROM team_profiles
    WHERE id = '...'
  );
```

### Recent email broadcast results

```sql
SELECT broadcast_id, status, sent_count, open_count, click_count, created_at
FROM email_broadcasts
WHERE team_id = '...'
ORDER BY created_at DESC
LIMIT 10;
```

### Lead magnet generation status

```sql
SELECT id, title, status, processing_step, error_log, created_at
FROM lead_magnets
WHERE user_id = '...'
ORDER BY created_at DESC
LIMIT 10;
```

## Common Failure Modes

### 1. Autopilot generates zero posts

**Root cause:** No knowledge entries in `cp_knowledge_entries` for the user, or all entries have low quality scores.

**Verify:**
```sql
SELECT count(*), avg(quality_score)
FROM cp_knowledge_entries
WHERE user_id = '...';
```

**Fix:** Upload a transcript or paste knowledge entries. The autopilot needs source material.

### 2. Style evolution produces no changes

**Root cause:** Fewer than 5 edits in `cp_edit_history` since the last evolution. The task has a minimum threshold.

**Verify:**
```sql
SELECT count(*)
FROM cp_edit_history
WHERE profile_id = '...'
  AND created_at > (
    SELECT COALESCE(
      (voice_profile->>'last_evolved')::timestamptz,
      '2000-01-01'::timestamptz
    )
    FROM team_profiles WHERE id = '...'
  );
```

**Fix:** Wait for more edits to accumulate, or manually trigger `evolve-writing-style` from Trigger.dev dashboard.

### 3. Posts stuck in "scheduled" status

**Root cause:** The `auto-publish-check` cron is running but Unipile credentials have expired.

**Verify:**
```sql
SELECT id, status, scheduled_time, published_at, error
FROM cp_pipeline_posts
WHERE status = 'scheduled'
  AND scheduled_time < now()
ORDER BY scheduled_time DESC;
```

**Fix:** Have the user reconnect Unipile in Settings → Integrations. Then manually retry the stuck posts from the Trigger.dev dashboard.

### 4. Email subscribers not receiving broadcasts

**Root cause:** Usually one of: (a) no verified Resend connection, (b) subscriber status is not `active`, (c) Resend API key expired.

**Verify:**
```sql
-- Check subscriber statuses
SELECT status, count(*)
FROM email_subscribers
WHERE team_id = '...'
GROUP BY 1;

-- Check integration
SELECT is_active, last_verified_at
FROM user_integrations
WHERE user_id = '...' AND service = 'resend';
```

**Fix:** Verify the Resend integration is active. Check that subscribers have `active` status. Re-verify the API key if needed.

### 5. Edit classification returning wrong tags

**Root cause:** The edit diff is too small (below Levenshtein threshold) or the classifier prompt needs tuning.

**Verify:**
```sql
SELECT content_type, field_name, edit_distance, classification, edit_tags
FROM cp_edit_history
WHERE profile_id = '...'
ORDER BY created_at DESC
LIMIT 10;
```

**Fix:** Check the Levenshtein threshold in `src/lib/services/edit-capture.ts`. If the classifier is consistently wrong, review the prompt in `src/lib/ai/content-pipeline/edit-classifier.ts`.

## Environment Variables

All of these must be set in **both** Vercel (for API routes) and Trigger.dev (for background tasks):

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude AI for content generation, style evolution, edit classification |
| `OPENAI_API_KEY` | Embeddings (text-embedding-3-small) for knowledge search |
| `RESEND_API_KEY` | Email delivery |
| `TRIGGER_SECRET_KEY` | Trigger.dev task execution |
| `GRAIN_WEBHOOK_SECRET` | Grain transcript webhook auth |
| `FIREFLIES_WEBHOOK_SECRET` | Fireflies transcript webhook auth |

## Key Files Reference

| Area | File |
|------|------|
| Edit capture service | `src/lib/services/edit-capture.ts` |
| Edit classifier (AI) | `src/lib/ai/content-pipeline/edit-classifier.ts` |
| Style evolution service | `src/lib/services/style-evolution.ts` |
| Voice prompt builder | `src/lib/ai/content-pipeline/voice-prompt-builder.ts` |
| Post writer (AI) | `src/lib/ai/content-pipeline/post-writer.ts` |
| Post polish (AI) | `src/lib/ai/content-pipeline/post-polish.ts` |
| Email writer (AI) | `src/lib/ai/content-pipeline/email-writer.ts` |
| Briefing agent (AI) | `src/lib/ai/content-pipeline/briefing-agent.ts` |
| Autopilot batch task | `src/trigger/nightly-autopilot-batch.ts` |
| Style evolution task | `src/trigger/evolve-writing-style.ts` |
| Transcript processing | `src/trigger/process-transcript.ts` |
| Knowledge search | `src/lib/services/knowledge-brain.ts` |
| Subscriber sync | `src/lib/subscriber-sync.ts` |
