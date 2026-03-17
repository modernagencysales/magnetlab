# Tool-as-Lead-Magnet System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create 13 magnetlab lead magnet funnels (one per bootcamp AI tool) that capture emails and deliver invite codes granting tool access.

**Architecture:** A Node.js automation script calls magnetlab APIs + writes invite codes to Supabase. Prerequisite code changes: (1) add Bearer token fallback to HMAC-only auth middleware, (2) add external email sequence endpoints, (3) add iClosed widget support to CalendlyEmbed. The script creates everything for all 13 tools in one run.

**Tech Stack:** TypeScript, Supabase JS client, magnetlab external APIs, Node.js script

---

## Task 1: Add Bearer Token Fallback to External Auth Middleware

**Files:**
- Modify: `src/lib/middleware/external-auth.ts`
- Test: `src/__tests__/lib/middleware/external-auth.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/lib/middleware/external-auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/auth/service-auth', () => ({
  verifyServiceSignature: vi.fn().mockReturnValue(true),
  isTimestampValid: vi.fn().mockReturnValue(true),
}));

const MOCK_API_KEY = 'test-external-api-key-12345';

describe('authenticateExternal', () => {
  beforeEach(() => {
    vi.stubEnv('EXTERNAL_API_KEY', MOCK_API_KEY);
  });

  it('should authenticate with valid Bearer token when HMAC headers are missing', async () => {
    const { authenticateExternal } = await import('@/lib/middleware/external-auth');
    const request = new Request('http://localhost/api/external/lead-magnets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MOCK_API_KEY}`,
        'x-gtm-user-id': 'user-123',
      },
    }) as any;
    // NextRequest mock
    request.headers = new Headers(request.headers);

    const result = await authenticateExternal(request);
    // Should return auth context, not a NextResponse error
    expect(result).not.toBeInstanceOf(Response);
    expect((result as any).userId).toBe('user-123');
  });

  it('should reject invalid Bearer token', async () => {
    const { authenticateExternal } = await import('@/lib/middleware/external-auth');
    const request = new Request('http://localhost/api/external/lead-magnets', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer wrong-key',
        'x-gtm-user-id': 'user-123',
      },
    }) as any;
    request.headers = new Headers(request.headers);

    const result = await authenticateExternal(request);
    expect(result).toBeInstanceOf(Response);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/lib/middleware/external-auth.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — Bearer token fallback not implemented yet.

**Step 3: Implement Bearer token fallback**

```typescript
// src/lib/middleware/external-auth.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyServiceSignature, isTimestampValid } from '@/lib/auth/service-auth'
import { timingSafeEqual } from 'crypto'

export interface ExternalAuthContext {
  userId: string
  serviceId: string
}

function authenticateBearer(request: NextRequest | Request): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false

  const token = authHeader.slice(7)
  const expectedKey = process.env.EXTERNAL_API_KEY
  if (!expectedKey) return false

  const tokenBuf = Buffer.from(token)
  const expectedBuf = Buffer.from(expectedKey)
  if (tokenBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(tokenBuf, expectedBuf)
}

export async function authenticateExternal(
  request: NextRequest
): Promise<ExternalAuthContext | NextResponse> {
  const signature = request.headers.get('x-gtm-signature')
  const timestamp = request.headers.get('x-gtm-timestamp')
  const userId = request.headers.get('x-gtm-user-id')
  const serviceId = request.headers.get('x-gtm-service-id')

  // If HMAC headers are missing, try Bearer token fallback
  if (!signature || !timestamp || !serviceId) {
    if (authenticateBearer(request) && userId) {
      return { userId, serviceId: 'bearer-token' }
    }
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 401 }
    )
  }

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing required headers' },
      { status: 401 }
    )
  }

  if (!isTimestampValid(timestamp)) {
    return NextResponse.json(
      { error: 'Request timestamp expired' },
      { status: 401 }
    )
  }

  const method = request.method
  const url = new URL(request.url)
  const fullPath = url.pathname
  const externalPrefix = '/api/external'
  const path = fullPath.startsWith(externalPrefix)
    ? fullPath.slice(externalPrefix.length)
    : fullPath

  const body = await request.text()

  if (!verifyServiceSignature(method, path, body, timestamp, signature)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  return { userId, serviceId }
}

export function withExternalAuth(
  handler: (request: NextRequest, context: ExternalAuthContext, body: unknown) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    const clonedRequest = request.clone()
    const authResult = await authenticateExternal(request)

    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await clonedRequest.json().catch(() => ({}))
    return handler(request, authResult, body)
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/lib/middleware/external-auth.test.ts --no-coverage 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/lib/middleware/external-auth.ts src/__tests__/lib/middleware/external-auth.test.ts
git commit -m "feat: add Bearer token fallback to external auth middleware

Allows external API routes that previously required HMAC signatures
to also accept Bearer token auth with EXTERNAL_API_KEY. Enables
automation scripts to call all external endpoints uniformly."
```

