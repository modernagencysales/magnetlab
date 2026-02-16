# Interactive Lead Magnets Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable the wizard to produce working interactive lead magnets (calculators, assessments, GPT chat tools) when those archetypes are selected, hosted on existing funnel content pages.

**Architecture:** Add `interactive_config` JSONB column to `lead_magnets` with discriminated union types. Fork content generation for interactive archetypes to produce config JSON instead of text. Swap the content delivery page renderer based on config type. Adapt ChatInterface and OnboardingSurvey from copy-of-gtm-os for GPT and assessment UIs.

**Tech Stack:** Next.js 15, Supabase, Anthropic SDK (streaming), expr-eval (safe formula evaluation), react-markdown (chat rendering), Zod (validation), Tailwind + shadcn/ui.

**Design Doc:** `docs/plans/2026-02-16-interactive-lead-magnets-design.md`

---

## Phase 1: Foundation

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_interactive_lead_magnets.sql`

**Step 1: Write the migration**

```sql
-- Add interactive config to lead_magnets
ALTER TABLE lead_magnets ADD COLUMN interactive_config JSONB DEFAULT NULL;

-- Chat persistence for GPT-type interactive lead magnets
CREATE TABLE interactive_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_magnet_id UUID NOT NULL REFERENCES lead_magnets(id) ON DELETE CASCADE,
  funnel_lead_id UUID REFERENCES funnel_leads(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_magnet_id, session_token)
);

CREATE TABLE interactive_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES interactive_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interactive_chats_lead_magnet ON interactive_chats(lead_magnet_id);
CREATE INDEX idx_interactive_chats_session ON interactive_chats(session_token);
CREATE INDEX idx_interactive_chat_messages_chat ON interactive_chat_messages(chat_id);
```

**Step 2: Push migration**

Run: `npm run db:push`
Expected: Migration applied successfully.

**Step 3: Verify columns exist**

Run against Supabase SQL editor or management API:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_magnets' AND column_name = 'interactive_config';
SELECT column_name FROM information_schema.columns WHERE table_name = 'interactive_chats';
SELECT column_name FROM information_schema.columns WHERE table_name = 'interactive_chat_messages';
```
Expected: All columns present.

**Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add interactive_config column and chat tables for interactive lead magnets"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `src/lib/types/lead-magnet.ts`

**Step 1: Add interactive config types**

Add after the existing `LeadMagnetArchetype` and related types (around line 41):

```typescript
// Interactive Lead Magnet Configs
// Discriminated union on `type` field

export interface CalculatorInput {
  id: string;
  label: string;
  type: 'number' | 'select' | 'slider';
  placeholder?: string;
  options?: Array<{ label: string; value: number }>;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
}

export interface ResultInterpretation {
  range: [number, number];
  label: string;
  description: string;
  color: 'green' | 'yellow' | 'red';
}

export interface CalculatorConfig {
  type: 'calculator';
  headline: string;
  description: string;
  inputs: CalculatorInput[];
  formula: string;
  resultLabel: string;
  resultFormat: 'number' | 'currency' | 'percentage';
  resultInterpretation: ResultInterpretation[];
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'single_choice' | 'multiple_choice' | 'scale';
  options?: Array<{ label: string; value: number }>;
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
}

export interface ScoreRange {
  min: number;
  max: number;
  label: string;
  description: string;
  recommendations: string[];
}

export interface AssessmentConfig {
  type: 'assessment';
  headline: string;
  description: string;
  questions: AssessmentQuestion[];
  scoring: {
    method: 'sum' | 'average';
    ranges: ScoreRange[];
  };
}

export interface GPTConfig {
  type: 'gpt';
  name: string;
  description: string;
  systemPrompt: string;
  welcomeMessage: string;
  suggestedPrompts: string[];
  maxTokens?: number;
}

export type InteractiveConfig = CalculatorConfig | AssessmentConfig | GPTConfig;

// Helper to check if an archetype is interactive
export const INTERACTIVE_ARCHETYPES: LeadMagnetArchetype[] = [
  'single-calculator',
  'assessment',
  'prompt',
];

export function isInteractiveArchetype(archetype: LeadMagnetArchetype): boolean {
  return INTERACTIVE_ARCHETYPES.includes(archetype);
}

// Map archetype to interactive type
export function getInteractiveType(archetype: LeadMagnetArchetype): InteractiveConfig['type'] | null {
  switch (archetype) {
    case 'single-calculator': return 'calculator';
    case 'assessment': return 'assessment';
    case 'prompt': return 'gpt';
    default: return null;
  }
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors — types are additive only)

**Step 3: Commit**

```bash
git add src/lib/types/lead-magnet.ts
git commit -m "feat: add InteractiveConfig types for calculator, assessment, and GPT"
```

---

### Task 3: Zod Validation Schemas

**Files:**
- Modify: `src/lib/validations/api.ts`

**Step 1: Add interactive config Zod schemas**

Add before `createLeadMagnetSchema` (around line 90):

```typescript
// Interactive config schemas
const calculatorInputSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['number', 'select', 'slider']),
  placeholder: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  defaultValue: z.number().optional(),
  unit: z.string().optional(),
});

const resultInterpretationSchema = z.object({
  range: z.tuple([z.number(), z.number()]),
  label: z.string(),
  description: z.string(),
  color: z.enum(['green', 'yellow', 'red']),
});

