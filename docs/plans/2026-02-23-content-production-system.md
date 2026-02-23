# Content Production System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable daily content production (1 LinkedIn post/day/profile, 1 newsletter/day, 1 lead magnet/week) with an AI style-learning system that improves from every CEO edit.

**Architecture:** magnetlab is the single content hub. Edit-tracking captures every content change, auto-classifies patterns, and evolves voice profiles weekly. gtm-system pushes warm leads to magnetlab's subscriber list via webhook. All AI writing modules inject the evolved voice profile.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Trigger.dev v4, Claude AI (Anthropic SDK), Resend (email), Unipile (LinkedIn publishing)

---

## Phase 1: Edit-Tracking Foundation

### Task 1: Create `cp_edit_history` Migration

**Files:**
- Create: `supabase/migrations/20260223000000_edit_history.sql`

**Step 1: Write the migration**

```sql
-- Edit history for style learning
-- Captures every meaningful content edit across posts, emails, lead magnets, sequences

CREATE TABLE IF NOT EXISTS cp_edit_history (
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
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_edit_history_team_id ON cp_edit_history(team_id);
CREATE INDEX idx_cp_edit_history_profile_id ON cp_edit_history(profile_id);
CREATE INDEX idx_cp_edit_history_content_type ON cp_edit_history(content_type);
CREATE INDEX idx_cp_edit_history_created_at ON cp_edit_history(created_at DESC);
CREATE INDEX idx_cp_edit_history_unprocessed ON cp_edit_history(profile_id, processed) WHERE processed = FALSE;

ALTER TABLE cp_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team edit history"
  ON cp_edit_history FOR SELECT
  USING (team_id IN (
    SELECT tp.team_id FROM team_profiles tp WHERE tp.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own team edit history"
  ON cp_edit_history FOR INSERT
  WITH CHECK (team_id IN (
    SELECT tp.team_id FROM team_profiles tp WHERE tp.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access on cp_edit_history"
  ON cp_edit_history FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Push migration**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add supabase/migrations/20260223000000_edit_history.sql
git commit -m "feat: add cp_edit_history table for style learning"
```

---

### Task 2: Edit Capture Service

**Files:**
- Create: `src/lib/services/edit-capture.ts`
- Test: `src/__tests__/lib/services/edit-capture.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/lib/services/edit-capture.test.ts
import { computeEditDiff, isSignificantEdit, buildEditRecord } from '@/lib/services/edit-capture';

describe('edit-capture', () => {
  describe('isSignificantEdit', () => {
    it('returns false for identical text', () => {
      expect(isSignificantEdit('hello world', 'hello world')).toBe(false);
    });

    it('returns false for whitespace-only changes', () => {
      expect(isSignificantEdit('hello  world', 'hello world')).toBe(false);
    });

    it('returns false for trivial typo fixes (< 5% change)', () => {
      const original = 'This is a long paragraph about building agencies and growing revenue through outbound sales systems that work.';
      const edited = 'This is a long paragraph about building agencies and growing revenue through outbound sales systems that works.';
      expect(isSignificantEdit(original, edited)).toBe(false);
    });

    it('returns true for meaningful edits', () => {
      const original = 'Leverage our synergistic approach to maximize ROI across verticals.';
      const edited = 'Here is how we actually grew revenue 3x in 6 months.';
      expect(isSignificantEdit(original, edited)).toBe(true);
    });
  });

  describe('computeEditDiff', () => {
    it('returns word-level additions and removals', () => {
      const diff = computeEditDiff(
        'I love building agencies',
        'I love growing agencies fast'
      );
      expect(diff.removed).toContain('building');
      expect(diff.added).toContain('growing');
      expect(diff.added).toContain('fast');
    });

    it('computes change ratio', () => {
      const diff = computeEditDiff('hello world', 'hello universe');
      expect(diff.changeRatio).toBeGreaterThan(0);
      expect(diff.changeRatio).toBeLessThan(1);
    });
  });

  describe('buildEditRecord', () => {
    it('builds a complete edit record', () => {
      const record = buildEditRecord({
        teamId: 'team-1',
        profileId: 'profile-1',
        contentType: 'post',
        contentId: 'post-1',
        fieldName: 'draft_content',
        originalText: 'Leverage synergy',
        editedText: 'Here is what actually works',
      });
      expect(record.team_id).toBe('team-1');
      expect(record.content_type).toBe('post');
      expect(record.edit_diff).toBeDefined();
      expect(record.edit_diff.changeRatio).toBeGreaterThan(0);
    });

    it('returns null for insignificant edits', () => {
      const record = buildEditRecord({
        teamId: 'team-1',
        profileId: 'profile-1',
        contentType: 'post',
        contentId: 'post-1',
        fieldName: 'draft_content',
        originalText: 'hello world',
        editedText: 'hello world',
      });
      expect(record).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/edit-capture.test.ts --no-coverage`
Expected: FAIL — module not found

**Step 3: Write the implementation**