---

## Task 2: Add External Email Sequence Endpoints

**Files:**
- Create: `src/app/api/external/email-sequence/generate/route.ts`
- Create: `src/app/api/external/email-sequence/[leadMagnetId]/activate/route.ts`
- Test: `src/__tests__/api/external/email-sequence.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/api/external/email-sequence.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/external-auth', () => ({
  authenticateExternalRequest: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'lm-1', user_id: 'u-1', team_id: 't-1', title: 'Test', archetype: 'prompt', concept: null, extracted_content: null },
        error: null,
      }),
      upsert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}));

vi.mock('@/lib/ai/email-sequence-generator', () => ({
  generateEmailSequence: vi.fn().mockResolvedValue([
    { day: 0, subject: 'Welcome', body: 'Hello', replyTrigger: 'positive' },
  ]),
  generateDefaultEmailSequence: vi.fn().mockReturnValue([
    { day: 0, subject: 'Welcome', body: 'Hello', replyTrigger: 'positive' },
  ]),
}));

describe('External email sequence generate', () => {
  it('should require authentication', async () => {
    const { authenticateExternalRequest } = await import('@/lib/api/external-auth');
    (authenticateExternalRequest as any).mockReturnValueOnce(false);

    const { POST } = await import('@/app/api/external/email-sequence/generate/route');
    const response = await POST(new Request('http://localhost/api/external/email-sequence/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u-1', leadMagnetId: 'lm-1' }),
    }));

    expect(response.status).toBe(401);
  });

  it('should require userId and leadMagnetId', async () => {
    const { POST } = await import('@/app/api/external/email-sequence/generate/route');
    const response = await POST(new Request('http://localhost/api/external/email-sequence/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test',
      },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/api/external/email-sequence.test.ts --no-coverage 2>&1 | tail -20`
Expected: FAIL — route doesn't exist yet.

**Step 3: Create external email sequence generate route**

```typescript
// src/app/api/external/email-sequence/generate/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import type { EmailGenerationContext, EmailSequenceRow } from '@/lib/types/email';
import { emailSequenceFromRow } from '@/lib/types/email';

export async function POST(request: Request) {
  try {
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    const body = await request.json();
    const { userId, leadMagnetId } = body as { userId?: string; leadMagnetId?: string };

    if (!userId || !leadMagnetId) {
      return ApiErrors.validationError('userId and leadMagnetId are required');
    }

    const supabase = createSupabaseAdminClient();

    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, user_id, team_id, title, archetype, concept, extracted_content')
      .eq('id', leadMagnetId)
      .eq('user_id', userId)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
      .eq('user_id', userId)
      .single();

    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const senderName = brandKit?.sender_name || user?.name || 'Your Friend';
    const concept = leadMagnet.concept as { contents?: string; deliveryFormat?: string } | null;
    const extractedContent = leadMagnet.extracted_content as { title?: string; format?: string } | null;

    const context: EmailGenerationContext = {
      leadMagnetTitle: leadMagnet.title,
      leadMagnetFormat: extractedContent?.format || concept?.deliveryFormat || leadMagnet.archetype,
      leadMagnetContents: concept?.contents || extractedContent?.title || '',
      senderName,
      businessDescription: brandKit?.business_description || '',
      bestVideoUrl: brandKit?.best_video_url || undefined,
      bestVideoTitle: brandKit?.best_video_title || undefined,
      contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
      communityUrl: brandKit?.community_url || undefined,
      audienceStyle: 'casual-direct',
    };

    let emails;
    try {
      emails = await generateEmailSequence({ context });
    } catch (aiError) {
      logApiError('external/email-sequence/generate/ai', aiError, { leadMagnetId });
      emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
    }

    const { data: emailSequence, error: upsertError } = await supabase
      .from('email_sequences')
      .upsert(
        {
          lead_magnet_id: leadMagnetId,
          user_id: userId,
          team_id: leadMagnet.team_id || null,
          emails,
          status: 'draft',
        },
        { onConflict: 'lead_magnet_id' }
      )
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .single();

    if (upsertError || !emailSequence) {
      logApiError('external/email-sequence/generate/save', upsertError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to save email sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(emailSequence as EmailSequenceRow),
      generated: true,
    });
  } catch (error) {
    logApiError('external/email-sequence/generate', error);
    return ApiErrors.internalError('Failed to generate email sequence');
  }
}
```