const calculatorConfigSchema = z.object({
  type: z.literal('calculator'),
  headline: z.string(),
  description: z.string(),
  inputs: z.array(calculatorInputSchema).min(1),
  formula: z.string().min(1),
  resultLabel: z.string(),
  resultFormat: z.enum(['number', 'currency', 'percentage']),
  resultInterpretation: z.array(resultInterpretationSchema).min(1),
});

const assessmentQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['single_choice', 'multiple_choice', 'scale']),
  options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
  scaleMin: z.number().optional(),
  scaleMax: z.number().optional(),
  scaleLabels: z.object({ min: z.string(), max: z.string() }).optional(),
});

const scoreRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string(),
  description: z.string(),
  recommendations: z.array(z.string()),
});

const assessmentConfigSchema = z.object({
  type: z.literal('assessment'),
  headline: z.string(),
  description: z.string(),
  questions: z.array(assessmentQuestionSchema).min(1),
  scoring: z.object({
    method: z.enum(['sum', 'average']),
    ranges: z.array(scoreRangeSchema).min(1),
  }),
});

const gptConfigSchema = z.object({
  type: z.literal('gpt'),
  name: z.string(),
  description: z.string(),
  systemPrompt: z.string().min(1),
  welcomeMessage: z.string(),
  suggestedPrompts: z.array(z.string()),
  maxTokens: z.number().optional(),
});

export const interactiveConfigSchema = z.discriminatedUnion('type', [
  calculatorConfigSchema,
  assessmentConfigSchema,
  gptConfigSchema,
]);
```

**Step 2: Update `createLeadMagnetSchema` to include `interactiveConfig`**

Modify the existing schema (around line 92):

```typescript
export const createLeadMagnetSchema = z.object({
  title: z.string().min(1).max(200),
  archetype: z.enum(leadMagnetArchetypes),
  concept: conceptSchema.optional(),
  extractedContent: extractedContentSchema.optional(),
  interactiveConfig: interactiveConfigSchema.optional(),  // NEW
  linkedinPost: z.string().optional(),
  postVariations: z.array(z.string()).optional(),
  dmTemplate: z.string().optional(),
  ctaWord: z.string().optional(),
});
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/validations/api.ts
git commit -m "feat: add Zod schemas for interactive config validation"
```

---

### Task 4: Update API Route + Install expr-eval

**Files:**
- Modify: `src/app/api/lead-magnet/route.ts`

**Step 1: Install expr-eval**

Run: `npm install expr-eval`

**Step 2: Update POST handler to save interactive_config**

In the POST handler's insert object (around line 89), add the new field:

```typescript
const { data, error } = await supabase
  .from('lead_magnets')
  .insert({
    user_id: session.user.id,
    title: validated.title,
    archetype: validated.archetype,
    concept: validated.concept,
    extracted_content: validated.extractedContent,
    interactive_config: validated.interactiveConfig,  // NEW
    linkedin_post: validated.linkedinPost,
    post_variations: validated.postVariations,
    dm_template: validated.dmTemplate,
    cta_word: validated.ctaWord,
    status: 'draft',
  })
  .select()
  .single();
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add package.json package-lock.json src/app/api/lead-magnet/route.ts
git commit -m "feat: save interactive_config in lead magnet creation, add expr-eval"
```

---

## Phase 2: AI Generation

### Task 5: Interactive Config Generators

**Files:**
- Create: `src/lib/ai/interactive-generators.ts`

**Step 1: Write the three generator functions**

Create `src/lib/ai/interactive-generators.ts`:

```typescript
import { getAnthropicClient } from './client';
import { logError } from '@/lib/utils/logger';
import type {
  CalculatorConfig,
  AssessmentConfig,
  GPTConfig,
  InteractiveConfig,
  LeadMagnetConcept,
} from '@/lib/types/lead-magnet';
import type { CallTranscriptInsights } from '@/lib/types/lead-magnet';

function buildTranscriptContext(insights?: CallTranscriptInsights): string {
  if (!insights) return '';
  const parts: string[] = [];
  if (insights.painPoints?.length) {
    parts.push(`PAIN POINTS:\n${insights.painPoints.map(p => `- "${p.quote}" (${p.frequency})`).join('\n')}`);
  }
  if (insights.frequentQuestions?.length) {
    parts.push(`COMMON QUESTIONS:\n${insights.frequentQuestions.map(q => `- "${q.question}"`).join('\n')}`);
  }
  if (insights.transformationOutcomes?.length) {
    parts.push(`DESIRED OUTCOMES:\n${insights.transformationOutcomes.map(t => `- ${t.currentState} → ${t.desiredState}`).join('\n')}`);
  }
  return parts.length > 0 ? `\n\nREAL CUSTOMER INSIGHTS:\n${parts.join('\n\n')}` : '';
}

