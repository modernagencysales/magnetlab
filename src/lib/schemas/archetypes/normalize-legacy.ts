/**
 * normalize-legacy.ts
 *
 * Transforms legacy lead magnet content fields (polished_content / extracted_content)
 * into the new unified `content` JSONB shape used by MCP v2.
 *
 * Constraint: Pure data transformation — no DB access, no network calls, no Next.js imports.
 */

import type { ExtractedContent, PolishedContent, PolishedBlock } from '@/lib/types/lead-magnet';

// ─── Types ────────────────────────────────────────────────────────

/** The unified section shape used by all archetype publish schemas. */
interface NormalizedSection {
  title: string;
  body: string;
  key_insight?: string;
}

/** The unified content shape produced by normalization. */
interface NormalizedContent {
  headline: string;
  problem_statement: string;
  call_to_action: string;
  sections: NormalizedSection[];
  [key: string]: unknown;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Normalizes legacy lead magnet content fields into the unified `content` shape.
 *
 * Priority: content (passthrough) > polished_content > extracted_content > null
 *
 * @param leadMagnet - Partial lead magnet record containing legacy and new content fields
 * @returns Normalized content record, or null if no content exists
 */
export function normalizeLegacyContent(leadMagnet: {
  content: unknown | null;
  polished_content: unknown | null;
  extracted_content: unknown | null;
  archetype?: string;
}): Record<string, unknown> | null {
  const { content, polished_content, extracted_content } = leadMagnet;

  // Passthrough: content already set — return unchanged
  if (content !== null && content !== undefined) {
    return content as Record<string, unknown>;
  }

  // Priority 1: polished_content (most refined version)
  if (polished_content !== null && polished_content !== undefined) {
    return normalizePolishedContent(polished_content as PolishedContent);
  }

  // Priority 2: extracted_content (raw extraction)
  if (extracted_content !== null && extracted_content !== undefined) {
    return normalizeExtractedContent(extracted_content as ExtractedContent);
  }

  // Both null — no content to normalize
  return null;
}

// ─── Normalization Helpers ────────────────────────────────────────

/**
 * Maps PolishedContent to the unified content shape.
 *
 * - headline      ← title || first section name || ''
 * - problem_statement ← heroSummary
 * - call_to_action    ← last section's keyTakeaway || 'Learn more'
 * - sections          ← each PolishedSection → { title, body, key_insight }
 */
function normalizePolishedContent(polished: PolishedContent): NormalizedContent {
  const sections = (polished.sections ?? []).map(
    (section): NormalizedSection => ({
      title: section.sectionName,
      body: buildSectionBody(section.introduction, section.blocks ?? []),
      ...(section.keyTakeaway ? { key_insight: section.keyTakeaway } : {}),
    })
  );

  const callToAction =
    polished.sections?.[polished.sections.length - 1]?.keyTakeaway || 'Learn more';

  return {
    headline: polished.title || polished.sections?.[0]?.sectionName || '',
    problem_statement: polished.heroSummary,
    call_to_action: callToAction,
    sections,
  };
}

/**
 * Maps ExtractedContent to the unified content shape.
 *
 * - headline          ← title
 * - problem_statement ← differentiation || 'See the full breakdown'
 * - call_to_action    ← 'Get the full guide'
 * - sections          ← each structure item → { title, body, key_insight (first only) }
 */
function normalizeExtractedContent(extracted: ExtractedContent): NormalizedContent {
  const sections = (extracted.structure ?? []).map(
    (item, index): NormalizedSection => ({
      title: item.sectionName,
      body: (item.contents ?? []).join('\n\n'),
      ...(index === 0 && extracted.nonObviousInsight
        ? { key_insight: extracted.nonObviousInsight }
        : {}),
    })
  );

  return {
    headline: extracted.title,
    problem_statement: extracted.differentiation || 'See the full breakdown',
    call_to_action: 'Get the full guide',
    sections,
  };
}

// ─── Internal Utilities ──────────────────────────────────────────

/**
 * Concatenates a section's introduction and block content into a single body string.
 * Filters out blocks with no content (e.g. dividers, images without captions).
 */
function buildSectionBody(introduction: string, blocks: PolishedBlock[]): string {
  const parts: string[] = [];

  if (introduction) {
    parts.push(introduction);
  }

  for (const block of blocks) {
    if (block.content) {
      parts.push(block.content);
    }
  }

  return parts.join('\n\n');
}
