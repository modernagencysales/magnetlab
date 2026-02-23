# Fathom Webhook Migration + Notetaker Onboarding Guide

**Date**: 2026-02-23
**Status**: Approved

## Problem

The Fathom integration uses OAuth + polling (30-min cron). It's broken because `FATHOM_CLIENT_ID`, `FATHOM_CLIENT_SECRET`, and `FATHOM_REDIRECT_URI` were never set on Vercel, causing a 500 at `/api/integrations/fathom/authorize`. Meanwhile Grain and Fireflies use simple webhooks that work fine.

## Solution

Replace Fathom's OAuth+polling with a webhook endpoint, matching the Grain/Fireflies pattern. Add an onboarding guide for the team member who sets up notetakers for clients.

## Design

### 1. Fathom Webhook Handler

**New route**: `/api/webhooks/fathom/[userId]/route.ts`

- Accepts Fathom's native `new-meeting-content-ready` payload
- Auth: `?secret=` URL param (per-user secret stored in `user_integrations`)
- Optional: verify `webhook-signature` header if Fathom sends it
- Dedup by `external_id` = `fathom:{meeting_id}`
- Insert into `cp_call_transcripts` with `source: 'fathom'`
- Trigger `process-transcript` task

**Fathom webhook payload** (with `include_transcript: true`):
- Meeting ID, title, created_at, duration, attendees
- Full transcript text
- Summary and action items (ignored, we only need transcript)

### 2. Webhook URL Generation

**New route**: `POST /api/integrations/fathom/webhook-url/route.ts`

- Requires auth (session)
- Generates a per-user UUID secret
- Stores in `user_integrations` (service: `fathom`, api_key: secret, is_active: true)
- Returns: `https://magnetlab.app/api/webhooks/fathom/{userId}?secret={secret}`

### 3. Updated FathomSettings UI

Replace OAuth connect button with:
- "Generate Webhook URL" button (first time)
- Copyable webhook URL display (after generation)
- Setup instructions link
- "Regenerate" button (generates new secret, invalidates old URL)
- "Disconnect" button (deactivates integration)

### 4. Files to Delete

| File | Reason |
|------|--------|
| `src/app/api/integrations/fathom/authorize/route.ts` | OAuth flow removed |
| `src/app/api/integrations/fathom/callback/route.ts` | OAuth flow removed |
| `src/app/api/integrations/fathom/disconnect/route.ts` | Replaced by new disconnect in webhook-url route |
| `src/trigger/sync-fathom-transcripts.ts` | Polling replaced by webhook push |

### 5. Files to Simplify

| File | Change |
|------|--------|
| `src/lib/integrations/fathom.ts` | Remove all OAuth helpers (getFathomAuthorizationUrl, exchangeFathomCode, refreshFathomToken, getUserFathomClient, FathomClient). Keep only type definitions if needed. |

### 6. Onboarding Setup Guide

**New file**: `docs/notetaker-setup-guide.md`

Written for the onboarding/sales person who sets up integrations for clients. Covers all 3 platforms with step-by-step instructions. See implementation plan for full content.

## What Stays the Same

- Grain webhook (`/api/webhooks/grain/`) — unchanged
- Fireflies webhook (`/api/webhooks/fireflies/`) — unchanged
- `cp_call_transcripts` table schema — unchanged
- `process-transcript` Trigger.dev task — unchanged
- `user_integrations` table — reused with new secret storage pattern

## Env Vars

**Removed** (no longer needed):
- `FATHOM_CLIENT_ID`
- `FATHOM_CLIENT_SECRET`
- `FATHOM_REDIRECT_URI`

**No new env vars** — per-user secrets are stored in DB, not env vars.
