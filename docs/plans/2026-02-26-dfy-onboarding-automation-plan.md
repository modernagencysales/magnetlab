# DFY Onboarding Automation Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 new automated steps to the DFY onboarding pipeline: AI content review, brand kit application, quiz generation, and thank-you page setup.

**Architecture:** 4 new handler functions in gtm-system's `dispatch-dfy-automation` task, each calling new magnetlab external API endpoints. New AI modules in magnetlab for content review and quiz generation. New prompt templates in the prompt registry. Database migration for `review_data` column on posts.

**Tech Stack:** Next.js 15 (magnetlab), Trigger.dev v4 (gtm-system), Claude Sonnet (AI), Supabase PostgreSQL, Zod validation.

---

## Task 1: Database Migration — Add `review_data` Column to Posts

**Files:**
- Create: `magnetlab/supabase/migrations/20260226100000_post_review_data.sql`

**Step 1: Write the migration**

```sql
-- Add review_data JSONB column to cp_pipeline_posts for AI content review results
ALTER TABLE cp_pipeline_posts
ADD COLUMN IF NOT EXISTS review_data jsonb DEFAULT NULL;

-- Add index for filtering by review category
CREATE INDEX IF NOT EXISTS idx_cp_pipeline_posts_review_category
ON cp_pipeline_posts ((review_data->>'review_category'))
WHERE review_data IS NOT NULL;

COMMENT ON COLUMN cp_pipeline_posts.review_data IS 'AI content review results: {review_score, review_category, review_notes, consistency_flags, reviewed_at}';
```

**Step 2: Apply the migration**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx supabase db push
```
Expected: Migration applies successfully.

**Step 3: Commit**

```bash
git add supabase/migrations/20260226100000_post_review_data.sql
git commit -m "feat: add review_data JSONB column to cp_pipeline_posts"
```

---

## Task 2: Content Review Prompt — Add to Prompt Registry

**Files:**
- Modify: `magnetlab/src/lib/ai/content-pipeline/prompt-defaults.ts`

**Step 1: Add the `content-review` prompt default**

Add this entry to the `PROMPT_DEFAULTS` record in `prompt-defaults.ts`, after the last existing entry:

```typescript
PROMPT_DEFAULTS['content-review'] = {
  slug: 'content-review',
  name: 'DFY Content Review',
  category: 'content_writing',
  description: 'Reviews a batch of LinkedIn posts for quality, AI patterns, consistency, and provides actionable edit recommendations. Used by the DFY onboarding pipeline.',
  system_prompt: `You are a senior LinkedIn content strategist reviewing posts for a client. You evaluate each post on quality, voice consistency, engagement potential, and flag any issues. You are direct and specific in your feedback — no vague suggestions.`,
  user_prompt: `Review the following LinkedIn posts written for a client. For EACH post, provide:
1. A quality score from 1-10
2. A category: "excellent" (8-10, publish as-is), "good_with_edits" (5-7, needs minor fixes), "needs_rewrite" (3-4, salvageable but needs major work), or "delete" (1-2, AI refusal, off-topic, or unsalvageable)
3. Specific edit recommendations (actionable, not vague)
4. Any consistency flags (contradictions with other posts, name/gender inconsistencies, repeated hooks across posts)

{{voice_profile}}

{{icp_summary}}

Here are the posts to review:

{{posts_json}}

IMPORTANT:
- Flag any post where the AI clearly refused to write content (e.g., "I cannot generate content that...", "As an AI...", ethical disclaimers that replaced the actual post)
- Flag posts that reuse the same hook pattern as another post in this batch
- Flag name/gender/pronoun inconsistencies across all posts (e.g., "Charlie" referred to as both he/she)
- Score hooks harshly: generic hooks like "Here's the thing about X" score low
- Reward specificity: numbers, timeframes, first-person stories, contrast

Return a JSON array:
\`\`\`json
[
  {
    "post_id": "uuid",
    "review_score": 7.5,
    "review_category": "good_with_edits",
    "review_notes": ["Hook is too generic — add a specific number or timeframe", "Body is strong but CTA is weak"],
    "consistency_flags": []
  }
]
\`\`\``,
  model: 'claude-sonnet-4-6',
  temperature: 0.3,
  max_tokens: 8000,
  variables: [
    { name: 'posts_json', description: 'JSON array of posts with id, draft_content, final_content, hook_score', example: '[{"id":"...","final_content":"..."}]' },
    { name: 'voice_profile', description: 'Client voice profile section (tone, style, banned phrases)', example: 'Voice: Professional but conversational...' },
    { name: 'icp_summary', description: 'Client ICP summary (industry, job titles, pain points)', example: 'ICP: C-suite executives in tech, pain points: scaling teams...' },
  ],
};
```

**Step 2: Add the `quiz-generator` prompt default**

Add this entry right after the content-review entry:

```typescript
PROMPT_DEFAULTS['quiz-generator'] = {
  slug: 'quiz-generator',
  name: 'DFY Quiz Generator',
  category: 'content_writing',
  description: 'Generates qualification form questions from ICP data, knowledge base insights, and brand kit context. Used by the DFY onboarding pipeline.',
  system_prompt: `You are a conversion optimization expert designing a short qualification quiz for a lead magnet landing page. The quiz should feel valuable to the prospect (not like a gate) while identifying if they match the client's ideal customer profile.`,
  user_prompt: `Generate 3-5 qualification questions for a lead magnet landing page based on the following data:

**Client:** {{client_name}}

**ICP Data:**
{{icp_json}}

**Knowledge Base Context (client's expertise and market intelligence):**
{{knowledge_context}}

**Brand Context (client's positioning and audience pain points):**
{{brand_context}}

RULES:
- First question must be easy and non-threatening (e.g., role, company size, or industry)
- Middle questions should be qualifying multiple-choice that reveal ICP fit
- Last question MUST be open-ended text: "What's your biggest challenge with [relevant topic] right now?" — this gives the client a conversation starter for the sales call
- Maximum 5 questions (completion rate drops sharply after 5)
- Questions should feel like they're helping the prospect get a better result, not interrogating them
- For qualifying multiple-choice: mark which answers qualify (match the ICP)

Return a JSON array:
\`\`\`json
[
  {
    "question_text": "What best describes your role?",
    "answer_type": "multiple_choice",
    "options": ["C-Suite / VP", "Director / Manager", "Individual Contributor", "Consultant / Advisor"],
    "qualifying_answer": ["C-Suite / VP", "Director / Manager"],
    "is_qualifying": true,
    "is_required": true
  }
]
\`\`\`

answer_type must be one of: "yes_no", "text", "textarea", "multiple_choice"
For yes_no: qualifying_answer is "yes" or "no"
For text/textarea: qualifying_answer is null, is_qualifying is false
For multiple_choice: qualifying_answer is an array of qualifying option strings, options must have at least 2 items`,
  model: 'claude-sonnet-4-6',
  temperature: 0.5,
  max_tokens: 3000,
  variables: [
    { name: 'client_name', description: 'Client company or person name', example: 'Rachel Pierre' },
    { name: 'icp_json', description: 'Processed intake ICP data (industry, job_titles, pain_points, buying_triggers)', example: '{"industry":"tech","job_titles":["CTO","VP Eng"]}' },
    { name: 'knowledge_context', description: 'Relevant knowledge base entries (market_intel, objection, question types)', example: 'Market Intel: Most CTOs struggle with...' },
    { name: 'brand_context', description: 'Brand kit positioning data (urgent_pains, frequent_questions, credibility_markers)', example: 'Urgent pains: scaling engineering teams...' },
  ],
};
```

**Step 3: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds with no type errors.

**Step 4: Commit**

```bash
git add src/lib/ai/content-pipeline/prompt-defaults.ts
git commit -m "feat: add content-review and quiz-generator prompt defaults"
```

---

## Task 3: Content Review AI Module

**Files:**
- Create: `magnetlab/src/lib/ai/content-pipeline/content-reviewer.ts`
- Test: `magnetlab/src/__tests__/lib/ai/content-reviewer.test.ts`

**Step 1: Write the test**

Create `src/__tests__/lib/ai/content-reviewer.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { buildReviewPayload, parseReviewResults, type ReviewResult } from '@/lib/ai/content-pipeline/content-reviewer';

