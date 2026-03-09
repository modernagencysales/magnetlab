/**
 * Position Synthesizer.
 * Analyzes knowledge entries for a topic and synthesizes a structured Position via Claude Sonnet.
 * PURE AI function — no database access, no side effects.
 */

import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type {
  KnowledgeEntry,
  Position,
  StanceType,
  EvidenceStrength,
  PositionDataPoint,
  PositionStory,
  PositionRecommendation,
  PositionContradiction,
} from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_ENTRIES_FOR_SYNTHESIS = 3;
const MAX_ENTRIES_IN_PROMPT = 30;

const VALID_STANCES: StanceType[] = ['contrarian', 'conventional', 'nuanced', 'experiential'];
const VALID_EVIDENCE: EvidenceStrength[] = ['anecdotal', 'observed', 'measured'];

const MAX_KEY_ARGUMENTS = 7;
const MAX_VOICE_MARKERS = 10;
const MAX_DIFFERENTIATORS = 5;
const MAX_COVERAGE_GAPS = 5;

// ─── Raw LLM Response Shape ──────────────────────────────────────────────────

interface RawDataPoint {
  claim: string;
  evidence_strength: string;
  source_entry_index: number;
}

interface RawStory {
  hook: string;
  arc: string;
  lesson: string;
  source_entry_index: number;
}

interface RawRecommendation {
  recommendation: string;
  reasoning: string;
  source_entry_index: number;
}

interface RawContradiction {
  tension: string;
  resolution?: string;
}

