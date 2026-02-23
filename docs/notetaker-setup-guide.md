# Notetaker Onboarding Setup Guide

> **Audience:** Team members setting up notetaker integrations for clients.
> Clients do not configure webhooks themselves -- you do it for them during onboarding.
> Every client uses a different notetaker platform. This guide walks you through each one.

---

## Quick Reference

| Platform | Where to Configure | Auth Model | What You Need |
|----------|--------------------|------------|---------------|
| **Fathom** | Fathom > Settings > API Access > Webhooks | Per-user secret (generated in MagnetLab) | Client's Fathom login |
| **Grain** | Grain > Settings > Integrations/API > Webhooks | Shared secret (`GRAIN_WEBHOOK_SECRET` env var) | Client's Grain login + their MagnetLab user ID |
| **Fireflies** | Fireflies > Settings > Developer settings | Shared secret (`FIREFLIES_WEBHOOK_SECRET` env var) | Client's Fireflies login + their MagnetLab user ID + possibly Zapier/Make |

---

## Before You Start

These steps are the same regardless of which notetaker the client uses.

1. **Log into the client's MagnetLab account** at [magnetlab.app](https://magnetlab.app)
2. Go to **Settings** (bottom of the left sidebar)
3. For **Fathom**: Scroll to the **Fathom** integration card and click **Connect Fathom** to generate the webhook URL. Copy it.
4. For **Grain** or **Fireflies**: You will construct the webhook URL manually (see the platform-specific sections below). You will need the client's **MagnetLab user ID** -- find this in the URL bar when viewing their account, or in the Supabase `users` table.

**Tip:** Keep a notepad open. You will be copying URLs and IDs between MagnetLab and the notetaker platform.

---

## Fathom Setup

Fathom is the smoothest integration. MagnetLab generates a unique webhook URL per user, and Fathom sends the full transcript automatically when a meeting ends.

### Step 1: Generate the Webhook URL in MagnetLab

1. In the client's MagnetLab account, go to **Settings**
2. Find the **Fathom** integration card
3. Click **Connect Fathom**
4. A webhook URL appears -- click the **Copy** button next to it
5. The URL looks like: `https://www.magnetlab.app/api/webhooks/fathom/<userId>?secret=<uuid>`

Save this URL. You will paste it into Fathom in the next step.

### Step 2: Create the Webhook in Fathom

1. Log into the client's Fathom account at [fathom.video](https://fathom.video)
2. Click the profile/settings icon (bottom-left corner)
3. Navigate to **Settings > API Access**
4. If no API key exists yet, click **Generate API Key** (you do not need the key itself, but the key must exist for webhooks to work)
5. Scroll down to the **Webhooks** section
6. Click **Add Webhook** (or **Create Webhook**)
7. In the **Destination URL** field, paste the MagnetLab webhook URL you copied
8. Configure these options:
   - **Triggered for**: Select **My recordings** (optionally also "Shared recordings" if the client wants team calls imported)
   - **Include transcript**: **ON** -- this is required. Without it, MagnetLab receives no transcript data and the webhook is useless.
   - **Include summary**: Optional (MagnetLab ignores this field)
   - **Include action items**: Optional (MagnetLab ignores this field)
9. Click **Save**

### Step 3: Test the Connection

1. Have the client (or you, on their account) join a short test call -- even 2 minutes is enough
2. End the meeting and wait for Fathom to finish processing (usually 5-10 minutes)
3. In MagnetLab, go to the **Knowledge** page (left sidebar)
4. The transcript should appear in the list with a "fathom" source tag
5. If it processed successfully, you will see extracted knowledge entries appearing shortly after

### Fathom Troubleshooting

| Problem | Solution |
|---------|----------|
| Fathom rejects the webhook URL | Make sure the full URL was pasted including `https://` and the `?secret=...` parameter. No trailing spaces. |
| Meeting processed in Fathom but nothing in MagnetLab | Check that **Include transcript** is toggled ON in the Fathom webhook settings. Without it, Fathom sends metadata only. |
| Fathom does not show a Webhooks section | The client may need to generate an API key first. Some older Fathom plans may not support webhooks -- check their plan tier. |
| Transcript appears in MagnetLab but is very short or empty | Fathom may not have captured audio properly. Open the recording in Fathom itself and check if the transcript is there. |
| "Connected" badge disappeared in MagnetLab Settings | Someone may have clicked **Disconnect**. Click **Connect Fathom** again to regenerate the URL. You will need to update the URL in Fathom's webhook settings too. |
| Getting 401 Unauthorized in Fathom's webhook logs | The secret in the URL does not match what MagnetLab has stored. Regenerate the URL in MagnetLab Settings and update it in Fathom. |

---

## Grain Setup

Grain uses a shared webhook secret (not per-user like Fathom). The client's MagnetLab user ID must be included in the webhook payload so MagnetLab knows which account to route the transcript to.

