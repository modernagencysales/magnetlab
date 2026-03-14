/** Focused Toolkit archetype. A curated collection of tools, templates, or resources for one job. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const toolSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(20),
  use_case: z.string().min(10),
});

export const publishSchema = baseContentSchema.extend({
  tools: z.array(toolSchema).min(3),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A curated collection of tools, templates, or resources designed for one specific job.';

export const guidelines = `## Writing a Focused Toolkit

A focused toolkit bundles 3-7 tools, templates, or resources that the
reader needs to accomplish one specific task. The power comes from curation
— you have done the research so they don't have to.

### Structure
- **Headline**: Name the job the toolkit helps them do.
  Good: "The Agency Proposal Toolkit: Win More Deals in Half the Time"
  Bad: "A Collection of Useful Resources"
- **Problem statement**: Describe the pain of not having these tools.
- **Tools**: Each tool is a self-contained resource.
  - Name: Clear, descriptive name that hints at what it does
  - Description: What it is, what it contains, and how to use it
  - Use case: The specific scenario or trigger for when to reach for this tool
- **Call to action**: Offer the complete toolkit download

### Quality Signals
- Every tool solves a different part of the same problem (no overlap)
- Use cases are specific situations, not vague categories
- Each tool is immediately usable — fill-in-the-blank, not build-from-scratch
- The collection as a whole covers the complete workflow for the named job

### Common Mistakes
- Including tools that overlap in purpose (redundant resources)
- Tools that require significant customization before they're useful
- Missing the "when to use" context — readers need triggers, not just descriptions
- Padding the list with mediocre tools to hit a number
- No logical ordering — arrange by workflow stage or frequency of use`;
