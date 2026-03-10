# LinkedIn Studio Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the basic PostPreview and textarea editor with a pixel-perfect LinkedIn preview, side-by-side rich text editor, Hook Only mode with AI scoring, and A/B hook variant generation.

**Architecture:** The PostDetailModal gets a complete layout overhaul — from single-column modal to a split-pane editor (TipTap left, LinkedIn preview right). A new `LinkedInPreview` component renders posts exactly as LinkedIn does. Hook scoring and variant generation get new API routes backed by Claude AI modules.

**Tech Stack:** TipTap v3 (already installed), Tailwind CSS, Claude Sonnet (hook scoring), React state management, existing content-pipeline API patterns.

---

### Task 1: Create LinkedInPreview Component

**Files:**
- Create: `src/components/content-pipeline/LinkedInPreview.tsx`
- Test: `src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx
import { render, screen } from '@testing-library/react';
import { LinkedInPreview } from '@/components/content-pipeline/LinkedInPreview';

describe('LinkedInPreview', () => {
  const defaultProps = {
    content: 'I spent $12,000 on link building tools last year.\n\nMost of it was wasted.\n\nHere\'s why: every tool promises thousands of prospects.',
    authorName: 'Tim Smith',
    authorHeadline: 'Founder at MAS',
    authorAvatarUrl: null as string | null,
  };

  it('renders author name and headline', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText('Tim Smith')).toBeInTheDocument();
    expect(screen.getByText('Founder at MAS')).toBeInTheDocument();
  });

  it('renders post content', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText(/I spent \$12,000/)).toBeInTheDocument();
  });

  it('renders "...more" when content exceeds truncation threshold', () => {
    const longContent = Array(20).fill('This is a line of content that takes up space.').join('\n');
    render(<LinkedInPreview {...defaultProps} content={longContent} />);
    expect(screen.getByText('...more')).toBeInTheDocument();
  });

  it('does not render "...more" for short content', () => {
    render(<LinkedInPreview {...defaultProps} content="Short post." />);
    expect(screen.queryByText('...more')).not.toBeInTheDocument();
  });

  it('renders initials when no avatar URL provided', () => {
    render(<LinkedInPreview {...defaultProps} authorAvatarUrl={null} />);
    expect(screen.getByText('TS')).toBeInTheDocument();
  });

  it('renders avatar image when URL provided', () => {
    render(<LinkedInPreview {...defaultProps} authorAvatarUrl="https://example.com/avatar.jpg" />);
    expect(screen.getByAltText('Tim Smith')).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('applies desktop device mode by default', () => {
    const { container } = render(<LinkedInPreview {...defaultProps} />);
    // Desktop width is 540px
    expect(container.querySelector('[data-device="desktop"]')).toBeInTheDocument();
  });

  it('applies mobile device mode', () => {
    const { container } = render(<LinkedInPreview {...defaultProps} device="mobile" />);
    expect(container.querySelector('[data-device="mobile"]')).toBeInTheDocument();
  });

  it('renders engagement bar with like, comment, repost, send', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText('Like')).toBeInTheDocument();
    expect(screen.getByText('Comment')).toBeInTheDocument();
    expect(screen.getByText('Repost')).toBeInTheDocument();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('renders "Just now" timestamp', () => {
    render(<LinkedInPreview {...defaultProps} />);
    expect(screen.getByText(/Just now/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the LinkedInPreview component**

```tsx
// src/components/content-pipeline/LinkedInPreview.tsx
'use client';

import { useMemo } from 'react';
import { ThumbsUp, MessageCircle, Repeat2, Send, Globe } from 'lucide-react';

// LinkedIn truncation constants (approximate character-based)
const DESKTOP_MAX_LINES = 5;
const MOBILE_MAX_LINES = 3;
const CHARS_PER_LINE_DESKTOP = 60;
const CHARS_PER_LINE_MOBILE = 40;

export type DeviceMode = 'desktop' | 'mobile' | 'tablet';

