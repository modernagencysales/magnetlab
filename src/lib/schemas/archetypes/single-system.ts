/** Single System archetype. Presents an interconnected system of named components. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const systemSectionSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(50),
  key_insight: z.string().optional(),
  component_name: z.string().min(2),
  how_it_connects: z.string().min(10),
});

export const publishSchema = baseContentSchema.extend({
  sections: z.array(systemSectionSchema).min(3),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'Present an interconnected system of named components that work together to produce a result.';

export const guidelines = `## Writing a Single System

A single-system lead magnet reveals the interconnected parts of a system
that works together to produce a specific outcome. Unlike a breakdown
(which is sequential steps), a system emphasizes how components interact.

### Structure
- **Headline**: Promise the outcome the system produces. Name the system.
  Good: "The 3-Part Client Retention System That Keeps 95% of Clients for 12+ Months"
  Bad: "My Business System"
- **Problem statement**: Describe the chaos that exists without the system.
- **Sections**: Each section is one component of the system.
  - Component name: A memorable, specific name (not "Step 1")
  - Body: Explain what this component does, how to build it, and why it matters
  - How it connects: Explicitly state what this component feeds into or receives from
  - Key insight: The design decision that makes this component work
- **Call to action**: Offer the full system blueprint or implementation guide

### Quality Signals
- Each component has a clear, named role — the reader can picture the system
- The connections between components are explicit, not assumed
- Removing any one component would break the system (nothing is filler)
- Real examples of the system in action with specific results

### Common Mistakes
- Listing components without explaining how they connect (it's a list, not a system)
- Vague component names ("Part A", "Module 1") instead of descriptive ones
- No concrete example of the system producing results end-to-end
- Over-engineering — a system with 8 components is rarely believable
- Failing to show what breaks when one component is missing`;
