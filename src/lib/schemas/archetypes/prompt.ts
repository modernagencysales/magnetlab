/** Prompt archetype. A collection of ready-to-use AI or action prompts. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const promptEntrySchema = z.object({
  title: z.string().min(3),
  prompt_text: z.string().min(20),
  example_output: z.string().min(10),
  when_to_use: z.string().min(10),
});

export const publishSchema = baseContentSchema.extend({
  prompts: z.array(promptEntrySchema).min(3),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A collection of ready-to-use prompts (for AI tools, self-reflection, or action) that solve a recurring problem.';

export const guidelines = `## Writing a Prompt Collection

A prompt lead magnet gives the reader pre-written prompts they can
immediately use — for AI tools like ChatGPT, for self-assessment, or
as action triggers. The value is eliminating the "blank page" problem.

### Structure
- **Headline**: Name the outcome the prompts produce.
  Good: "10 ChatGPT Prompts That Write LinkedIn Posts Your Audience Actually Reads"
  Bad: "AI Prompts Collection"
- **Problem statement**: Describe the blank-page paralysis or the gap
  between having the tool and getting results from it.
- **Prompts**: Each prompt entry includes:
  - Title: Memorable name that hints at the outcome ("The Authority Builder")
  - Prompt text: The complete, copy-paste-ready prompt with clear placeholders
    marked in [brackets] for customization
  - Example output: A realistic sample of what the prompt produces — this sets
    expectations and proves the prompt works
  - When to use: The specific situation or trigger for reaching for this prompt
- **Call to action**: Offer the complete prompt library

### Quality Signals
- Prompts are copy-paste ready — the reader doesn't need to figure out formatting
- Placeholders are clearly marked and obvious (use [brackets])
- Example outputs are realistic and high-quality — they prove the prompt works
- When-to-use is a specific trigger, not a vague category
- The prompts complement each other and cover different scenarios

### Common Mistakes
- Prompts that are too vague ("Write me something good about marketing")
- Missing example outputs — readers need to see what good looks like
- No context for when to use each prompt — a list without triggers is overwhelming
- Prompts that only work with one specific AI tool but don't say so
- Not testing the prompts — every prompt should be verified to produce good output
- Overlapping prompts that produce similar results for similar situations`;