**Step 4: Create external email sequence activate route**

```typescript
// src/app/api/external/email-sequence/[leadMagnetId]/activate/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { EmailSequenceRow } from '@/lib/types/email';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    const body = await request.json().catch(() => ({}));
    const { userId } = body as { userId?: string };
    const { leadMagnetId } = await params;

    if (!userId) {
      return ApiErrors.validationError('userId is required');
    }

    const supabase = createSupabaseAdminClient();

    const { data: sequenceData, error: seqError } = await supabase
      .from('email_sequences')
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .eq('lead_magnet_id', leadMagnetId)
      .eq('user_id', userId)
      .single();

    if (seqError || !sequenceData) {
      return ApiErrors.notFound('Email sequence');
    }

    const sequence = emailSequenceFromRow(sequenceData as EmailSequenceRow);

    if (!sequence.emails || sequence.emails.length === 0) {
      return ApiErrors.validationError('No emails in sequence. Generate emails first.');
    }

    const { data: updatedSequence, error: updateError } = await supabase
      .from('email_sequences')
      .update({ status: 'active' })
      .eq('id', sequence.id)
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .single();

    if (updateError) {
      logApiError('external/email-sequence/activate', updateError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to activate sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(updatedSequence as EmailSequenceRow),
      message: 'Email sequence activated.',
    });
  } catch (error) {
    logApiError('external/email-sequence/activate', error);
    return ApiErrors.internalError('Failed to activate email sequence');
  }
}
```

**Step 5: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/api/external/email-sequence.test.ts --no-coverage 2>&1 | tail -20`
Expected: PASS

**Step 6: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/app/api/external/email-sequence/ src/__tests__/api/external/email-sequence.test.ts
git commit -m "feat: add external email sequence generate + activate endpoints

Bearer-token authenticated endpoints for programmatic email sequence
management. Used by the tool-leadmagnet automation script."
```

---

## Task 3: Add iClosed Widget Support to CalendlyEmbed

**Files:**
- Modify: `src/components/funnel/public/CalendlyEmbed.tsx`
- Test: `src/__tests__/components/funnel/CalendlyEmbed.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/components/funnel/CalendlyEmbed.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendlyEmbed } from '@/components/funnel/public/CalendlyEmbed';

describe('CalendlyEmbed', () => {
  it('should render iClosed widget for iclosed.io URLs', () => {
    render(<CalendlyEmbed url="https://app.iclosed.io/e/timkeen/test" />);
    const widget = screen.getByTitle('Book a Call');
    expect(widget).toBeDefined();
    expect(widget.tagName).toBe('DIV');
    expect(widget.getAttribute('data-url')).toBe('https://app.iclosed.io/e/timkeen/test');
    expect(widget.className).toContain('iclosed-widget');
  });

  it('should render Cal.com iframe for cal.com URLs', () => {
    render(<CalendlyEmbed url="https://cal.com/someone/30min" />);
    const iframe = screen.getByTitle('Book a Call');
    expect(iframe.tagName).toBe('IFRAME');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/components/funnel/CalendlyEmbed.test.tsx --no-coverage 2>&1 | tail -20`
Expected: FAIL — iClosed not detected.

**Step 3: Add iClosed widget support**

```typescript
// src/components/funnel/public/CalendlyEmbed.tsx
'use client';

import { useEffect } from 'react';

interface CalendlyEmbedProps {
  url: string;
}

type EmbedType = 'calendly' | 'cal' | 'iclosed' | 'unknown';

function detectEmbedType(url: string): EmbedType {
  if (url.includes('calendly.com') || url.includes('calendly/')) {
    return 'calendly';
  }
  if (url.includes('cal.com') || url.includes('cal/')) {
    return 'cal';
  }
  if (url.includes('iclosed.io') || url.includes('iclosed.com')) {
    return 'iclosed';
  }
  return 'unknown';
}

function getCalEmbedUrl(url: string): string {
  let fullUrl = url;
  if (!url.startsWith('https://')) {
    fullUrl = `https://cal.com/${url}`;
  }
  const separator = fullUrl.includes('?') ? '&' : '?';
  return `${fullUrl}${separator}embed=true&theme=dark&hideEventTypeDetails=false`;
}

