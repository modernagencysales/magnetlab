/** Focused Directory archetype. A curated, categorized list of vetted resources. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const resourceSchema = z.object({
  name: z.string().min(2),
  url: z.string().url(),
  description: z.string().min(15),
  category: z.string().min(2),
});

export const publishSchema = baseContentSchema.extend({
  resources: z.array(resourceSchema).min(5),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A curated, categorized directory of vetted resources that saves the reader hours of research.';

export const guidelines = `## Writing a Focused Directory

A focused directory is a curated list of resources — tools, services,
communities, or references — that the reader would otherwise spend hours
(or weeks) finding and vetting themselves. The value is curation and trust.

### Structure
- **Headline**: Promise time saved and pain avoided.
  Good: "50 Vetted Tools for Agency Owners — Tested Over 3 Years and $2M in Revenue"
  Bad: "A List of Tools"
- **Problem statement**: Describe the research pain — too many options, no trusted filter.
- **Resources**: Each resource entry includes:
  - Name: The tool/resource name
  - URL: Direct link (not an affiliate-only landing page)
  - Description: What it does, why it made the list, and any caveats
  - Category: Group resources logically so readers can scan for what they need
- **Call to action**: Offer the full directory (this preview shows a subset)

### Quality Signals
- Every resource has been personally used or thoroughly vetted — not just aggregated
- Categories match how the reader thinks about their workflow
- Descriptions include honest opinions, not marketing copy from the resource's website
- At least 5 resources minimum — directories under 5 feel thin and unhelpful
- Resources are current and actively maintained (no dead links or abandoned tools)

### Common Mistakes
- Listing every tool you've heard of instead of curating the best ones
- Copy-pasting descriptions from the tool's website instead of writing your own take
- No categorization — a flat list of 20+ resources is unusable
- Missing context on pricing, limitations, or who each tool is best for
- Including resources just to pad the list — quality over quantity always wins`;