```typescript
// src/lib/services/edit-capture.ts

export interface EditDiff {
  added: string[];
  removed: string[];
  changeRatio: number;
  wordCountBefore: number;
  wordCountAfter: number;
}

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
}

export interface EditRecord {
  team_id: string;
  profile_id: string | null;
  content_type: string;
  content_id: string;
  field_name: string;
  original_text: string;
  edited_text: string;
  edit_diff: EditDiff;
  edit_tags: string[];
  ceo_note: string | null;
}

const SIGNIFICANCE_THRESHOLD = 0.05; // 5% of words must change

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function tokenize(text: string): string[] {
  return normalizeWhitespace(text).split(' ').filter(Boolean);
}

export function isSignificantEdit(original: string, edited: string): boolean {
  const normOriginal = normalizeWhitespace(original);
  const normEdited = normalizeWhitespace(edited);
  if (normOriginal === normEdited) return false;

  const diff = computeEditDiff(original, edited);
  return diff.changeRatio >= SIGNIFICANCE_THRESHOLD;
}

export function computeEditDiff(original: string, edited: string): EditDiff {
  const originalWords = tokenize(original);
  const editedWords = tokenize(edited);

  const originalSet = new Set(originalWords);
  const editedSet = new Set(editedWords);

  const removed = originalWords.filter(w => !editedSet.has(w));
  const added = editedWords.filter(w => !originalSet.has(w));

  const totalWords = Math.max(originalWords.length, editedWords.length, 1);
  const changedWords = new Set([...removed, ...added]).size;
  const changeRatio = changedWords / totalWords;

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
    changeRatio,
    wordCountBefore: originalWords.length,
    wordCountAfter: editedWords.length,
  };
}

export function buildEditRecord(input: EditRecordInput): EditRecord | null {
  if (!isSignificantEdit(input.originalText, input.editedText)) {
    return null;
  }

  const editDiff = computeEditDiff(input.originalText, input.editedText);

  return {
    team_id: input.teamId,
    profile_id: input.profileId,
    content_type: input.contentType,
    content_id: input.contentId,
    field_name: input.fieldName,
    original_text: input.originalText,
    edited_text: input.editedText,
    edit_diff: editDiff,
    edit_tags: input.editTags || [],
    ceo_note: input.ceoNote || null,
  };
}

/**
 * Capture an edit and store it in the database.
 * Fire-and-forget — never blocks the save operation.
 */
export async function captureEdit(
  supabase: { from: (table: string) => { insert: (data: Record<string, unknown>) => { error: unknown } } },
  input: EditRecordInput
): Promise<void> {
  const record = buildEditRecord(input);
  if (!record) return;

  const { error } = await supabase
    .from('cp_edit_history')
    .insert(record);

  if (error) {
    console.error('[edit-capture] Failed to save edit:', error);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest src/__tests__/lib/services/edit-capture.test.ts --no-coverage`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/lib/services/edit-capture.ts src/__tests__/lib/services/edit-capture.test.ts
git commit -m "feat: add edit capture service with diff computation and significance detection"
```

---

### Task 3: Hook Edit Capture into Post Save

**Files:**
- Modify: `src/app/api/content-pipeline/posts/[id]/route.ts` (lines 38-90, PATCH handler)

**Step 1: Read the current PATCH handler**

Read `src/app/api/content-pipeline/posts/[id]/route.ts` to understand the exact structure before modifying.

**Step 2: Add edit capture to the PATCH handler**

After the existing update logic, before returning the response, add:

```typescript
// At top of file, add import:
import { captureEdit } from '@/lib/services/edit-capture';

// Inside the PATCH handler, BEFORE the database update:
// 1. Fetch the current post to get the original text
const { data: currentPost } = await supabase
  .from('cp_pipeline_posts')
  .select('draft_content, final_content, team_profile_id, user_id')
  .eq('id', params.id)
  .single();

// 2. After the update succeeds, capture edits (fire-and-forget):
if (currentPost) {
  const teamScope = await requireTeamScope(session.user.id);

  if (updates.draft_content && currentPost.draft_content) {
    captureEdit(supabase, {
      teamId: teamScope.teamId,
      profileId: currentPost.team_profile_id,
      contentType: 'post',
      contentId: params.id,
      fieldName: 'draft_content',
      originalText: currentPost.draft_content,
      editedText: updates.draft_content,
    });
  }

  if (updates.final_content && currentPost.final_content) {
    captureEdit(supabase, {
      teamId: teamScope.teamId,
      profileId: currentPost.team_profile_id,
      contentType: 'post',
      contentId: params.id,
      fieldName: 'final_content',
      originalText: currentPost.final_content,
      editedText: updates.final_content,
    });
  }
}
```

**Step 3: Run existing tests to verify nothing broke**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: All existing tests pass

**Step 4: Commit**

```bash
git add src/app/api/content-pipeline/posts/[id]/route.ts
git commit -m "feat: hook edit capture into post save flow"
```

---

### Task 4: Hook Edit Capture into Email Broadcast Save

**Files:**
- Modify: `src/app/api/email/broadcasts/[id]/route.ts` (lines 66-141, PUT handler)

**Step 1: Read the current PUT handler**

Read the file to understand the exact structure.

**Step 2: Add edit capture**

Same pattern as Task 3 — fetch current broadcast before update, capture diffs on `subject` and `body` fields after successful update. Use `contentType: 'email'`.

**Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npm run test -- --no-coverage`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/email/broadcasts/[id]/route.ts
git commit -m "feat: hook edit capture into email broadcast save flow"
```

---

### Task 5: Hook Edit Capture into Email Sequence Save

**Files:**
- Modify: `src/app/api/email-sequence/[leadMagnetId]/route.ts` (lines 68-161, PUT handler)

**Step 1: Read the current PUT handler**

Read the file. The emails are stored as a JSONB array of `{day, subject, body}` objects.

**Step 2: Add edit capture**

Fetch current sequence before update. For each email step that changed, capture the diff. Compare old emails array with new — match by `day` index.

```typescript
// Compare each email step
if (currentSequence?.emails && Array.isArray(updates.emails)) {
  for (let i = 0; i < updates.emails.length; i++) {
    const oldEmail = currentSequence.emails[i];
    const newEmail = updates.emails[i];
    if (oldEmail && newEmail) {
      if (oldEmail.subject !== newEmail.subject) {
        captureEdit(supabase, {
          teamId: teamScope.teamId,
          profileId: null,
          contentType: 'sequence',
          contentId: sequenceId,
          fieldName: `email_${i}_subject`,
          originalText: oldEmail.subject,
          editedText: newEmail.subject,
        });
      }
      if (oldEmail.body !== newEmail.body) {
        captureEdit(supabase, {
          teamId: teamScope.teamId,
          profileId: null,
          contentType: 'sequence',
          contentId: sequenceId,
          fieldName: `email_${i}_body`,
          originalText: oldEmail.body,
          editedText: newEmail.body,
        });
      }
    }
  }
}
```

**Step 3: Run tests, commit**

```bash
git add src/app/api/email-sequence/[leadMagnetId]/route.ts
git commit -m "feat: hook edit capture into email sequence save flow"
```

---

### Task 6: Hook Edit Capture into Lead Magnet Content Save

**Files:**
- Modify: `src/app/api/lead-magnet/[id]/content/route.ts`

**Step 1: Read the file to understand the content save structure**

Lead magnets store content as `content_blocks` (JSONB). Compare old blocks with new blocks.

**Step 2: Add edit capture**

For each content block that changed, capture the diff. Content blocks are typically arrays of `{type, content}` — compare stringified blocks or individual text fields.

**Step 3: Run tests, commit**

```bash
git add src/app/api/lead-magnet/[id]/content/route.ts
git commit -m "feat: hook edit capture into lead magnet content save flow"
```

---

## Phase 2: Edit Classification & Feedback UI

### Task 7: Edit Classification AI Module

**Files:**
- Create: `src/lib/ai/content-pipeline/edit-classifier.ts`
- Test: `src/__tests__/lib/ai/edit-classifier.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/lib/ai/edit-classifier.test.ts
import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';