describe('content-reviewer', () => {
  describe('buildReviewPayload', () => {
    it('formats posts into JSON with required fields', () => {
      const posts = [
        { id: 'post-1', final_content: 'My post content', hook_score: 7 },
        { id: 'post-2', final_content: 'Another post', hook_score: 4 },
      ];
      const payload = buildReviewPayload(posts);
      const parsed = JSON.parse(payload);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ id: 'post-1', final_content: 'My post content', hook_score: 7 });
    });

    it('falls back to draft_content when final_content is null', () => {
      const posts = [
        { id: 'post-1', final_content: null, draft_content: 'Draft content', hook_score: 5 },
      ];
      const payload = buildReviewPayload(posts);
      const parsed = JSON.parse(payload);
      expect(parsed[0].final_content).toBe('Draft content');
    });
  });

  describe('parseReviewResults', () => {
    it('parses valid review JSON', () => {
      const raw = JSON.stringify([
        {
          post_id: 'post-1',
          review_score: 8,
          review_category: 'excellent',
          review_notes: ['Great hook'],
          consistency_flags: [],
        },
      ]);
      const results = parseReviewResults(raw);
      expect(results).toHaveLength(1);
      expect(results[0].review_category).toBe('excellent');
    });

    it('clamps scores to 1-10 range', () => {
      const raw = JSON.stringify([
        { post_id: 'p1', review_score: 15, review_category: 'excellent', review_notes: [], consistency_flags: [] },
        { post_id: 'p2', review_score: -2, review_category: 'delete', review_notes: [], consistency_flags: [] },
      ]);
      const results = parseReviewResults(raw);
      expect(results[0].review_score).toBe(10);
      expect(results[1].review_score).toBe(1);
    });

    it('validates review_category values', () => {
      const raw = JSON.stringify([
        { post_id: 'p1', review_score: 5, review_category: 'invalid_category', review_notes: [], consistency_flags: [] },
      ]);
      const results = parseReviewResults(raw);
      expect(results[0].review_category).toBe('needs_rewrite');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/lib/ai/content-reviewer.test.ts --no-coverage
```
Expected: FAIL — module not found.

**Step 3: Write the content reviewer module**

Create `src/lib/ai/content-pipeline/content-reviewer.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
import { logError } from '@/lib/utils/logger';

export interface ReviewResult {
  post_id: string;
  review_score: number;
  review_category: 'excellent' | 'good_with_edits' | 'needs_rewrite' | 'delete';
  review_notes: string[];
  consistency_flags: string[];
}

export interface ReviewablePost {
  id: string;
  final_content: string | null;
  draft_content?: string | null;
  hook_score?: number | null;
}

const VALID_CATEGORIES = ['excellent', 'good_with_edits', 'needs_rewrite', 'delete'] as const;

function categoryFromScore(score: number): ReviewResult['review_category'] {
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good_with_edits';
  if (score >= 3) return 'needs_rewrite';
  return 'delete';
}

export function buildReviewPayload(posts: ReviewablePost[]): string {
  return JSON.stringify(
    posts.map((p) => ({
      id: p.id,
      final_content: p.final_content || p.draft_content || '',
      hook_score: p.hook_score ?? null,
    }))
  );
}

export function parseReviewResults(raw: string): ReviewResult[] {
  let parsed: unknown[];
  try {
    // Handle markdown code blocks
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse review results JSON');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Review results must be a JSON array');
  }

  return parsed.map((item: Record<string, unknown>) => {
    const score = Math.max(1, Math.min(10, Number(item.review_score) || 5));
    const rawCategory = String(item.review_category || '');
    const category = VALID_CATEGORIES.includes(rawCategory as typeof VALID_CATEGORIES[number])
      ? (rawCategory as ReviewResult['review_category'])
      : categoryFromScore(score);

    return {
      post_id: String(item.post_id || ''),
      review_score: score,
      review_category: category,
      review_notes: Array.isArray(item.review_notes) ? item.review_notes.map(String) : [],
      consistency_flags: Array.isArray(item.consistency_flags) ? item.consistency_flags.map(String) : [],
    };
  });
}

export async function reviewPosts(
  posts: ReviewablePost[],
  options: {
    voiceProfile?: string;
    icpSummary?: string;
  } = {}
): Promise<ReviewResult[]> {
  const prompt = await getPrompt('content-review');

  const postsJson = buildReviewPayload(posts);
  const voiceSection = options.voiceProfile
    ? `**Voice Profile:**\n${options.voiceProfile}`
    : '';
  const icpSection = options.icpSummary
    ? `**ICP Summary:**\n${options.icpSummary}`
    : '';

  const userPrompt = interpolatePrompt(prompt.user_prompt, {
    posts_json: postsJson,
    voice_profile: voiceSection,
    icp_summary: icpSection,
  });

  const client = new Anthropic();
  const response = await client.messages.create({
    model: prompt.model || 'claude-sonnet-4-6',
    max_tokens: prompt.max_tokens || 8000,
    temperature: prompt.temperature ?? 0.3,
    system: prompt.system_prompt || '',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseReviewResults(text);
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/lib/ai/content-reviewer.test.ts --no-coverage
```
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/content-reviewer.ts src/__tests__/lib/ai/content-reviewer.test.ts
git commit -m "feat: add content reviewer AI module with tests"
```

---

## Task 4: Quiz Generator AI Module

**Files:**
- Create: `magnetlab/src/lib/ai/content-pipeline/quiz-generator.ts`
- Test: `magnetlab/src/__tests__/lib/ai/quiz-generator.test.ts`

**Step 1: Write the test**

Create `src/__tests__/lib/ai/quiz-generator.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { parseQuizQuestions, validateQuizQuestion, type GeneratedQuestion } from '@/lib/ai/content-pipeline/quiz-generator';

describe('quiz-generator', () => {
  describe('parseQuizQuestions', () => {
    it('parses valid quiz JSON', () => {
      const raw = JSON.stringify([
        {
          question_text: 'What is your role?',
          answer_type: 'multiple_choice',
          options: ['CEO', 'VP', 'Manager', 'IC'],
          qualifying_answer: ['CEO', 'VP'],
          is_qualifying: true,
          is_required: true,
        },
      ]);
      const questions = parseQuizQuestions(raw);
      expect(questions).toHaveLength(1);
      expect(questions[0].answer_type).toBe('multiple_choice');
    });

    it('caps at 5 questions', () => {
      const raw = JSON.stringify(
        Array.from({ length: 8 }, (_, i) => ({
          question_text: `Q${i}`,
          answer_type: 'text',
          options: null,
          qualifying_answer: null,
          is_qualifying: false,
          is_required: true,
        }))
      );
      const questions = parseQuizQuestions(raw);
      expect(questions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('validateQuizQuestion', () => {
    it('rejects multiple_choice with fewer than 2 options', () => {
      const q: GeneratedQuestion = {
        question_text: 'Pick one',
        answer_type: 'multiple_choice',
        options: ['Only one'],
        qualifying_answer: ['Only one'],
        is_qualifying: true,
        is_required: true,
      };
      expect(validateQuizQuestion(q)).toBe(false);
    });

    it('accepts valid yes_no question', () => {
      const q: GeneratedQuestion = {
        question_text: 'Do you manage a team?',
        answer_type: 'yes_no',
        options: null,
        qualifying_answer: 'yes',
        is_qualifying: true,
        is_required: true,
      };
      expect(validateQuizQuestion(q)).toBe(true);
    });

    it('accepts valid text question', () => {
      const q: GeneratedQuestion = {
        question_text: 'What is your biggest challenge?',
        answer_type: 'textarea',
        options: null,
        qualifying_answer: null,
        is_qualifying: false,
        is_required: true,
      };
      expect(validateQuizQuestion(q)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/lib/ai/quiz-generator.test.ts --no-coverage
```
Expected: FAIL — module not found.

**Step 3: Write the quiz generator module**

Create `src/lib/ai/content-pipeline/quiz-generator.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';

export interface GeneratedQuestion {
  question_text: string;
  answer_type: 'yes_no' | 'text' | 'textarea' | 'multiple_choice';
  options: string[] | null;
  qualifying_answer: string | string[] | null;
  is_qualifying: boolean;
  is_required: boolean;
}

const VALID_ANSWER_TYPES = ['yes_no', 'text', 'textarea', 'multiple_choice'] as const;
const MAX_QUESTIONS = 5;

export function validateQuizQuestion(q: GeneratedQuestion): boolean {
  if (!q.question_text || q.question_text.trim().length === 0) return false;
  if (!VALID_ANSWER_TYPES.includes(q.answer_type as typeof VALID_ANSWER_TYPES[number])) return false;
  if (q.answer_type === 'multiple_choice') {
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
  }
  if (q.answer_type === 'yes_no' && q.is_qualifying) {
    if (q.qualifying_answer !== 'yes' && q.qualifying_answer !== 'no') return false;
  }
  return true;
}

export function parseQuizQuestions(raw: string): GeneratedQuestion[] {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('Quiz questions must be a JSON array');
  }

  const questions: GeneratedQuestion[] = parsed
    .slice(0, MAX_QUESTIONS)
    .map((item: Record<string, unknown>) => ({
      question_text: String(item.question_text || ''),
      answer_type: VALID_ANSWER_TYPES.includes(item.answer_type as typeof VALID_ANSWER_TYPES[number])
        ? (item.answer_type as GeneratedQuestion['answer_type'])
        : 'text',
      options: Array.isArray(item.options) ? item.options.map(String) : null,
      qualifying_answer: item.qualifying_answer ?? null,
      is_qualifying: Boolean(item.is_qualifying),
      is_required: item.is_required !== false,
    }))
    .filter(validateQuizQuestion);

  return questions;
}

export async function generateQuizQuestions(options: {
  clientName: string;
  icpJson: string;
  knowledgeContext: string;
  brandContext: string;
}): Promise<GeneratedQuestion[]> {
  const prompt = await getPrompt('quiz-generator');

  const userPrompt = interpolatePrompt(prompt.user_prompt, {
    client_name: options.clientName,
    icp_json: options.icpJson,
    knowledge_context: options.knowledgeContext || 'No knowledge base data available.',
    brand_context: options.brandContext || 'No brand kit data available.',
  });

  const client = new Anthropic();
  const response = await client.messages.create({
    model: prompt.model || 'claude-sonnet-4-6',
    max_tokens: prompt.max_tokens || 3000,
    temperature: prompt.temperature ?? 0.5,
    system: prompt.system_prompt || '',
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return parseQuizQuestions(text);
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/lib/ai/quiz-generator.test.ts --no-coverage
```
Expected: All 4 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/content-pipeline/quiz-generator.ts src/__tests__/lib/ai/quiz-generator.test.ts
git commit -m "feat: add quiz generator AI module with tests"
```

---

## Task 5: External API — Review Content

**Files:**
- Create: `magnetlab/src/app/api/external/review-content/route.ts`
- Test: `magnetlab/src/__tests__/api/external/review-content.test.ts`

**Step 1: Write the test**

Create `src/__tests__/api/external/review-content.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'user-1' }, error: null }),
  })),
}));