export async function generateCalculatorConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  transcriptInsights?: CallTranscriptInsights,
): Promise<CalculatorConfig> {
  const qaPairs = Object.entries(answers)
    .map(([key, val]) => `Q (${key}): ${val}`)
    .join('\n\n');

  const prompt = `You are a lead magnet calculator designer. Based on the following concept and Q&A extraction, generate a working calculator configuration.

CONCEPT:
Title: ${concept.title}
Pain Solved: ${concept.painSolved}
Delivery Format: ${concept.deliveryFormat}

EXTRACTED ANSWERS:
${qaPairs}${buildTranscriptContext(transcriptInsights)}

Generate a calculator config as JSON with this EXACT structure:
{
  "type": "calculator",
  "headline": "Short, compelling headline for the calculator page",
  "description": "1-2 sentence description of what this calculates and why it matters",
  "inputs": [
    {
      "id": "camelCaseVariableName",
      "label": "Human-readable label",
      "type": "number" | "select" | "slider",
      "placeholder": "hint text",
      "min": 0,
      "max": 100000,
      "step": 1,
      "defaultValue": 0,
      "unit": "$" | "%" | "hours" | etc,
      "options": [{"label": "Option A", "value": 10}]  // only for select type
    }
  ],
  "formula": "mathematical expression using input IDs as variables, e.g. (revenue - cost) / cost * 100",
  "resultLabel": "Your Estimated ROI",
  "resultFormat": "number" | "currency" | "percentage",
  "resultInterpretation": [
    {
      "range": [min, max],
      "label": "Level name",
      "description": "What this range means and what to do about it",
      "color": "green" | "yellow" | "red"
    }
  ]
}

RULES:
- Use 3-6 inputs. Each must have a unique camelCase id.
- Formula must ONLY reference input IDs as variables. Use standard math operators: + - * / ( ) and Math functions like Math.min(), Math.max(), Math.round().
- Include 3-4 interpretation ranges that cover all possible results.
- Ranges must be contiguous (no gaps) and cover the full output domain.
- Set sensible defaults, min/max values based on the domain.
- Use "select" type for categorical inputs, "slider" for bounded ranges, "number" for open-ended.

Return ONLY valid JSON, no markdown fences.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No response from AI');
  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]) as CalculatorConfig;
}

export async function generateAssessmentConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  transcriptInsights?: CallTranscriptInsights,
): Promise<AssessmentConfig> {
  const qaPairs = Object.entries(answers)
    .map(([key, val]) => `Q (${key}): ${val}`)
    .join('\n\n');

  const prompt = `You are a lead magnet assessment/scorecard designer. Based on the following concept and Q&A extraction, generate a working assessment configuration.

CONCEPT:
Title: ${concept.title}
Pain Solved: ${concept.painSolved}
Delivery Format: ${concept.deliveryFormat}

EXTRACTED ANSWERS:
${qaPairs}${buildTranscriptContext(transcriptInsights)}

Generate an assessment config as JSON with this EXACT structure:
{
  "type": "assessment",
  "headline": "Short, compelling headline",
  "description": "1-2 sentence description of what this assesses",
  "questions": [
    {
      "id": "q1",
      "text": "The question text",
      "type": "single_choice",
      "options": [
        {"label": "Answer option", "value": 3},
        {"label": "Another option", "value": 1}
      ]
    },
    {
      "id": "q2",
      "text": "Rate your confidence in...",
      "type": "scale",
      "scaleMin": 1,
      "scaleMax": 5,
      "scaleLabels": {"min": "Not at all", "max": "Extremely"}
    }
  ],
  "scoring": {
    "method": "sum",
    "ranges": [
      {
        "min": 0,
        "max": 20,
        "label": "Beginner",
        "description": "What this level means",
        "recommendations": ["Specific action 1", "Specific action 2"]
      }
    ]
  }
}

RULES:
- Generate 8-12 questions. Mix single_choice and scale types for variety.
- Each single_choice question should have 3-5 options with different score values.
- Score values should meaningfully differentiate — don't make all options worth the same.
- Use "sum" scoring method. Ensure ranges cover all possible total scores.
- Include 3-4 scoring ranges (e.g., Beginner/Intermediate/Advanced/Expert).
- Each range needs 2-4 specific, actionable recommendations (not generic advice).
- Questions should be diagnostic — they should reveal the person's actual level, not be leading.
- Question IDs should be sequential: q1, q2, q3, etc.

Return ONLY valid JSON, no markdown fences.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No response from AI');
  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]) as AssessmentConfig;
}