// Mock the Anthropic client
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          patterns: [
            { pattern: 'shortened_hook', description: 'Shortened the hook from 2 lines to 1' },
            { pattern: 'removed_jargon', description: 'Replaced "leverage" with "use"' }
          ]
        })}]
      })
    }
  }))
}));

describe('edit-classifier', () => {
  it('classifies edit patterns from a diff', async () => {
    const result = await classifyEditPatterns({
      originalText: 'Leverage our synergistic approach to maximize ROI.',
      editedText: 'Here is how we actually use this to grow revenue.',
      contentType: 'post',
      fieldName: 'draft_content',
    });
    expect(result.patterns).toBeDefined();
    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns[0].pattern).toBeDefined();
  });
});
```

**Step 2: Run to verify failure, then implement**

```typescript
// src/lib/ai/content-pipeline/edit-classifier.ts
import Anthropic from '@anthropic-ai/sdk';

interface ClassifyInput {
  originalText: string;
  editedText: string;
  contentType: string;
  fieldName: string;
}

interface EditPattern {
  pattern: string;
  description: string;
}

interface ClassifyResult {
  patterns: EditPattern[];
}

export async function classifyEditPatterns(input: ClassifyInput): Promise<ClassifyResult> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Analyze what changed between the original and edited text. Identify specific writing style patterns.

Content type: ${input.contentType} (field: ${input.fieldName})

ORIGINAL:
${input.originalText}

EDITED:
${input.editedText}

Return JSON with "patterns" array. Each pattern has:
- "pattern": short snake_case label (e.g. "shortened_hook", "removed_jargon", "added_story", "softened_cta", "made_conversational", "added_specifics", "reduced_length")
- "description": one sentence explaining the change

Only include patterns that represent deliberate style choices, not typo fixes.
Return {"patterns": []} if no meaningful style changes detected.`
    }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { patterns: [] };
    return JSON.parse(jsonMatch[0]);
  } catch {
    return { patterns: [] };
  }
}
```

**Step 3: Run tests, commit**

```bash
git add src/lib/ai/content-pipeline/edit-classifier.ts src/__tests__/lib/ai/edit-classifier.test.ts
git commit -m "feat: add AI edit classifier for style pattern detection"
```

---

### Task 8: Async Edit Classification Integration

**Files:**
- Modify: `src/lib/services/edit-capture.ts`

After an edit is captured in the database, fire an async classification call that updates the `auto_classified_changes` column. This runs in the background — never blocks the save.

```typescript
// Add to edit-capture.ts:
import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';

export async function captureAndClassifyEdit(
  supabase: SupabaseClient,
  input: EditRecordInput
): Promise<void> {
  const record = buildEditRecord(input);
  if (!record) return;

  // Step 1: Insert the edit record
  const { data, error } = await supabase
    .from('cp_edit_history')
    .insert(record)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[edit-capture] Failed to save edit:', error);
    return;
  }

  // Step 2: Classify async (fire-and-forget)
  classifyEditPatterns({
    originalText: input.originalText,
    editedText: input.editedText,
    contentType: input.contentType,
    fieldName: input.fieldName,
  }).then(result => {
    if (result.patterns.length > 0) {
      supabase
        .from('cp_edit_history')
        .update({ auto_classified_changes: result })
        .eq('id', data.id)
        .then(({ error: updateError }) => {
          if (updateError) console.error('[edit-capture] Failed to save classification:', updateError);
        });
    }
  }).catch(err => {
    console.error('[edit-capture] Classification failed:', err);
  });
}
```

**Commit:**

```bash
git add src/lib/services/edit-capture.ts
git commit -m "feat: add async edit classification after capture"
```

---

### Task 9: Style Feedback Toast Component

**Files:**
- Create: `src/components/content-pipeline/StyleFeedbackToast.tsx`

**Step 1: Build the component**

Non-blocking toast that appears after saving content. Quick-tag chips + optional text note. Calls `POST /api/content-pipeline/edit-feedback` to update the edit record.