### Step 1: Construct the Webhook URL

The Grain webhook URL format is:

```
https://magnetlab.app/api/webhooks/grain/?secret=<GRAIN_WEBHOOK_SECRET>
```

The `GRAIN_WEBHOOK_SECRET` value is set as an environment variable in MagnetLab's Vercel deployment and Trigger.dev. Ask the team lead for the current value, or check the Vercel environment variables for the magnetlab project.

### Step 2: Get the Client's MagnetLab User ID

You need the client's `user_id` from MagnetLab. To find it:

- **Option A**: Check the Supabase `users` table -- search by the client's email address. The `id` column is the user ID.
- **Option B**: If you have access to the client's MagnetLab Fathom settings, the user ID appears in the generated Fathom webhook URL (the segment between `/fathom/` and `?secret=`).

Save this user ID. You will need it when configuring Grain's webhook payload.

### Step 3: Configure the Webhook in Grain

1. Log into the client's Grain account at [grain.com](https://grain.com)
2. Navigate to **Settings > Integrations** (or **Settings > API**, depending on Grain's current UI)
3. Find the **Webhooks** section
4. Click **Add Webhook** or **Create Webhook**
5. Set the **URL** to the webhook URL you constructed in Step 1
6. For the event type, select **Recording completed** or **Transcript ready** (whichever is available)
7. In the webhook payload configuration, make sure these fields are included:

| Field | Required? | Notes |
|-------|-----------|-------|
| `recording_id` | **Required** | Grain's unique ID for the recording |
| `transcript` | **Required** | The full transcript text (not a summary, not a URL to the transcript) |
| `user_id` | **Required** | Set this to the client's MagnetLab user ID from Step 2 |
| `title` | Recommended | The meeting title |
| `date` | Recommended | The meeting date/time (ISO 8601 format) |
| `duration_minutes` | Recommended | Meeting length in minutes |
| `participants` | Recommended | Array of participant names or emails |

8. Save the webhook

### Step 4: Test the Connection

1. Record a test meeting through Grain
2. Wait for Grain to finish processing (~5 minutes)
3. In MagnetLab, go to the **Knowledge** page
4. The transcript should appear with a "grain" source tag

### Grain Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized response | The `?secret=` value in the URL does not match the `GRAIN_WEBHOOK_SECRET` environment variable in MagnetLab. Double-check the value. |
| Webhook fires but transcript not appearing | Check that the payload includes the `transcript` field with the full text, the `recording_id`, and the `user_id`. All three are required. |
| 400 Bad Request response | Missing one of the required fields: `recording_id`, `transcript`, or `user_id`. Check the payload structure. |
| Grain does not show webhook options | Check if the client's Grain plan supports API/webhook access. Some plans restrict this. |
| Transcript appears under the wrong user | The `user_id` in the payload is wrong. Update it to the correct MagnetLab user ID. |
| Duplicate transcripts | Not a problem -- MagnetLab deduplicates automatically based on `grain:<recording_id>`. |

---

## Fireflies Setup

Fireflies is the trickiest integration. By default, Fireflies webhooks only send a notification with the `meetingId` -- they do **not** include the full transcript in the payload. This means you may need a Zapier or Make.com intermediary to fetch the transcript and forward it to MagnetLab.

### Step 1: Construct the Webhook URL

The Fireflies webhook URL format is:

```
https://magnetlab.app/api/webhooks/fireflies/?secret=<FIREFLIES_WEBHOOK_SECRET>
```

The `FIREFLIES_WEBHOOK_SECRET` value is set as an environment variable in MagnetLab's Vercel deployment. Ask the team lead for the current value, or check the Vercel environment variables.

### Step 2: Get the Client's MagnetLab User ID

Same as the Grain setup -- see [Step 2 in the Grain section](#step-2-get-the-clients-magnetlab-user-id) above.

### Step 3: Configure Fireflies (Direct -- if transcript is included)

If the client's Fireflies plan sends the full transcript in the webhook payload:

1. Log into the client's Fireflies account at [app.fireflies.ai](https://app.fireflies.ai)
2. Click the **gear icon** (top-right) to open **Settings**
3. Click the **Developer settings** tab
4. In the **Webhooks** field, paste the MagnetLab Fireflies webhook URL
5. Save

### Step 3 (Alternative): Configure via Make.com Intermediary

If Fireflies only sends the `meetingId` in the webhook (this is the common case), you need an intermediary to fetch the transcript:

1. Create a new **Make.com scenario** (preferred over Zapier for Fireflies)
2. **Trigger**: Fireflies > **Watch Transcripts** (or use a generic webhook to receive Fireflies notifications)
3. **Module 2**: Fireflies > **Get a Transcript** -- this fetches the full transcript text via the Fireflies GraphQL API
4. **Module 3**: HTTP > **Make a request** (POST) with:
   - **URL**: The MagnetLab Fireflies webhook URL from Step 1
   - **Body type**: JSON
   - **Body content**:
     ```json
     {
       "meeting_id": "{{the meeting ID from Fireflies}}",
       "transcript": "{{the full transcript text from Module 2}}",
       "user_id": "{{the client's MagnetLab user ID}}",
       "title": "{{meeting title}}",
       "date": "{{meeting date}}",
       "duration_minutes": {{duration}},
       "participants": ["{{participant emails or names}}"]
     }
     ```
5. Turn on the scenario

**Why Make.com instead of Zapier?** Make.com has a native "Get a Transcript" module for Fireflies that returns the full text. Zapier's Fireflies integration only provides the meeting URL, not the transcript content.

### Step 4: Test the Connection

1. Record a test meeting with Fireflies active
2. Wait for Fireflies to process (~5-10 minutes)
3. If using Make.com, check the scenario execution log to confirm it ran
4. In MagnetLab, go to the **Knowledge** page
5. The transcript should appear with a "fireflies" source tag

### Fireflies Troubleshooting

| Problem | Solution |
|---------|----------|
| 401 Unauthorized response | The `?secret=` value does not match the `FIREFLIES_WEBHOOK_SECRET` environment variable. |
| Webhook fires but transcript is empty | Fireflies likely only sent the `meetingId`, not the full transcript. Set up the Make.com intermediary (Step 3 Alternative). |
| Make.com scenario not triggering | Check that the Fireflies webhook URL in Fireflies settings points to Make.com's webhook URL (not MagnetLab's directly). MagnetLab's URL goes in Make.com's HTTP module. |
| 400 Bad Request from MagnetLab | The payload is missing `meeting_id`, `transcript`, or `user_id`. All three are required. Check the Make.com HTTP module body. |
| Fireflies webhook only fires for some meetings | Fireflies typically only fires webhooks for meetings where the client is the organizer or where Fireflies Bot was explicitly invited. |
| Transcript appears under wrong user | The `user_id` in the Make.com payload is incorrect. Update it to match the client's MagnetLab user ID. |

---

## General Troubleshooting

### Where to Check When Things Are Not Working

Check these in order:

1. **MagnetLab Knowledge page** -- If a transcript arrived and was processed, it shows up here. If it is not here, the webhook either did not fire or was rejected.
2. **MagnetLab Settings** (Fathom only) -- Confirm the integration shows a green **Connected** badge and the webhook URL is visible. If not, regenerate it.
3. **The notetaker's webhook/delivery logs** -- Most platforms (Fathom, Grain) show delivery status for each webhook event. Look for HTTP status codes: 200 = success, 401 = bad secret, 400 = bad payload, 500 = server error.
4. **Vercel function logs** -- If you have Vercel access, check the logs at `https://vercel.com/[team]/magnetlab/logs`. Filter by the webhook path (`/api/webhooks/fathom`, `/api/webhooks/grain`, or `/api/webhooks/fireflies`). Error details show up here.
5. **Trigger.dev dashboard** -- If the transcript was saved but not processed (no knowledge entries extracted), check for failed `process-transcript` task runs in the Trigger.dev dashboard.

### Common Issues Across All Platforms

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| 500 Internal Server Error | Server-side issue (could be database, Trigger.dev, or config) | Check Vercel logs for the specific error message |
| Transcript saved but no knowledge entries | The `process-transcript` Trigger.dev task failed | Check the Trigger.dev dashboard for failed runs. Common causes: OpenAI API key expired, Anthropic API key expired, or task deployment out of date. |
| Duplicate transcripts appearing | Not actually a problem | MagnetLab deduplicates by `<source>:<meeting_id>`. If the same transcript appears twice, it means the meeting IDs were different (e.g., Fathom resent with a new ID). The duplicates are harmless. |
| Transcript appears with no title or date | The notetaker's webhook payload did not include these optional fields | Not critical -- the transcript content is what matters. Title and date are nice-to-have metadata. |
| Client disconnected/reconnected and now nothing works | The webhook URL changed but the notetaker still has the old URL | Re-copy the new webhook URL from MagnetLab Settings and update it in the notetaker platform. |
| "Transcript too short" message in logs | MagnetLab skips transcripts shorter than 100 characters | This is intentional -- very short transcripts (test calls, accidental recordings) are not useful for content extraction. |

### Environment Variables Reference

These are set on the MagnetLab Vercel deployment. You should not need to change them, but they are here for reference if troubleshooting auth issues.

| Variable | Used By | Purpose |
|----------|---------|---------|
| `GRAIN_WEBHOOK_SECRET` | Grain webhook route | Shared secret for authenticating Grain webhooks |
| `FIREFLIES_WEBHOOK_SECRET` | Fireflies webhook route | Shared secret for authenticating Fireflies webhooks |

Fathom does not use an environment variable -- each user's webhook secret is stored in the `user_integrations` database table and generated through the MagnetLab UI.
