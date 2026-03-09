# AI Co-pilot Phase 2c: Learning & Memory — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the co-pilot measurably smarter over time by auto-extracting user preferences from corrections, adding a note-capable feedback widget, exposing memory management in Settings, and tagging co-pilot-sourced edits for style evolution.

**Architecture:** When a user corrects the co-pilot (e.g., "Don't use bullet points"), Haiku extracts the preference into `copilot_memories`, which are already injected into the system prompt. The feedback widget expands the existing thumbs up/down to include a free-text note that also triggers memory extraction. A Settings page lets users view, edit, and deactivate learned preferences. Co-pilot-generated content that gets edited in the UI is tagged `source: 'copilot'` so the weekly `evolve-writing-style` task can learn from it.

**Tech Stack:** Next.js 15, React 18, TypeScript, Supabase, Claude Haiku (memory extraction), Jest + React Testing Library

---

### What Already Exists (No Work Needed)

- `copilot_memories` table + RLS (migration `20260227500000`)
- Memory injection into system prompt (`buildCopilotSystemPrompt` section 3)
- Negative feedback aggregation into system prompt (section 5)
- `copilot-memory-extractor` prompt registered in `prompt-defaults.ts`
- `submitFeedback()` in CopilotProvider
- `POST /api/copilot/conversations/[id]/feedback` API route
- Basic thumbs up/down buttons on CopilotMessage (no note input yet)

---

### Task 1: Create memory extractor module

**Files:**
- Create: `src/lib/ai/copilot/memory-extractor.ts`
- Test: `src/__tests__/lib/ai/copilot/memory-extractor.test.ts`

**Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */

const mockMessagesCreate = jest.fn();
jest.mock('@/lib/ai/anthropic-client', () => ({
  createAnthropicClient: jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn().mockResolvedValue(null),
}));

import { extractMemories, detectCorrectionSignal } from '@/lib/ai/copilot/memory-extractor';

describe('memory-extractor', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('detectCorrectionSignal', () => {
    it('detects negation + preference patterns', () => {
      expect(detectCorrectionSignal("Don't use bullet points")).toBe(true);
      expect(detectCorrectionSignal("Never start with a question")).toBe(true);
      expect(detectCorrectionSignal("Stop using emojis")).toBe(true);
      expect(detectCorrectionSignal("I prefer shorter paragraphs")).toBe(true);
      expect(detectCorrectionSignal("Always include a CTA")).toBe(true);
    });

    it('returns false for regular messages', () => {
      expect(detectCorrectionSignal("Write me a post about AI")).toBe(false);
      expect(detectCorrectionSignal("What topics are trending?")).toBe(false);
      expect(detectCorrectionSignal("Show me my analytics")).toBe(false);
    });
  });

  describe('extractMemories', () => {
    it('returns parsed memories from Claude response', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify([
          { rule: 'Never use bullet points', category: 'structure', confidence: 0.9 },
        ]) }],
      });

      const result = await extractMemories('user-1', [
        { role: 'assistant', content: 'Here is a post with bullet points...' },
        { role: 'user', content: "Don't use bullet points, I hate them" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('Never use bullet points');
      expect(result[0].category).toBe('structure');
    });

    it('returns empty array when no memories extracted', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: '[]' }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: 'Write me a post about leadership' },
      ]);

      expect(result).toEqual([]);
    });

    it('returns empty array on malformed JSON', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not json' }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Don't use emojis" },
      ]);

      expect(result).toEqual([]);
    });

    it('filters out memories with invalid categories', async () => {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify([
          { rule: 'Good rule', category: 'tone', confidence: 0.9 },
          { rule: 'Bad category', category: 'invalid', confidence: 0.9 },
        ]) }],
      });

      const result = await extractMemories('user-1', [
        { role: 'user', content: "Be more casual" },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].rule).toBe('Good rule');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/lib/ai/copilot/memory-extractor.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/lib/ai/copilot/memory-extractor.ts
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { getPrompt } from '@/lib/services/prompt-registry';

interface ExtractedMemory {
  rule: string;
  category: 'tone' | 'structure' | 'vocabulary' | 'content' | 'general';
  confidence: number;
}

const VALID_CATEGORIES = new Set(['tone', 'structure', 'vocabulary', 'content', 'general']);