export function CalendlyEmbed({ url }: CalendlyEmbedProps) {
  const embedType = detectEmbedType(url);

  useEffect(() => {
    if (embedType === 'calendly') {
      const existingScript = document.querySelector('script[src="https://assets.calendly.com/assets/external/widget.js"]');
      if (existingScript) return;
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
    if (embedType === 'iclosed') {
      const existingScript = document.querySelector('script[src="https://app.iclosed.io/assets/widget.js"]');
      if (existingScript) return;
      const script = document.createElement('script');
      script.src = 'https://app.iclosed.io/assets/widget.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [embedType]);

  if (embedType === 'calendly') {
    const calendlyUrl = url.startsWith('https://') ? url : `https://calendly.com/${url}`;
    return (
      <div
        className="calendly-inline-widget rounded-xl overflow-hidden"
        data-url={`${calendlyUrl}?background_color=18181b&text_color=fafafa&primary_color=8b5cf6`}
        style={{
          minWidth: '320px',
          height: '630px',
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
        }}
      />
    );
  }

  if (embedType === 'iclosed') {
    const iClosedUrl = url.startsWith('https://') ? url : `https://app.iclosed.io/${url}`;
    return (
      <div
        className="iclosed-widget rounded-xl overflow-hidden"
        data-url={iClosedUrl}
        title="Book a Call"
        style={{
          width: '100%',
          height: '620px',
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
        }}
      />
    );
  }

  if (embedType === 'cal') {
    const embedUrl = getCalEmbedUrl(url);
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          minWidth: '320px',
          height: '700px',
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '12px',
        }}
      >
        <iframe
          src={embedUrl}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Book a Call"
          allow="camera; microphone; payment"
        />
      </div>
    );
  }

  // Fallback for unknown URL type
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        minWidth: '320px',
        height: '630px',
        background: '#18181B',
        border: '1px solid #27272A',
        borderRadius: '12px',
      }}
    >
      <iframe
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Booking Calendar"
      />
    </div>
  );
}
```

**Step 4: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx vitest run src/__tests__/components/funnel/CalendlyEmbed.test.tsx --no-coverage 2>&1 | tail -20`
Expected: PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/components/funnel/public/CalendlyEmbed.tsx src/__tests__/components/funnel/CalendlyEmbed.test.tsx
git commit -m "feat: add iClosed widget support to CalendlyEmbed

Detects iclosed.io URLs, loads the iClosed widget script, and renders
the widget div with data-url attribute. Works alongside existing
Calendly and Cal.com support."
```

---

## Task 4: Create the Automation Script

**Files:**
- Create: `scripts/generate-tool-leadmagnets.ts`

This is the main automation script. It's long but straightforward — it loops through all 13 tools and calls APIs for each.

**Step 1: Create the script**

```typescript
// scripts/generate-tool-leadmagnets.ts
//
// Usage: npx tsx scripts/generate-tool-leadmagnets.ts
//
// Prerequisites:
//   - magnetlab dev server running at localhost:3000
//   - .env.local has SUPABASE_SERVICE_ROLE_KEY and EXTERNAL_API_KEY
//
// What it does:
//   1. Creates a "Lead Magnet" cohort in bootcamp_cohorts
//   2. For each of 13 AI tools:
//      - Creates an invite code in bootcamp_invite_codes
//      - Creates a lead magnet in magnetlab
//      - Creates a funnel page
//      - Applies branding
//      - Generates qualification quiz
//      - Sets up thank-you page with iClosed booking
//      - Generates + activates email sequence
//      - Publishes the funnel
//   3. Outputs a summary table of all URLs + codes

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

// ============================================
// CONFIG
// ============================================

const SUPABASE_URL = 'https://qvawbxpijxlwdkolmjrs.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY!;
const MAGNETLAB_URL = process.env.MAGNETLAB_URL || 'http://localhost:3000';
const MAS_USER_ID = '0f634817-6db8-4a54-adfd-6ab143950b8c';
const ICLOSED_BOOKING_URL = 'https://app.iclosed.io/e/timkeen/test';
const REGISTRATION_BASE_URL = 'https://www.modernagencysales.com/bootcamp/register';