jest.mock('@/lib/ai/content-pipeline/content-reviewer', () => ({
  reviewPosts: jest.fn().mockResolvedValue([
    { post_id: 'post-1', review_score: 8, review_category: 'excellent', review_notes: [], consistency_flags: [] },
  ]),
}));

describe('POST /api/external/review-content', () => {
  it('rejects missing auth header', async () => {
    const { POST } = await import('@/app/api/external/review-content/route');
    const req = new NextRequest('http://localhost/api/external/review-content', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-1', teamProfileId: 'tp-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/api/external/review-content.test.ts --no-coverage
```
Expected: FAIL — module not found.

**Step 3: Write the external review-content API route**

Create `src/app/api/external/review-content/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { reviewPosts, type ReviewablePost } from '@/lib/ai/content-pipeline/content-reviewer';
import { logError } from '@/lib/utils/logger';
import { timingSafeEqual } from 'crypto';

function authenticateRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) return false;
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticateRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, teamProfileId, voiceProfile, icpSummary } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch draft posts for this team profile or user
    let query = supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content, hook_score, status')
      .eq('status', 'draft');

    if (teamProfileId) {
      query = query.eq('team_profile_id', teamProfileId);
    } else {
      query = query.eq('user_id', userId);
    }

    const { data: posts, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        reviewed: 0,
        summary: { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 },
      });
    }

    // Run AI review
    const reviewResults = await reviewPosts(posts as ReviewablePost[], {
      voiceProfile: voiceProfile || undefined,
      icpSummary: icpSummary || undefined,
    });

    // Apply results to each post
    const summary = { excellent: 0, good_with_edits: 0, needs_rewrite: 0, deleted: 0 };
    const deletedPostIds: string[] = [];

    for (const result of reviewResults) {
      const reviewData = {
        review_score: result.review_score,
        review_category: result.review_category,
        review_notes: result.review_notes,
        consistency_flags: result.consistency_flags,
        reviewed_at: new Date().toISOString(),
      };

      if (result.review_category === 'delete') {
        // Delete the post
        await supabase
          .from('cp_pipeline_posts')
          .delete()
          .eq('id', result.post_id);
        deletedPostIds.push(result.post_id);
        summary.deleted++;
      } else {
        // Update with review data
        await supabase
          .from('cp_pipeline_posts')
          .update({ review_data: reviewData })
          .eq('id', result.post_id);
        summary[result.review_category]++;
      }
    }

    return NextResponse.json({
      success: true,
      reviewed: reviewResults.length,
      summary,
      deletedPostIds,
    });
  } catch (error) {
    logError('external/review-content', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npx jest src/__tests__/api/external/review-content.test.ts --no-coverage
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/api/external/review-content/route.ts src/__tests__/api/external/review-content.test.ts
git commit -m "feat: add external review-content API route"
```

---

## Task 6: External API — Apply Branding

**Files:**
- Create: `magnetlab/src/app/api/external/apply-branding/route.ts`

**Step 1: Write the API route**

Create `src/app/api/external/apply-branding/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { timingSafeEqual } from 'crypto';

function authenticateRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) return false;
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticateRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, funnelPageId, brandKit } = body;

    if (!userId || !funnelPageId) {
      return NextResponse.json({ error: 'userId and funnelPageId are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // If brandKit provided in payload, use it; otherwise fetch from DB
    let kit = brandKit;
    if (!kit) {
      // Try team-level first
      const { data: teamProfile } = await supabase
        .from('team_profiles')
        .select('team_id')
        .eq('user_id', userId)
        .eq('role', 'owner')
        .limit(1)
        .single();

      const brandQuery = supabase
        .from('brand_kits')
        .select('logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url');

      if (teamProfile?.team_id) {
        brandQuery.eq('team_id', teamProfile.team_id);
      } else {
        brandQuery.eq('user_id', userId);
      }

      const { data: brandKitData } = await brandQuery.single();
      kit = brandKitData;
    }

    if (!kit) {
      return NextResponse.json({ error: 'No brand kit found for user' }, { status: 404 });
    }

    // Apply branding to funnel page
    const funnelUpdate: Record<string, unknown> = {};
    if (kit.default_theme) funnelUpdate.theme = kit.default_theme;
    if (kit.default_primary_color) funnelUpdate.primary_color = kit.default_primary_color;
    if (kit.default_background_style) funnelUpdate.background_style = kit.default_background_style;
    if (kit.logo_url) funnelUpdate.logo_url = kit.logo_url;
    if (kit.font_family) funnelUpdate.font_family = kit.font_family;
    if (kit.font_url) funnelUpdate.font_url = kit.font_url;

    if (Object.keys(funnelUpdate).length > 0) {
      await supabase
        .from('funnel_pages')
        .update(funnelUpdate)
        .eq('id', funnelPageId);
    }

    // Update funnel page sections
    if (kit.logos && Array.isArray(kit.logos) && kit.logos.length > 0) {
      const { data: logoSections } = await supabase
        .from('funnel_page_sections')
        .select('id, config')
        .eq('funnel_page_id', funnelPageId)
        .eq('section_type', 'logo_bar');

      for (const section of logoSections || []) {
        await supabase
          .from('funnel_page_sections')
          .update({ config: { ...(section.config as Record<string, unknown>), logos: kit.logos } })
          .eq('id', section.id);
      }
    }

    if (kit.default_testimonial?.quote) {
      const { data: testimonialSections } = await supabase
        .from('funnel_page_sections')
        .select('id, config')
        .eq('funnel_page_id', funnelPageId)
        .eq('section_type', 'testimonial');

      for (const section of testimonialSections || []) {
        await supabase
          .from('funnel_page_sections')
          .update({
            config: {
              ...(section.config as Record<string, unknown>),
              quote: kit.default_testimonial.quote,
              author: kit.default_testimonial.author || '',
              role: kit.default_testimonial.role || '',
            },
          })
          .eq('id', section.id);
      }
    }

    if (kit.default_steps?.steps?.length > 0) {
      const { data: stepsSections } = await supabase
        .from('funnel_page_sections')
        .select('id, config')
        .eq('funnel_page_id', funnelPageId)
        .eq('section_type', 'steps');

      for (const section of stepsSections || []) {
        await supabase
          .from('funnel_page_sections')
          .update({
            config: {
              ...(section.config as Record<string, unknown>),
              steps: kit.default_steps.steps,
            },
          })
          .eq('id', section.id);
      }
    }

    return NextResponse.json({ success: true, applied: Object.keys(funnelUpdate) });
  } catch (error) {
    logError('external/apply-branding', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/external/apply-branding/route.ts
git commit -m "feat: add external apply-branding API route"
```

---

## Task 7: External API — Generate Quiz

**Files:**
- Create: `magnetlab/src/app/api/external/generate-quiz/route.ts`

**Step 1: Write the API route**

Create `src/app/api/external/generate-quiz/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateQuizQuestions } from '@/lib/ai/content-pipeline/quiz-generator';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import { logError } from '@/lib/utils/logger';
import { timingSafeEqual } from 'crypto';

function authenticateRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) return false;
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticateRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, funnelPageId, clientName, icpData, teamId, profileId } = body;

    if (!userId || !funnelPageId) {
      return NextResponse.json({ error: 'userId and funnelPageId are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // 1. Gather knowledge context
    let knowledgeContext = '';
    try {
      const knowledgeTypes = ['market_intel', 'objection', 'question'];
      for (const kType of knowledgeTypes) {
        const results = await searchKnowledgeV2({
          userId,
          query: icpData?.pain_points?.join(', ') || clientName || 'ideal customer',
          teamId: teamId || undefined,
          profileId: profileId || undefined,
          filters: { type: kType },
          limit: 3,
        });
        if (results.entries && results.entries.length > 0) {
          knowledgeContext += `\n## ${kType.replace('_', ' ').toUpperCase()}\n`;
          for (const entry of results.entries) {
            knowledgeContext += `- ${entry.content}\n`;
          }
        }
      }
    } catch {
      // Non-fatal — proceed without knowledge context
    }

    // 2. Gather brand context
    let brandContext = '';
    const brandQuery = supabase
      .from('brand_kits')
      .select('urgent_pains, frequent_questions, credibility_markers');

    if (teamId) {
      brandQuery.eq('team_id', teamId);
    } else {
      brandQuery.eq('user_id', userId);
    }

    const { data: brandKit } = await brandQuery.single();
    if (brandKit) {
      if (brandKit.urgent_pains?.length) {
        brandContext += `Urgent pains: ${brandKit.urgent_pains.join(', ')}\n`;
      }
      if (brandKit.frequent_questions?.length) {
        brandContext += `Frequent questions: ${brandKit.frequent_questions.join(', ')}\n`;
      }
      if (brandKit.credibility_markers?.length) {
        brandContext += `Credibility markers: ${brandKit.credibility_markers.join(', ')}\n`;
      }
    }

    // 3. Generate questions via AI
    const questions = await generateQuizQuestions({
      clientName: clientName || 'the client',
      icpJson: JSON.stringify(icpData || {}),
      knowledgeContext,
      brandContext,
    });

    if (questions.length === 0) {
      return NextResponse.json({ error: 'AI failed to generate valid questions' }, { status: 500 });
    }

    // 4. Create qualification form
    const { data: form, error: formError } = await supabase
      .from('qualification_forms')
      .insert({
        user_id: userId,
        name: `${clientName || 'DFY'} Qualification Quiz`,
      })
      .select('id')
      .single();

    if (formError || !form) {
      return NextResponse.json({ error: 'Failed to create qualification form' }, { status: 500 });
    }

    // 5. Insert questions
    const questionRows = questions.map((q, i) => ({
      form_id: form.id,
      funnel_page_id: null,
      question_text: q.question_text,
      question_order: i,
      answer_type: q.answer_type,
      qualifying_answer: q.qualifying_answer,
      options: q.options,
      placeholder: q.answer_type === 'textarea' ? 'Tell us more...' : null,
      is_qualifying: q.is_qualifying,
      is_required: q.is_required,
    }));

    const { error: questionsError } = await supabase
      .from('qualification_questions')
      .insert(questionRows);

    if (questionsError) {
      return NextResponse.json({ error: 'Failed to insert questions' }, { status: 500 });
    }

    // 6. Link form to funnel
    await supabase
      .from('funnel_pages')
      .update({ qualification_form_id: form.id })
      .eq('id', funnelPageId);

    return NextResponse.json({
      success: true,
      formId: form.id,
      questionCount: questions.length,
    });
  } catch (error) {
    logError('external/generate-quiz', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/external/generate-quiz/route.ts
git commit -m "feat: add external generate-quiz API route"
```

---

## Task 8: External API — Setup Thank-You Page

**Files:**
- Create: `magnetlab/src/app/api/external/setup-thankyou/route.ts`

**Step 1: Write the API route**

Create `src/app/api/external/setup-thankyou/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { timingSafeEqual } from 'crypto';

function authenticateRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) return false;
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

interface SectionInsert {
  funnel_page_id: string;
  section_type: string;
  page_location: string;
  sort_order: number;
  is_visible: boolean;
  config: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    if (!authenticateRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, funnelPageId, bookingUrl, resourceTitle } = body;

    if (!userId || !funnelPageId) {
      return NextResponse.json({ error: 'userId and funnelPageId are required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch brand kit for optional sections
    let brandKit: Record<string, unknown> | null = null;
    const { data: teamProfile } = await supabase
      .from('team_profiles')
      .select('team_id')
      .eq('user_id', userId)
      .eq('role', 'owner')
      .limit(1)
      .single();

    const brandQuery = supabase
      .from('brand_kits')
      .select('logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url');

    if (teamProfile?.team_id) {
      brandQuery.eq('team_id', teamProfile.team_id);
    } else {
      brandQuery.eq('user_id', userId);
    }

    const { data: kit } = await brandQuery.single();
    brandKit = kit as Record<string, unknown> | null;

    // Delete existing thank-you sections to start fresh
    await supabase
      .from('funnel_page_sections')
      .delete()
      .eq('funnel_page_id', funnelPageId)
      .eq('page_location', 'thankyou');

    // Build sections
    const sections: SectionInsert[] = [];
    let sortOrder = 0;

    // 1. Section bridge — "You're in!"
    sections.push({
      funnel_page_id: funnelPageId,
      section_type: 'section_bridge',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: {
        text: "You're in! Here's what happens next",
        variant: 'accent',
      },
    });

    // 2. Steps section
    const steps = [
      {
        title: `Check your email for your ${resourceTitle || 'resource'}`,
        description: "We've sent it straight to your inbox. Check spam if you don't see it.",
        icon: '📧',
      },
      {
        title: 'Take the 60-second quiz below',
        description: "Help us personalize your experience so we can give you exactly what you need.",
        icon: '📋',
      },
    ];

    if (bookingUrl) {
      steps.push({
        title: 'Book your free strategy call',
        description: "Let's map out your next steps together — no pitch, just value.",
        icon: '📅',
      });
    }

    sections.push({
      funnel_page_id: funnelPageId,
      section_type: 'steps',
      page_location: 'thankyou',
      sort_order: sortOrder++,
      is_visible: true,
      config: {
        heading: 'Your Next Steps',
        steps,
      },
    });

    // 3. Booking CTA (if booking URL provided)
    if (bookingUrl) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'marketing_block',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          blockType: 'cta',
          title: 'Book Your Free Strategy Call',
          content: "Let's discuss how to get you results faster. Pick a time that works for you.",
          ctaText: 'Pick a Time',
          ctaUrl: bookingUrl,
        },
      });
    }

    // 4. Testimonial (if available)
    const testimonial = brandKit?.default_testimonial as Record<string, string> | undefined;
    if (testimonial?.quote) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'testimonial',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: {
          quote: testimonial.quote,
          author: testimonial.author || '',
          role: testimonial.role || '',
        },
      });
    }

    // 5. Logo bar (if available)
    const logos = brandKit?.logos as Array<Record<string, string>> | undefined;
    if (logos && logos.length > 0) {
      sections.push({
        funnel_page_id: funnelPageId,
        section_type: 'logo_bar',
        page_location: 'thankyou',
        sort_order: sortOrder++,
        is_visible: true,
        config: { logos },
      });
    }

    // Insert all sections
    if (sections.length > 0) {
      const { error: insertError } = await supabase
        .from('funnel_page_sections')
        .insert(sections);

      if (insertError) {
        return NextResponse.json({ error: 'Failed to insert sections' }, { status: 500 });
      }
    }

    // Ensure resource email is enabled
    await supabase
      .from('funnel_pages')
      .update({ send_resource_email: true })
      .eq('id', funnelPageId);

    // Apply branding to funnel page if brand kit exists
    if (brandKit) {
      const funnelUpdate: Record<string, unknown> = {};
      if (brandKit.default_theme) funnelUpdate.theme = brandKit.default_theme;
      if (brandKit.default_primary_color) funnelUpdate.primary_color = brandKit.default_primary_color;
      if (brandKit.default_background_style) funnelUpdate.background_style = brandKit.default_background_style;
      if (brandKit.font_family) funnelUpdate.font_family = brandKit.font_family;
      if (brandKit.font_url) funnelUpdate.font_url = brandKit.font_url;
      if (brandKit.logo_url) funnelUpdate.logo_url = brandKit.logo_url;

      if (Object.keys(funnelUpdate).length > 0) {
        await supabase
          .from('funnel_pages')
          .update(funnelUpdate)
          .eq('id', funnelPageId);
      }
    }

    return NextResponse.json({
      success: true,
      sectionsCreated: sections.length,
      hasBookingCta: !!bookingUrl,
      hasTestimonial: !!testimonial?.quote,
      hasLogoBar: !!(logos && logos.length > 0),
    });
  } catch (error) {
    logError('external/setup-thankyou', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/app/api/external/setup-thankyou/route.ts
git commit -m "feat: add external setup-thankyou API route"
```

---

## Task 9: Fix Font Gap in Funnel Creation

**Files:**
- Modify: `magnetlab/src/app/api/funnel/route.ts`

**Step 1: Read the current funnel creation POST handler**

Read `src/app/api/funnel/route.ts` and find the brand kit merge section where `funnelInsertData` is built. Look for where `theme`, `primary_color`, and `background_style` are set from the brand kit.

**Step 2: Add font fields to the brand kit merge**

In the `funnelInsertData` object, ensure these two lines exist:

```typescript
font_family: funnelData.fontFamily || brandKit?.font_family || null,
font_url: funnelData.fontUrl || brandKit?.font_url || null,
```

If `font_family` and `font_url` are already present (from a previous fix), verify they fall back to `brandKit?.font_family` and `brandKit?.font_url`.

Also ensure the brand kit SELECT query includes `font_family, font_url` in the column list.

**Step 3: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/app/api/funnel/route.ts
git commit -m "fix: include font_family and font_url in brand kit merge on funnel creation"
```

---

## Task 10: Posts Tab — Review Badge UI

**Files:**
- Modify: `magnetlab/src/app/api/content-pipeline/posts/route.ts` (add review_data to select)
- Modify: Post card/list component in magnetlab (add review badge display)

**Step 1: Add `review_data` to the posts GET select**

In `src/app/api/content-pipeline/posts/route.ts`, find the `.select(...)` call and add `review_data` to the column list.

Change the select string to include `, review_data` at the end (before the closing quote).

**Step 2: Add the same to the by-date-range route**

In `src/app/api/content-pipeline/posts/by-date-range/route.ts`, add `review_data` to the `.select(...)` column list.

**Step 3: Add review badge to post rendering**

Find the component that renders individual posts in the content pipeline (likely in `src/components/content-pipeline/`). Add a review badge that shows when `review_data` exists:

```tsx
{post.review_data && (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
    post.review_data.review_category === 'excellent' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
    post.review_data.review_category === 'good_with_edits' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
    post.review_data.review_category === 'needs_rewrite' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
    'bg-muted text-muted-foreground'
  }`}>
    {post.review_data.review_category === 'excellent' ? 'Excellent' :
     post.review_data.review_category === 'good_with_edits' ? 'Needs Edits' :
     post.review_data.review_category === 'needs_rewrite' ? 'Needs Rewrite' :
     'Reviewed'}
    {' '}{post.review_data.review_score}/10
  </span>
)}
```

Add expandable review notes below the post content:

```tsx
{post.review_data?.review_notes?.length > 0 && (
  <details className="mt-2">
    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
      {post.review_data.review_notes.length} edit suggestion{post.review_data.review_notes.length !== 1 ? 's' : ''}
    </summary>
    <ul className="mt-1 space-y-1 pl-4">
      {post.review_data.review_notes.map((note: string, i: number) => (
        <li key={i} className="text-xs text-muted-foreground">• {note}</li>
      ))}
    </ul>
  </details>
)}
```

**Step 4: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
npm run build
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add src/app/api/content-pipeline/posts/route.ts src/app/api/content-pipeline/posts/by-date-range/route.ts src/components/content-pipeline/
git commit -m "feat: add review badge and edit notes to posts tab"
```

