/** Single Calculator archetype. An interactive calculator that quantifies a business metric. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const inputSchema = z.object({
  label: z.string().min(3),
  type: z.string().min(2),
  placeholder: z.string().optional(),
});

export const publishSchema = baseContentSchema.extend({
  inputs: z.array(inputSchema).min(1),
  formula_description: z.string().min(20),
  output_format: z.string().min(10),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'An interactive calculator that helps the reader quantify a business metric they care about.';

export const guidelines = `## Writing a Single Calculator

A single-calculator lead magnet gives the reader a personalized number
based on their inputs. Calculators work because they transform vague
feelings ("I think I'm losing money") into concrete figures ("You're
leaving $47,000/year on the table").

### Structure
- **Headline**: Promise a personalized answer to a question they already have.
  Good: "Calculate How Much Revenue You're Losing to Bad Follow-Up"
  Bad: "Revenue Calculator"
- **Problem statement**: Name the uncertainty they live with.
- **Inputs**: Each input is one variable the reader provides.
  - Label: Plain English, no jargon. "Monthly website visitors" not "MAU"
  - Type: number, select, or slider — pick whichever reduces friction
  - Placeholder: Show realistic example values so they know the expected scale
- **Formula description**: Explain the logic in plain English. The reader should
  understand why the calculation works, not just trust a black box.
- **Output format**: Describe what the result looks like and what it means.
  Include interpretation — don't just show a number without context.

### Quality Signals
- Inputs are data the reader actually knows (or can estimate quickly)
- The formula is grounded in real-world data or proven benchmarks
- The output creates urgency — it shows cost of inaction or size of opportunity
- The result naturally leads to the next conversation with you

### Common Mistakes
- Asking for inputs the reader doesn't know ("What's your customer lifetime value?")
- Black-box formulas — if they can't understand the math, they won't trust the result
- Results without context — "$47K" means nothing without "that's 3x your current pipeline"
- Too many inputs — every extra field is a dropout. Aim for 3-5 inputs maximum
- No clear connection between the result and what you sell`;