// Patterns that indicate the user is expressing a preference or correction
const CORRECTION_PATTERNS = [
  /\b(don'?t|do not|never|stop|avoid|no more)\b/i,
  /\b(always|prefer|instead|rather|please use)\b/i,
  /\b(too (formal|casual|long|short|verbose|wordy|generic))\b/i,
  /\b(more|less) (formal|casual|concise|detailed|direct)\b/i,
  /\b(wrong tone|bad tone|not my voice|not my style)\b/i,
];

/**
 * Detects whether a user message contains a correction or preference signal.
 */
export function detectCorrectionSignal(text: string): boolean {
  return CORRECTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Extracts user preferences/rules from a conversation context using Claude Haiku.
 * Returns an array of extracted memories, empty if none found or on error.
 */
export async function extractMemories(
  _userId: string,
  conversationContext: Array<{ role: string; content: string }>,
): Promise<ExtractedMemory[]> {
  try {
    const prompt = await getPrompt('copilot-memory-extractor');
    const client = createAnthropicClient('copilot-memory', { timeout: 30_000 });

    const contextText = conversationContext
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const response = await client.messages.create({
      model: prompt?.model || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      temperature: prompt?.temperature ?? 0.3,
      system: prompt?.system_prompt || 'Output JSON array of extracted rules:\n[{"rule": "...", "category": "tone|structure|vocabulary|content|general", "confidence": 0.0-1.0}]\nOnly extract clear, specific preferences. Return empty array if nothing clear.',
      messages: [{
        role: 'user',
        content: prompt?.user_prompt
          ? prompt.user_prompt.replace('{{conversation_context}}', contextText)
          : `Here is the conversation context where the user provided feedback or corrections:\n${contextText}\nExtract any preferences or rules the user is expressing. Return a JSON array.`,
      }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON, handling potential markdown code blocks
    const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) return [];

    // Validate and filter
    return parsed.filter(
      (m: Record<string, unknown>) =>
        typeof m.rule === 'string' &&
        m.rule.length > 0 &&
        VALID_CATEGORIES.has(m.category as string) &&
        typeof m.confidence === 'number' &&
        m.confidence >= 0 &&
        m.confidence <= 1
    ) as ExtractedMemory[];
  } catch {
    return [];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage src/__tests__/lib/ai/copilot/memory-extractor.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/lib/ai/copilot/memory-extractor.ts src/__tests__/lib/ai/copilot/memory-extractor.test.ts
git commit -m "feat: add copilot memory extractor module with correction signal detection"
```

---

### Task 2: Create memories API routes

**Files:**
- Create: `src/app/api/copilot/memories/route.ts`
- Create: `src/app/api/copilot/memories/[id]/route.ts`
- Test: `src/__tests__/api/copilot/memories.test.ts`

**Step 1: Write the failing test**

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

function createChain(resolveData: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit'];
  methods.forEach(m => {
    chain[m] = jest.fn().mockReturnValue(chain);
  });
  chain.single = jest.fn().mockResolvedValue({ data: resolveData, error: null });
  (chain as unknown as PromiseLike<{ data: unknown; error: null }>).then = jest.fn(
    (resolve: (value: { data: unknown; error: null }) => unknown) =>
      resolve({ data: Array.isArray(resolveData) ? resolveData : [resolveData], error: null })
  ) as jest.Mock;
  return chain;
}

const mockState = { fromFn: jest.fn((_table?: string) => createChain()) };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: (table: string) => mockState.fromFn(table),
  })),
}));

import { GET, POST } from '@/app/api/copilot/memories/route';

describe('Copilot Memories API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockState.fromFn = jest.fn(() => createChain());
  });

  describe('GET /api/copilot/memories', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('returns memories for the authenticated user', async () => {
      const mockMemories = [
        { id: 'm1', rule: 'No bullet points', category: 'structure', confidence: 0.9, source: 'conversation', active: true, created_at: '2026-02-28T00:00:00Z' },
      ];
      mockState.fromFn.mockReturnValueOnce(createChain(mockMemories));

      const req = new NextRequest('http://localhost/api/copilot/memories');
      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memories).toEqual(mockMemories);
    });

    it('filters by active status from query param', async () => {
      const chain = createChain([]);
      mockState.fromFn.mockReturnValueOnce(chain);

      const req = new NextRequest('http://localhost/api/copilot/memories?active=true');
      await GET(req);

      expect(chain.eq).toHaveBeenCalledWith('active', true);
    });
  });

  describe('POST /api/copilot/memories', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Test', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('creates a manual memory', async () => {
      const created = { id: 'm-new', rule: 'Use casual tone', category: 'tone', confidence: 1.0, source: 'manual' };
      mockState.fromFn.mockReturnValueOnce(createChain(created));

      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Use casual tone', category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.memory).toEqual(created);
    });

    it('returns 400 when rule is missing', async () => {
      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ category: 'tone' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it('returns 400 when category is invalid', async () => {
      const req = new NextRequest('http://localhost/api/copilot/memories', {
        method: 'POST',
        body: JSON.stringify({ rule: 'Test', category: 'invalid' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/api/copilot/memories.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

`src/app/api/copilot/memories/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const VALID_CATEGORIES = ['tone', 'structure', 'vocabulary', 'content', 'general'];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const activeParam = req.nextUrl.searchParams.get('active');

  let query = supabase
    .from('copilot_memories')
    .select('id, rule, category, confidence, source, active, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (activeParam !== null) {
    query = query.eq('active', activeParam === 'true');
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memories: data || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { rule, category } = await req.json();

  if (!rule || typeof rule !== 'string' || !rule.trim()) {
    return NextResponse.json({ error: 'rule is required' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('copilot_memories')
    .insert({
      user_id: session.user.id,
      rule: rule.trim(),
      category,
      confidence: 1.0,
      source: 'manual',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ memory: data });
}
```

`src/app/api/copilot/memories/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const supabase = createSupabaseAdminClient();

  // Only allow updating rule, category, active
  const updates: Record<string, unknown> = {};
  if (typeof body.rule === 'string') updates.rule = body.rule.trim();
  if (typeof body.active === 'boolean') updates.active = body.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await supabase
    .from('copilot_memories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('copilot_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest --no-coverage src/__tests__/api/copilot/memories.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/app/api/copilot/memories/ src/__tests__/api/copilot/memories.test.ts
git commit -m "feat: add copilot memories CRUD API routes"
```

---

### Task 3: Wire memory extraction into chat route

**Files:**
- Modify: `src/app/api/copilot/chat/route.ts`
- Test: `src/__tests__/api/copilot/chat.test.ts` (add tests)

**Context:** After each user message in the agent loop, if the message contains a correction signal, fire-and-forget Haiku memory extraction and save results to `copilot_memories`. This should not block the SSE stream.

**Step 1: Write the failing tests**

Add to `src/__tests__/api/copilot/chat.test.ts`:

```typescript
// At top, add mock for memory-extractor
const mockDetectCorrectionSignal = jest.fn().mockReturnValue(false);
const mockExtractMemories = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/ai/copilot/memory-extractor', () => ({
  detectCorrectionSignal: (...args: unknown[]) => mockDetectCorrectionSignal(...args),
  extractMemories: (...args: unknown[]) => mockExtractMemories(...args),
}));

// Add test:
it('triggers memory extraction when correction signal detected', async () => {
  mockDetectCorrectionSignal.mockReturnValue(true);
  mockExtractMemories.mockResolvedValue([
    { rule: 'No emojis', category: 'vocabulary', confidence: 0.9 },
  ]);

  // ... setup and execute chat request with message "Don't use emojis"

  // Verify extraction was triggered
  expect(mockDetectCorrectionSignal).toHaveBeenCalledWith("Don't use emojis");
  expect(mockExtractMemories).toHaveBeenCalled();
});
```

**Step 2: Implement the change**

In `src/app/api/copilot/chat/route.ts`, add at the top:

```typescript
import { detectCorrectionSignal, extractMemories } from '@/lib/ai/copilot/memory-extractor';
```

After saving the user message (line ~75), add fire-and-forget memory extraction:

```typescript
// Save user message
await supabase.from('copilot_messages').insert({
  conversation_id: conversationId,
  role: 'user',
  content: body.message,
});

// Fire-and-forget: extract memories if correction signal detected
if (detectCorrectionSignal(body.message)) {
  // Get recent conversation context (last 6 messages)
  const { data: recentMsgs } = await supabase
    .from('copilot_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6);

  const context = (recentMsgs || [])
    .reverse()
    .filter((m: { role: string; content: string | null }) => m.role === 'user' || m.role === 'assistant')
    .map((m: { role: string; content: string | null }) => ({ role: m.role, content: m.content || '' }));

  extractMemories(userId, context).then(async (memories) => {
    if (memories.length > 0) {
      await supabase.from('copilot_memories').insert(
        memories.map(m => ({
          user_id: userId,
          rule: m.rule,
          category: m.category,
          confidence: m.confidence,
          source: 'conversation',
          conversation_id: conversationId,
        }))
      );
    }
  }).catch(() => {}); // Fire-and-forget
}
```

**Step 3: Run tests**

Run: `npx jest --no-coverage src/__tests__/api/copilot/chat.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/copilot/chat/route.ts src/__tests__/api/copilot/chat.test.ts
git commit -m "feat: auto-extract memories from correction signals in copilot chat"
```

---

### Task 4: Add feedback note input to FeedbackWidget

**Files:**
- Create: `src/components/copilot/FeedbackWidget.tsx`
- Modify: `src/components/copilot/CopilotMessage.tsx` (replace inline buttons)
- Test: `src/__tests__/components/copilot/FeedbackWidget.test.tsx`

**Step 1: Write the failing test**

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  ThumbsUp: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="thumbs-up" {...props} />,
  ThumbsDown: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="thumbs-down" {...props} />,
  Send: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="send" {...props} />,
  X: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="x" {...props} />,
}));

import { FeedbackWidget } from '@/components/copilot/FeedbackWidget';

describe('FeedbackWidget', () => {
  const mockOnFeedback = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders thumbs up and down buttons', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    expect(screen.getByLabelText('Good response')).toBeInTheDocument();
    expect(screen.getByLabelText('Bad response')).toBeInTheDocument();
  });

  it('calls onFeedback with positive on thumbs up click', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Good response'));
    expect(mockOnFeedback).toHaveBeenCalledWith('positive', undefined);
  });

  it('shows note input on negative feedback click', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    expect(screen.getByPlaceholderText(/what could be better/i)).toBeInTheDocument();
  });

  it('submits negative feedback with note', async () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));

    const input = screen.getByPlaceholderText(/what could be better/i);
    fireEvent.change(input, { target: { value: 'Too formal' } });
    fireEvent.click(screen.getByLabelText('Submit feedback'));

    expect(mockOnFeedback).toHaveBeenCalledWith('negative', 'Too formal');
  });

  it('submits negative feedback without note on skip', () => {
    render(<FeedbackWidget onFeedback={mockOnFeedback} />);
    fireEvent.click(screen.getByLabelText('Bad response'));
    fireEvent.click(screen.getByLabelText('Skip note'));

    expect(mockOnFeedback).toHaveBeenCalledWith('negative', undefined);
  });

  it('shows existing feedback state', () => {
    render(
      <FeedbackWidget
        onFeedback={mockOnFeedback}
        existingFeedback={{ rating: 'positive' }}
      />
    );
    // Thumbs up should be highlighted
    const thumbsUp = screen.getByLabelText('Good response');
    expect(thumbsUp.className).toContain('emerald');
  });

  it('does not re-open note input after feedback submitted', () => {
    render(
      <FeedbackWidget
        onFeedback={mockOnFeedback}
        existingFeedback={{ rating: 'negative', note: 'Too formal' }}
      />
    );
    expect(screen.queryByPlaceholderText(/what could be better/i)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/components/copilot/FeedbackWidget.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

`src/components/copilot/FeedbackWidget.tsx`:

```typescript
'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, X } from 'lucide-react';

interface FeedbackWidgetProps {
  onFeedback: (rating: 'positive' | 'negative', note?: string) => void;
  existingFeedback?: { rating: 'positive' | 'negative'; note?: string };
}

export function FeedbackWidget({ onFeedback, existingFeedback }: FeedbackWidgetProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');

  const handlePositive = () => {
    if (!existingFeedback) onFeedback('positive', undefined);
  };

  const handleNegative = () => {
    if (existingFeedback) return;
    setShowNoteInput(true);
  };

  const submitNegative = () => {
    onFeedback('negative', note.trim() || undefined);
    setShowNoteInput(false);
    setNote('');
  };

  const skipNote = () => {
    onFeedback('negative', undefined);
    setShowNoteInput(false);
    setNote('');
  };

  return (
    <div className="flex flex-col items-start gap-1 mt-1">
      <div className="flex items-center gap-1">
        <button
          onClick={handlePositive}
          className={`p-1 rounded transition-colors ${
            existingFeedback?.rating === 'positive'
              ? 'text-emerald-500'
              : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
          }`}
          aria-label="Good response"
        >
          <ThumbsUp className="w-3 h-3" />
        </button>
        <button
          onClick={handleNegative}
          className={`p-1 rounded transition-colors ${
            existingFeedback?.rating === 'negative'
              ? 'text-red-500'
              : 'text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400'
          }`}
          aria-label="Bad response"
        >
          <ThumbsDown className="w-3 h-3" />
        </button>
      </div>

      {showNoteInput && !existingFeedback && (
        <div className="flex items-center gap-1 w-full max-w-[85%]">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What could be better?"
            className="flex-1 text-xs px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
            maxLength={200}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNegative(); }}
          />
          <button
            onClick={submitNegative}
            className="p-1 text-violet-600 hover:text-violet-700"
            aria-label="Submit feedback"
          >
            <Send className="w-3 h-3" />
          </button>
          <button
            onClick={skipNote}
            className="p-1 text-zinc-400 hover:text-zinc-500"
            aria-label="Skip note"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Update CopilotMessage to use FeedbackWidget**

In `src/components/copilot/CopilotMessage.tsx`, replace the inline feedback buttons (lines 115-141) with:

```typescript
import { FeedbackWidget } from './FeedbackWidget';

// ...inside the component, replace the feedback buttons section:
      {message.role === 'assistant' && message.content && (
        <FeedbackWidget
          onFeedback={onFeedback}
          existingFeedback={message.feedback}
        />
      )}
```

Remove the `ThumbsUp` and `ThumbsDown` imports from CopilotMessage since they move to FeedbackWidget.

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/copilot/FeedbackWidget.test.tsx src/__tests__/components/copilot/CopilotComponents.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/copilot/FeedbackWidget.tsx src/components/copilot/CopilotMessage.tsx src/__tests__/components/copilot/FeedbackWidget.test.tsx
git commit -m "feat: add FeedbackWidget with note input for negative feedback"
```

---

### Task 5: Wire feedback notes into memory extraction

**Files:**
- Modify: `src/app/api/copilot/conversations/[id]/feedback/route.ts`
- Test: Add to existing feedback test or new test

**Context:** When a user submits negative feedback with a note, fire-and-forget memory extraction from the feedback note + surrounding conversation context.

**Step 1: Update the feedback route**

In `src/app/api/copilot/conversations/[id]/feedback/route.ts`, after saving the feedback, add:

```typescript
import { extractMemories } from '@/lib/ai/copilot/memory-extractor';

// ...after the successful update:

// Fire-and-forget: extract memories from negative feedback with notes
if (rating === 'negative' && note) {
  // Get surrounding conversation context
  const { data: context } = await supabase
    .from('copilot_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6);

  const contextMsgs = (context || [])
    .reverse()
    .filter((m: { role: string; content: string | null }) => m.role === 'user' || m.role === 'assistant')
    .map((m: { role: string; content: string | null }) => ({ role: m.role, content: m.content || '' }));

  // Add the feedback note as user context
  contextMsgs.push({ role: 'user', content: `[Feedback note]: ${note}` });

  extractMemories(session.user.id, contextMsgs).then(async (memories) => {
    if (memories.length > 0) {
      await supabase.from('copilot_memories').insert(
        memories.map(m => ({
          user_id: session.user.id,
          rule: m.rule,
          category: m.category,
          confidence: m.confidence,
          source: 'feedback' as const,
          conversation_id: conversationId,
        }))
      );
    }
  }).catch(() => {});
}
```

**Step 2: Run tests**

Run: `npx jest --no-coverage src/__tests__/api/copilot/`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/copilot/conversations/[id]/feedback/route.ts
git commit -m "feat: extract memories from negative feedback notes"
```

---

### Task 6: Memory Management Settings UI

**Files:**
- Create: `src/components/settings/CopilotMemorySettings.tsx`
- Create: `src/app/(dashboard)/settings/copilot/page.tsx`
- Modify: `src/components/settings/SettingsNav.tsx` (add nav item)
- Test: `src/__tests__/components/settings/CopilotMemorySettings.test.tsx`

**Step 1: Write the failing test**

```typescript
/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Brain: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="brain" {...props} />,
  Plus: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="plus" {...props} />,
  Trash2: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="trash" {...props} />,
  ToggleLeft: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="toggle-left" {...props} />,
  ToggleRight: (props: React.HTMLAttributes<HTMLSpanElement>) => <span data-testid="toggle-right" {...props} />,
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { CopilotMemorySettings } from '@/components/settings/CopilotMemorySettings';

describe('CopilotMemorySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        memories: [
          { id: 'm1', rule: 'No bullet points', category: 'structure', confidence: 0.9, source: 'conversation', active: true, created_at: '2026-02-28T00:00:00Z' },
          { id: 'm2', rule: 'Use casual tone', category: 'tone', confidence: 1.0, source: 'manual', active: true, created_at: '2026-02-27T00:00:00Z' },
        ],
      }),
    });
  });

  it('renders memories list', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('No bullet points')).toBeInTheDocument();
      expect(screen.getByText('Use casual tone')).toBeInTheDocument();
    });
  });

  it('shows category badges', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('structure')).toBeInTheDocument();
      expect(screen.getByText('tone')).toBeInTheDocument();
    });
  });

  it('shows source labels', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText(/auto-learned/i)).toBeInTheDocument();
      expect(screen.getByText(/manual/i)).toBeInTheDocument();
    });
  });

  it('shows add memory form when button clicked', async () => {
    render(<CopilotMemorySettings />);

    await waitFor(() => screen.getByText('No bullet points'));

    fireEvent.click(screen.getByText(/add preference/i));
    expect(screen.getByPlaceholderText(/e\.g\., Never use bullet/i)).toBeInTheDocument();
  });

  it('renders empty state when no memories', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ memories: [] }),
    });

    render(<CopilotMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText(/no learned preferences/i)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest --no-coverage src/__tests__/components/settings/CopilotMemorySettings.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

`src/components/settings/CopilotMemorySettings.tsx`:

```typescript
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Brain, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';

interface Memory {
  id: string;
  rule: string;
  category: string;
  confidence: number;
  source: string;
  active: boolean;
  created_at: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  structure: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  vocabulary: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  content: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  general: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300',
};

export function CopilotMemorySettings() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/copilot/memories');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const addMemory = async () => {
    if (!newRule.trim()) return;

    const res = await fetch('/api/copilot/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule: newRule.trim(), category: newCategory }),
    });

    if (res.ok) {
      setNewRule('');
      setShowAddForm(false);
      loadMemories();
    }
  };

  const toggleMemory = async (id: string, active: boolean) => {
    await fetch(`/api/copilot/memories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    setMemories(prev => prev.map(m => m.id === id ? { ...m, active: !active } : m));
  };

  const deleteMemory = async (id: string) => {
    await fetch(`/api/copilot/memories/${id}`, { method: 'DELETE' });
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  if (loading) {
    return <div className="text-sm text-zinc-500">Loading preferences...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold">Learned Preferences</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-700"
        >
          <Plus className="w-4 h-4" />
          Add Preference
        </button>
      </div>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        These preferences are automatically learned from your conversations with the co-pilot. You can also add them manually. Active preferences are included in every co-pilot prompt.
      </p>

      {showAddForm && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
          <input
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="e.g., Never use bullet points in posts"
            className="flex-1 text-sm px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
            maxLength={200}
            onKeyDown={(e) => { if (e.key === 'Enter') addMemory(); }}
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="text-sm px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800"
          >
            <option value="general">General</option>
            <option value="tone">Tone</option>
            <option value="structure">Structure</option>
            <option value="vocabulary">Vocabulary</option>
            <option value="content">Content</option>
          </select>
          <button
            onClick={addMemory}
            className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700"
          >
            Save
          </button>
        </div>
      )}

      {memories.length === 0 ? (
        <div className="text-center py-8 text-sm text-zinc-500 dark:text-zinc-400">
          No learned preferences yet. The co-pilot will learn your preferences as you interact with it, or you can add them manually above.
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map(m => (
            <div
              key={m.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                m.active
                  ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800'
                  : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_COLORS[m.category] || CATEGORY_COLORS.general}`}>
                    {m.category}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {m.source === 'manual' ? 'manual' : 'auto-learned'}
                  </span>
                </div>
                <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{m.rule}</p>
              </div>
              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  onClick={() => toggleMemory(m.id, m.active)}
                  className="p-1 text-zinc-400 hover:text-zinc-600"
                  aria-label={m.active ? 'Deactivate' : 'Activate'}
                >
                  {m.active ? <ToggleRight className="w-4 h-4 text-violet-600" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteMemory(m.id)}
                  className="p-1 text-zinc-400 hover:text-red-500"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

`src/app/(dashboard)/settings/copilot/page.tsx`:

```typescript
import { CopilotMemorySettings } from '@/components/settings/CopilotMemorySettings';

export default function CopilotSettingsPage() {
  return (
    <div className="space-y-8">
      <CopilotMemorySettings />
    </div>
  );
}
```

**Step 4: Add nav item to SettingsNav**

In `src/components/settings/SettingsNav.tsx`, add a new nav group after "Branding":

```typescript
import { ..., Brain } from 'lucide-react';

// Add after the Branding group:
{
  title: 'AI Co-pilot',
  items: [
    { label: 'Preferences', href: '/settings/copilot', icon: Brain },
  ],
},
```

**Step 5: Run tests**

Run: `npx jest --no-coverage src/__tests__/components/settings/CopilotMemorySettings.test.tsx`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/components/settings/CopilotMemorySettings.tsx src/app/\(dashboard\)/settings/copilot/page.tsx src/components/settings/SettingsNav.tsx src/__tests__/components/settings/CopilotMemorySettings.test.tsx
git commit -m "feat: add copilot memory management UI in Settings"
```

---

### Task 7: Tag copilot-sourced edits for style evolution

**Files:**
- Modify: `src/lib/services/edit-capture.ts` (add optional `source` field)
- Modify: `src/app/api/content-pipeline/posts/[id]/route.ts` (pass `source: 'copilot'` when applicable)

**Context:** When the co-pilot generates a post and the user edits it, the edit should be tagged with `source: 'copilot'` so the weekly `evolve-writing-style` task knows which edits came from AI-generated content.

**Step 1: Add optional `source` field to EditRecordInput**

In `src/lib/services/edit-capture.ts`, add to `EditRecordInput`:

```typescript
export interface EditRecordInput {
  teamId: string;
  profileId: string | null;
  contentType: 'post' | 'email' | 'lead_magnet' | 'sequence';
  contentId: string;
  fieldName: string;
  originalText: string;
  editedText: string;
  editTags?: string[];
  ceoNote?: string;
  source?: 'manual' | 'copilot'; // NEW: tracks if content was AI-generated
}
```

And in `EditRecord`:

```typescript
export interface EditRecord {
  // ...existing fields...
  source?: string;
}
```

In the `captureEdit` function, include `source` in the DB insert if provided. In `captureAndClassifyEdit`, pass it through.

**Step 2: Run existing tests**

Run: `npx jest --no-coverage src/__tests__/lib/services/edit-capture.test.ts`
Expected: PASS (existing tests still work since source is optional)

**Step 3: Commit**

```bash
git add src/lib/services/edit-capture.ts
git commit -m "feat: add optional source field to edit capture for copilot tracking"
```

---

### Task 8: Smoke test + TypeScript check

**Files:** None created — verification only.

**Step 1: Run all copilot + settings tests**

```bash
npx jest --no-coverage src/__tests__/api/copilot/ src/__tests__/lib/ai/copilot/ src/__tests__/components/copilot/ src/__tests__/components/settings/CopilotMemorySettings.test.tsx
```

Expected: All tests pass.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "copilot|memory|feedback" | head -20
```

Expected: No errors in copilot/memory files.

**Step 3: Commit if any fixes needed**

---

### Task 9: Update CLAUDE.md with Phase 2c documentation

**Files:**
- Modify: `CLAUDE.md` (update AI Co-pilot section header and add Phase 2c features)

**Changes:**
1. Update section header from "Phase 2a+2b" to "Phase 2a+2b+2c"
2. Add Learning & Memory subsection documenting:
   - Memory extractor module (`src/lib/ai/copilot/memory-extractor.ts`)
   - Correction signal detection patterns
   - Memory extraction pipeline (conversation corrections + feedback notes)
   - Memories API routes (`/api/copilot/memories`, `/api/copilot/memories/[id]`)
   - FeedbackWidget component (note input on negative feedback)
   - Memory Management Settings UI (`/settings/copilot`)
   - Edit tracking `source: 'copilot'` tag
3. Update component count and test count

**Commit:**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Phase 2c learning & memory documentation"
```