// Tool definitions — slug → human-readable lead magnet config
const TOOL_CONFIGS: Record<string, {
  title: string;
  code: string;
  slug: string;
  optinHeadline: string;
  optinSubline: string;
}> = {
  'offer-generator': {
    title: 'Free AI Offer Generator',
    code: 'OFFERGEN',
    slug: 'free-offer-generator',
    optinHeadline: 'Create Your Perfect Offer in Minutes',
    optinSubline: 'Use our AI-powered Offer Generator to craft an irresistible offer that attracts your ideal clients. Enter your email to get free access.',
  },
  'niche-finder': {
    title: 'Free AI Niche Finder',
    code: 'NICHEFIND',
    slug: 'free-niche-finder',
    optinHeadline: 'Discover Your Most Profitable Niche',
    optinSubline: 'Our AI Niche Finder analyzes your skills and market demand to identify the niche where you can win. Enter your email for free access.',
  },
  'lead-magnet-ideator': {
    title: 'Free Lead Magnet Ideator',
    code: 'LMIDEATE',
    slug: 'free-lead-magnet-ideator',
    optinHeadline: 'Generate Lead Magnet Ideas That Convert',
    optinSubline: 'Let AI brainstorm high-converting lead magnet concepts tailored to your expertise and audience. Enter your email to get started.',
  },
  'lead-magnet-creator': {
    title: 'Free Lead Magnet Creator',
    code: 'LMCREATE',
    slug: 'free-lead-magnet-creator',
    optinHeadline: 'Build Your Lead Magnet with AI',
    optinSubline: 'Turn your expertise into a polished lead magnet in minutes. Our AI handles the structure, copy, and design. Enter your email for free access.',
  },
  'lead-magnet-post-creator': {
    title: 'Free Lead Magnet Post Writer',
    code: 'LMPOST',
    slug: 'free-lead-magnet-post-writer',
    optinHeadline: 'Write LinkedIn Posts That Promote Your Lead Magnet',
    optinSubline: 'AI generates scroll-stopping LinkedIn posts to drive traffic to your lead magnet. Enter your email for free access.',
  },
  'lead-magnet-email': {
    title: 'Free Lead Magnet Email Writer',
    code: 'LMEMAIL',
    slug: 'free-lead-magnet-email-writer',
    optinHeadline: 'Write Your Lead Magnet Email Sequence with AI',
    optinSubline: 'Generate a complete 5-email nurture sequence that converts leads into conversations. Enter your email for free access.',
  },
  'ty-page-vsl': {
    title: 'Free Thank-You Page VSL Builder',
    code: 'TYVSL',
    slug: 'free-ty-page-vsl-builder',
    optinHeadline: 'Build a High-Converting Thank-You Page Script',
    optinSubline: 'AI creates a persuasive video sales letter script for your thank-you page that books more calls. Enter your email for free access.',
  },
  'profile-optimizer': {
    title: 'Free LinkedIn Profile Optimizer',
    code: 'PROFILE',
    slug: 'free-profile-optimizer',
    optinHeadline: 'Optimize Your LinkedIn Profile with AI',
    optinSubline: 'Get AI-powered recommendations to transform your LinkedIn profile into a client magnet. Enter your email for free access.',
  },
  'transcript-post-idea-grabber': {
    title: 'Free Transcript Idea Extractor',
    code: 'IDEAGRAB',
    slug: 'free-transcript-idea-extractor',
    optinHeadline: 'Turn Any Conversation Into LinkedIn Content',
    optinSubline: 'Paste a call transcript and let AI extract the best post ideas and insights. Enter your email for free access.',
  },
  'post-generator': {
    title: 'Free LinkedIn Post Generator',
    code: 'POSTGEN',
    slug: 'free-post-generator',
    optinHeadline: 'Generate LinkedIn Posts That Get Engagement',
    optinSubline: 'Create compelling LinkedIn posts in your voice with AI. Stop staring at a blank screen. Enter your email for free access.',
  },
  'post-finalizer': {
    title: 'Free LinkedIn Post Finalizer',
    code: 'POSTFINAL',
    slug: 'free-post-finalizer',
    optinHeadline: 'Polish Your LinkedIn Posts to Perfection',
    optinSubline: 'AI reviews and refines your draft posts for maximum impact and engagement. Enter your email for free access.',
  },
  'dm-chat-helper': {
    title: 'Free LinkedIn DM Script GPT',
    code: 'DMHELP',
    slug: 'free-dm-script-gpt',
    optinHeadline: 'Write LinkedIn DMs That Start Real Conversations',
    optinSubline: 'AI generates personalized DM scripts that feel natural and open doors. Enter your email for free access.',
  },
  'cold-email-mastermind': {
    title: 'Free Cold Email Mastermind',
    code: 'COLDEMAIL',
    slug: 'free-cold-email-mastermind',
    optinHeadline: 'Master Cold Email with AI',
    optinSubline: 'Get AI-powered guidance on cold email strategy, sequences, and copy that actually gets replies. Enter your email for free access.',
  },
};

