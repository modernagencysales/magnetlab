# Attio Call Recorder Setup Guide

## Overview

Attio Call Intelligence automatically records your Zoom, Google Meet, and Microsoft Teams calls, generates transcripts, and syncs them into MagnetLab's content pipeline for AI-powered knowledge extraction and content ideas.

---

## Part 1: Getting Vlad (or any team member) on Attio Call Recorder

### Prerequisites
- Attio workspace on **Pro or Enterprise** plan (Call Intelligence is not available on Free/Plus)
- Admin access to invite new members

### Steps

1. **Invite to Attio workspace**
   - Go to Attio > Settings > Members
   - Click "Invite member"
   - Enter Vlad's email address
   - Vlad accepts the invite and logs in

2. **Connect calendar**
   - Vlad goes to Settings > Calendar sync
   - Connects Google Calendar or Microsoft Outlook
   - This lets Attio see upcoming meetings

3. **Enable Call Intelligence**
   - Vlad goes to Settings > Call Intelligence
   - Toggles on "Auto-record external meetings"
   - Optionally configure: record all meetings vs. only meetings with CRM contacts
   - Save settings

4. **First call test**
   - Vlad joins a Zoom/Meet/Teams call
   - The Attio recording bot should auto-join (participants will see "Attio Recorder" or similar)
   - Vlad admits the bot when prompted
   - After the call ends, the recording + transcript appears in Attio within a few minutes

5. **Verify in Attio**
   - Go to the meeting in Attio (linked to the relevant person/company record)
   - Confirm the recording has a "completed" status and transcript is visible

---

## Part 2: Setting up the MagnetLab webhook (Admin/Dev task)

This connects Attio recordings to MagnetLab's content pipeline.

### Step 1: Set environment variables

Add these to your Vercel environment (or `.env.local` for dev):

```
ATTIO_API_KEY=<your Attio API key>
ATTIO_WEBHOOK_SECRET=<webhook signing secret from Attio>
ATTIO_DEFAULT_USER_ID=<MagnetLab user UUID to attribute recordings to>
```

**To get the API key:**
- Attio > Settings > Developer > API Keys
- Create a new key with scopes: `meeting:read`, `call_recording:read`

### Step 2: Create the webhook in Attio

- Go to Attio > Settings > Developer > Webhooks
- Click "Create webhook"
- **Target URL**: `https://www.magnetlab.app/api/webhooks/attio`
- **Events**: Select `call-recording.created`
- Copy the **webhook signing secret** — this goes in `ATTIO_WEBHOOK_SECRET`
- Save

### Step 3: Deploy

Deploy the latest MagnetLab code to Vercel. The webhook endpoint is at:
```
POST /api/webhooks/attio
```

### Step 4: Test

1. Record a test call via Attio
2. Check Vercel function logs for the webhook handler
3. Verify the transcript appears in `cp_call_transcripts` table in Supabase
4. Verify the `process-transcript` Trigger.dev task runs

---

## Part 3: Backfilling existing recordings

To pull in all past call recordings that already exist in Attio:

```bash
cd magnetlab

# Dry run first — see what would be imported
DRY_RUN=1 npx tsx scripts/attio-backfill.ts

# Run for real
npx tsx scripts/attio-backfill.ts
```

The script pages through all meetings, finds those with completed recordings, fetches transcripts, and inserts them into `cp_call_transcripts` with deduplication.

**Note:** Backfilled transcripts are inserted but NOT automatically run through the AI pipeline. To process them, you can either:
- Trigger the `process-transcript` task manually for each transcript ID
- Or create a small follow-up script that triggers the task for all un-processed records

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot doesn't join calls | Check Vlad's Calendar sync + Call Intelligence settings in Attio |
| Webhook not firing | Verify the webhook is active in Attio Developer settings |
| 401 on webhook | Check `ATTIO_WEBHOOK_SECRET` matches the signing secret in Attio |
| 502 on webhook | Check `ATTIO_API_KEY` is valid and has `meeting:read`, `call_recording:read` scopes |
| Empty transcript | Recording may still be processing — Attio needs a few minutes after the call ends |
| Duplicate entries | The webhook handler deduplicates by `attio:<call_recording_id>` per user |