interface LinkedInPreviewProps {
  content: string;
  authorName: string;
  authorHeadline: string;
  authorAvatarUrl: string | null;
  device?: DeviceMode;
  hookOnly?: boolean;
  imageUrl?: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function shouldTruncate(content: string, device: DeviceMode): boolean {
  const lines = content.split('\n');
  const maxLines = device === 'mobile' ? MOBILE_MAX_LINES : DESKTOP_MAX_LINES;

  if (lines.length > maxLines) return true;

  const charsPerLine = device === 'mobile' ? CHARS_PER_LINE_MOBILE : CHARS_PER_LINE_DESKTOP;
  let visualLines = 0;
  for (const line of lines) {
    visualLines += Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
    if (visualLines > maxLines) return true;
  }
  return false;
}

function getTruncatedContent(content: string, device: DeviceMode): string {
  const maxLines = device === 'mobile' ? MOBILE_MAX_LINES : DESKTOP_MAX_LINES;
  const charsPerLine = device === 'mobile' ? CHARS_PER_LINE_MOBILE : CHARS_PER_LINE_DESKTOP;
  const lines = content.split('\n');
  const result: string[] = [];
  let visualLines = 0;

  for (const line of lines) {
    const lineVisualCount = Math.max(1, Math.ceil((line.length || 1) / charsPerLine));
    if (visualLines + lineVisualCount > maxLines) {
      // Truncate this line to fit
      const remaining = maxLines - visualLines;
      const maxChars = remaining * charsPerLine;
      result.push(line.slice(0, maxChars));
      break;
    }
    result.push(line);
    visualLines += lineVisualCount;
    if (visualLines >= maxLines) break;
  }

  return result.join('\n');
}

const deviceWidths: Record<DeviceMode, number> = {
  desktop: 540,
  tablet: 440,
  mobile: 340,
};

export function LinkedInPreview({
  content,
  authorName,
  authorHeadline,
  authorAvatarUrl,
  device = 'desktop',
  hookOnly = false,
  imageUrl,
}: LinkedInPreviewProps) {
  const truncated = useMemo(() => shouldTruncate(content, device), [content, device]);
  const visibleContent = useMemo(
    () => (truncated && !hookOnly) ? getTruncatedContent(content, device) : content,
    [content, device, truncated, hookOnly],
  );
  const hookContent = useMemo(
    () => getTruncatedContent(content, device),
    [content, device],
  );

  const width = deviceWidths[device];

  // Render markdown bold/italic inline
  function renderContent(text: string) {
    return text.split('\n').map((line, i) => {
      if (!line) return <br key={i} />;
      // Process **bold** and *italic*
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
      return (
        <p key={i} style={{ margin: 0, padding: 0 }}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
              return <em key={j}>{part.slice(1, -1)}</em>;
            }
            return <span key={j}>{part}</span>;
          })}
        </p>
      );
    });
  }

  return (
    <div
      data-device={device}
      className="mx-auto overflow-hidden rounded-lg border border-[#e0e0e0] bg-white"
      style={{
        maxWidth: width,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
      }}
    >
      {/* Author Header */}
      <div className="flex items-start gap-2 px-4 pt-3 pb-2">
        {/* Avatar */}
        {authorAvatarUrl ? (
          <img
            src={authorAvatarUrl}
            alt={authorName}
            className="h-12 w-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a66c2] text-sm font-semibold text-white flex-shrink-0">
            {getInitials(authorName)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#000000e6] leading-tight truncate">
            {authorName}
          </p>
          <p className="text-xs text-[#00000099] leading-tight truncate mt-0.5">
            {authorHeadline}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-[#00000099]">Just now</span>
            <span className="text-xs text-[#00000099]">·</span>
            <Globe className="h-3 w-3 text-[#00000099]" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <div
          className="text-sm text-[#000000e6] leading-[1.43]"
          style={{ fontSize: '14px', wordBreak: 'break-word' }}
        >
          {hookOnly ? (
            <>
              {renderContent(hookContent)}
              {truncated && (
                <span className="text-[#00000099]">...more</span>
              )}
              {/* Dimmed rest of content */}
              {content !== hookContent && (
                <div className="mt-1 opacity-30 border-t border-dashed border-gray-300 pt-1">
                  {renderContent(content.slice(hookContent.length).replace(/^\n/, ''))}
                </div>
              )}
            </>
          ) : (
            <>
              {renderContent(visibleContent)}
              {truncated && (
                <span className="text-[#00000099] cursor-pointer">...more</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Image attachment */}
      {imageUrl && (
        <div className="border-t border-[#e0e0e0]">
          <img src={imageUrl} alt="" className="w-full object-cover" style={{ maxHeight: 350 }} />
        </div>
      )}

      {/* Engagement counts (static placeholder) */}
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-[#00000099]">
        <div className="flex items-center gap-0.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#378fe9] text-[8px] text-white">👍</span>
          <span className="ml-1">0</span>
        </div>
        <span>0 comments</span>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-[#e0e0e0]" />

      {/* Action Bar */}
      <div className="flex items-center justify-around px-2 py-1">
        {[
          { icon: ThumbsUp, label: 'Like' },
          { icon: MessageCircle, label: 'Comment' },
          { icon: Repeat2, label: 'Repost' },
          { icon: Send, label: 'Send' },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded py-2.5 text-xs font-semibold text-[#00000099] hover:bg-[#00000008] transition-colors"
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
git add src/components/content-pipeline/LinkedInPreview.tsx src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx
git commit -m "feat: add pixel-perfect LinkedInPreview component with device modes and truncation"
```

---

### Task 2: Create DeviceToggle Component

**Files:**
- Create: `src/components/content-pipeline/DeviceToggle.tsx`

**Step 1: Write the component**

```tsx
// src/components/content-pipeline/DeviceToggle.tsx
'use client';

import { Monitor, Smartphone, Tablet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceMode } from './LinkedInPreview';

interface DeviceToggleProps {
  device: DeviceMode;
  onChange: (device: DeviceMode) => void;
}

const devices: { mode: DeviceMode; icon: typeof Monitor; label: string }[] = [
  { mode: 'desktop', icon: Monitor, label: 'Desktop' },
  { mode: 'tablet', icon: Tablet, label: 'Tablet' },
  { mode: 'mobile', icon: Smartphone, label: 'Mobile' },
];

export function DeviceToggle({ device, onChange }: DeviceToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5">
      {devices.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
            device === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          {device === mode && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content-pipeline/DeviceToggle.tsx
git commit -m "feat: add DeviceToggle component for desktop/tablet/mobile preview switching"
```

---

### Task 3: Create HookOnlyToggle Component

**Files:**
- Create: `src/components/content-pipeline/HookOnlyToggle.tsx`

**Step 1: Write the component**

```tsx
// src/components/content-pipeline/HookOnlyToggle.tsx
'use client';

import { cn } from '@/lib/utils';

interface HookOnlyToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function HookOnlyToggle({ enabled, onChange }: HookOnlyToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'rounded-lg px-3 py-1 text-xs font-medium transition-colors border',
        enabled
          ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
          : 'border-border text-muted-foreground hover:bg-muted'
      )}
    >
      Hook Only
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content-pipeline/HookOnlyToggle.tsx
git commit -m "feat: add HookOnlyToggle component"
```

---

### Task 4: Create Hook Scorer AI Module + API Route

**Files:**
- Create: `src/lib/ai/content-pipeline/hook-scorer.ts`
- Create: `src/app/api/content-pipeline/posts/[id]/hook-score/route.ts`
- Test: `src/__tests__/api/content-pipeline/hook-score.test.ts`

**Step 1: Write the failing test**

```ts
// src/__tests__/api/content-pipeline/hook-score.test.ts
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'post-1', final_content: 'I spent $12,000 on tools.\n\nMost of it was wasted.\n\nHere is why.' },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));
jest.mock('@/lib/ai/content-pipeline/hook-scorer', () => ({
  scoreHook: jest.fn().mockResolvedValue({
    score: 8,
    breakdown: {
      curiosity_gap: 9,
      power_words: 7,
      pattern_interrupt: 8,
      specificity: 9,
    },
    suggestions: ['Strong opening with specific number', 'Consider adding tension word'],
  }),
}));

import { getServerSession } from '@/lib/auth';

describe('POST /api/content-pipeline/posts/[id]/hook-score', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { POST } = await import('@/app/api/content-pipeline/posts/[id]/hook-score/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/posts/post-1/hook-score', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'post-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns hook score with breakdown and suggestions', async () => {
    const { POST } = await import('@/app/api/content-pipeline/posts/[id]/hook-score/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/posts/post-1/hook-score', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'post-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.score).toBe(8);
    expect(data.breakdown).toBeDefined();
    expect(data.suggestions).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/hook-score.test.ts`
Expected: FAIL — module not found

**Step 3: Write the hook scorer AI module**

```ts
// src/lib/ai/content-pipeline/hook-scorer.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface HookScoreResult {
  score: number; // 1-10
  breakdown: {
    curiosity_gap: number;
    power_words: number;
    pattern_interrupt: number;
    specificity: number;
  };
  suggestions: string[];
}

export async function scoreHook(content: string): Promise<HookScoreResult> {
  // Extract the hook (first 5 lines or before the truncation point)
  const lines = content.split('\n');
  const hook = lines.slice(0, 5).join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `Rate this LinkedIn post hook on a scale of 1-10. The hook is the first few lines that appear before "...see more" on LinkedIn.

HOOK:
"""
${hook}
"""

FULL POST (for context):
"""
${content}
"""

Rate each dimension 1-10:
1. curiosity_gap - Does it create an information gap that makes you want to click "see more"?
2. power_words - Does it use compelling, specific language (numbers, contrasts, emotional words)?
3. pattern_interrupt - Does it break the reader's scroll with something unexpected?
4. specificity - Does it use concrete details rather than vague statements?

Then give an overall score (1-10) and 2-3 specific improvement suggestions.

Respond in this exact JSON format only, no other text:
{"score":N,"breakdown":{"curiosity_gap":N,"power_words":N,"pattern_interrupt":N,"specificity":N},"suggestions":["suggestion 1","suggestion 2"]}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]) as HookScoreResult;
  } catch {
    // Fallback
    return {
      score: 5,
      breakdown: { curiosity_gap: 5, power_words: 5, pattern_interrupt: 5, specificity: 5 },
      suggestions: ['Could not analyze hook — try rephrasing for clarity'],
    };
  }
}
```

**Step 4: Write the API route**

```ts
// src/app/api/content-pipeline/posts/[id]/hook-score/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { scoreHook } from '@/lib/ai/content-pipeline/hook-scorer';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, final_content, draft_content')
    .eq('id', id)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const content = post.final_content || post.draft_content;
  if (!content) {
    return NextResponse.json({ error: 'Post has no content' }, { status: 400 });
  }

  const result = await scoreHook(content);

  // Save score to post
  await supabase
    .from('cp_pipeline_posts')
    .update({ hook_score: result.score })
    .eq('id', id);

  return NextResponse.json(result);
}
```

**Step 5: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/hook-score.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/ai/content-pipeline/hook-scorer.ts src/app/api/content-pipeline/posts/\[id\]/hook-score/route.ts src/__tests__/api/content-pipeline/hook-score.test.ts
git commit -m "feat: add hook scorer AI module and API route"
```

---

### Task 5: Create Hook Variants AI Module + API Route

**Files:**
- Create: `src/lib/ai/content-pipeline/hook-generator.ts`
- Create: `src/app/api/content-pipeline/posts/[id]/hook-variants/route.ts`
- Test: `src/__tests__/api/content-pipeline/hook-variants.test.ts`

**Step 1: Write the failing test**

```ts
// src/__tests__/api/content-pipeline/hook-variants.test.ts
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'post-1',
              final_content: 'I spent $12,000 on tools.\n\nMost of it was wasted.\n\nHere is the breakdown.',
            },
            error: null,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));
jest.mock('@/lib/ai/content-pipeline/hook-generator', () => ({
  generateHookVariants: jest.fn().mockResolvedValue([
    { hook_type: 'question', content: 'What if everything you knew about link building was wrong?\n\nI spent $12,000 to find out.\n\nHere is the breakdown.' },
    { hook_type: 'story', content: 'Last year I made the most expensive mistake of my career.\n\n$12,000 gone. On tools that didn\'t work.\n\nHere is the breakdown.' },
    { hook_type: 'statistic', content: '97% of link building tools are a waste of money.\n\nI spent $12,000 proving it.\n\nHere is the breakdown.' },
  ]),
}));

import { getServerSession } from '@/lib/auth';

describe('POST /api/content-pipeline/posts/[id]/hook-variants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
  });

  it('returns 401 when not authenticated', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const { POST } = await import('@/app/api/content-pipeline/posts/[id]/hook-variants/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/posts/post-1/hook-variants', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'post-1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 3 hook variants', async () => {
    const { POST } = await import('@/app/api/content-pipeline/posts/[id]/hook-variants/route');
    const req = new NextRequest('http://localhost/api/content-pipeline/posts/post-1/hook-variants', { method: 'POST' });
    const res = await POST(req, { params: Promise.resolve({ id: 'post-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.variants).toHaveLength(3);
    expect(data.variants[0]).toHaveProperty('hook_type');
    expect(data.variants[0]).toHaveProperty('content');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/hook-variants.test.ts`
Expected: FAIL — module not found

**Step 3: Write the hook generator AI module**

```ts
// src/lib/ai/content-pipeline/hook-generator.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface HookVariant {
  hook_type: string;
  content: string;
}

export async function generateHookVariants(content: string): Promise<HookVariant[]> {
  // Split into hook (first 5 lines) and body (rest)
  const lines = content.split('\n');
  const hookLines = lines.slice(0, 5);
  const bodyLines = lines.slice(5);
  const body = bodyLines.join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Generate 3 alternative hooks for this LinkedIn post. Keep the post body the same — only rewrite the opening hook (first 3-5 lines before "...see more").

CURRENT HOOK:
"""
${hookLines.join('\n')}
"""

POST BODY (keep this unchanged):
"""
${body}
"""

Each hook variant should use a different approach:
1. A question-based hook (start with a provocative question)
2. A story-based hook (start with a personal moment/scene)
3. A statistic/data hook (start with a surprising number or fact)

For each variant, give the COMPLETE post (new hook + original body joined together).

Respond in this exact JSON format only, no other text:
[{"hook_type":"question","content":"full post with new hook"},{"hook_type":"story","content":"full post with new hook"},{"hook_type":"statistic","content":"full post with new hook"}]`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    return JSON.parse(jsonMatch[0]) as HookVariant[];
  } catch {
    return [];
  }
}
```

**Step 4: Write the API route**

```ts
// src/app/api/content-pipeline/posts/[id]/hook-variants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { generateHookVariants } from '@/lib/ai/content-pipeline/hook-generator';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('cp_pipeline_posts')
    .select('id, final_content, draft_content, variations')
    .eq('id', id)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  const content = post.final_content || post.draft_content;
  if (!content) {
    return NextResponse.json({ error: 'Post has no content' }, { status: 400 });
  }

  const variants = await generateHookVariants(content);

  // Save variants to post
  const postVariations = variants.map((v, i) => ({
    id: `hook-variant-${i}-${Date.now()}`,
    content: v.content,
    hook_type: v.hook_type,
    selected: false,
  }));

  await supabase
    .from('cp_pipeline_posts')
    .update({ variations: postVariations })
    .eq('id', id);

  return NextResponse.json({ variants: postVariations });
}
```

**Step 5: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/api/content-pipeline/hook-variants.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/ai/content-pipeline/hook-generator.ts src/app/api/content-pipeline/posts/\[id\]/hook-variants/route.ts src/__tests__/api/content-pipeline/hook-variants.test.ts
git commit -m "feat: add hook variant generator AI module and API route"
```

---

### Task 6: Create HookScorePanel Component

**Files:**
- Create: `src/components/content-pipeline/HookScorePanel.tsx`

**Step 1: Write the component**

This component displays the hook score breakdown and suggestions, and has a button to generate hook variants.

```tsx
// src/components/content-pipeline/HookScorePanel.tsx
'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HookScoreBreakdown {
  curiosity_gap: number;
  power_words: number;
  pattern_interrupt: number;
  specificity: number;
}

interface HookScoreData {
  score: number;
  breakdown: HookScoreBreakdown;
  suggestions: string[];
}

interface HookScorePanelProps {
  postId: string;
  initialScore: number | null;
  onVariantsGenerated: () => void;
}

const dimensionLabels: Record<keyof HookScoreBreakdown, string> = {
  curiosity_gap: 'Curiosity Gap',
  power_words: 'Power Words',
  pattern_interrupt: 'Pattern Interrupt',
  specificity: 'Specificity',
};

function ScoreBar({ score, label }: { score: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-muted-foreground truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="w-6 text-xs text-right font-medium">{score}</span>
    </div>
  );
}

export function HookScorePanel({ postId, initialScore, onVariantsGenerated }: HookScorePanelProps) {
  const [scoreData, setScoreData] = useState<HookScoreData | null>(null);
  const [scoring, setScoring] = useState(false);
  const [generatingVariants, setGeneratingVariants] = useState(false);

  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${postId}/hook-score`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScoreData(data);
      }
    } catch { /* silent */ } finally {
      setScoring(false);
    }
  };

  const handleGenerateVariants = async () => {
    setGeneratingVariants(true);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${postId}/hook-variants`, { method: 'POST' });
      if (res.ok) {
        onVariantsGenerated();
      }
    } catch { /* silent */ } finally {
      setGeneratingVariants(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Hook Analysis</h4>
        <button
          type="button"
          onClick={handleScore}
          disabled={scoring}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {scoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {scoreData ? 'Re-score' : 'Score Hook'}
        </button>
      </div>

      {/* Score display */}
      {(scoreData || initialScore !== null) && (
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
            (scoreData?.score ?? initialScore ?? 0) >= 8 ? 'bg-green-100 text-green-700' :
            (scoreData?.score ?? initialScore ?? 0) >= 5 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          )}>
            {scoreData?.score ?? initialScore}/10
          </div>
          {scoreData && (
            <div className="flex-1 space-y-1.5">
              {(Object.entries(scoreData.breakdown) as [keyof HookScoreBreakdown, number][]).map(([key, value]) => (
                <ScoreBar key={key} score={value} label={dimensionLabels[key]} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggestions */}
      {scoreData?.suggestions && scoreData.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Suggestions</p>
          {scoreData.suggestions.map((s, i) => (
            <p key={i} className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/20">{s}</p>
          ))}
        </div>
      )}

      {/* Generate variants button */}
      <button
        type="button"
        onClick={handleGenerateVariants}
        disabled={generatingVariants}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border w-full justify-center px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
      >
        {generatingVariants ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
        {generatingVariants ? 'Generating 3 variants...' : 'Generate 3 Hook Variants'}
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/content-pipeline/HookScorePanel.tsx
git commit -m "feat: add HookScorePanel component with score breakdown and variant generation"
```

---

### Task 7: Enhance TipTap Editor with Strikethrough, Emoji, and Character Count

**Files:**
- Modify: `src/components/content/inline-editor/TipTapTextBlock.tsx`
- Modify: `src/lib/utils/tiptap-serializer.ts`

**Step 1: Install missing TipTap extensions**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm install @tiptap/extension-strike @tiptap/extension-character-count`

**Step 2: Update the serializer to support strikethrough**

Add ~~strikethrough~~ support to the serializer.

In `src/lib/utils/tiptap-serializer.ts`:

- Add `'strike'` to the `TiptapMark.type` union
- Update `INLINE_REGEX` to match `~~text~~`
- Update `parseInlineMarks()` to parse strikethrough
- Update `serializeTextNode()` to output `~~text~~`

**Exact changes to `tiptap-serializer.ts`:**

Replace `TiptapMark` type:
```ts
export interface TiptapMark {
  type: 'bold' | 'italic' | 'link' | 'strike';
  attrs?: { href: string; target: string };
}
```

Replace `INLINE_REGEX`:
```ts
const INLINE_REGEX = /(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
```

Update `parseInlineMarks()` — add strikethrough match group (match[2] becomes strikethrough, italic shifts to match[3], link to match[4]):
```ts
function parseInlineMarks(line: string): TiptapTextNode[] {
  const nodes: TiptapTextNode[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(INLINE_REGEX)) {
    const matchStart = match.index!;

    if (matchStart > lastIndex) {
      nodes.push({ type: 'text', text: line.slice(lastIndex, matchStart) });
    }

    const [full] = match;

    if (match[1]) {
      // Bold: **text**
      nodes.push({
        type: 'text',
        text: full.slice(2, -2),
        marks: [{ type: 'bold' }],
      });
    } else if (match[2]) {
      // Strikethrough: ~~text~~
      nodes.push({
        type: 'text',
        text: full.slice(2, -2),
        marks: [{ type: 'strike' }],
      });
    } else if (match[3]) {
      // Italic: *text*
      nodes.push({
        type: 'text',
        text: full.slice(1, -1),
        marks: [{ type: 'italic' }],
      });
    } else if (match[4]) {
      // Link: [text](url)
      const linkMatch = full.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push({
          type: 'text',
          text: linkMatch[1],
          marks: [{ type: 'link', attrs: { href: linkMatch[2], target: '_blank' } }],
        });
      }
    }

    lastIndex = matchStart + full.length;
  }

  if (lastIndex < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIndex) });
  }

  return nodes;
}
```

Update `serializeTextNode()` — add strike case:
```ts
case 'strike':
  result = `~~${result}~~`;
  break;
```

**Step 3: Update TipTapTextBlock — add Strike extension, enhance bubble menu**

In `src/components/content/inline-editor/TipTapTextBlock.tsx`:

Add imports:
```ts
import Strike from '@tiptap/extension-strike';
import CharacterCount from '@tiptap/extension-character-count';
import { Bold, Italic, Strikethrough, Link as LinkIcon, Unlink } from 'lucide-react';
```

Add extensions to the editor config (after Link, before Placeholder):
```ts
Strike,
CharacterCount,
```

Add strikethrough button to `BubbleToolbar` (after Italic button, before the separator div):
```tsx
<button
  type="button"
  onMouseDown={(e) => {
    e.preventDefault();
    editor.chain().focus().toggleStrike().run();
  }}
  className={`rounded p-1.5 transition-colors ${
    editor.isActive('strike')
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700'
  }`}
  aria-label="Strikethrough"
  title="Strikethrough"
>
  <Strikethrough className="h-4 w-4" />
</button>
```

Add `onCharacterCount` prop and emit character count:
```ts
// Add to TipTapTextBlockProps:
onCharacterCount?: (count: number) => void;

// In the onUpdate handler, after the onChange call:
if (onCharacterCountRef.current) {
  onCharacterCountRef.current(updatedEditor.storage.characterCount.characters());
}
```

**Step 4: Run existing tests + verify**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/`
Expected: All existing tests pass

**Step 5: Commit**

```bash
git add src/components/content/inline-editor/TipTapTextBlock.tsx src/lib/utils/tiptap-serializer.ts package.json package-lock.json
git commit -m "feat: add strikethrough formatting and character count to TipTap editor"
```

---

### Task 8: Rewrite PostDetailModal with Split-Pane Layout

This is the big one. We replace the current single-column modal with a split-pane layout: TipTap editor on the left, LinkedInPreview on the right.

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx`

**Step 1: Plan the new layout**

The new modal layout:
```
┌──────────────────────────────────────────────────────┐
│ Post Details                        [Device] [Close] │
├────────────────────────┬─────────────────────────────┤
│                        │                             │
│  TipTap Rich Editor    │   LinkedIn Preview          │
│  (live editing)        │   (real-time, pixel-perfect)│
│                        │                             │
│                        │   [Hook Only]               │
│                        │                             │
│  Char count: 1,234     │   [Hook Score Panel]        │
│                        │                             │
├────────────────────────┴─────────────────────────────┤
│  [Variations tabs]                                   │
│  [Templates] [Polish] [Copy] [Schedule] [Publish]    │
│  [DM template] [Polish notes]                        │
│  [Engagement section] (if published)                 │
│  [Automation section] (if published)                 │
└──────────────────────────────────────────────────────┘
```

**Step 2: Rewrite PostDetailModal**

Key changes from the current implementation:
1. Replace `<PostPreview>` + textarea toggle with side-by-side TipTap + LinkedInPreview
2. TipTap is always in edit mode (no toggle needed)
3. LinkedInPreview updates in real-time from editor content
4. Add DeviceToggle, HookOnlyToggle, HookScorePanel
5. Fetch team profile data for LinkedIn preview (avatar, name, headline)
6. Modal goes wider (max-w-6xl) to fit two panes
7. Keep all existing functionality (variations, engagement, automation, etc.) below the editor

The full rewritten component is ~350 lines. Key structural changes:

- New state: `device` (DeviceMode), `hookOnly` (boolean), `charCount` (number), `profileData` ({name, headline, avatar_url})
- New useEffect: fetch team profile on mount from `/api/teams/profiles`
- Layout: `grid grid-cols-1 lg:grid-cols-2 gap-4` for the editor area
- Left column: TipTapTextBlock with character count footer
- Right column: LinkedInPreview + DeviceToggle + HookOnlyToggle + HookScorePanel
- Below: existing variations, actions, engagement, automation sections (unchanged)

**Exact changes to PostDetailModal.tsx:**

Add new imports at top:
```tsx
import { TipTapTextBlock } from '@/components/content/inline-editor/TipTapTextBlock';
import { LinkedInPreview, type DeviceMode } from './LinkedInPreview';
import { DeviceToggle } from './DeviceToggle';
import { HookOnlyToggle } from './HookOnlyToggle';
import { HookScorePanel } from './HookScorePanel';
import type { TeamProfile } from '@/lib/types/content-pipeline';
```

Add new state variables (after existing state block):
```tsx
const [device, setDevice] = useState<DeviceMode>('desktop');
const [hookOnly, setHookOnly] = useState(false);
const [charCount, setCharCount] = useState(0);
const [profileData, setProfileData] = useState<{ name: string; headline: string; avatarUrl: string | null }>({
  name: 'You',
  headline: '',
  avatarUrl: null,
});
```

Add profile fetch useEffect:
```tsx
useEffect(() => {
  fetch('/api/teams/profiles')
    .then(r => r.json())
    .then(data => {
      const profiles: TeamProfile[] = data.profiles || [];
      // Use the post's team_profile_id or the default profile
      const profile = post.team_profile_id
        ? profiles.find(p => p.id === post.team_profile_id)
        : profiles.find(p => p.is_default) || profiles[0];
      if (profile) {
        setProfileData({
          name: profile.full_name,
          headline: profile.title || '',
          avatarUrl: profile.avatar_url,
        });
      }
    })
    .catch(() => {});
}, [post.team_profile_id]);
```

Replace the modal body with the new split-pane layout. The full implementation replaces everything from the `<PostPreview>` and edit textarea sections with:
- Left pane: `<TipTapTextBlock>` that saves `editContent` on every keystroke (auto-save on blur or after 2s debounce)
- Right pane: `<LinkedInPreview>` fed by `editContent` in real-time
- Controls bar between panes: DeviceToggle + HookOnlyToggle
- HookScorePanel below the preview

Remove the `editing` state toggle — the editor is always visible. The "Edit" button in the actions bar becomes unnecessary. The Save button does an explicit save (same PATCH call).

**Step 3: Run existing tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/`
Expected: PASS (existing tests should still pass — PostDetailModal doesn't have component tests)

**Step 4: Manual verification**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run dev`
- Navigate to content pipeline → click any post → verify split-pane layout
- Verify LinkedIn preview updates as you type
- Verify device toggle switches between desktop/mobile/tablet
- Verify Hook Only mode dims content after truncation point
- Verify Hook Score button calls API and shows breakdown
- Verify Generate Variants button works

**Step 5: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: rewrite PostDetailModal with split-pane editor + LinkedIn preview"
```

---

### Task 9: Add Character Count with Truncation Indicator

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx`

**Step 1: Add truncation point indicator**

Below the TipTap editor, show:
- Current character count
- Estimated truncation point (where LinkedIn will show "...see more")
- Visual indicator if content is long enough to be truncated

```tsx
// In the left pane, below TipTapTextBlock:
<div className="flex items-center justify-between px-1 pt-1 text-xs text-muted-foreground">
  <span>{charCount} characters</span>
  {charCount > 210 && (
    <span className="text-amber-600">LinkedIn will truncate this post</span>
  )}
</div>
```

**Step 2: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: add character count with LinkedIn truncation indicator"
```

---

### Task 10: Update PostPreview to Accept Profile Props (Backward Compat)

**Files:**
- Modify: `src/components/content-pipeline/PostPreview.tsx`

**Step 1: Make PostPreview a thin wrapper around LinkedInPreview**

Update PostPreview to accept optional profile props and delegate to LinkedInPreview. This keeps backward compatibility for any other places that use PostPreview.

```tsx
// src/components/content-pipeline/PostPreview.tsx
'use client';

import { LinkedInPreview } from './LinkedInPreview';

interface PostPreviewProps {
  content: string;
  authorName?: string;
  authorHeadline?: string;
  authorAvatarUrl?: string | null;
}

export function PostPreview({
  content,
  authorName = 'You',
  authorHeadline = '',
  authorAvatarUrl = null,
}: PostPreviewProps) {
  return (
    <LinkedInPreview
      content={content}
      authorName={authorName}
      authorHeadline={authorHeadline}
      authorAvatarUrl={authorAvatarUrl}
    />
  );
}
```

**Step 2: Verify nothing breaks**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage src/__tests__/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/content-pipeline/PostPreview.tsx
git commit -m "refactor: PostPreview delegates to LinkedInPreview for backward compatibility"
```

---

### Task 11: Add Auto-Save with Debounce to Editor

**Files:**
- Modify: `src/components/content-pipeline/PostDetailModal.tsx`

**Step 1: Add debounced auto-save**

Instead of requiring the user to click "Save", the editor should auto-save after 1.5 seconds of inactivity. Show a "Saving..." / "Saved" indicator.

Add a `useRef` for the debounce timer and a `saveStatus` state:

```tsx
const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

const debouncedSave = useCallback((content: string) => {
  if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(async () => {
    setSaveStatus('saving');
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_content: content }),
      });
      if (response.ok) {
        const data = await response.json();
        setSaveStatus('saved');
        if (data.editId) setFeedbackEditId(data.editId);
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    } catch {
      setSaveStatus('idle');
    }
  }, 1500);
}, [post.id]);
```

Wire into the TipTapTextBlock's onChange:
```tsx
onChange={(content) => {
  setEditContent(content);
  debouncedSave(content);
}}
```

Show save indicator next to character count:
```tsx
<span className="text-xs">
  {saveStatus === 'saving' && '⟳ Saving...'}
  {saveStatus === 'saved' && '✓ Saved'}
</span>
```

**Step 2: Commit**

```bash
git add src/components/content-pipeline/PostDetailModal.tsx
git commit -m "feat: add debounced auto-save to post editor with save status indicator"
```

---

### Task 12: Write Integration Tests and Final Polish

**Files:**
- Create: `src/__tests__/components/content-pipeline/PostDetailModal.test.tsx`

**Step 1: Write integration test for the new layout**

```tsx
// src/__tests__/components/content-pipeline/PostDetailModal.test.tsx
import { render, screen } from '@testing-library/react';

// Mock fetch globally
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ profiles: [{ id: 'p1', full_name: 'Tim Smith', title: 'CEO', avatar_url: null, is_default: true }] }),
});

// Mock TipTapTextBlock (it needs DOM APIs not available in jsdom)
jest.mock('@/components/content/inline-editor/TipTapTextBlock', () => ({
  TipTapTextBlock: ({ content, onChange }: { content: string; onChange: (c: string) => void }) => (
    <textarea data-testid="tiptap-mock" value={content} onChange={e => onChange(e.target.value)} />
  ),
}));

import { PostDetailModal } from '@/components/content-pipeline/PostDetailModal';
import type { PipelinePost } from '@/lib/types/content-pipeline';

const mockPost: PipelinePost = {
  id: 'test-1',
  user_id: 'user-1',
  idea_id: null,
  draft_content: 'Test post content for the editor.',
  final_content: null,
  dm_template: null,
  cta_word: null,
  variations: null,
  status: 'draft',
  scheduled_time: null,
  linkedin_post_id: null,
  publish_provider: null,
  lead_magnet_id: null,
  hook_score: 7,
  polish_status: null,
  polish_notes: null,
  is_buffer: false,
  buffer_position: null,
  auto_publish_after: null,
  published_at: null,
  template_id: null,
  style_id: null,
  enable_automation: false,
  automation_config: null,
  review_data: null,
  engagement_stats: null,
  scrape_engagement: false,
  heyreach_campaign_id: null,
  last_engagement_scrape_at: null,
  engagement_scrape_count: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('PostDetailModal', () => {
  it('renders the LinkedIn preview with post content', () => {
    render(
      <PostDetailModal
        post={mockPost}
        onClose={jest.fn()}
        onPolish={jest.fn()}
        onUpdate={jest.fn()}
        polishing={false}
      />
    );
    expect(screen.getByText(/Test post content/)).toBeInTheDocument();
  });

  it('renders the editor area', () => {
    render(
      <PostDetailModal
        post={mockPost}
        onClose={jest.fn()}
        onPolish={jest.fn()}
        onUpdate={jest.fn()}
        polishing={false}
      />
    );
    expect(screen.getByTestId('tiptap-mock')).toBeInTheDocument();
  });

  it('renders Hook Only toggle', () => {
    render(
      <PostDetailModal
        post={mockPost}
        onClose={jest.fn()}
        onPolish={jest.fn()}
        onUpdate={jest.fn()}
        polishing={false}
      />
    );
    expect(screen.getByText('Hook Only')).toBeInTheDocument();
  });

  it('renders hook score panel', () => {
    render(
      <PostDetailModal
        post={mockPost}
        onClose={jest.fn()}
        onPolish={jest.fn()}
        onUpdate={jest.fn()}
        polishing={false}
      />
    );
    expect(screen.getByText('Hook Analysis')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(
      <PostDetailModal
        post={mockPost}
        onClose={jest.fn()}
        onPolish={jest.fn()}
        onUpdate={jest.fn()}
        polishing={false}
      />
    );
    expect(screen.getByText('Polish')).toBeInTheDocument();
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });
});
```

**Step 2: Run all tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage`
Expected: All tests PASS

**Step 3: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run typecheck`
Expected: No errors

**Step 4: Final commit**

```bash
git add src/__tests__/components/content-pipeline/PostDetailModal.test.tsx
git commit -m "test: add integration tests for new split-pane PostDetailModal"
```

---

## Summary of All Files

### New Files (10)
| File | Purpose |
|------|---------|
| `src/components/content-pipeline/LinkedInPreview.tsx` | Pixel-perfect LinkedIn post preview |
| `src/components/content-pipeline/DeviceToggle.tsx` | Desktop/tablet/mobile toggle |
| `src/components/content-pipeline/HookOnlyToggle.tsx` | Hook isolation toggle |
| `src/components/content-pipeline/HookScorePanel.tsx` | Hook score breakdown + variant trigger |
| `src/lib/ai/content-pipeline/hook-scorer.ts` | AI hook scoring (Claude Sonnet) |
| `src/lib/ai/content-pipeline/hook-generator.ts` | AI hook variant generation (Claude Sonnet) |
| `src/app/api/content-pipeline/posts/[id]/hook-score/route.ts` | Hook score API |
| `src/app/api/content-pipeline/posts/[id]/hook-variants/route.ts` | Hook variants API |
| `src/__tests__/components/content-pipeline/LinkedInPreview.test.tsx` | LinkedInPreview tests |
| `src/__tests__/api/content-pipeline/hook-score.test.ts` | Hook score API tests |
| `src/__tests__/api/content-pipeline/hook-variants.test.ts` | Hook variants API tests |
| `src/__tests__/components/content-pipeline/PostDetailModal.test.tsx` | PostDetailModal integration tests |

### Modified Files (3)
| File | Changes |
|------|---------|
| `src/components/content-pipeline/PostDetailModal.tsx` | Complete rewrite: split-pane layout, TipTap editor, auto-save, hook tools |
| `src/components/content-pipeline/PostPreview.tsx` | Thin wrapper delegating to LinkedInPreview |
| `src/components/content/inline-editor/TipTapTextBlock.tsx` | Add Strike extension, character count |
| `src/lib/utils/tiptap-serializer.ts` | Add ~~strikethrough~~ support |

### New Dependencies (2)
| Package | Purpose |
|---------|---------|
| `@tiptap/extension-strike` | Strikethrough formatting |
| `@tiptap/extension-character-count` | Character counting |