// ============================================
// HELPERS
// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function callMagnetlab(method: string, path: string, body?: unknown) {
  const url = `${MAGNETLAB_URL}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EXTERNAL_API_KEY}`,
      'x-gtm-user-id': MAS_USER_ID,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(`${method} ${path} failed (${response.status}): ${JSON.stringify(error)}`);
  }

  return response.json();
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Tool-as-Lead-Magnet Generator');
  console.log('================================\n');

  // Validate env
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Set it in .env.local or export it.');
  }
  if (!EXTERNAL_API_KEY) {
    throw new Error('EXTERNAL_API_KEY is required. Set it in .env.local or export it.');
  }

  // Step 1: Create "Lead Magnet" cohort
  console.log('📋 Step 1: Creating "Lead Magnet" cohort...');
  const { data: existingCohort } = await supabase
    .from('bootcamp_cohorts')
    .select('id, name')
    .eq('name', 'Lead Magnet')
    .single();

  let cohortId: string;
  if (existingCohort) {
    cohortId = existingCohort.id;
    console.log(`   Using existing cohort: ${cohortId}`);
  } else {
    const { data: newCohort, error } = await supabase
      .from('bootcamp_cohorts')
      .insert({
        name: 'Lead Magnet',
        description: 'Cohort for tool-as-lead-magnet invite codes',
        status: 'Active',
      })
      .select('id')
      .single();
    if (error || !newCohort) throw new Error(`Failed to create cohort: ${error?.message}`);
    cohortId = newCohort.id;
    console.log(`   Created cohort: ${cohortId}`);
  }

  // Step 2: Fetch active AI tools
  console.log('\n🔧 Step 2: Fetching active AI tools...');
  const { data: tools, error: toolsError } = await supabase
    .from('ai_tools')
    .select('id, slug, name, description')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (toolsError || !tools) throw new Error(`Failed to fetch tools: ${toolsError?.message}`);
  console.log(`   Found ${tools.length} active tools`);

  // Filter to only tools we have configs for
  const matchedTools = tools.filter((t) => TOOL_CONFIGS[t.slug]);
  console.log(`   Matched ${matchedTools.length} tools with configs`);

  const results: Array<{
    tool: string;
    code: string;
    funnelUrl: string;
    registrationUrl: string;
  }> = [];

  // Step 3: Process each tool
  for (const tool of matchedTools) {
    const config = TOOL_CONFIGS[tool.slug];
    console.log(`\n🔨 Processing: ${config.title} (${tool.slug})`);

    try {
      // 3a: Create invite code
      console.log('   Creating invite code...');
      const { data: existingCode } = await supabase
        .from('bootcamp_invite_codes')
        .select('id, code')
        .eq('code', config.code)
        .single();

      let inviteCodeId: string;
      if (existingCode) {
        inviteCodeId = existingCode.id;
        console.log(`   ⚡ Code ${config.code} already exists, skipping`);
      } else {
        const { data: newCode, error: codeError } = await supabase
          .from('bootcamp_invite_codes')
          .insert({
            code: config.code,
            cohort_id: cohortId,
            status: 'Active',
            max_uses: 5000,
            use_count: 0,
            access_level: 'Lead Magnet',
            tool_grants: [{ toolSlug: tool.slug, credits: 10 }],
          })
          .select('id, code')
          .single();
        if (codeError) throw new Error(`Invite code: ${codeError.message}`);
        inviteCodeId = newCode!.id;
        console.log(`   ✅ Created invite code: ${config.code}`);
      }

      // 3b: Create lead magnet
      console.log('   Creating lead magnet...');
      const registrationUrl = `${REGISTRATION_BASE_URL}?code=${config.code}`;

      const lmResult = await callMagnetlab('POST', '/api/external/lead-magnets', {
        title: config.title,
        archetype: 'prompt',
        concept: {
          contents: `AI-powered ${tool.name}: ${tool.description || config.optinSubline}`,
          deliveryFormat: 'AI Tool Access',
        },
      });
      const leadMagnetId = lmResult.id;
      console.log(`   ✅ Lead magnet: ${leadMagnetId}`);

      // Set external URL to the registration link
      await supabase
        .from('lead_magnets')
        .update({ external_url: registrationUrl })
        .eq('id', leadMagnetId);

      await sleep(500);

      // 3c: Create funnel
      console.log('   Creating funnel...');
      const funnelResult = await callMagnetlab('POST', '/api/external/funnels', {
        leadMagnetId,
        slug: config.slug,
        optinHeadline: config.optinHeadline,
        optinSubline: config.optinSubline,
        optinButtonText: 'Get Free Access',
      });
      const funnelId = funnelResult.funnel.id;
      console.log(`   ✅ Funnel: ${funnelId}`);

      await sleep(500);

      // 3d: Apply branding
      console.log('   Applying branding...');
      await callMagnetlab('POST', '/api/external/apply-branding', {
        userId: MAS_USER_ID,
        funnelPageId: funnelId,
      });
      console.log('   ✅ Branding applied');

      await sleep(500);

      // 3e: Generate quiz
      console.log('   Generating qualification quiz...');
      await callMagnetlab('POST', '/api/external/generate-quiz', {
        userId: MAS_USER_ID,
        funnelPageId: funnelId,
      });
      console.log('   ✅ Quiz generated');

      await sleep(500);

      // 3f: Setup thank-you page with iClosed booking
      console.log('   Setting up thank-you page...');
      await callMagnetlab('POST', '/api/external/setup-thankyou', {
        userId: MAS_USER_ID,
        funnelPageId: funnelId,
        bookingUrl: ICLOSED_BOOKING_URL,
        resourceTitle: config.title,
      });

      // Set calendly_url to iClosed URL for embedded widget
      await supabase
        .from('funnel_pages')
        .update({ calendly_url: ICLOSED_BOOKING_URL })
        .eq('id', funnelId);

      console.log('   ✅ Thank-you page with iClosed booking');

      await sleep(500);

      // 3g: Generate email sequence
      console.log('   Generating email sequence...');
      const seqResult = await callMagnetlab('POST', '/api/external/email-sequence/generate', {
        userId: MAS_USER_ID,
        leadMagnetId,
      });
      console.log('   ✅ Email sequence generated');

      // 3h: Inject registration link into Day 0 email
      console.log('   Injecting registration link into emails...');
      const emails = seqResult.emailSequence.emails;
      if (emails && emails.length > 0) {
        // Add registration link to Day 0 email body
        const registrationBlock = `\n\n---\n\n**🔗 Get Your Free ${config.title} Access:**\n[Click here to activate your free tool access](${registrationUrl})\n\nYour personal code: **${config.code}**`;
        emails[0].body = emails[0].body + registrationBlock;

        // Also add link to Day 2 and Day 4 as reminders
        for (const email of emails) {
          if (email.day === 2 || email.day === 4) {
            email.body = email.body + `\n\n---\n\n**Haven't activated your free ${config.title} yet?**\n[Get access here](${registrationUrl}) — Code: **${config.code}**`;
          }
        }

        // Update sequence in DB
        await supabase
          .from('email_sequences')
          .update({ emails })
          .eq('lead_magnet_id', leadMagnetId);

        console.log('   ✅ Registration link injected');
      }

      await sleep(500);

      // 3i: Activate email sequence
      console.log('   Activating email sequence...');
      await callMagnetlab('POST', `/api/external/email-sequence/${leadMagnetId}/activate`, {
        userId: MAS_USER_ID,
      });
      console.log('   ✅ Email sequence activated');

      await sleep(500);

      // 3j: Publish funnel
      console.log('   Publishing funnel...');
      const publishResult = await callMagnetlab('POST', `/api/external/funnels/${funnelId}/publish`, {
        publish: true,
      });
      const funnelUrl = publishResult.publicUrl || `https://magnetlab.app/p/mas/${config.slug}`;
      console.log(`   ✅ Published: ${funnelUrl}`);

      results.push({
        tool: tool.slug,
        code: config.code,
        funnelUrl,
        registrationUrl,
      });

      console.log(`   ✅ DONE: ${config.title}`);

      // Pause between tools to avoid rate limits
      await sleep(2000);
    } catch (err) {
      console.error(`   ❌ FAILED: ${(err as Error).message}`);
      // Continue with next tool
    }
  }

  // Step 4: Summary
  console.log('\n\n========================================');
  console.log('📊 SUMMARY');
  console.log('========================================\n');
  console.log(`Total: ${results.length}/${matchedTools.length} tools processed\n`);
  console.log('| Tool | Code | Funnel URL | Registration URL |');
  console.log('|------|------|-----------|------------------|');
  for (const r of results) {
    console.log(`| ${r.tool} | ${r.code} | ${r.funnelUrl} | ${r.registrationUrl} |`);
  }
  console.log('\n✅ All done!');
}

