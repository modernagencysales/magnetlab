/** Archetype registry. Maps archetype names to their Zod publish schemas and quality guidelines. */

import { z } from 'zod';

import * as singleBreakdown from './single-breakdown';
import * as singleSystem from './single-system';
import * as focusedToolkit from './focused-toolkit';
import * as singleCalculator from './single-calculator';
import * as focusedDirectory from './focused-directory';
import * as miniTraining from './mini-training';
import * as oneStory from './one-story';
import * as prompt from './prompt';
import * as assessment from './assessment';
import * as workflow from './workflow';

// ─── Types ───────────────────────────────────────────────────────

export const ARCHETYPES = [
  'single-breakdown',
  'single-system',
  'focused-toolkit',
  'single-calculator',
  'focused-directory',
  'mini-training',
  'one-story',
  'prompt',
  'assessment',
  'workflow',
] as const;

export type Archetype = (typeof ARCHETYPES)[number];

type ArchetypeDefinition = {
  publishSchema: z.ZodType;
  description: string;
  guidelines: string;
};

// ─── Registry ────────────────────────────────────────────────────

const registry: Record<Archetype, ArchetypeDefinition> = {
  'single-breakdown': singleBreakdown,
  'single-system': singleSystem,
  'focused-toolkit': focusedToolkit,
  'single-calculator': singleCalculator,
  'focused-directory': focusedDirectory,
  'mini-training': miniTraining,
  'one-story': oneStory,
  prompt: prompt,
  assessment: assessment,
  workflow: workflow,
};

// ─── Public API ──────────────────────────────────────────────────

export function getArchetypeSchema(archetype: Archetype): ArchetypeDefinition {
  const def = registry[archetype];
  if (!def) {
    throw new Error(`Unknown archetype: ${archetype}`);
  }
  return def;
}

export function listArchetypes(): Array<{ archetype: Archetype; description: string }> {
  return ARCHETYPES.map((archetype) => ({
    archetype,
    description: registry[archetype].description,
  }));
}
