/** AI post analyzer. Reads post text and auto-configures a Post Campaign.
 *  Never imports HTTP or DB directly — receives data as params. */

import { createAnthropicClient } from '@/lib/ai/anthropic-client';

// ─── Constants ──────────────────────────────────────────────────────────

const AUTO_SETUP_MODEL = 'claude-sonnet-4-6-20250514';
const MAX_TOKENS = 1024;

// ─── Types ──────────────────────────────────────────────────────────────

export interface AutoSetupInput {
  postText: string;
  publishedFunnels: Array<{
    id: string;
    title: string;
    slug: string;
    leadMagnetTitle: string;
  }>;
  teamProfiles: Array<{
    id: string;
    name: string;
    unipileAccountId: string;
  }>;
  posterProfileId: string;
}

export interface AutoSetupResult {
  keyword: string;
  funnelPageId: string | null;
  funnelName: string | null;
  deliveryAccountId: string;
  deliveryAccountName: string;
  posterAccountId: string;
  replyTemplate: string;
  dmTemplate: string;
  confidence: 'high' | 'medium' | 'low';
  needsUserInput: string[];
}

// ─── Prompt ─────────────────────────────────────────────────────────────

function buildAnalysisPrompt(input: AutoSetupInput): string {
  const funnelList =
    input.publishedFunnels.length > 0
      ? input.publishedFunnels
          .map((f) => `- ID: ${f.id}, Title: "${f.title}", Lead Magnet: "${f.leadMagnetTitle}"`)
          .join('\n')
      : '(no published funnels)';

  const profileList = input.teamProfiles.map((p) => `- ID: ${p.id}, Name: "${p.name}"`).join('\n');

  return `Analyze this LinkedIn post and extract campaign configuration.

POST TEXT:
"""
${input.postText}
"""

AVAILABLE LEAD MAGNETS (published funnels):
${funnelList}

TEAM PROFILES:
${profileList}

POSTER PROFILE ID: ${input.posterProfileId}

Extract the following as JSON:
1. "keyword" — The specific word or short phrase from patterns like "comment X below", "drop X in comments", "type X". If no clear keyword CTA, propose one based on the topic (e.g., "GUIDE", "PLAYBOOK").
2. "delivery_person_name" — From patterns like "connect with X", "send a connection request to X", "add X". Case-insensitive match against team profile names. If no match found, use null.
3. "funnel_match_id" — The ID of the best matching published funnel based on the post topic. If no clear match or multiple possible matches, use null.
4. "funnel_match_name" — The title of the matched funnel, or null.

Respond with ONLY valid JSON in this exact format:
{"keyword": "...", "delivery_person_name": "...", "funnel_match_id": "...", "funnel_match_name": "..."}`;
}

// ─── Analysis ───────────────────────────────────────────────────────────

interface ParsedAIResponse {
  keyword: string;
  delivery_person_name: string | null;
  funnel_match_id: string | null;
  funnel_match_name: string | null;
}

function parseAIResponse(text: string): ParsedAIResponse | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return {
      keyword: typeof parsed.keyword === 'string' ? parsed.keyword : '',
      delivery_person_name:
        typeof parsed.delivery_person_name === 'string' ? parsed.delivery_person_name : null,
      funnel_match_id: typeof parsed.funnel_match_id === 'string' ? parsed.funnel_match_id : null,
      funnel_match_name:
        typeof parsed.funnel_match_name === 'string' ? parsed.funnel_match_name : null,
    };
  } catch {
    return null;
  }
}

function resolveDeliveryAccount(
  deliveryPersonName: string | null,
  teamProfiles: AutoSetupInput['teamProfiles'],
  posterProfileId: string
): { id: string; name: string } {
  if (deliveryPersonName) {
    const match = teamProfiles.find(
      (p) => p.name.toLowerCase() === deliveryPersonName.toLowerCase()
    );
    if (match) {
      return { id: match.unipileAccountId, name: match.name };
    }
  }

  // Fallback: use poster's profile as delivery
  const posterProfile = teamProfiles.find(
    (p) => p.unipileAccountId === posterProfileId || p.id === posterProfileId
  );
  return {
    id: posterProfile?.unipileAccountId ?? posterProfileId,
    name: posterProfile?.name ?? 'Poster',
  };
}

function determineConfidence(
  keyword: string,
  funnelMatchId: string | null,
  deliveryResolved: boolean
): 'high' | 'medium' | 'low' {
  if (!keyword) return 'low';
  if (funnelMatchId && deliveryResolved) return 'high';
  return 'medium';
}

function buildNeedsUserInput(keyword: string, funnelMatchId: string | null): string[] {
  const needs: string[] = [];
  if (!keyword) needs.push('keyword');
  if (!funnelMatchId) needs.push('funnelPageId');
  return needs;
}

/**
 * Analyze a LinkedIn post and auto-configure a Post Campaign.
 *
 * Extracts keyword, delivery account, lead magnet match, and generates templates.
 * Returns a draft configuration with confidence level and fields requiring user input.
 */
export async function analyzePostForCampaign(input: AutoSetupInput): Promise<AutoSetupResult> {
  const client = createAnthropicClient('auto-setup');

  const response = await client.messages.create({
    model: AUTO_SETUP_MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content: buildAnalysisPrompt(input),
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const parsed = parseAIResponse(text);

  const keyword = parsed?.keyword ?? '';
  const deliveryAccount = resolveDeliveryAccount(
    parsed?.delivery_person_name ?? null,
    input.teamProfiles,
    input.posterProfileId
  );
  const deliveryResolved =
    parsed?.delivery_person_name !== null && deliveryAccount.name !== 'Poster';
  const funnelMatchId = parsed?.funnel_match_id ?? null;
  const funnelMatchName = parsed?.funnel_match_name ?? null;

  const confidence = determineConfidence(keyword, funnelMatchId, deliveryResolved);
  const needsUserInput = buildNeedsUserInput(keyword, funnelMatchId);

  // Find poster account info
  const posterProfile = input.teamProfiles.find(
    (p) => p.unipileAccountId === input.posterProfileId || p.id === input.posterProfileId
  );
  const posterAccountId = posterProfile?.unipileAccountId ?? input.posterProfileId;

  return {
    keyword,
    funnelPageId: funnelMatchId,
    funnelName: funnelMatchName,
    deliveryAccountId: deliveryAccount.id,
    deliveryAccountName: deliveryAccount.name,
    posterAccountId,
    replyTemplate: `Hey {{name}}! Just sent you a connection request — accept it and I'll send the resource right over`,
    dmTemplate: `Hey {{name}}, here's what you requested: {{funnel_url}}`,
    confidence,
    needsUserInput,
  };
}