main().catch((err) => {
  console.error('\n💥 Fatal error:', err.message);
  process.exit(1);
});
```

**Step 2: Run the script (dry run — verify it starts)**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsx scripts/generate-tool-leadmagnets.ts 2>&1 | head -10`
Expected: Script starts, connects to Supabase, begins processing. Will fail on API calls if magnetlab isn't running locally — that's OK for now.

**Step 3: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add scripts/generate-tool-leadmagnets.ts
git commit -m "feat: add automation script for tool-as-lead-magnet funnels

Creates 13 magnetlab funnels (one per bootcamp AI tool) with invite
codes, email sequences, qualification quizzes, and iClosed booking.
Run with: npx tsx scripts/generate-tool-leadmagnets.ts"
```

---

## Task 5: Run the Script and Verify

**Step 1: Start magnetlab dev server**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev &`
Wait for "Ready" message.

**Step 2: Load env vars and run script**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && source .env.local && npx tsx scripts/generate-tool-leadmagnets.ts`
Expected: Script processes all 13 tools, outputs summary table.

**Step 3: Verify invite codes in bootcamp admin**

Check: Navigate to `https://www.modernagencysales.com/admin/courses/invite-codes`
Expected: 13 new codes (OFFERGEN, NICHEFIND, etc.) all Active under "Lead Magnet" cohort.