---

## Task 11: Deploy magnetlab Changes

**Step 1: Deploy to Vercel**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
vercel --prod
```
Expected: Deployment succeeds.

**Step 2: Deploy Trigger.dev tasks**

Run:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab"
TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```
Expected: Deployment succeeds.

---

## Task 12: gtm-system — Add 4 New Handler Functions

**Files:**
- Modify: `gtm-system/src/trigger/dfy/dispatch-automation.ts`

**Step 1: Add handler functions**

Add these 4 handler functions before the `AUTOMATION_HANDLERS` map in `dispatch-automation.ts`:

```typescript
// ── Content Review Handler ──────────────────────────────────────────
async function handleReviewAndPolishContent(
  engagement: EngagementRecord,
  deliverable: DeliverableRecord,
): Promise<HandlerResult> {
  const magnetlabUrl = process.env.MAGNETLAB_API_URL || 'https://magnetlab.app';
  const magnetlabKey = process.env.MAGNETLAB_API_KEY;

  if (!magnetlabKey) {
    return { skipped: true, reason: 'MAGNETLAB_API_KEY not configured' };
  }

  const processedIntake = engagement.processed_intake as ProcessedIntake | null;
  const userId = engagement.magnetlab_user_id || engagement.tenant_id;

  // Resolve team profile
  const supabase = createSupabaseAdminClient();
  let teamProfileId: string | undefined;
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('id, voice_profile')
    .eq('user_id', userId as string)
    .eq('role', 'owner')
    .limit(1)
    .single();
  if (profile) teamProfileId = profile.id;

  const voiceProfile = profile?.voice_profile
    ? JSON.stringify(profile.voice_profile)
    : undefined;

  const icpSummary = processedIntake
    ? `Industry: ${processedIntake.icp.industry}. Titles: ${processedIntake.icp.job_titles.join(', ')}. Pain points: ${processedIntake.icp.pain_points.join(', ')}.`
    : undefined;

  const response = await fetchWithRetry(`${magnetlabUrl}/api/external/review-content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${magnetlabKey}`,
    },
    body: JSON.stringify({
      userId,
      teamProfileId,
      voiceProfile,
      icpSummary,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Review content API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  // Notify Slack with summary
  try {
    const slack = createSlackClient();
    const channels = getDfySlackChannels();
    if (slack && channels.length > 0) {
      const { summary } = result;
      const adminUrl = `https://www.modernagencysales.com/admin/dfy/${engagement.id}`;
      for (const channel of channels) {
        await slack.sendMessage({
          channel,
          text: `Content review complete for ${engagement.client_company}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Content Review Complete*\n*Client:* ${engagement.client_company}\n✅ Excellent: ${summary.excellent}\n✏️ Needs edits: ${summary.good_with_edits}\n🔄 Needs rewrite: ${summary.needs_rewrite}\n🗑️ Deleted: ${summary.deleted}\n\n<${adminUrl}|Review in Admin>`,
              },
            },
          ],
        });
      }
    }
  } catch { /* non-fatal */ }

  return {
    ...result,
    needs_manual_action: true,
    note: `Content review complete. ${result.summary.excellent} excellent, ${result.summary.good_with_edits} need edits, ${result.summary.needs_rewrite} need rewrite, ${result.summary.deleted} deleted. Admin review required.`,
  };
}