export async function generateGPTConfig(
  concept: LeadMagnetConcept,
  answers: Record<string, string>,
  businessContext?: Record<string, unknown>,
  transcriptInsights?: CallTranscriptInsights,
): Promise<GPTConfig> {
  const qaPairs = Object.entries(answers)
    .map(([key, val]) => `Q (${key}): ${val}`)
    .join('\n\n');

  const businessDesc = businessContext?.businessDescription || '';

  const prompt = `You are designing a custom AI assistant as a lead magnet. Based on the following concept and Q&A extraction, generate the configuration.

CONCEPT:
Title: ${concept.title}
Pain Solved: ${concept.painSolved}

BUSINESS CONTEXT:
${businessDesc}

EXTRACTED ANSWERS:
${qaPairs}${buildTranscriptContext(transcriptInsights)}

Generate a GPT config as JSON with this EXACT structure:
{
  "type": "gpt",
  "name": "Tool Name",
  "description": "1-2 sentence description of what this AI tool does",
  "systemPrompt": "The full system prompt for the AI assistant. Be detailed — include the expertise domain, methodology, tone, constraints, and output format.",
  "welcomeMessage": "The greeting message shown when someone opens the chat. Should explain what the tool does and invite them to try it.",
  "suggestedPrompts": ["Prompt 1", "Prompt 2", "Prompt 3", "Prompt 4"],
  "maxTokens": 2048
}

RULES FOR THE SYSTEM PROMPT:
- Ground the assistant in the creator's specific expertise and methodology (from the extraction answers).
- Include the domain knowledge, frameworks, and terminology from the business context.
- Set a clear tone that matches the creator's brand (professional but approachable, etc.).
- Define what the assistant should NOT do (e.g., give medical/legal advice, make guarantees).
- Specify the output format (e.g., "respond in clear, actionable bullet points").
- Keep it under 1500 words — detailed enough to be useful, concise enough to leave room for conversation.

RULES FOR SUGGESTED PROMPTS:
- 3-4 prompts that showcase the tool's best capabilities.
- Each should be specific enough to get a great first response.
- Vary the prompt types (analyze something, generate something, evaluate something, recommend something).

Return ONLY valid JSON, no markdown fences.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content.find(b => b.type === 'text');
  if (!text || text.type !== 'text') throw new Error('No response from AI');
  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]) as GPTConfig;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/ai/interactive-generators.ts
git commit -m "feat: add AI generators for calculator, assessment, and GPT configs"
```

---

### Task 6: Fork Content Extraction API for Interactive Archetypes

**Files:**
- Modify: `src/app/api/lead-magnet/extract/route.ts`
- Modify: `src/components/wizard/WizardContainer.tsx`

**Step 1: Read the current extract route POST handler**

Read `src/app/api/lead-magnet/extract/route.ts` to understand the current POST handler flow.

**Step 2: Add interactive config generation to the extract POST handler**

In the POST handler, after checking for `action === 'contextual-questions'`, add a new action branch:

```typescript
if (action === 'generate-interactive') {
  const { archetype, concept, answers, businessContext, transcriptInsights } = body;
  const { isInteractiveArchetype, getInteractiveType } = await import('@/lib/types/lead-magnet');

  if (!isInteractiveArchetype(archetype)) {
    return ApiErrors.validationError('Archetype is not interactive');
  }

  const interactiveType = getInteractiveType(archetype);
  const { generateCalculatorConfig, generateAssessmentConfig, generateGPTConfig } = await import('@/lib/ai/interactive-generators');

  let config;
  switch (interactiveType) {
    case 'calculator':
      config = await generateCalculatorConfig(concept, answers, transcriptInsights);
      break;
    case 'assessment':
      config = await generateAssessmentConfig(concept, answers, transcriptInsights);
      break;
    case 'gpt':
      config = await generateGPTConfig(concept, answers, businessContext, transcriptInsights);
      break;
    default:
      return ApiErrors.validationError('Unknown interactive type');
  }

  return NextResponse.json({ interactiveConfig: config });
}
```

**Step 3: Update WizardContainer to call interactive generation**

In `handleExtractionComplete` (around line 296), add a fork based on archetype:

```typescript
const { isInteractiveArchetype } = await import('@/lib/types/lead-magnet');

if (isInteractiveArchetype(archetype)) {
  // Generate interactive config instead of text content
  const response = await fetch('/api/lead-magnet/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'generate-interactive',
      archetype,
      concept,
      answers,
      businessContext: state.brandKit,
      transcriptInsights,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to generate interactive config');
  }

  const { interactiveConfig } = await response.json();

  setState(prev => ({
    ...prev,
    extractionAnswers: answers,
    interactiveConfig,  // New state field
    currentStep: 4,
  }));
} else {
  // Existing text extraction flow (unchanged)
  ...
}
```

**Step 4: Add `interactiveConfig` to WizardState type**

In `src/lib/types/lead-magnet.ts`, add to `WizardState` interface:

```typescript
interactiveConfig: InteractiveConfig | null;
```

And update `INITIAL_STATE` in WizardContainer to include `interactiveConfig: null`.

**Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 6: Commit**

```bash
git add src/app/api/lead-magnet/extract/route.ts src/components/wizard/WizardContainer.tsx src/lib/types/lead-magnet.ts
git commit -m "feat: fork extraction to generate interactive configs for calculator/assessment/GPT"
```

---

## Phase 3: Wizard UX

### Task 7: Interactive Badge on IdeationStep

**Files:**
- Modify: `src/components/wizard/steps/IdeationStep.tsx`

**Step 1: Add interactive badge to ConceptCard**

Import `isInteractiveArchetype` from types. In the `ConceptCard` component, after the recommendation badge (around line 64), add:

```typescript
{isInteractiveArchetype(concept.archetype) && (
  <div className="absolute -top-2 left-4 flex items-center gap-1 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
    <Sparkles className="h-3 w-3" />
    Interactive
  </div>
)}
```

Import `Sparkles` from lucide-react.

**Step 2: Run dev server and verify visually**

Run: `npm run dev`
Navigate to `/create`, fill in context, reach ideation step. Verify that `single-calculator`, `assessment`, and `prompt` cards show the blue "Interactive" badge.

**Step 3: Commit**

```bash
git add src/components/wizard/steps/IdeationStep.tsx
git commit -m "feat: add Interactive badge to calculator, assessment, and prompt concept cards"
```

---

### Task 8: ContentStep Fork for Interactive Preview

**Files:**
- Create: `src/components/wizard/steps/InteractiveContentStep.tsx`
- Modify: `src/components/wizard/WizardContainer.tsx`

This is the step 4 review screen. For interactive archetypes, show a live preview + editor instead of the text content review.

**Step 1: Create InteractiveContentStep component**

Create `src/components/wizard/steps/InteractiveContentStep.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import type { InteractiveConfig, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { CalculatorPreview } from '@/components/interactive/CalculatorPreview';
import { AssessmentPreview } from '@/components/interactive/AssessmentPreview';
import { GPTPreview } from '@/components/interactive/GPTPreview';
import { CalculatorEditor } from '@/components/interactive/editors/CalculatorEditor';
import { AssessmentEditor } from '@/components/interactive/editors/AssessmentEditor';
import { GPTEditor } from '@/components/interactive/editors/GPTEditor';

interface InteractiveContentStepProps {
  config: InteractiveConfig;
  concept: LeadMagnetConcept;
  onConfigChange: (config: InteractiveConfig) => void;
  onApprove: () => void;
  onBack: () => void;
  onRegenerate: () => void;
  loading: boolean;
  regenerating: boolean;
}

export function InteractiveContentStep({
  config,
  concept,
  onConfigChange,
  onApprove,
  onBack,
  onRegenerate,
  loading,
  regenerating,
}: InteractiveContentStepProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Review Your Interactive Tool</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Preview how your {config.type === 'calculator' ? 'calculator' : config.type === 'assessment' ? 'assessment' : 'AI tool'} will look, and tweak it if needed.
          </p>
        </div>
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'preview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'edit' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Edit
        </button>
      </div>

      {/* Content area */}
      <div className="min-h-[400px]">
        {activeTab === 'preview' && (
          <div className="rounded-xl border bg-card p-6">
            {config.type === 'calculator' && <CalculatorPreview config={config} />}
            {config.type === 'assessment' && <AssessmentPreview config={config} />}
            {config.type === 'gpt' && <GPTPreview config={config} />}
          </div>
        )}
        {activeTab === 'edit' && (
          <div className="rounded-xl border bg-card p-6">
            {config.type === 'calculator' && (
              <CalculatorEditor config={config} onChange={(c) => onConfigChange(c)} />
            )}
            {config.type === 'assessment' && (
              <AssessmentEditor config={config} onChange={(c) => onConfigChange(c)} />
            )}
            {config.type === 'gpt' && (
              <GPTEditor config={config} onChange={(c) => onConfigChange(c)} />
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Regenerate
        </button>
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Looks Good — Generate Posts'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Wire into WizardContainer**

In WizardContainer, update the Step 4 rendering block (around line 546):

```typescript
{state.currentStep === 4 && state.interactiveConfig && (
  <InteractiveContentStep
    config={state.interactiveConfig}
    concept={selectedConcept!}
    onConfigChange={(config) => setState(prev => ({ ...prev, interactiveConfig: config }))}
    onApprove={handleContentApprove}
    onBack={() => goToStep(3)}
    onRegenerate={handleRegenerateInteractive}
    loading={generating === 'posts'}
    regenerating={generating === 'extraction'}
  />
)}

{state.currentStep === 4 && state.extractedContent && !state.interactiveConfig && (
  <ContentStep
    content={state.extractedContent}
    onApprove={handleContentApprove}
    onBack={() => goToStep(3)}
    loading={generating === 'posts'}
  />
)}
```

Also update `handleContentApprove` to pass interactive config info to the post writer so LinkedIn posts reference "free calculator" etc. instead of "free guide".

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: Errors for missing Preview and Editor components (expected — we'll create those next)

**Step 4: Commit**

```bash
git add src/components/wizard/steps/InteractiveContentStep.tsx src/components/wizard/WizardContainer.tsx
git commit -m "feat: add InteractiveContentStep with preview/edit tabs, wire into wizard"
```

---

### Task 9: Preview Components

**Files:**
- Create: `src/components/interactive/CalculatorPreview.tsx`
- Create: `src/components/interactive/AssessmentPreview.tsx`
- Create: `src/components/interactive/GPTPreview.tsx`

These are read-only preview versions used in the wizard Step 4. They're simpler versions of the public-facing tools (Task 13-15).

**Step 1: Create CalculatorPreview**

Create `src/components/interactive/CalculatorPreview.tsx` — renders the calculator inputs and formula result based on `CalculatorConfig`. Uses `expr-eval` Parser to evaluate the formula safely.

Key implementation:
- `useState` for input values, initialized from `defaultValue`
- `Parser` from `expr-eval` to evaluate formula with current input values
- Find matching `resultInterpretation` range for the result
- Color-coded result display

**Step 2: Create AssessmentPreview**

Create `src/components/interactive/AssessmentPreview.tsx` — simplified version showing the first 2-3 questions and a "preview only" indicator. Full assessment flow is built in the public component.

**Step 3: Create GPTPreview**

Create `src/components/interactive/GPTPreview.tsx` — shows the welcome message, suggested prompt pills, and a disabled chat input. No actual AI calls in preview.

**Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interactive/
git commit -m "feat: add calculator, assessment, and GPT preview components for wizard"
```

---

### Task 10: Editor Components

**Files:**
- Create: `src/components/interactive/editors/CalculatorEditor.tsx`
- Create: `src/components/interactive/editors/AssessmentEditor.tsx`
- Create: `src/components/interactive/editors/GPTEditor.tsx`

**Step 1: Create CalculatorEditor**

Props: `{ config: CalculatorConfig, onChange: (config: CalculatorConfig) => void }`

Sections:
- Headline + description text inputs
- Inputs list: each input has label, type dropdown, unit, min/max/step/default fields. Add/remove buttons.
- Formula text input with helper showing available variable names (`config.inputs.map(i => i.id)`).
- Result label + format dropdown.
- Interpretation ranges: add/remove, each with min, max, label, description, color dropdown.

All changes call `onChange` with the updated config.

**Step 2: Create AssessmentEditor**

Props: `{ config: AssessmentConfig, onChange: (config: AssessmentConfig) => void }`

Sections:
- Headline + description text inputs
- Questions list: each expandable with text, type dropdown, options sub-editor (label + score value). Add/remove/reorder.
- Scoring method toggle (sum/average)
- Score ranges: add/remove, each with min, max, label, description, recommendations list.

**Step 3: Create GPTEditor**

Props: `{ config: GPTConfig, onChange: (config: GPTConfig) => void }`

Sections:
- Name + description text inputs
- System prompt: large textarea
- Welcome message: textarea
- Suggested prompts: editable list with add/remove

**Step 4: Run typecheck + dev server**

Run: `npm run typecheck`
Run: `npm run dev`
Navigate through wizard to Step 4 with an interactive archetype. Verify preview and edit tabs work.

**Step 5: Commit**

```bash
git add src/components/interactive/editors/
git commit -m "feat: add calculator, assessment, and GPT editor components"
```

---

## Phase 4: Public-Facing Interactive Components

### Task 11: Calculator Tool (Public)

**Files:**
- Create: `src/components/interactive/public/CalculatorTool.tsx`

**Step 1: Build the public calculator component**

Full-featured version of the calculator for the content page. Props:

```typescript
interface CalculatorToolProps {
  config: CalculatorConfig;
  theme: 'dark' | 'light';
  primaryColor: string;
}
```

Implementation:
- Renders all inputs based on config (number inputs with unit prefix/suffix, select dropdowns, range sliders with labels)
- Uses `expr-eval` Parser to evaluate formula on each input change
- Shows result in large display with `resultLabel` and formatted value
- Matches result to `resultInterpretation` range, shows label + description with color indicator
- Responsive layout: 2-column grid on desktop, stacked on mobile
- Styled with theme colors

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/interactive/public/CalculatorTool.tsx
git commit -m "feat: add public calculator tool component with formula evaluation"
```

---

### Task 12: Assessment Tool (Public)

**Files:**
- Create: `src/components/interactive/public/AssessmentTool.tsx`

Adapted from copy-of-gtm-os `OnboardingSurvey.tsx` but simplified:
- No Blueprint pre-fill
- No bootcamp-specific types
- Progressive one-question-at-a-time flow
- Scoring logic built-in

**Step 1: Build the assessment component**

Props:
```typescript
interface AssessmentToolProps {
  config: AssessmentConfig;
  theme: 'dark' | 'light';
  primaryColor: string;
}
```

Implementation:
- State: `currentQuestion` index, `answers` record (question ID → score value), `isComplete`
- Progress bar at top (currentQuestion / total)
- Question rendering by type:
  - `single_choice`: Button grid with letter badges (A, B, C...), auto-advance on select
  - `multiple_choice`: Checkbox-style buttons, explicit "Next" button
  - `scale`: Numbered buttons (scaleMin to scaleMax) with min/max labels
- Enter key to advance, keyboard number selection for scale
- Animation on question transition (fade in/out)
- On completion: calculate total score (sum or average), find matching range, display:
  - Score number
  - Level label (large, colored)
  - Level description
  - Recommendations as a bulleted list
  - "Retake" button to restart

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/interactive/public/AssessmentTool.tsx
git commit -m "feat: add public assessment tool with typeform-style flow and scoring"
```

---

### Task 13: GPT Chat Tool (Public)

**Files:**
- Create: `src/components/interactive/public/GPTChatTool.tsx`

Adapted from copy-of-gtm-os `ChatInterface.tsx` but simplified:
- No conversation sidebar (single chat thread)
- No TanStack Query (direct fetch)
- No Supabase Edge Function (uses magnetlab API route)
- Session token for persistence

**Step 1: Build the GPT chat component**

Props:
```typescript
interface GPTChatToolProps {
  config: GPTConfig;
  leadMagnetId: string;
  theme: 'dark' | 'light';
  primaryColor: string;
}
```

Implementation:
- State: `messages` array, `streamingMessage`, `isLoading`, `sessionToken`, `chatId`
- On mount: generate/load session token from `localStorage` key `interactive_chat_${leadMagnetId}`
- On mount: if session token exists, fetch existing messages from `GET /api/public/chat?leadMagnetId=X&sessionToken=Y`
- Welcome message display from config
- Suggested prompt pills (clickable, sends as first message)
- Message list with markdown rendering (adapt `ChatMessage.tsx` approach — use `react-markdown`)
- Input: auto-expanding textarea, Enter to send, Shift+Enter for newline
- On send:
  1. Add user message to messages array
  2. POST to `/api/public/chat` with `{ leadMagnetId, sessionToken, message, chatId }`
  3. Stream SSE response, accumulate chunks into streamingMessage
  4. On complete: move streamingMessage into messages array, update chatId
- AbortController for cancellation
- Auto-scroll to bottom on new messages
- Loading state: animated dots in assistant message

**Step 2: Install react-markdown if not already present**

Run: `npm ls react-markdown` — check if already installed.
If not: `npm install react-markdown`

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/interactive/public/GPTChatTool.tsx package.json package-lock.json
git commit -m "feat: add public GPT chat tool with streaming and session persistence"
```

---

### Task 14: Content Page Routing

**Files:**
- Modify: `src/app/p/[username]/[slug]/content/page.tsx`
- Modify: `src/components/content/ContentPageClient.tsx`

**Step 1: Fetch `interactive_config` in the server component**

In `content/page.tsx`, update the lead magnet query (around line 107) to include the new column:

```typescript
const { data: leadMagnet, error: lmError } = await supabase
  .from('lead_magnets')
  .select('id, title, extracted_content, polished_content, concept, thumbnail_url, interactive_config')
  .eq('id', funnel.lead_magnet_id)
  .single();
```

Update the `notFound()` check to also allow interactive-only lead magnets:

```typescript
if (!leadMagnet.extracted_content && !leadMagnet.polished_content && !leadMagnet.interactive_config) {
  notFound();
}
```

Pass `interactiveConfig` to `ContentPageClient`:

```typescript
<ContentPageClient
  ...existing props...
  interactiveConfig={leadMagnet.interactive_config as InteractiveConfig | null}
/>
```

**Step 2: Update ContentPageClient to render interactive tools**

In `ContentPageClient.tsx`, add a check at the top of the render:

```typescript
if (interactiveConfig) {
  return (
    <InteractiveContentWrapper
      config={interactiveConfig}
      leadMagnetId={leadMagnetId}
      theme={theme}
      primaryColor={primaryColor}
    />
  );
}

// ...existing text rendering below
```

Create `InteractiveContentWrapper` component that switches on config.type and renders the appropriate public tool component.

**Step 3: Run typecheck + build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/p/[username]/[slug]/content/page.tsx src/components/content/ContentPageClient.tsx
git commit -m "feat: route content page to interactive tools when interactive_config exists"
```

---

## Phase 5: GPT Chat API

### Task 15: Streaming Chat Endpoint

**Files:**
- Create: `src/app/api/public/chat/route.ts`

**Step 1: Build the streaming chat API**

```typescript
import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/client';
import { logApiError } from '@/lib/api/errors';
import type { GPTConfig } from '@/lib/types/lead-magnet';

export async function POST(request: NextRequest) {
  try {
    const { leadMagnetId, sessionToken, message, chatId } = await request.json();

    if (!leadMagnetId || !sessionToken || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Load lead magnet and validate it's a GPT type
    const { data: lm, error: lmError } = await supabase
      .from('lead_magnets')
      .select('interactive_config')
      .eq('id', leadMagnetId)
      .single();

    if (lmError || !lm?.interactive_config || lm.interactive_config.type !== 'gpt') {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    const config = lm.interactive_config as GPTConfig;

    // Rate limit check: count messages in last hour for this session
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourlyCount } = await supabase
      .from('interactive_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId || '')
      .eq('role', 'user')
      .gte('created_at', oneHourAgo);

    if ((hourlyCount ?? 0) >= 50) {
      return new Response(JSON.stringify({ error: 'Rate limit reached. Try again later.' }), { status: 429 });
    }

    // Find or create chat
    let currentChatId = chatId;
    if (!currentChatId) {
      const { data: existingChat } = await supabase
        .from('interactive_chats')
        .select('id')
        .eq('lead_magnet_id', leadMagnetId)
        .eq('session_token', sessionToken)
        .single();

      if (existingChat) {
        currentChatId = existingChat.id;
      } else {
        const { data: newChat, error: chatError } = await supabase
          .from('interactive_chats')
          .insert({
            lead_magnet_id: leadMagnetId,
            session_token: sessionToken,
            title: message.substring(0, 100),
          })
          .select('id')
          .single();

        if (chatError) throw chatError;
        currentChatId = newChat.id;
      }
    }

    // Save user message
    await supabase.from('interactive_chat_messages').insert({
      chat_id: currentChatId,
      role: 'user',
      content: message,
    });

    // Load conversation history (last 20 messages)
    const { data: history } = await supabase
      .from('interactive_chat_messages')
      .select('role, content')
      .eq('chat_id', currentChatId)
      .order('created_at', { ascending: true })
      .limit(20);

    const messages = (history || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = getAnthropicClient().messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: config.maxTokens || 2048,
            system: config.systemPrompt,
            messages,
          });

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`));
            }
          }

          // Save assistant message
          await supabase.from('interactive_chat_messages').insert({
            chat_id: currentChatId,
            role: 'assistant',
            content: fullResponse,
          });

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', chatId: currentChatId })}\n\n`));
          controller.close();
        } catch (error) {
          logApiError('public/chat', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    logApiError('public/chat', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}

// GET - Load existing chat messages
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leadMagnetId = searchParams.get('leadMagnetId');
  const sessionToken = searchParams.get('sessionToken');

  if (!leadMagnetId || !sessionToken) {
    return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: chat } = await supabase
    .from('interactive_chats')
    .select('id')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('session_token', sessionToken)
    .single();

  if (!chat) {
    return Response.json({ messages: [], chatId: null });
  }

  const { data: messages } = await supabase
    .from('interactive_chat_messages')
    .select('role, content, created_at')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: true });

  return Response.json({ messages: messages || [], chatId: chat.id });
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/public/chat/route.ts
git commit -m "feat: add streaming GPT chat API with rate limiting and message persistence"
```

---

## Phase 6: Save Flow

### Task 16: Update PublishStep to Include Interactive Config

**Files:**
- Modify: `src/components/wizard/steps/PublishStep.tsx`
- Modify: `src/components/wizard/WizardContainer.tsx`

**Step 1: Pass interactiveConfig to PublishStep**

In WizardContainer, update the PublishStep rendering (around line 563) to include the new prop:

```typescript
<PublishStep
  ...existing props...
  interactiveConfig={state.interactiveConfig}
