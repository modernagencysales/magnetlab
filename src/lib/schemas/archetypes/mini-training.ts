/** Mini Training archetype. A short multi-lesson course that teaches one skill. Never import from other archetypes. */

import { z } from 'zod';

import { baseContentSchema } from './shared';

// ─── Schema ──────────────────────────────────────────────────────

const lessonSchema = z.object({
  title: z.string().min(3),
  objective: z.string().min(10),
  content: z.string().min(50),
  exercise: z.string().min(10),
});

export const publishSchema = baseContentSchema.extend({
  lessons: z.array(lessonSchema).min(2),
});

// ─── Metadata ────────────────────────────────────────────────────

export const description =
  'A short multi-lesson course that teaches the reader one specific skill through guided exercises.';

export const guidelines = `## Writing a Mini Training

A mini training is a 2-5 lesson micro-course that teaches one focused
skill. Each lesson has a clear objective, teaching content, and a hands-on
exercise. The reader should be measurably better at the skill after
completing it.

### Structure
- **Headline**: Promise the skill they will gain and the time it takes.
  Good: "Master LinkedIn Hooks in 3 Days: A Hands-On Mini Course"
  Bad: "Learn About LinkedIn"
- **Problem statement**: Describe the skill gap and its cost.
- **Lessons**: Each lesson is a self-contained learning unit.
  - Title: Name the lesson clearly ("Day 1: Your Content Positioning")
  - Objective: One sentence — what the reader can DO after this lesson
  - Content: Teaching material — concepts, frameworks, examples. Be thorough.
  - Exercise: A specific, completable task that practices the lesson's skill
- **Call to action**: Next step after completing the training

### Quality Signals
- Each lesson teaches ONE thing — not three things crammed into one lesson
- Exercises produce a tangible output the reader can use (not just "reflect on X")
- Lessons build on each other — lesson 2 uses the output of lesson 1
- Specific examples throughout — show, don't just tell
- The complete training can be consumed in under an hour total

### Common Mistakes
- Lessons that are all theory with no practice (exercises are not optional)
- Exercises that are too vague ("think about your audience") — be specific
- Too many lessons — a mini training with 10 lessons is a full course, not a lead magnet
- No progressive skill building — each lesson should feel like leveling up
- Content that reads like a blog post instead of a teaching experience`;