**Step 4: Verify funnels are live**

Check: Visit `https://magnetlab.app/p/mas/free-post-generator` (or other slugs)
Expected: Opt-in page with MAS branding, headline, subline, email capture form.

**Step 5: Test the full flow**

Test: Submit email on one funnel → verify thank-you page shows quiz + iClosed booking → check email arrives with registration link → register with code → verify 10 credits granted.

**Step 6: Commit any fixes**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add -A
git commit -m "fix: post-run adjustments from tool-leadmagnet generation"
```

---

## Task 6: Deploy

**Step 1: Deploy magnetlab to Vercel**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod`

Note: The script creates data in the shared Supabase database, so funnels will be live immediately after deploy. The CalendlyEmbed iClosed support and external email sequence routes need to be deployed for the funnels to work fully on production.

**Step 2: Deploy Trigger.dev tasks (if email sequence tasks changed)**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy`

**Step 3: Re-run script against production**

If script was run locally, re-run against production magnetlab:

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && MAGNETLAB_URL=https://magnetlab.app npx tsx scripts/generate-tool-leadmagnets.ts`

The script is idempotent — it skips existing invite codes and handles slug collisions.

---

## Summary of All Changes

| Area | What Changes |
|------|-------------|
| `src/lib/middleware/external-auth.ts` | Bearer token fallback for HMAC-only routes |
| `src/app/api/external/email-sequence/generate/route.ts` | New endpoint |
| `src/app/api/external/email-sequence/[leadMagnetId]/activate/route.ts` | New endpoint |
| `src/components/funnel/public/CalendlyEmbed.tsx` | iClosed widget support |
| `scripts/generate-tool-leadmagnets.ts` | Automation script |
| Supabase: `bootcamp_cohorts` | New "Lead Magnet" cohort |
| Supabase: `bootcamp_invite_codes` | 13 new invite codes |
| Supabase: `lead_magnets` | 13 new lead magnets |
| Supabase: `funnel_pages` + sections | 13 new funnels with branding |
| Supabase: `email_sequences` | 13 new active email sequences |
| Supabase: `qualification_forms` + questions | 13 new quizzes |