/>
```

**Step 2: Update PublishStep to include interactiveConfig in save payload**

In PublishStep's `handleSave` function, add `interactiveConfig` to the POST body:

```typescript
body: JSON.stringify({
  title: trimmedTitle,
  archetype: concept.archetype,
  concept,
  extractedContent: content,
  interactiveConfig,  // NEW
  linkedinPost: post.post,
  postVariations: [post],
  dmTemplate,
  ctaWord,
}),
```

Update the `PublishStepProps` interface to include:
```typescript
interactiveConfig?: InteractiveConfig | null;
```

**Step 3: Run typecheck + build**

Run: `npm run typecheck`
Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/wizard/steps/PublishStep.tsx src/components/wizard/WizardContainer.tsx
git commit -m "feat: save interactiveConfig when publishing interactive lead magnets"
```

---

## Phase 7: Integration Testing

### Task 17: End-to-End Manual Testing

**Step 1: Test calculator flow**

1. Start wizard, enter business context
2. Select a `single-calculator` concept
3. Answer extraction questions
4. Verify Step 4 shows calculator preview (not text)
5. Switch to Edit tab, modify an input label
6. Switch back to Preview, verify change reflected
7. Click "Looks Good", verify posts generated
8. Save lead magnet
9. Create funnel page, publish
10. Visit public content page — verify working calculator