```tsx
// src/components/content-pipeline/StyleFeedbackToast.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const QUICK_TAGS = [
  'Too formal',
  'Too long',
  'Wrong tone',
  'Missing story',
  'Too salesy',
  'Good as-is',
];

interface StyleFeedbackToastProps {
  editId: string;
  onDismiss: () => void;
}

export function StyleFeedbackToast({ editId, onDismiss }: StyleFeedbackToastProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const submit = async () => {
    await fetch('/api/content-pipeline/edit-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ editId, tags: selectedTags, note: note || null }),
    });
    setSubmitted(true);
    setTimeout(onDismiss, 1500);
  };

  if (submitted) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-900/90 text-green-100 px-4 py-3 rounded-lg shadow-lg z-50">
        Style note saved
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-50 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-200">Style note (optional)</span>
        <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300">
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {QUICK_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              selectedTags.includes(tag)
                ? 'bg-violet-600 border-violet-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Or type a note..."
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-500 mb-2"
      />
      <button
        onClick={submit}
        disabled={selectedTags.length === 0 && !note}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm py-1.5 rounded transition-colors"
      >
        Save
      </button>
    </div>
  );
}
```

**Step 2: Create the feedback API endpoint**

```typescript
// src/app/api/content-pipeline/edit-feedback/route.ts
import { getServerSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { editId, tags, note } = await request.json();
  if (!editId) return NextResponse.json({ error: 'editId required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('cp_edit_history')
    .update({
      edit_tags: tags || [],
      ceo_note: note || null,
    })
    .eq('id', editId);

  if (error) return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

**Step 3: Commit**

```bash
git add src/components/content-pipeline/StyleFeedbackToast.tsx src/app/api/content-pipeline/edit-feedback/route.ts
git commit -m "feat: add style feedback toast component and API endpoint"
```

---

### Task 10: Integrate Feedback Toast into Post Editor

**Files:**
- Modify: The post editing component (likely in `src/components/content-pipeline/` — read the PostsTab or post editor component)

After a post save that captured an edit, show the `StyleFeedbackToast`. The PATCH response should return the edit ID if an edit was captured.

**Step 1: Modify the PATCH endpoint to return editId**

Update `src/app/api/content-pipeline/posts/[id]/route.ts` to return `{ ...post, editId }` when an edit was captured.

**Step 2: Show toast in the editor component**

After successful save, if `response.editId` exists, render `<StyleFeedbackToast editId={response.editId} onDismiss={() => setShowFeedback(false)} />`.

**Step 3: Commit**

```bash
git commit -m "feat: integrate style feedback toast into post editor"
```

---

## Phase 3: Enhanced Voice Profile & Style Evolution

### Task 11: Expand TeamVoiceProfile Type

**Files:**
- Modify: `src/lib/types/content-pipeline.ts` (lines 120-129)

**Step 1: Read current type**

**Step 2: Expand the interface**

```typescript
export interface EditPattern {
  pattern: string;
  description: string;
  confidence: number;
  count: number;
  first_seen: string;
  last_seen: string;
}

export interface TeamVoiceProfile {
  // Existing fields (keep backward compatible)
  first_person_context?: string;
  perspective_notes?: string;
  tone?: string;
  signature_phrases?: string[];
  banned_phrases?: string[];
  industry_jargon?: string[];
  storytelling_style?: string;
  hook_patterns?: string[];

  // New fields for style learning
  vocabulary_preferences?: {
    avoid: string[];
    prefer: string[];
  };
  structure_patterns?: {
    linkedin: string[];
    email: string[];
  };
  cta_style?: string;
  content_length?: {
    linkedin: string;
    email: string;
  };
  topics_to_emphasize?: string[];
  topics_to_avoid?: string[];
  edit_patterns?: EditPattern[];
  positive_examples?: Array<{
    content_id: string;
    type: string;
    note: string;
  }>;
  last_evolved?: string;
  evolution_version?: number;
}
```

**Step 3: Commit**

```bash
git add src/lib/types/content-pipeline.ts
git commit -m "feat: expand TeamVoiceProfile type for style learning"
```

---

### Task 12: Style Evolution Trigger.dev Task

**Files:**
- Create: `src/trigger/evolve-writing-style.ts`
- Test: `src/__tests__/trigger/evolve-writing-style.test.ts`

**Step 1: Write the test**

Test the evolution logic (the part that processes edits and produces an updated voice profile) as a pure function, separate from the Trigger.dev wrapper.

```typescript
// src/__tests__/trigger/evolve-writing-style.test.ts
import { aggregateEditPatterns } from '@/lib/services/style-evolution';

describe('style-evolution', () => {
  it('aggregates duplicate patterns with counts', () => {
    const edits = [
      { auto_classified_changes: { patterns: [{ pattern: 'shortened_hook', description: 'Shortened hook' }] } },
      { auto_classified_changes: { patterns: [{ pattern: 'shortened_hook', description: 'Shortened hook again' }] } },
      { auto_classified_changes: { patterns: [{ pattern: 'removed_jargon', description: 'Removed jargon' }] } },
    ];
    const result = aggregateEditPatterns(edits as any);
    expect(result).toHaveLength(2);
    const hookPattern = result.find(p => p.pattern === 'shortened_hook');
    expect(hookPattern?.count).toBe(2);
  });
});
```

**Step 2: Implement the aggregation helper**

```typescript
// src/lib/services/style-evolution.ts
import type { EditPattern } from '@/lib/types/content-pipeline';

interface EditHistoryRow {
  auto_classified_changes: { patterns: Array<{ pattern: string; description: string }> } | null;
  created_at: string;
}

