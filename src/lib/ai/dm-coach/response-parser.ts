/** DM Coach response parser.
 * Purpose: Parse structured AI coaching responses from raw Claude output.
 * Constraint: No SDK imports. No process.env. Pure parsing functions. */

import type { CoachSuggestion, CoachReasoning, QualificationStage } from '@/lib/types/dm-coach';

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_STAGES: QualificationStage[] = [
  'unknown',
  'situation',
  'pain',
  'impact',
  'vision',
  'capability',
  'commitment',
];

// ─── Parser ─────────────────────────────────────────────────────────────────

/**
 * Parse AI response text into a structured CoachSuggestion.
 * Extracts suggested response, stage transitions, signals, style notes,
 * goal alignment, and coaching rationale.
 */
export function parseCoachResponse(response: string): CoachSuggestion {
  const styleNotes = extractSection(response, 'Style analysis');
  const stageRaw = extractSection(response, 'Stage');
  const signalsRaw = extractSection(response, 'Signals');
  const goalAlignment = extractSection(response, 'Goal alignment');
  const suggestedResponse = extractSection(response, 'Suggested response');
  const strategyApplied = extractSection(response, 'Why this response');
  const negativeSignalsRaw = extractSection(response, 'Negative signals');

  // Parse stage before/after from "situation -> pain" or "situation → pain"
  const { before, after } = parseStageTransition(stageRaw);

  // Parse signals into array
  const signals = signalsRaw
    ? signalsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Parse negative signals if present
  const negativeSignals = negativeSignalsRaw
    ? negativeSignalsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const reasoning: CoachReasoning = {
    stage: stageRaw || 'Unknown',
    signals,
    styleNotes: styleNotes || '',
    strategyApplied: strategyApplied || '',
    goalAlignment: goalAlignment || '',
    negativeSignals: negativeSignals?.length ? negativeSignals : undefined,
  };

  return {
    suggestedResponse: suggestedResponse || extractFallbackResponse(response),
    reasoning,
    qualificationStageBefore: before,
    qualificationStageAfter: after,
  };
}

// ─── Section Extraction ─────────────────────────────────────────────────────

/**
 * Extract content after a **Section name**: header.
 * Handles multiline content up to the next **Section** header or end of text.
 */
function extractSection(response: string, sectionName: string): string {
  // Match **Section name**: or **Section name** : with optional colon
  const pattern = new RegExp(
    `\\*\\*${escapeRegex(sectionName)}\\*\\*[:\\s]*\\n?([\\s\\S]*?)(?=\\n\\*\\*[A-Z]|$)`,
    'i'
  );
  const match = response.match(pattern);
  return match?.[1]?.trim() || '';
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Stage Parsing ──────────────────────────────────────────────────────────

/**
 * Parse a stage transition string like "situation -> pain" or "situation → pain".
 * Returns validated QualificationStage values; defaults to 'unknown' if invalid.
 */
function parseStageTransition(raw: string): {
  before: QualificationStage;
  after: QualificationStage;
} {
  if (!raw) return { before: 'unknown', after: 'unknown' };

  // Split on arrow variants: ->, →, =>, -->, ~>
  const parts = raw.split(/\s*(?:->|→|=>|-->|~>)\s*/);

  const beforeRaw = parts[0]?.trim().toLowerCase() || '';
  const afterRaw = (parts[1] || parts[0])?.trim().toLowerCase() || '';

  return {
    before: validateStage(beforeRaw),
    after: validateStage(afterRaw),
  };
}

/**
 * Validate a string as a QualificationStage. Returns 'unknown' if invalid.
 */
function validateStage(value: string): QualificationStage {
  const cleaned = value.replace(/[^a-z]/g, '');
  return VALID_STAGES.includes(cleaned as QualificationStage)
    ? (cleaned as QualificationStage)
    : 'unknown';
}

// ─── Fallback Extraction ────────────────────────────────────────────────────

/**
 * Fallback: extract a usable response when structured parsing fails.
 * Tries quoted text, lead-in phrases, then last paragraph.
 */
function extractFallbackResponse(response: string): string {
  // Look for text in double quotes (at least 10 chars)
  const quotedMatch = response.match(/"([^"]{10,})"/);
  if (quotedMatch) return quotedMatch[1];

  // Look for text after common lead-in phrases
  const leadInMatch = response.match(
    /(?:suggest|recommend|try|send|reply with)[:\s]+["']?([^"'\n]+)/i
  );
  if (leadInMatch) return leadInMatch[1];

  // Return last paragraph as last resort
  const paragraphs = response.split('\n\n').filter((p) => p.trim());
  return paragraphs[paragraphs.length - 1] || response;
}
