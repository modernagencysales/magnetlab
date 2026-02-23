# Fathom Webhook Migration + Notetaker Onboarding Guide

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Fathom's broken OAuth+polling integration with a webhook endpoint, update the UI, and write an onboarding guide for setting up notetakers for clients.

**Architecture:** Fathom sends `new-meeting-content-ready` webhooks with transcript included. We add a per-user webhook endpoint (`/api/webhooks/fathom/[userId]`) authenticated via `?secret=` URL param. The FathomSettings UI generates and displays the webhook URL. An onboarding guide covers Fathom, Grain, and Fireflies setup for non-technical team members.

**Tech Stack:** Next.js 15 App Router, Supabase, Trigger.dev, Jest

**Design doc:** `docs/plans/2026-02-23-fathom-webhook-migration-design.md`

---

### Task 1: Fathom Webhook Route — Tests

**Files:**
- Create: `src/__tests__/api/webhooks/fathom.test.ts`

**Step 1: Write the failing tests**

```typescript
/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock Trigger.dev
jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: { trigger: jest.fn() },
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';

// Import the route handler (will be created in Task 2)
import { POST } from '@/app/api/webhooks/fathom/[userId]/route';

function createMockSupabase() {
  let selectResult: { data: unknown; error: unknown } = { data: null, error: null };
  let insertResult: { data: unknown; error: unknown } = { data: null, error: null };

  const chain: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'maybeSingle', 'single', 'insert']) {
    chain[method] = jest.fn(() => chain);
  }

  // Make maybeSingle resolve to selectResult
  chain.maybeSingle = jest.fn(() => Promise.resolve(selectResult));
  // Make single resolve to insertResult
  chain.single = jest.fn(() => Promise.resolve(insertResult));

  const client = {
    from: jest.fn(() => chain),
  };

  return {
    client,
    chain,
    setSelectResult: (r: { data: unknown; error: unknown }) => { selectResult = r; },
    setInsertResult: (r: { data: unknown; error: unknown }) => { insertResult = r; },
  };
}

function makeRequest(
  userId: string,
  body: Record<string, unknown>,
  options?: { secret?: string; omitSecret?: boolean }
): NextRequest {
  const secret = options?.omitSecret ? '' : (options?.secret || 'test-secret-uuid');
  const url = `http://localhost:3000/api/webhooks/fathom/${userId}${secret ? `?secret=${secret}` : ''}`;
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_FATHOM_PAYLOAD = {
  call_id: 'fathom-meeting-123',
  title: 'Client Discovery Call',
  created_at: '2026-02-23T10:00:00Z',
  duration: 2700,
  attendees: ['alice@example.com', 'bob@example.com'],
  transcript: 'Alice: Welcome to the call. Bob: Thanks for having me. Alice: Let us discuss the project timeline...',
};

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/webhooks/fathom/[userId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should reject request without secret param', async () => {
    const req = makeRequest('user-1', VALID_FATHOM_PAYLOAD, { omitSecret: true });
    const res = await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });
    expect(res.status).toBe(401);
  });

  it('should reject request with wrong secret', async () => {
    // Mock: stored secret is 'correct-secret'
    mock.setSelectResult({ data: { webhook_secret: 'correct-secret', is_active: true }, error: null });
    // Override chain so first from('user_integrations') returns the integration lookup
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { webhook_secret: 'correct-secret', is_active: true }, error: null });

    const req = makeRequest('user-1', VALID_FATHOM_PAYLOAD, { secret: 'wrong-secret' });
    const res = await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });
    expect(res.status).toBe(401);
  });

  it('should reject payload missing transcript', async () => {
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { webhook_secret: 'test-secret-uuid', is_active: true }, error: null });

    const req = makeRequest('user-1', { call_id: 'abc' });
    const res = await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });
    expect(res.status).toBe(400);
  });

  it('should process valid Fathom webhook and insert transcript', async () => {
    // First call: lookup integration secret
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { webhook_secret: 'test-secret-uuid', is_active: true }, error: null });
    // Dedup check: no existing
    mock.chain.maybeSingle = jest.fn().mockResolvedValueOnce({ data: null, error: null });
    // Insert returns new row
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { id: 'transcript-1' }, error: null });

    const req = makeRequest('user-1', VALID_FATHOM_PAYLOAD);
    const res = await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.transcript_id).toBe('transcript-1');
  });

  it('should handle duplicate transcript gracefully', async () => {
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { webhook_secret: 'test-secret-uuid', is_active: true }, error: null });
    mock.chain.maybeSingle = jest.fn().mockResolvedValueOnce({ data: { id: 'existing-1' }, error: null });

    const req = makeRequest('user-1', VALID_FATHOM_PAYLOAD);
    const res = await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.transcript_id).toBe('existing-1');
  });

  it('should trigger process-transcript after insert', async () => {
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { webhook_secret: 'test-secret-uuid', is_active: true }, error: null });
    mock.chain.maybeSingle = jest.fn().mockResolvedValueOnce({ data: null, error: null });
    mock.chain.single = jest.fn()
      .mockResolvedValueOnce({ data: { id: 'transcript-2' }, error: null });

    const req = makeRequest('user-1', VALID_FATHOM_PAYLOAD);
    await POST(req, { params: Promise.resolve({ userId: 'user-1' }) });

    expect(tasks.trigger).toHaveBeenCalledWith('process-transcript', {
      userId: 'user-1',
      transcriptId: 'transcript-2',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/webhooks/fathom.test.ts --no-coverage 2>&1 | tail -20`

Expected: FAIL — the route module doesn't exist yet.

**Step 3: Commit**

```bash
git add src/__tests__/api/webhooks/fathom.test.ts
git commit -m "test: add Fathom webhook handler tests"
```

---

### Task 2: Fathom Webhook Route — Implementation

**Files:**
- Create: `src/app/api/webhooks/fathom/[userId]/route.ts`

**Step 1: Write the webhook handler**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { logError, logWarn } from '@/lib/utils/logger';

// Fathom's native webhook payload shape (new-meeting-content-ready)
// Field names may vary — we accept multiple common field names
interface FathomWebhookPayload {
  // Meeting identifier (Fathom may use call_id, id, or meeting_id)
  call_id?: string;
  id?: string;
  meeting_id?: string;
  // Metadata
  title?: string;
  created_at?: string;
  date?: string;
  // Duration in seconds (Fathom native) or minutes
  duration?: number;
  duration_seconds?: number;
  duration_minutes?: number;
  // Participants
  attendees?: string[];
  participants?: string[];
  // Transcript text
  transcript?: string;
  // Nested transcript object (Fathom may wrap it)
  transcript_text?: string;
  // We ignore summary and action_items
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  try {
    // 1. Validate secret from URL param
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Look up stored secret for this user's fathom integration
    const supabase = createSupabaseAdminClient();
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('webhook_secret, is_active')
      .eq('user_id', userId)
      .eq('service', 'fathom')
      .single();

    if (integrationError || !integration || !integration.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (integration.webhook_secret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Parse payload
    const payload: FathomWebhookPayload = await request.json();

    // Extract meeting ID (accept multiple field names)
    const meetingId = payload.call_id || payload.id || payload.meeting_id;
    // Extract transcript (accept multiple field names)
    const transcriptText = payload.transcript || payload.transcript_text;

    if (!meetingId || !transcriptText) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting identifier and transcript' },
        { status: 400 }
      );
    }

    // Skip very short transcripts
    if (transcriptText.length < 100) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Transcript too short',
      });
    }

    const externalId = `fathom:${meetingId}`;

    // 4. Dedup check
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        transcript_id: existing.id,
      });
    }

    // 5. Normalize duration to minutes
    const durationMinutes = payload.duration_minutes
      || (payload.duration ? Math.round(payload.duration / 60) : null)
      || (payload.duration_seconds ? Math.round(payload.duration_seconds / 60) : null);

    // 6. Insert transcript
    const { data: transcript, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: userId,
        source: 'fathom',
        external_id: externalId,
        title: payload.title || null,
        call_date: payload.created_at || payload.date || null,
        duration_minutes: durationMinutes,
        participants: payload.attendees || payload.participants || null,
        raw_transcript: transcriptText,
      })
      .select('id')
      .single();

    if (insertError || !transcript) {
      logError('webhooks/fathom', new Error(String(insertError?.message)), {
        step: 'failed_to_insert_fathom_transcript',
        userId,
      });
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // 7. Trigger processing
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId,
        transcriptId: transcript.id,
      });
    } catch (triggerError) {
      logWarn('webhooks/fathom', 'Failed to trigger process-transcript', {
        detail: String(triggerError),
      });
    }

    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
    });
  } catch (error) {
    logError('webhooks/fathom', error, { step: 'fathom_webhook_error', userId });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/api/webhooks/fathom.test.ts --no-coverage 2>&1 | tail -20`

Expected: Tests should pass. If mock chaining needs adjustment due to multiple `from()` calls (integration lookup vs transcript operations), fix the mock setup to handle sequential calls.

**Step 3: Commit**

```bash
git add src/app/api/webhooks/fathom/\[userId\]/route.ts
git commit -m "feat: add Fathom webhook endpoint for transcript ingestion"
```

---

### Task 3: Webhook URL Generation API

**Files:**
- Create: `src/app/api/integrations/fathom/webhook-url/route.ts`

**Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration, upsertUserIntegration, deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { logError } from '@/lib/utils/logger';

// GET: Return existing webhook URL if configured
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const integration = await getUserIntegration(session.user.id, 'fathom');
    if (!integration || !integration.webhook_secret || !integration.is_active) {
      return NextResponse.json({ configured: false });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app';
    const webhookUrl = `${baseUrl}/api/webhooks/fathom/${session.user.id}?secret=${integration.webhook_secret}`;

    return NextResponse.json({
      configured: true,
      webhook_url: webhookUrl,
    });
  } catch (error) {
    logError('integrations/fathom', error, { step: 'get_webhook_url_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Generate (or regenerate) webhook URL
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const secret = crypto.randomUUID();

    await upsertUserIntegration({
      userId: session.user.id,
      service: 'fathom',
      webhookSecret: secret,
      isActive: true,
      metadata: { created_via: 'webhook_setup' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app';
    const webhookUrl = `${baseUrl}/api/webhooks/fathom/${session.user.id}?secret=${secret}`;

    return NextResponse.json({
      configured: true,
      webhook_url: webhookUrl,
    });
  } catch (error) {
    logError('integrations/fathom', error, { step: 'generate_webhook_url_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Disconnect Fathom integration
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteUserIntegration(session.user.id, 'fathom');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('integrations/fathom', error, { step: 'disconnect_fathom_error' });
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/integrations/fathom/webhook-url/route.ts
git commit -m "feat: add Fathom webhook URL generation API"
```

---

### Task 4: Update FathomSettings UI

**Files:**
- Modify: `src/components/settings/FathomSettings.tsx`
- Modify: `src/components/dashboard/SettingsContent.tsx` (props change)

**Step 1: Rewrite FathomSettings.tsx**

Replace the entire file with:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, Video, Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { logError } from '@/lib/utils/logger';

interface FathomSettingsProps {
  isConnected: boolean;
}

export function FathomSettings({ isConnected: initialConnected }: FathomSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [configured, setConfigured] = useState(initialConnected);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch existing webhook URL on mount
  const fetchWebhookUrl = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/fathom/webhook-url');
      if (res.ok) {
        const data = await res.json();
        if (data.configured) {
          setWebhookUrl(data.webhook_url);
          setConfigured(true);
        }
      }
    } catch (error) {
      logError('settings/fathom', error, { step: 'fetch_webhook_url' });
    }
  }, []);

  useEffect(() => {
    if (initialConnected) {
      fetchWebhookUrl();
    }
  }, [initialConnected, fetchWebhookUrl]);

  const handleGenerate = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/integrations/fathom/webhook-url', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate webhook URL');
      const data = await res.json();
      setWebhookUrl(data.webhook_url);
      setConfigured(true);
      setFeedback({ type: 'success', message: 'Webhook URL generated! Paste it into Fathom.' });
    } catch (error) {
      logError('settings/fathom', error, { step: 'generate_error' });
      setFeedback({ type: 'error', message: 'Failed to generate webhook URL' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Fathom? Transcripts will stop syncing.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/fathom/webhook-url', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setWebhookUrl(null);
      setConfigured(false);
      setFeedback({ type: 'success', message: 'Fathom disconnected.' });
    } catch (error) {
      logError('settings/fathom', error, { step: 'disconnect_error' });
      setFeedback({ type: 'error', message: 'Failed to disconnect' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
            <Video className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-medium">Fathom</p>
            <p className="text-xs text-muted-foreground">
              Auto-sync meeting transcripts to your content pipeline
            </p>
          </div>
        </div>
        {configured && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {configured && webhookUrl ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste this URL into your Fathom webhook settings. Transcripts sync automatically when meetings end.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
              {webhookUrl}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md border px-2 py-2 hover:bg-muted transition-colors"
              title="Copy URL"
            >
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate URL
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Disconnect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect Fathom to automatically import meeting transcripts into your content pipeline.
          </p>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating...
              </span>
            ) : (
              'Connect Fathom'
            )}
          </button>
        </div>
      )}

      {feedback && (
        <p className={`mt-3 flex items-center gap-2 text-sm ${
          feedback.type === 'success' ? 'text-green-600' : 'text-red-500'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {feedback.message}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Update SettingsContent.tsx props**

In `src/components/dashboard/SettingsContent.tsx`, change the FathomSettings usage (around line 337-340):

Old:
```tsx
<FathomSettings
  isConnected={fathomIntegration?.is_active ?? false}
  lastSyncedAt={(fathomIntegration?.metadata as { last_synced_at?: string } | undefined)?.last_synced_at ?? null}
/>
```

New:
```tsx
<FathomSettings
  isConnected={fathomIntegration?.is_active ?? false}
/>
```

**Step 3: Commit**

```bash
git add src/components/settings/FathomSettings.tsx src/components/dashboard/SettingsContent.tsx
git commit -m "feat: update Fathom UI to webhook-based flow"
```

---

### Task 5: Delete OAuth Infrastructure

**Files:**
- Delete: `src/app/api/integrations/fathom/authorize/route.ts`
- Delete: `src/app/api/integrations/fathom/callback/route.ts`
- Delete: `src/app/api/integrations/fathom/disconnect/route.ts`
- Delete: `src/trigger/sync-fathom-transcripts.ts`
- Modify: `src/lib/integrations/fathom.ts` (gut it)

**Step 1: Delete the OAuth routes and cron task**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
rm src/app/api/integrations/fathom/authorize/route.ts
rm src/app/api/integrations/fathom/callback/route.ts
rm src/app/api/integrations/fathom/disconnect/route.ts
rm src/trigger/sync-fathom-transcripts.ts
```

**Step 2: Replace fathom.ts with minimal file**

Replace entire `src/lib/integrations/fathom.ts` with:

```typescript
// Fathom integration — webhook-based (no OAuth)
// Webhook handler: src/app/api/webhooks/fathom/[userId]/route.ts
// Settings UI: src/components/settings/FathomSettings.tsx

// Fathom webhook payload types (for reference)
export interface FathomWebhookPayload {
  call_id?: string;
  id?: string;
  meeting_id?: string;
  title?: string;
  created_at?: string;
  date?: string;
  duration?: number;
  duration_seconds?: number;
  duration_minutes?: number;
  attendees?: string[];
  participants?: string[];
  transcript?: string;
  transcript_text?: string;
}
```

**Step 3: Check for stale imports**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && grep -r "from.*integrations/fathom" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "__tests__"`

Fix any files still importing deleted exports (getFathomAuthorizationUrl, exchangeFathomCode, etc.).

**Step 4: Verify build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors related to fathom imports.

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove Fathom OAuth + polling, replace with webhook types"
```

---

### Task 6: Write Notetaker Onboarding Setup Guide

**Files:**
- Create: `docs/notetaker-setup-guide.md`

**Step 1: Write the guide**

```markdown
# Notetaker Setup Guide

> **For:** The team member setting up notetaker integrations for clients.
> Each client's notetaker platform is different. This guide covers how to configure webhooks for each one.

## Quick Reference

| Notetaker | Setup Location | What You Need |
|-----------|---------------|---------------|
| **Fathom** | Fathom Settings > API Access | Client's Fathom login |
| **Grain** | Grain Settings > Integrations | Client's Grain login |
| **Fireflies** | Fireflies Settings > Developer | Client's Fireflies login |

---

## Before You Start

1. Log into the client's MagnetLab account at [magnetlab.app](https://magnetlab.app)
2. Go to **Settings** (left sidebar, bottom)
3. Scroll to the **Fathom** section (or Grain/Fireflies — see below)
4. Click **Connect [Notetaker]** to generate the webhook URL
5. Copy the webhook URL — you'll paste it into the notetaker's settings

---

## Fathom Setup

### Step 1: Get the Webhook URL from MagnetLab

1. In MagnetLab Settings, find the **Fathom** card
2. Click **Connect Fathom**
3. A webhook URL will appear — click the copy icon

### Step 2: Create the Webhook in Fathom

1. Log into the client's Fathom account at [fathom.video](https://fathom.video)
2. Click the profile/settings icon (bottom-left)
3. Go to **Settings > API Access**
4. If no API key exists, click **Generate API Key** (save it somewhere safe)
5. Under **Webhooks**, click **Add Webhook** (or **Create Webhook**)
6. Paste the MagnetLab webhook URL into the **Destination URL** field
7. Configure these settings:
   - **Triggered for**: Check **My recordings** (and optionally "Shared recordings")
   - **Include transcript**: **ON** (required!)
   - **Include summary**: Optional (we only use the transcript)
   - **Include action items**: Optional (we only use the transcript)
8. Save the webhook

### Step 3: Test It

1. Have the client join a short test meeting (even 2 minutes works)
2. Wait for Fathom to process the recording (usually 5-10 minutes after the meeting ends)
3. In MagnetLab, go to **Knowledge** — the transcript should appear automatically
4. If it doesn't appear within 15 minutes, check:
   - Is the webhook URL correct? (compare what's in Fathom vs MagnetLab Settings)
   - Is "Include transcript" enabled in the Fathom webhook settings?
   - Check the client's Fathom plan — some free plans may not support webhooks

### Troubleshooting Fathom

| Problem | Solution |
|---------|----------|
| Webhook URL gives an error in Fathom | Make sure the URL starts with `https://` and includes the `?secret=` parameter |
| Meeting processed but no transcript in MagnetLab | Check "Include transcript" is ON in Fathom webhook settings |
| Fathom doesn't show webhook options | Client may need to upgrade their Fathom plan, or generate an API key first |
| Transcript appears but is very short | Fathom may not have captured audio properly — check the recording in Fathom itself |

---

## Grain Setup

### Step 1: Get the Webhook URL from MagnetLab

1. In MagnetLab Settings, scroll to find transcript/webhook configuration
2. The Grain webhook URL format is: `https://magnetlab.app/api/webhooks/grain/?secret=<SECRET>`
3. The secret is set in MagnetLab's environment (`GRAIN_WEBHOOK_SECRET`)

> **Note:** Grain uses a shared webhook secret (not per-user). The `user_id` must be included in the webhook payload by configuring Grain's webhook settings to send it.

### Step 2: Configure Grain

1. Log into the client's Grain account at [grain.com](https://grain.com)
2. Go to **Settings > Integrations** (or **Settings > API**)
3. Find the **Webhooks** section
4. Add a new webhook with:
   - **URL**: The MagnetLab Grain webhook URL
   - **Events**: Recording completed / Transcript ready
5. In the webhook payload configuration, make sure these fields are included:
   - `recording_id` (required)
   - `transcript` (required — full text)
   - `user_id` — set this to the client's MagnetLab user ID
   - `title`, `date`, `duration_minutes`, `participants` (optional but recommended)
6. Save

### Step 3: Test It

1. Record a test meeting through Grain
2. Wait for Grain to process (~5 minutes)
3. Check MagnetLab **Knowledge** for the transcript

### Troubleshooting Grain

| Problem | Solution |
|---------|----------|
| Webhook not firing | Check Grain's webhook logs for delivery status |
| 401 Unauthorized | The `?secret=` value doesn't match `GRAIN_WEBHOOK_SECRET` in MagnetLab's environment |
| Transcript missing in MagnetLab | Ensure the payload includes `transcript` field with full text |

---

## Fireflies Setup

### Step 1: Get the Webhook URL from MagnetLab

1. The Fireflies webhook URL format is: `https://magnetlab.app/api/webhooks/fireflies/?secret=<SECRET>`
2. The secret is set in MagnetLab's environment (`FIREFLIES_WEBHOOK_SECRET`)

### Step 2: Configure Fireflies

1. Log into the client's Fireflies account at [app.fireflies.ai](https://app.fireflies.ai)
2. Go to **Settings** (gear icon, top-right)
3. Click the **Developer settings** tab
4. In the **Webhooks** field, enter the MagnetLab Fireflies webhook URL
5. Save

> **Important:** Fireflies webhooks only send a notification with the `meetingId` — the full transcript is NOT included in the webhook payload. The current MagnetLab Fireflies handler expects the transcript in the body, so you may need an intermediary (like Zapier or Make) to:
> 1. Receive Fireflies' webhook notification
> 2. Fetch the full transcript via Fireflies GraphQL API
> 3. Forward the complete payload to MagnetLab's webhook

### Step 3: Test It

1. Record a test meeting with Fireflies enabled
2. Wait for processing (~5-10 minutes)
3. Check MagnetLab **Knowledge** for the transcript

### Troubleshooting Fireflies

| Problem | Solution |
|---------|----------|
| Webhook not triggering | Fireflies only fires webhooks for meeting organizers |
| 401 Unauthorized | Check the `?secret=` value matches `FIREFLIES_WEBHOOK_SECRET` |
| Transcript empty/missing | Fireflies webhook payload is minimal — an intermediary may be needed |

---

## General Troubleshooting

### Where to check if things aren't working

1. **MagnetLab Knowledge page** — if a transcript arrived, it shows up here
2. **MagnetLab Settings > Fathom** — check the webhook URL is still active (green "Connected" badge)
3. **The notetaker's webhook logs** — most platforms show delivery status (success/failure/retry)
4. **Vercel logs** — if you have access, check `https://vercel.com/[team]/magnetlab/logs` for webhook errors

### Common issues across all platforms

| Issue | Cause | Fix |
|-------|-------|-----|
| "This page isn't working" (500 error) | Webhook URL is wrong or integration is disconnected | Re-generate the webhook URL in MagnetLab Settings |
| Transcript shows up but isn't processed | Trigger.dev task may be failing | Check Trigger.dev dashboard for failed `process-transcript` runs |
| Duplicate transcripts | The notetaker sent the same webhook twice | No action needed — MagnetLab deduplicates automatically |
```

**Step 2: Commit**

```bash
git add docs/notetaker-setup-guide.md
git commit -m "docs: add notetaker onboarding setup guide for Fathom, Grain, Fireflies"
```

---

### Task 7: Run Full Test Suite + Build Check

**Step 1: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test 2>&1 | tail -30`

Expected: All tests pass, including the new Fathom webhook tests.

**Step 2: Type check**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck 2>&1 | tail -20`

Expected: No type errors.

**Step 3: Lint**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run lint 2>&1 | tail -20`

Expected: No lint errors in new/modified files.

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve test/lint issues from Fathom webhook migration"
```

---

### Task 8: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md` in magnetlab repo

**Step 1: Update the Content Pipeline section**

In the "Content Pipeline Tables" section, update the `cp_call_transcripts` source list from:
> `source: 'grain' | 'fireflies' | 'fathom' | 'paste'`

Add a note that Fathom is now webhook-based (not OAuth).

In the webhook routes section, add the Fathom webhook:
- `api/webhooks/fathom/[userId]/` — Fathom transcript webhook (per-user secret auth)

Remove any references to Fathom OAuth env vars (`FATHOM_CLIENT_ID`, `FATHOM_CLIENT_SECRET`, `FATHOM_REDIRECT_URI`).

Remove `sync-fathom-transcripts` from the Trigger.dev task list.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for Fathom webhook migration"
```