interface RawSynthesisResponse {
  thesis: string;
  stance_type: string;
  confidence: number;
  key_arguments: string[];
  unique_data_points: RawDataPoint[];
  stories: RawStory[];
  specific_recommendations: RawRecommendation[];
  voice_markers: string[];
  differentiators: string[];
  contradictions: RawContradiction[];
  related_topics: string[];
  coverage_gaps: string[];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Synthesize a Position from knowledge entries for a given topic.
 * Returns null if fewer than MIN_ENTRIES_FOR_SYNTHESIS entries are provided.
 */
export async function synthesizePosition(
  entries: KnowledgeEntry[],
  topic: string,
  topicSlug: string
): Promise<Position | null> {
  if (entries.length < MIN_ENTRIES_FOR_SYNTHESIS) {
    return null;
  }

  const trimmedEntries = entries.slice(0, MAX_ENTRIES_IN_PROMPT);
  const formattedEntries = formatEntriesForPrompt(trimmedEntries);
  const prompt = buildSynthesisPrompt(topic, formattedEntries);

  try {
    const client = getAnthropicClient('position-synthesizer');

    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const raw = parseJsonResponse<RawSynthesisResponse>(text);

    return normalizeResponse(raw, topic, topicSlug, trimmedEntries);
  } catch (error) {
    logError('position-synthesizer', error, { topic, topicSlug, entryCount: entries.length });
    return null;
  }
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSynthesisPrompt(topic: string, formattedEntries: string): string {
  return `You are analyzing a person's knowledge base entries about "${topic}" to synthesize their ACTUAL position — what they truly believe, teach, and recommend based on real experience.

KNOWLEDGE ENTRIES:
${formattedEntries}

INSTRUCTIONS:
Analyze these entries and extract a structured position. Be ruthlessly specific:
- Use their ACTUAL language, real numbers, concrete examples — not generic summaries
- Only include stories that have a clear narrative arc (setup → tension → resolution/lesson)
- Flag contradictions honestly rather than papering over them
- If they use distinctive phrases or framing, capture those as voice_markers
- Differentiators should be things that separate their view from generic advice on this topic

Return ONLY valid JSON (no markdown, no code fences, no explanation) with this exact structure:

{
  "thesis": "Their core position in 2-3 sentences. Use their framing and language, not a sanitized summary.",
  "stance_type": "contrarian | conventional | nuanced | experiential",
  "confidence": 0.0 to 1.0,
  "key_arguments": ["3-5 supporting arguments they actually make, in their words"],
  "unique_data_points": [
    {
      "claim": "A specific factual claim or data point they reference",
      "evidence_strength": "anecdotal | observed | measured",
      "source_entry_index": 0
    }
  ],
  "stories": [
    {
      "hook": "The compelling setup that draws you in",
      "arc": "What happened — the tension, turning point, or sequence of events",
      "lesson": "The takeaway or insight the story demonstrates",
      "source_entry_index": 0
    }
  ],
  "specific_recommendations": [
    {
      "recommendation": "A concrete, actionable recommendation they make",
      "reasoning": "Why they recommend this, based on their experience",
      "source_entry_index": 0
    }
  ],
  "voice_markers": ["Actual phrases, metaphors, or framing devices they repeatedly use"],
  "differentiators": ["What makes their take different from generic advice on this topic"],
  "contradictions": [
    {
      "tension": "Where two entries or claims seem to conflict",
      "resolution": "Optional — how they might reconcile this, or null if unresolved"
    }
  ],
  "related_topics": ["Other topics that naturally connect to this position"],
  "coverage_gaps": ["Important aspects of this topic they haven't addressed yet"]
}

RULES:
- source_entry_index is 0-based, referencing the entry's position in the numbered list above
- Only include stories with clear narrative arcs — skip vague references to experiences
- key_arguments: 3-5 items. These are arguments THEY make, not arguments you'd make about the topic
- voice_markers: actual phrases they use, not descriptions of their style
- confidence: how strongly and consistently they hold this position (0.5 = mixed signals, 0.9 = very clear and consistent)
- Do NOT generalize their specific experiences into platitudes
- Do NOT invent data points or stories — only include what is clearly supported by the entries
- If an entry is ambiguous, lean toward omitting rather than guessing`;
}

// ─── Entry Formatter ──────────────────────────────────────────────────────────

function formatEntriesForPrompt(entries: KnowledgeEntry[]): string {
  return entries
    .map((entry, index) => {
      const meta: string[] = [];

      if (entry.knowledge_type) {
        meta.push(`type: ${entry.knowledge_type}`);
      }
      if (entry.quality_score != null) {
        meta.push(`quality: ${entry.quality_score}`);
      }
      if (entry.tags?.length) {
        meta.push(`tags: ${entry.tags.join(', ')}`);
      }
      if (entry.context) {
        meta.push(`context: ${entry.context}`);
      }

      const metaLine = meta.length > 0 ? `  [${meta.join(' | ')}]` : '';
      return `[${index}]${metaLine}\n${entry.content}`;
    })
    .join('\n\n');
}

// ─── Response Normalizer ──────────────────────────────────────────────────────

function normalizeResponse(
  raw: RawSynthesisResponse,
  topic: string,
  topicSlug: string,
  entries: KnowledgeEntry[]
): Position {
  const stanceType: StanceType = VALID_STANCES.includes(raw.stance_type as StanceType)
    ? (raw.stance_type as StanceType)
    : 'experiential';

  const confidence = Math.max(0, Math.min(1, Number(raw.confidence) || 0.5));

  const keyArguments = Array.isArray(raw.key_arguments)
    ? raw.key_arguments
        .filter((a): a is string => typeof a === 'string')
        .slice(0, MAX_KEY_ARGUMENTS)
    : [];

  const uniqueDataPoints: PositionDataPoint[] = Array.isArray(raw.unique_data_points)
    ? raw.unique_data_points.map((dp) => ({
        claim: String(dp.claim || ''),
        evidence_strength: VALID_EVIDENCE.includes(dp.evidence_strength as EvidenceStrength)
          ? (dp.evidence_strength as EvidenceStrength)
          : 'anecdotal',
        source_entry_id: resolveEntryId(dp.source_entry_index, entries),
      }))
    : [];

  const stories: PositionStory[] = Array.isArray(raw.stories)
    ? raw.stories.map((s) => ({
        hook: String(s.hook || ''),
        arc: String(s.arc || ''),
        lesson: String(s.lesson || ''),
        source_entry_id: resolveEntryId(s.source_entry_index, entries),
      }))
    : [];

  const specificRecommendations: PositionRecommendation[] = Array.isArray(
    raw.specific_recommendations
  )
    ? raw.specific_recommendations.map((r) => ({
        recommendation: String(r.recommendation || ''),
        reasoning: String(r.reasoning || ''),
        source_entry_id: resolveEntryId(r.source_entry_index, entries),
      }))
    : [];

  const voiceMarkers = Array.isArray(raw.voice_markers)
    ? raw.voice_markers
        .filter((m): m is string => typeof m === 'string')
        .slice(0, MAX_VOICE_MARKERS)
    : [];

  const differentiators = Array.isArray(raw.differentiators)
    ? raw.differentiators
        .filter((d): d is string => typeof d === 'string')
        .slice(0, MAX_DIFFERENTIATORS)
    : [];

  const contradictions: PositionContradiction[] = Array.isArray(raw.contradictions)
    ? raw.contradictions.map((c) => ({
        tension: String(c.tension || ''),
        ...(c.resolution ? { resolution: String(c.resolution) } : {}),
      }))
    : [];

  const relatedTopics = Array.isArray(raw.related_topics)
    ? raw.related_topics.filter((t): t is string => typeof t === 'string')
    : [];

  const coverageGaps = Array.isArray(raw.coverage_gaps)
    ? raw.coverage_gaps
        .filter((g): g is string => typeof g === 'string')
        .slice(0, MAX_COVERAGE_GAPS)
    : [];

  // Collect all entry IDs that were actually referenced
  const referencedIds = new Set<string>();
  for (const dp of uniqueDataPoints) {
    if (dp.source_entry_id) referencedIds.add(dp.source_entry_id);
  }
  for (const s of stories) {
    if (s.source_entry_id) referencedIds.add(s.source_entry_id);
  }
  for (const r of specificRecommendations) {
    if (r.source_entry_id) referencedIds.add(r.source_entry_id);
  }

  // Include all provided entry IDs as supporting (they were all relevant enough to be passed in)
  const supportingEntryIds = entries.map((e) => e.id);

  return {
    topic,
    topic_slug: topicSlug,
    thesis: String(raw.thesis || ''),
    stance_type: stanceType,
    confidence,
    key_arguments: keyArguments,
    unique_data_points: uniqueDataPoints,
    stories,
    specific_recommendations: specificRecommendations,
    voice_markers: voiceMarkers,
    differentiators,
    contradictions,
    related_topics: relatedTopics,
    coverage_gaps: coverageGaps,
    supporting_entry_ids: supportingEntryIds,
    entry_count: entries.length,
    synthesized_at: new Date().toISOString(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveEntryId(index: number, entries: KnowledgeEntry[]): string {
  if (typeof index === 'number' && index >= 0 && index < entries.length) {
    return entries[index].id;
  }
  return '';
}