// ── Apply Branding Handler ──────────────────────────────────────────
async function handleApplyBranding(
  engagement: EngagementRecord,
  deliverable: DeliverableRecord,
): Promise<HandlerResult> {
  const magnetlabUrl = process.env.MAGNETLAB_API_URL || 'https://magnetlab.app';
  const magnetlabKey = process.env.MAGNETLAB_API_KEY;

  if (!magnetlabKey) {
    return { skipped: true, reason: 'MAGNETLAB_API_KEY not configured' };
  }

  const userId = engagement.magnetlab_user_id || engagement.tenant_id;

  // Find the funnel page ID from the engagement
  const supabase = createSupabaseAdminClient();
  const { data: funnelDeliverable } = await supabase
    .from('dfy_deliverables')
    .select('id, automation_status')
    .eq('engagement_id', engagement.id)
    .eq('automation_type', 'build_funnel')
    .single();

  // Get the funnel page ID from the build_funnel run output
  let funnelPageId: string | undefined;
  if (funnelDeliverable) {
    const { data: funnelRun } = await supabase
      .from('dfy_automation_runs')
      .select('output_data')
      .eq('deliverable_id', funnelDeliverable.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = (funnelRun?.output_data as Record<string, unknown>)?.funnelPageId as string;
  }

  if (!funnelPageId) {
    // Try to find funnel page directly
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = funnel?.id;
  }

  if (!funnelPageId) {
    throw new Error('No funnel page found to apply branding to');
  }

  const response = await fetchWithRetry(`${magnetlabUrl}/api/external/apply-branding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${magnetlabKey}`,
    },
    body: JSON.stringify({ userId, funnelPageId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apply branding API returned ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// ── Generate Quiz Handler ───────────────────────────────────────────
async function handleGenerateQuiz(
  engagement: EngagementRecord,
  deliverable: DeliverableRecord,
): Promise<HandlerResult> {
  const magnetlabUrl = process.env.MAGNETLAB_API_URL || 'https://magnetlab.app';
  const magnetlabKey = process.env.MAGNETLAB_API_KEY;

  if (!magnetlabKey) {
    return { skipped: true, reason: 'MAGNETLAB_API_KEY not configured' };
  }

  const processedIntake = engagement.processed_intake as ProcessedIntake | null;
  const userId = engagement.magnetlab_user_id || engagement.tenant_id;

  // Find funnel page ID (same pattern as branding)
  const supabase = createSupabaseAdminClient();
  const { data: funnelDeliverable } = await supabase
    .from('dfy_deliverables')
    .select('id')
    .eq('engagement_id', engagement.id)
    .eq('automation_type', 'build_funnel')
    .single();

  let funnelPageId: string | undefined;
  if (funnelDeliverable) {
    const { data: funnelRun } = await supabase
      .from('dfy_automation_runs')
      .select('output_data')
      .eq('deliverable_id', funnelDeliverable.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = (funnelRun?.output_data as Record<string, unknown>)?.funnelPageId as string;
  }

  if (!funnelPageId) {
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = funnel?.id;
  }

  if (!funnelPageId) {
    throw new Error('No funnel page found to attach quiz to');
  }

  // Resolve team context
  let teamId: string | undefined;
  let profileId: string | undefined;
  const { data: profile } = await supabase
    .from('team_profiles')
    .select('id, team_id')
    .eq('user_id', userId as string)
    .eq('role', 'owner')
    .limit(1)
    .single();
  if (profile) {
    teamId = profile.team_id;
    profileId = profile.id;
  }

  const response = await fetchWithRetry(`${magnetlabUrl}/api/external/generate-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${magnetlabKey}`,
    },
    body: JSON.stringify({
      userId,
      funnelPageId,
      clientName: engagement.client_name || engagement.client_company,
      icpData: processedIntake?.icp || null,
      teamId,
      profileId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Generate quiz API returned ${response.status}: ${errorText}`);
  }

  return await response.json();
}

// ── Setup Thank-You Page Handler ────────────────────────────────────
async function handleSetupThankyou(
  engagement: EngagementRecord,
  deliverable: DeliverableRecord,
): Promise<HandlerResult> {
  const magnetlabUrl = process.env.MAGNETLAB_API_URL || 'https://magnetlab.app';
  const magnetlabKey = process.env.MAGNETLAB_API_KEY;

  if (!magnetlabKey) {
    return { skipped: true, reason: 'MAGNETLAB_API_KEY not configured' };
  }

  const userId = engagement.magnetlab_user_id || engagement.tenant_id;
  const processedIntake = engagement.processed_intake as ProcessedIntake | null;

  // Find funnel page ID
  const supabase = createSupabaseAdminClient();
  const { data: funnelDeliverable } = await supabase
    .from('dfy_deliverables')
    .select('id')
    .eq('engagement_id', engagement.id)
    .eq('automation_type', 'build_funnel')
    .single();

  let funnelPageId: string | undefined;
  if (funnelDeliverable) {
    const { data: funnelRun } = await supabase
      .from('dfy_automation_runs')
      .select('output_data')
      .eq('deliverable_id', funnelDeliverable.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = (funnelRun?.output_data as Record<string, unknown>)?.funnelPageId as string;
  }

  if (!funnelPageId) {
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('id, title')
      .eq('user_id', userId as string)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    funnelPageId = funnel?.id;
  }

  if (!funnelPageId) {
    throw new Error('No funnel page found to set up thank-you page for');
  }

  // Get lead magnet title for resource reference
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('title, lead_magnet_id')
    .eq('id', funnelPageId)
    .single();

  let resourceTitle = funnel?.title || 'your resource';
  if (funnel?.lead_magnet_id) {
    const { data: lm } = await supabase
      .from('lead_magnets')
      .select('title')
      .eq('id', funnel.lead_magnet_id)
      .single();
    if (lm?.title) resourceTitle = lm.title;
  }

  // Get booking URL from intake or engagement config
  const bookingUrl = (engagement as Record<string, unknown>).booking_url as string
    || (processedIntake as Record<string, unknown>)?.booking_url as string
    || null;

  const response = await fetchWithRetry(`${magnetlabUrl}/api/external/setup-thankyou`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${magnetlabKey}`,
    },
    body: JSON.stringify({
      userId,
      funnelPageId,
      bookingUrl,
      resourceTitle,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Setup thank-you API returned ${response.status}: ${errorText}`);
  }

  return await response.json();
}
```

**Step 2: Add to AUTOMATION_HANDLERS map**

Find the `AUTOMATION_HANDLERS` map and add the 4 new entries:

```typescript
const AUTOMATION_HANDLERS: Record<
  string,
  (engagement: EngagementRecord, deliverable: DeliverableRecord) => Promise<HandlerResult>
> = {
  // ... existing handlers ...
  review_and_polish_content: handleReviewAndPolishContent,
  apply_branding: handleApplyBranding,
  generate_quiz: handleGenerateQuiz,
  setup_thankyou: handleSetupThankyou,
};
```

**Step 3: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/gtm-system"
npm run build
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/trigger/dfy/dispatch-automation.ts
git commit -m "feat: add 4 new DFY automation handlers (review, branding, quiz, thankyou)"
```

---

## Task 13: gtm-system — Add 4 New Deliverables to Template

**Files:**
- Modify: `gtm-system/src/lib/dfy/templates.ts`

**Step 1: Add the 4 new deliverables to INTRO_OFFER_TEMPLATE**

In the `deliverables` array, add these 4 entries after the existing `Build funnel` deliverable:

```typescript
    // ── NEW: Post-build automation chain ──
    {
      name: 'Review & polish content',
      description: 'AI reviews all draft posts for quality, flags bad ones, ranks them, and generates edit recommendations',
      category: 'content',
      assignee: 'System',
      relative_due_days: 5,
      milestone: 'Fulfillment',
      priority: 2,
      depends_on: ['Select & finish 10 posts'],
      automation_config: {
        automatable: true,
        automation_type: 'review_and_polish_content',
        trigger: 'on_prerequisite_complete',
      },
    },
    {
      name: 'Apply branding',
      description: 'Auto-apply brand kit (colors, fonts, logo, theme) to funnel pages, content pages, and lead magnets',
      category: 'funnel',
      assignee: 'System',
      relative_due_days: 6,
      milestone: 'Fulfillment',
      priority: 2,
      depends_on: ['Build funnel'],
      automation_config: {
        automatable: true,
        automation_type: 'apply_branding',
        trigger: 'on_prerequisite_complete',
      },
    },
    {
      name: 'Generate qualification quiz',
      description: 'Auto-generate quiz questions from ICP data, knowledge base, and brand kit to qualify prospects',
      category: 'funnel',
      assignee: 'System',
      relative_due_days: 6,
      milestone: 'Fulfillment',
      priority: 2,
      depends_on: ['Build funnel'],
      automation_config: {
        automatable: true,
        automation_type: 'generate_quiz',
        trigger: 'on_prerequisite_complete',
      },
    },
    {
      name: 'Setup thank-you page',
      description: 'Build branded thank-you page with resource delivery, quiz, booking CTA, testimonial, and logo bar',
      category: 'funnel',
      assignee: 'System',
      relative_due_days: 6,
      milestone: 'Fulfillment',
      priority: 2,
      depends_on: ['Build funnel'],
      automation_config: {
        automatable: true,
        automation_type: 'setup_thankyou',
        trigger: 'on_prerequisite_complete',
      },
    },
```

**Step 2: Verify build**

Run:
```bash
cd "/Users/timlife/Documents/claude code/gtm-system"
npm run build
```
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/lib/dfy/templates.ts
git commit -m "feat: add 4 new deliverables to INTRO_OFFER_TEMPLATE"
```

---

## Task 14: Deploy gtm-system Changes

**Step 1: Push to git (triggers Railway auto-deploy)**

Run:
```bash
cd "/Users/timlife/Documents/claude code/gtm-system"
git push origin main
```
Expected: Railway picks up the push and deploys.

**Step 2: Deploy Trigger.dev tasks**

Run:
```bash
cd "/Users/timlife/Documents/claude code/gtm-system"
TRIGGER_SECRET_KEY=tr_prod_Fxgn6CdrH6v2NSMVhSJL npx trigger.dev@4.3.3 deploy
```
Expected: Deployment succeeds with new dispatch-dfy-automation task version.

---

## Task 15: Update CLAUDE.md Documentation

**Files:**
- Modify: `magnetlab/CLAUDE.md`

**Step 1: Add DFY Onboarding Automation section**

Add a new section to magnetlab's CLAUDE.md documenting the new external APIs, AI modules, and prompt slugs:

```markdown
## DFY Onboarding Automation (Feb 2026)

4 automated steps in the DFY pipeline, triggered by gtm-system's dependency cascade after funnel/post creation.

### External API Routes (called by gtm-system)

| Route | Purpose |
|-------|---------|
| `POST /api/external/review-content` | AI reviews draft posts, flags bad ones, ranks quality |
| `POST /api/external/apply-branding` | Applies brand kit to funnel pages + sections |
| `POST /api/external/generate-quiz` | Generates qualification questions from ICP + knowledge + brand data |
| `POST /api/external/setup-thankyou` | Builds branded thank-you page with sections |

All authenticated via `Authorization: Bearer ${EXTERNAL_API_KEY}`.

### AI Modules

- `src/lib/ai/content-pipeline/content-reviewer.ts` — Reviews posts for quality, AI patterns, consistency
- `src/lib/ai/content-pipeline/quiz-generator.ts` — Generates qualification questions from ICP data

### Prompt Slugs

- `content-review` — Batch post review with scoring, categorization, edit recommendations
- `quiz-generator` — Qualification question generation (3-5 questions, multiple types)

### Database

- `cp_pipeline_posts.review_data` — JSONB column for review results (review_score, review_category, review_notes, consistency_flags, reviewed_at)

### Key Files

- `src/app/api/external/review-content/route.ts`
- `src/app/api/external/apply-branding/route.ts`
- `src/app/api/external/generate-quiz/route.ts`
- `src/app/api/external/setup-thankyou/route.ts`
- `src/lib/ai/content-pipeline/content-reviewer.ts`
- `src/lib/ai/content-pipeline/quiz-generator.ts`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add DFY onboarding automation section to CLAUDE.md"
```