export function aggregateEditPatterns(edits: EditHistoryRow[]): EditPattern[] {
  const patternMap = new Map<string, { descriptions: string[]; count: number; first_seen: string; last_seen: string }>();

  for (const edit of edits) {
    if (!edit.auto_classified_changes?.patterns) continue;
    for (const p of edit.auto_classified_changes.patterns) {
      const existing = patternMap.get(p.pattern);
      if (existing) {
        existing.count++;
        existing.descriptions.push(p.description);
        if (edit.created_at > existing.last_seen) existing.last_seen = edit.created_at;
      } else {
        patternMap.set(p.pattern, {
          descriptions: [p.description],
          count: 1,
          first_seen: edit.created_at,
          last_seen: edit.created_at,
        });
      }
    }
  }

  return Array.from(patternMap.entries())
    .map(([pattern, data]) => ({
      pattern,
      description: data.descriptions[data.descriptions.length - 1],
      confidence: Math.min(data.count / 10, 1),
      count: data.count,
      first_seen: data.first_seen,
      last_seen: data.last_seen,
    }))
    .sort((a, b) => b.count - a.count);
}
```

**Step 3: Implement the Trigger.dev task**

```typescript
// src/trigger/evolve-writing-style.ts
import { task, schedules } from '@trigger.dev/sdk/v3';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { aggregateEditPatterns } from '@/lib/services/style-evolution';

export const evolveWritingStyle = task({
  id: 'evolve-writing-style',
  retry: { maxAttempts: 2 },
  run: async (payload: { profileId: string }) => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Get current profile + voice_profile
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('id, full_name, voice_profile')
      .eq('id', payload.profileId)
      .single();

    if (!profile) throw new Error('Profile not found');

    // 2. Get unprocessed edits
    const { data: edits } = await supabase
      .from('cp_edit_history')
      .select('*')
      .eq('profile_id', payload.profileId)
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (!edits || edits.length === 0) return { status: 'no_edits' };

    // 3. Aggregate patterns
    const aggregatedPatterns = aggregateEditPatterns(edits);

    // 4. Ask Claude to evolve the voice profile
    const anthropic = new Anthropic();
    const currentProfile = profile.voice_profile || {};

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are a writing style analyst. Given a current voice profile and recent edit patterns from an author, produce an updated voice profile.

CURRENT VOICE PROFILE:
${JSON.stringify(currentProfile, null, 2)}

RECENT EDIT PATTERNS (${edits.length} edits analyzed):
${aggregatedPatterns.map(p => `- ${p.pattern} (${p.count}x): ${p.description}`).join('\n')}

SAMPLE EDITS (most recent 5):
${edits.slice(-5).map(e => `Original: "${e.original_text?.slice(0, 200)}"\nEdited: "${e.edited_text?.slice(0, 200)}"\nCEO note: ${e.ceo_note || 'none'}\nTags: ${(e.edit_tags || []).join(', ') || 'none'}`).join('\n---\n')}

Return a JSON voice profile that:
1. Preserves existing preferences that weren't contradicted
2. Updates preferences based on consistent patterns (3+ occurrences)
3. Adds new patterns with confidence scores
4. Separates linkedin vs email structure patterns
5. Includes vocabulary_preferences (avoid/prefer lists) based on actual word replacements

Return ONLY the JSON object, no explanation.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Failed to parse evolved profile');

    const evolvedProfile = JSON.parse(jsonMatch[0]);
    evolvedProfile.edit_patterns = aggregatedPatterns;
    evolvedProfile.last_evolved = new Date().toISOString();
    evolvedProfile.evolution_version = (currentProfile.evolution_version || 0) + 1;

    // 5. Save evolved profile
    await supabase
      .from('team_profiles')
      .update({ voice_profile: evolvedProfile })
      .eq('id', payload.profileId);

    // 6. Mark edits as processed
    await supabase
      .from('cp_edit_history')
      .update({ processed: true })
      .eq('profile_id', payload.profileId)
      .eq('processed', false);

    return {
      status: 'evolved',
      version: evolvedProfile.evolution_version,
      patternsProcessed: edits.length,
      topPatterns: aggregatedPatterns.slice(0, 5),
    };
  },
});

