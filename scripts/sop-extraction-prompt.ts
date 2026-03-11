/** Claude prompt template for structured SOP extraction. */

import { VALID_DELIVERABLE_TYPES, VALID_TOOLS } from './sop-types';

/**
 * Build the Claude prompt for extracting structured data from a raw SOP markdown file.
 * Uses system message for instructions, user message for content.
 */
export function buildSystemPrompt(): string {
  return `You are a structured data extractor. You receive SOP (Standard Operating Procedure) documents and extract structured JSON. You ALWAYS respond with valid JSON only — no markdown fences, no explanation, no preamble.`;
}

export function buildExtractionPrompt(
  moduleId: string,
  sopNumber: string,
  rawMarkdown: string
): string {
  return `Extract structured data from this SOP document (module "${moduleId}", SOP number "${sopNumber}").

Return a JSON object with these fields:

{
  "title": "Human-readable title (without SOP number prefix like 'SOP 1.1:')",
  "content": "The full instructional content as clean markdown. Remove YAML frontmatter (--- blocks) and the H1 title line. Keep everything else: steps, :::tip/:::warning/:::info admonition blocks, examples, key lessons, common mistakes.",
  "quality_bars": [
    { "check": "A measurable quality criterion for this SOP's output", "severity": "critical|warning|info" }
  ],
  "deliverables": [
    { "type": "one_of_the_valid_types_below", "description": "What the user produces" }
  ],
  "tools_used": ["tool_name"],
  "dependencies": ["sop_number_of_prerequisite, e.g. 0-1"]
}

Rules:
- quality_bars: Extract from :::warning blocks, "Common Mistakes" sections, and implicit standards in the steps. Create 2-5 quality bars per SOP. "critical" = deal-breakers, "warning" = common mistakes, "info" = best practices.
- deliverables: What tangible output does this SOP produce? Use ONLY these types: ${VALID_DELIVERABLE_TYPES.join(', ')}. Use the closest match. Most SOPs produce 1-2 deliverables.
- tools_used: Use ONLY these names: ${VALID_TOOLS.join(', ')}. Omit any tool not in this list.
- dependencies: Reference by "N-N" format (e.g., "0-1" means Module 0 SOP 1). Empty array if none.
- content: Keep full instructional text. Remove YAML frontmatter and H1 title. Keep admonition blocks, step numbers, examples, tips.

RAW SOP MARKDOWN:

${rawMarkdown}`;
}
