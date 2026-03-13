/** Single Breakdown archetype. Deconstructs one process into actionable steps. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema, sectionSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

export const publishSchema = baseContentSchema.extend({
  sections: z.array(sectionSchema).min(3),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'Deconstruct one process, framework, or system into clear, actionable steps.';

export const guidelines = `## Writing a Single Breakdown

A single-breakdown deconstructs one process, framework, or system into
clear, actionable steps that the reader can follow.

### Structure
- **Headline**: Name the reader's pain or desired outcome, not your product.
  Good: "The 5-Step System That Generates 20+ Inbound Leads Per Week"
  Bad: "My Amazing Lead Generation Framework"
- **Problem statement**: 2-3 sentences. Make the reader feel understood.
- **Sections**: Each section is one step/component. Build sequentially.
  - Title: Action-oriented ("Step 1: Audit Your Current Pipeline")
  - Body: Explain what, why, and how. Include a specific example.
  - Key insight: The non-obvious "aha" moment. What would they miss on their own?
- **Proof points**: Quantified where possible. "Used by 500 agencies" > "Trusted by many"
- **Call to action**: Clear next step. What do they do after reading this?

### Quality Signals
- Each section builds on the previous one — the order matters
- Specific numbers and examples, not vague platitudes
- The reader can take action after reading without needing anything else
- Personal experience woven in — this should feel like advice from a mentor, not a textbook

### Common Mistakes
- Sections that describe but don't instruct (telling not showing)
- Generic advice without specific examples from the user's real experience
- Skipping the "why" — readers need to understand why each step matters
- Front-loading credentials instead of leading with value
- Making it about the framework name instead of the outcome it produces`;
