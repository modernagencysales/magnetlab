/** Workflow archetype. A step-by-step repeatable process with triggers, actions, and outputs. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const stepSchema = z.object({
  trigger: z.string().min(3),
  action: z.string().min(10),
  tool: z.string().min(2),
  output: z.string().min(5),
});

export const publishSchema = baseContentSchema.extend({
  steps: z.array(stepSchema).min(3),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A step-by-step repeatable workflow with triggers, actions, tools, and outputs the reader can copy.';

export const guidelines = `## Writing a Workflow

A workflow lead magnet gives the reader a repeatable process they can
follow on a fixed cadence (daily, weekly, monthly). Unlike a breakdown
(which is conceptual), a workflow is operational — it specifies when to
do what, with which tool, and what the output should be.

### Structure
- **Headline**: Promise consistency and time savings.
  Good: "The Weekly Content Production Workflow That Takes 3 Hours and Fills Your Pipeline"
  Bad: "How to Make Content"
- **Problem statement**: Describe the inefficiency or inconsistency they deal with.
- **Steps**: Each step is one action in the workflow.
  - Trigger: When this step happens ("Monday morning", "After every client call",
    "When pipeline drops below 10 leads")
  - Action: What to do — specific and concrete
  - Tool: Which tool or platform to use (be specific: "Notion", not "a note app")
  - Output: The tangible deliverable this step produces
- **Call to action**: Offer the full workflow template or automation setup

### Quality Signals
- Every step has a clear trigger — the reader knows exactly WHEN to do it
- Tools are named specifically (not "your favorite tool") so the reader can start today
- Outputs are tangible and measurable — "3 polished posts" not "some content"
- The workflow fits into a realistic schedule — time estimates included
- Steps connect: the output of step N feeds the trigger or input of step N+1

### Common Mistakes
- Vague timing ("regularly", "often") instead of specific triggers
- Missing the tool — naming the action but not the tool makes it abstract
- No outputs specified — without deliverables, the workflow feels like busy work
- Steps that require 4+ hours each — a workflow should be efficient, not exhausting
- Not showing how the workflow compounds over time (week 1 vs week 12)
- Assuming the reader has tools they may not have — offer alternatives`;
