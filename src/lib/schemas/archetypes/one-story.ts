/** One Story archetype. A single compelling narrative that teaches through personal experience. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

export const publishSchema = baseContentSchema.extend({
  story_hook: z.string().min(20),
  narrative: z.string().min(200),
  lesson: z.string().min(20),
  takeaway: z.string().min(20),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A single compelling narrative that teaches a lesson through personal or client experience.';

export const guidelines = `## Writing a One Story

A one-story lead magnet teaches through narrative. It uses a single
personal or client story — with a clear arc from problem to resolution —
to deliver a lesson the reader can apply. Stories build trust faster than
any other format because they show, not tell.

### Structure
- **Headline**: Tease the transformation or the surprising outcome.
  Good: "How I Went From Zero to 50 Clients in 6 Months (And What I'd Do Differently)"
  Bad: "My Story"
- **Problem statement**: Set up the universal problem your story illustrates.
- **Story hook**: The opening line that pulls the reader in. Start in the middle
  of the action or with a provocative statement.
  Good: "I was two months from shutting down my consultancy when a single post changed everything."
  Bad: "Let me tell you about my journey."
- **Narrative**: The full story with:
  - The situation (stakes, context, emotion)
  - The turning point (what changed and why)
  - The result (specific, quantified outcomes)
  - The messy parts (failures, doubts, mistakes — these build trust)
- **Lesson**: The principle or framework extracted from the story
- **Takeaway**: One specific action the reader can take today

### Quality Signals
- The story has genuine emotional stakes — the reader feels the tension
- Specific details make it believable (dates, numbers, names, dialogue)
- The lesson is non-obvious — it's not advice they've heard a hundred times
- The takeaway is concrete and actionable, not "believe in yourself"
- You show vulnerability — the failures and doubts, not just the wins

### Common Mistakes
- Starting with backstory instead of action — open with the most interesting moment
- Sanitizing the story — removing the messy, embarrassing parts that make it real
- The lesson doesn't match the story — forced connection between narrative and advice
- No specific numbers or outcomes — "it worked really well" is not a result
- Making it about you instead of the reader — the story serves the lesson, not your ego`;
