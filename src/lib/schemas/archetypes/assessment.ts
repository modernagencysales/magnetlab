/** Assessment archetype. A scored self-evaluation with personalized results. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const questionSchema = z.object({
  question: z.string().min(10),
  options: z.array(z.string()).min(2),
});

const resultRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string().min(2),
  description: z.string().min(20),
});

export const publishSchema = baseContentSchema.extend({
  questions: z.array(questionSchema).min(5),
  scoring_rubric: z.string().min(20),
  result_ranges: z.array(resultRangeSchema).min(1),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A scored self-assessment with personalized results that helps the reader diagnose where they stand.';

export const guidelines = `## Writing an Assessment

An assessment lead magnet gives the reader a structured way to evaluate
themselves against a framework you define. The power is in the
personalization — they answer questions and get a result that feels
tailored to their situation.

### Structure
- **Headline**: Promise clarity or a score on something they care about.
  Good: "How Strong Is Your LinkedIn Presence? Take the 2-Minute Assessment"
  Bad: "Marketing Quiz"
- **Problem statement**: Describe the lack of self-awareness and its cost.
- **Questions**: At least 5 questions, each with:
  - Question text: Clear, specific, and answerable without research
  - Options: 2-4 options in ascending order of sophistication/maturity
- **Scoring rubric**: Plain English explanation of how answers map to scores.
  The reader should understand the scoring, not just see a number.
- **Result ranges**: Score brackets with:
  - Min/max: The score range this result covers
  - Label: A memorable name for this level ("LinkedIn Ghost", "LinkedIn Pro")
  - Description: What this score means and what they should focus on next

### Quality Signals
- Questions reveal blind spots — the reader learns something just by considering them
- Options are clearly ordered from worst to best (or least to most mature)
- Result descriptions are honest and specific — not everything is "great, but..."
- The lowest result is motivating, not demoralizing — it shows opportunity
- Results naturally lead to your offer as the next step

### Common Mistakes
- Questions the reader can't answer honestly ("How good is your strategy?" — too subjective)
- Binary questions (yes/no) that don't reveal nuance — use a spectrum
- Result descriptions that all say "you're doing okay" — be direct about gaps
- Scoring that isn't transparent — hidden formulas feel manipulative
- Too many questions — 5-10 is the sweet spot, beyond that is fatigue
- Result ranges that overlap or have gaps (every possible score should map to exactly one result)`;