**Step 2: Test assessment flow**

Same flow but select `assessment` archetype. Verify:
- Typeform-style progressive questions
- Score calculation on completion
- Result display with recommendations

**Step 3: Test GPT flow**

Same flow but select `prompt` archetype. Verify:
- Chat interface loads with welcome message
- Suggested prompts work
- Streaming responses work
- Refresh page — conversation persists via session token

**Step 4: Test backward compatibility**

Select a non-interactive archetype (e.g., `single-breakdown`). Verify the entire wizard flow works exactly as before — text content, no interactive preview.

**Step 5: Deploy**

Run: `vercel --prod`
Expected: Successful deployment.

```bash
git add -A
git commit -m "feat: interactive lead magnets — complete feature"
```

---

## File Summary

### New Files (13)
| File | Purpose |
|------|---------|
| `supabase/migrations/..._add_interactive_lead_magnets.sql` | DB migration |
| `src/lib/ai/interactive-generators.ts` | AI config generation (calculator, assessment, GPT) |
| `src/components/wizard/steps/InteractiveContentStep.tsx` | Wizard Step 4 for interactive types |
| `src/components/interactive/CalculatorPreview.tsx` | Calculator preview (wizard) |
| `src/components/interactive/AssessmentPreview.tsx` | Assessment preview (wizard) |
| `src/components/interactive/GPTPreview.tsx` | GPT preview (wizard) |
| `src/components/interactive/editors/CalculatorEditor.tsx` | Calculator config editor |
| `src/components/interactive/editors/AssessmentEditor.tsx` | Assessment config editor |
| `src/components/interactive/editors/GPTEditor.tsx` | GPT config editor |
| `src/components/interactive/public/CalculatorTool.tsx` | Public calculator |
| `src/components/interactive/public/AssessmentTool.tsx` | Public assessment |
| `src/components/interactive/public/GPTChatTool.tsx` | Public GPT chat |
| `src/app/api/public/chat/route.ts` | GPT streaming API |

### Modified Files (7)
| File | Change |
|------|--------|
| `src/lib/types/lead-magnet.ts` | Add InteractiveConfig types, helpers, WizardState update |
| `src/lib/validations/api.ts` | Add interactive config Zod schemas |
| `src/app/api/lead-magnet/route.ts` | Save interactive_config in POST |
| `src/app/api/lead-magnet/extract/route.ts` | Add `generate-interactive` action |
| `src/components/wizard/WizardContainer.tsx` | Fork extraction + Step 4 routing |
| `src/components/wizard/steps/IdeationStep.tsx` | Interactive badge |
| `src/components/wizard/steps/PublishStep.tsx` | Pass interactiveConfig in save |
| `src/app/p/[username]/[slug]/content/page.tsx` | Fetch + pass interactive_config |
| `src/components/content/ContentPageClient.tsx` | Route to interactive tools |

### New Dependencies (1-2)
- `expr-eval` — safe formula evaluation
- `react-markdown` — may already be installed; needed for GPT chat rendering