// Weekly schedule: Sunday 3:30 AM UTC (after knowledge consolidation at 3 AM)
export const weeklyStyleEvolution = schedules.task({
  id: 'weekly-style-evolution',
  cron: '30 3 * * 0',
  run: async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all profiles with unprocessed edits
    const { data: profiles } = await supabase
      .from('cp_edit_history')
      .select('profile_id')
      .eq('processed', false)
      .not('profile_id', 'is', null);

    if (!profiles) return { status: 'no_profiles' };

    const uniqueProfiles = [...new Set(profiles.map(p => p.profile_id))];

    for (const profileId of uniqueProfiles) {
      await evolveWritingStyle.trigger({ profileId });
    }

    return { status: 'triggered', profileCount: uniqueProfiles.length };
  },
});
```

**Step 4: Run tests, commit**

```bash
git add src/trigger/evolve-writing-style.ts src/lib/services/style-evolution.ts src/__tests__/trigger/evolve-writing-style.test.ts
git commit -m "feat: add style evolution Trigger.dev task (weekly + on-demand)"
```

---

## Phase 4: Prompt Injection into AI Writing

### Task 13: Voice Profile Prompt Builder

**Files:**
- Create: `src/lib/ai/content-pipeline/voice-prompt-builder.ts`
- Test: `src/__tests__/lib/ai/voice-prompt-builder.test.ts`

**Step 1: Write test**

```typescript
describe('buildVoicePromptSection', () => {
  it('builds a prompt section from a full voice profile', () => {
    const result = buildVoicePromptSection({
      tone: 'conversational',
      vocabulary_preferences: { avoid: ['leverage'], prefer: ['use'] },
      structure_patterns: { linkedin: ['short paragraphs'], email: ['subheadings'] },
      edit_patterns: [{ pattern: 'shortened_hook', description: 'Shortened hooks', confidence: 0.9, count: 8, first_seen: '', last_seen: '' }],
    }, 'linkedin');
    expect(result).toContain('conversational');
    expect(result).toContain('AVOID: leverage');
    expect(result).toContain('shortened_hook');
    expect(result).toContain('short paragraphs');
  });

  it('handles empty/null voice profile gracefully', () => {
    const result = buildVoicePromptSection(null, 'linkedin');
    expect(result).toBe('');
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/ai/content-pipeline/voice-prompt-builder.ts
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

export function buildVoicePromptSection(
  profile: TeamVoiceProfile | null | undefined,
  contentType: 'linkedin' | 'email'
): string {
  if (!profile) return '';

  const sections: string[] = [];

  sections.push('## Writing Style (learned from author edits)');

  if (profile.tone) sections.push(`Tone: ${profile.tone}`);

  if (profile.vocabulary_preferences) {
    const { avoid, prefer } = profile.vocabulary_preferences;
    if (avoid?.length) sections.push(`Vocabulary: AVOID: ${avoid.join(', ')}`);
    if (prefer?.length) sections.push(`Vocabulary: PREFER: ${prefer.join(', ')}`);
  }

  if (profile.banned_phrases?.length) {
    sections.push(`NEVER use these phrases: ${profile.banned_phrases.join(', ')}`);
  }

  const structurePatterns = profile.structure_patterns?.[contentType];
  if (structurePatterns?.length) {
    sections.push(`Structure (${contentType}): ${structurePatterns.join('. ')}`);
  }

  if (profile.cta_style) sections.push(`CTA style: ${profile.cta_style}`);

  const lengthTarget = profile.content_length?.[contentType];
  if (lengthTarget) sections.push(`Length target: ${lengthTarget}`);

  if (profile.storytelling_style) sections.push(`Storytelling: ${profile.storytelling_style}`);

  if (profile.edit_patterns?.length) {
    sections.push('\n## Learned patterns (from recent edits):');
    const topPatterns = profile.edit_patterns
      .filter(p => p.confidence >= 0.3)
      .slice(0, 5);
    for (const p of topPatterns) {
      sections.push(`- ${p.description} (${p.count}x, confidence: ${(p.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (profile.positive_examples?.length) {
    sections.push('\n## Approved examples (author marked "Good as-is"):');
    sections.push(`${profile.positive_examples.length} examples on file — match this quality.`);
  }

  return sections.join('\n');
}
```

**Step 3: Run tests, commit**

```bash
git add src/lib/ai/content-pipeline/voice-prompt-builder.ts src/__tests__/lib/ai/voice-prompt-builder.test.ts
git commit -m "feat: add voice profile prompt builder for AI injection"
```

---

### Task 14: Inject Voice Profile into Post Writer

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-writer.ts` (lines 29-60 buildVoiceSection, lines 118-187 writePostFreeform)

**Step 1: Read the current file**

Understand how `buildVoiceSection` currently works and where it's called.

**Step 2: Replace or augment buildVoiceSection**

Import `buildVoicePromptSection` from the new module. In `writePostFreeform` and `writePostWithTemplate`, add the enhanced voice prompt section to the system/user prompt alongside the existing voice section.

Key: The new `buildVoicePromptSection` produces a richer prompt section. The existing `buildVoiceSection` likely handles `first_person_context`, `perspective_notes`, etc. — keep those and ADD the new style-learning context.

**Step 3: Run tests to verify nothing broke, commit**

```bash
git add src/lib/ai/content-pipeline/post-writer.ts
git commit -m "feat: inject evolved voice profile into post writer"
```

---

### Task 15: Inject Voice Profile into Post Polish

**Files:**
- Modify: `src/lib/ai/content-pipeline/post-polish.ts` (lines 309-339 buildPolishPrompt)

Same pattern as Task 14. Add voice prompt section to the polish prompt so the AI polishes toward the author's evolved style.

**Commit:**

```bash
git add src/lib/ai/content-pipeline/post-polish.ts
git commit -m "feat: inject evolved voice profile into post polish"
```

---

### Task 16: Inject Voice Profile into Briefing Agent

**Files:**
- Modify: `src/lib/ai/content-pipeline/briefing-agent.ts` (lines 116-144 generateSuggestedAngles)

Add voice profile context to angle suggestion prompts so suggested angles align with the author's evolved preferences.

**Commit:**

```bash
git add src/lib/ai/content-pipeline/briefing-agent.ts
git commit -m "feat: inject evolved voice profile into briefing agent"
```

---

## Phase 5: Email List Consolidation

### Task 17: Subscriber Import Admin Endpoint

**Files:**
- Create: `src/app/api/admin/import-subscribers/route.ts`
- Test: `src/__tests__/api/admin/import-subscribers.test.ts`

**Step 1: Write the test**

Test CSV parsing, deduplication, and source tagging.

**Step 2: Implement**

`POST /api/admin/import-subscribers` accepts:
- `source`: 'csv' | 'resend' | 'positive_replies' | 'purchasers'
- `data`: CSV string (for csv source) or empty (for auto-pull sources)
- `teamId`: target team

For CSV: parse rows, extract email/first_name/last_name/company, tag with `metadata.source = 'csv_import'`.
For Resend: call Resend API to list contacts from gtm-system's audience, import.
For positive_replies: query `reply_pipeline` in Supabase where status = 'completed' and email is not null.
For purchasers: query Stripe API for customers with successful charges.

All sources: upsert into `email_subscribers` with email dedup (case-insensitive).

**Step 3: Run tests, commit**

```bash
git add src/app/api/admin/import-subscribers/route.ts src/__tests__/api/admin/import-subscribers.test.ts
git commit -m "feat: add admin subscriber import endpoint (CSV, Resend, replies, purchasers)"
```

---

### Task 18: Subscriber Sync Webhook from gtm-system

**Files:**
- Create: `src/app/api/webhooks/subscriber-sync/route.ts`

**Step 1: Implement**

```typescript
// src/app/api/webhooks/subscriber-sync/route.ts
import { createSupabaseAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Verify webhook secret
  const secret = request.headers.get('x-webhook-secret');
  if (secret !== process.env.SUBSCRIBER_SYNC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { email, first_name, last_name, company, source, metadata, team_id } = body;

  if (!email || !team_id) {
    return NextResponse.json({ error: 'email and team_id required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Upsert subscriber (dedup by email within team)
  const { error } = await supabase
    .from('email_subscribers')
    .upsert(
      {
        team_id,
        email: email.toLowerCase().trim(),
        first_name: first_name || null,
        last_name: last_name || null,
        status: 'active',
        metadata: {
          source: source || 'gtm_sync',
          company: company || null,
          ...(metadata || {}),
          synced_at: new Date().toISOString(),
        },
      },
      { onConflict: 'team_id,email' }
    );

  if (error) {
    console.error('[subscriber-sync] Upsert failed:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

**Step 2: Also need to fire this webhook from gtm-system**

In gtm-system, after a lead becomes warm (positive reply handler, meeting booked handler), fire a POST to `{MAGNETLAB_URL}/api/webhooks/subscriber-sync` with the lead data. This is a separate change in gtm-system — document it here but implement when working in that repo.

**Step 3: Commit**

```bash
git add src/app/api/webhooks/subscriber-sync/route.ts
git commit -m "feat: add subscriber sync webhook endpoint for gtm-system integration"
```

---

## Phase 6: Daily Email Generator

### Task 19: Newsletter Email AI Module

**Files:**
- Create: `src/lib/ai/content-pipeline/email-writer.ts`
- Test: `src/__tests__/lib/ai/email-writer.test.ts`

**Step 1: Write the test**

```typescript
// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({
          subject: 'How I landed 3 clients this week using one system',
          body: '# The system that changed everything\n\nHere is what actually happened...',
        })}]
      })
    }
  }))
}));

describe('writeNewsletterEmail', () => {
  it('generates a newsletter-style email from a topic + knowledge context', async () => {
    const result = await writeNewsletterEmail({
      topic: 'outbound sales systems',
      knowledgeContext: 'Some insights about building outbound...',
      voiceProfile: { tone: 'conversational' },
      todaysLinkedInTopic: 'LinkedIn hooks that work',
    });
    expect(result.subject).toBeDefined();
    expect(result.body).toBeDefined();
    expect(result.body.length).toBeGreaterThan(100);
  });
});
```

**Step 2: Implement**

```typescript
// src/lib/ai/content-pipeline/email-writer.ts
import Anthropic from '@anthropic-ai/sdk';
import { buildVoicePromptSection } from './voice-prompt-builder';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

interface WriteEmailInput {
  topic: string;
  knowledgeContext: string;
  voiceProfile: TeamVoiceProfile | null;
  todaysLinkedInTopic?: string;
  subscriberFirstName?: string;
}

interface EmailResult {
  subject: string;
  body: string;
}

export async function writeNewsletterEmail(input: WriteEmailInput): Promise<EmailResult> {
  const anthropic = new Anthropic();
  const voiceSection = buildVoicePromptSection(input.voiceProfile, 'email');

  const prompt = `Write a daily newsletter email for a B2B audience.

TOPIC: ${input.topic}
${input.todaysLinkedInTopic ? `Today's LinkedIn post topic (for thematic consistency, but write DIFFERENT content): ${input.todaysLinkedInTopic}` : ''}

KNOWLEDGE CONTEXT:
${input.knowledgeContext}

${voiceSection}

NEWSLETTER EMAIL RULES:
- This is NOT a LinkedIn post. It should be longer, more detailed, more utility-focused.
- Include actionable takeaways the reader can use immediately.
- Use subheadings to break up the content.
- Open with a personal/relatable hook (not "Hey {{first_name}}")
- 300-500 words in the body.
- End with a soft CTA (reply to this email, check out a resource, etc.)
- Conversational but substantive — the reader should feel like they learned something.

Return JSON with "subject" (compelling, 5-10 words) and "body" (markdown formatted).`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse email');
  return JSON.parse(jsonMatch[0]);
}
```

**Step 3: Run tests, commit**

```bash
git add src/lib/ai/content-pipeline/email-writer.ts src/__tests__/lib/ai/email-writer.test.ts
git commit -m "feat: add newsletter email AI writer module"
```

---

### Task 20: Daily Email Draft Generation Endpoint

**Files:**
- Create: `src/app/api/email/generate-daily/route.ts`

**Step 1: Implement**

`POST /api/email/generate-daily` — authenticated endpoint that:
1. Gets the user's team + active profile
2. Fetches today's approved LinkedIn post (if any) for topic consistency
3. Builds a knowledge brief from the AI Brain
4. Calls `writeNewsletterEmail()` with voice profile
5. Creates a draft broadcast in `email_broadcasts`
6. Returns the draft

**Step 2: Commit**

```bash
git add src/app/api/email/generate-daily/route.ts
git commit -m "feat: add daily email draft generation endpoint"
```

---

## Phase 7: Weekly Lead Magnet Pipeline

### Task 21: Lead Magnet Topic Suggestion Task

**Files:**
- Create: `src/trigger/suggest-lead-magnet-topics.ts`

Weekly Trigger.dev task (Monday 8 AM UTC) that:
1. Analyzes the knowledge base (gap analysis + high-quality topics)
2. Checks recent engagement data (which topics performed well)
3. Generates 3 topic suggestions with rationale
4. Stores them in a new `cp_lead_magnet_suggestions` table (or reuses `cp_content_ideas` with type='lead_magnet')

**Commit:**

```bash
git add src/trigger/suggest-lead-magnet-topics.ts
git commit -m "feat: add weekly lead magnet topic suggestion task"
```

---

### Task 22: Promotion Post Generator

**Files:**
- Create: `src/lib/ai/content-pipeline/promotion-post-writer.ts`

Given a published lead magnet (title, description, URL), generate 3-5 LinkedIn promotional posts to spread across the week. Uses the author's evolved voice profile to match their style.

Each post has a different angle: problem-aware, curiosity-driven, social proof, value-first, FOMO.

**Commit:**

```bash
git add src/lib/ai/content-pipeline/promotion-post-writer.ts
git commit -m "feat: add lead magnet promotion post generator"
```

---

## Phase 8: gtm-system Integration

### Task 23: Add Webhook Firing to gtm-system Reply Handlers

**Files (in gtm-system repo):**
- Modify: `src/app/api/webhooks/plusvibe/route.ts`
- Modify: `src/app/api/webhooks/heyreach/route.ts`
- Modify: `src/app/api/webhooks/calcom/route.ts`

After a lead becomes warm (positive reply, meeting booked), fire a POST to magnetlab's subscriber sync webhook:

```typescript
// Fire-and-forget to magnetlab subscriber sync
fetch(`${process.env.MAGNETLAB_URL}/api/webhooks/subscriber-sync`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-webhook-secret': process.env.MAGNETLAB_SUBSCRIBER_SYNC_SECRET!,
  },
  body: JSON.stringify({
    email: lead.email,
    first_name: lead.first_name || lead.full_name?.split(' ')[0],
    last_name: lead.last_name,
    company: lead.company,
    source: 'positive_reply',
    team_id: process.env.MAGNETLAB_TEAM_ID,
  }),
  signal: AbortSignal.timeout(5000),
}).catch(err => console.error('[subscriber-sync] Failed:', err));
```

**Env vars needed on gtm-system (Railway):**
- `MAGNETLAB_URL=https://magnetlab.app`
- `MAGNETLAB_SUBSCRIBER_SYNC_SECRET=<generate-random-secret>`
- `MAGNETLAB_TEAM_ID=<your-team-id>`

**Also set on magnetlab (Vercel):**
- `SUBSCRIBER_SYNC_WEBHOOK_SECRET=<same-secret>`

**Commit (in gtm-system):**

```bash
git commit -m "feat: fire subscriber sync webhook to magnetlab on warm lead events"
```

---

## Phase 9: Guides

### Task 24: CEO Content Operations Guide

**Files:**
- Create: `src/app/(dashboard)/help/page.tsx` (in-app help page)
- Create: `src/components/help/ContentOpsGuide.tsx`

Build an in-app help page accessible from the dashboard sidebar. Contains the CEO daily/weekly routine, troubleshooting FAQ, and style feedback instructions.

Content from the design doc Section 4 (CEO guide). Render as styled markdown.

**Commit:**

```bash
git commit -m "feat: add in-app CEO content operations guide"
```

---

### Task 25: Developer Troubleshooting Guide

**Files:**
- Create: `docs/troubleshooting-content-production.md`

Standalone markdown doc with the troubleshooting table, debug queries, key dashboards, and common failure modes from the design doc Section 4 (developer guide).

**Commit:**

```bash
git commit -m "docs: add developer troubleshooting guide for content production"
```

---

## Phase 10: Deploy & Verify

### Task 26: Deploy Everything

**Step 1: Push Supabase migration**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push
```

**Step 2: Deploy magnetlab to Vercel**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod
```

**Step 3: Deploy Trigger.dev tasks**

```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 4: Set env vars**

On Vercel:
- `SUBSCRIBER_SYNC_WEBHOOK_SECRET`

On Railway (gtm-system):
- `MAGNETLAB_URL=https://magnetlab.app`
- `MAGNETLAB_SUBSCRIBER_SYNC_SECRET`
- `MAGNETLAB_TEAM_ID`

**Step 5: Deploy gtm-system webhook changes**

Push to main, verify Railway auto-deploy.

**Step 6: Run the one-time subscriber import**

Use the admin import endpoint to pull from all sources.

**Step 7: Verify end-to-end**

1. Edit a post → check `cp_edit_history` has a row
2. Wait for classification → check `auto_classified_changes` populated
3. Tag an edit → check `edit_tags` updated
4. Trigger style evolution → check `voice_profile` updated
5. Generate a new post → verify voice profile context in the prompt
6. Generate a daily email → verify newsletter format
7. Trigger subscriber sync webhook → verify new subscriber in magnetlab

---

## Summary: Implementation Order

| Phase | Tasks | Priority | Effort |
|-------|-------|----------|--------|
| 1. Edit-Tracking Foundation | 1-6 | Critical | 2-3 hours |
| 2. Edit Classification & Feedback UI | 7-10 | Critical | 2 hours |
| 3. Voice Profile & Style Evolution | 11-12 | Critical | 2 hours |
| 4. Prompt Injection | 13-16 | Critical | 1-2 hours |
| 5. Email List Consolidation | 17-18 | High | 1-2 hours |
| 6. Daily Email Generator | 19-20 | High | 1-2 hours |
| 7. Weekly Lead Magnet Pipeline | 21-22 | Medium | 1-2 hours |
| 8. gtm-system Integration | 23 | High | 30 min |
| 9. Guides | 24-25 | Medium | 1 hour |
| 10. Deploy & Verify | 26 | Critical | 1 hour |

**Total: ~26 tasks across 10 phases. Critical path: Phases 1-4 (the style-learning system).**
