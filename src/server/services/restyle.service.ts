/**
 * Restyle Service
 * Orchestrates AI-powered funnel restyling: load funnel, optionally screenshot URLs,
 * call AI for branding plan, apply approved changes.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import * as funnelsRepo from '@/server/repositories/funnels.repo';
import {
  buildRestylePrompt,
  buildVisionPrompt,
  parseRestylePlan,
} from '@/lib/ai/restyle/plan-generator';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { logApiError } from '@/lib/api/errors';

import type { DataScope } from '@/lib/utils/team-context';
import type { RestylePlan } from '@/lib/types/funnel';
import { SECTION_VARIANTS } from '@/lib/types/funnel';

// ─── Types ──────────────────────────────────────────────────────────

export interface RestyleInput {
  prompt?: string;
  urls?: string[];
}

export interface ApplyRestyleInput {
  plan: RestylePlan;
}

// ─── Constants ──────────────────────────────────────────────────────

const ALLOWED_FIELD_UPDATES: Record<string, string> = {
  theme: 'theme',
  primaryColor: 'primary_color',
  backgroundStyle: 'background_style',
  fontFamily: 'font_family',
  fontUrl: 'font_url',
};

const MAX_VISION_URLS = 3;
const AI_MODEL = 'claude-sonnet-4-5-20250514';
const AI_MAX_TOKENS = 2048;

/**
 * Private IP ranges and loopback addresses that must be blocked to prevent SSRF.
 * Each entry: [start, end] as 32-bit integers for fast range comparison.
 */
const BLOCKED_IP_RANGES: Array<[number, number]> = [
  [ipToInt('10.0.0.0'), ipToInt('10.255.255.255')], // 10.0.0.0/8
  [ipToInt('172.16.0.0'), ipToInt('172.31.255.255')], // 172.16.0.0/12
  [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')], // 192.168.0.0/16
  [ipToInt('127.0.0.0'), ipToInt('127.255.255.255')], // 127.0.0.0/8
  [ipToInt('169.254.0.0'), ipToInt('169.254.255.255')], // 169.254.0.0/16 (link-local)
  [ipToInt('0.0.0.0'), ipToInt('0.255.255.255')], // 0.0.0.0/8
];

/** Convert dotted IPv4 string to a 32-bit integer for range checks. */
function ipToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Returns true if the hostname looks like a raw IPv4 address in a blocked range. */
function isBlockedIp(hostname: string): boolean {
  const ipv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  if (!ipv4) return false;
  const asInt = ipToInt(hostname);
  return BLOCKED_IP_RANGES.some(([start, end]) => asInt >= start && asInt <= end);
}

/**
 * Validate that a URL is safe to fetch externally (anti-SSRF).
 * Returns true when the URL passes all checks; false otherwise.
 *
 * Rules:
 *  1. Must parse via `new URL()`
 *  2. Only `https:` protocol allowed
 *  3. Hostname must be a fully-qualified domain name (contains a dot)
 *  4. Rejects `localhost`, `0.0.0.0`, and other bare hostnames
 *  5. Rejects private/internal IPv4 ranges
 */
function validateExternalUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only HTTPS allowed
  if (parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost and common non-FQDN names
  if (hostname === 'localhost' || hostname === '0.0.0.0') return false;

  // Reject IPv6 loopback (browsers normalise [::1])
  if (hostname === '[::1]' || hostname === '::1') return false;

  // Must contain a dot — bare hostnames (e.g. "intranet") are not FQDNs
  if (!hostname.includes('.')) return false;

  // Reject private/internal IPv4 ranges
  if (isBlockedIp(hostname)) return false;

  return true;
}

// ─── Generate Restyle Plan ──────────────────────────────────────────

export async function generateRestylePlan(
  scope: DataScope,
  funnelId: string,
  input: RestyleInput
): Promise<{ plan: RestylePlan }> {
  // 1. Validate input
  if (!input.prompt && (!input.urls || input.urls.length === 0)) {
    throw Object.assign(new Error('Either a style prompt or reference URLs are required'), {
      statusCode: 400,
    });
  }

  // 2. Load funnel
  const funnel = await funnelsRepo.findFunnelById(scope, funnelId);
  if (!funnel) {
    throw Object.assign(new Error('Funnel not found'), { statusCode: 404 });
  }

  // 3. Load sections
  const sections = await funnelsRepo.findSections(funnelId);

  // 4. Vision analysis (if URLs provided)
  let visionAnalysis: string | undefined;
  if (input.urls && input.urls.length > 0) {
    visionAnalysis = await analyzeUrls(input.urls);
  }

  // 5. Build prompt
  const promptInput = buildRestylePrompt({
    stylePrompt: input.prompt || 'Match the style of the reference image(s)',
    currentFunnel: {
      theme: funnel.theme,
      primaryColor: funnel.primaryColor,
      backgroundStyle: funnel.backgroundStyle,
      fontFamily: funnel.fontFamily,
      fontUrl: funnel.fontUrl,
      logoUrl: funnel.logoUrl,
    },
    currentSections: sections.map((s) => ({
      sectionType: s.sectionType,
      pageLocation: s.pageLocation,
      sortOrder: s.sortOrder,
    })),
    visionAnalysis,
  });

  // 6. Call Claude
  const anthropic = createAnthropicClient('restyle-plan');
  const response = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    system: promptInput.systemMessage,
    messages: [{ role: 'user', content: promptInput.userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw Object.assign(new Error('AI returned no text response'), { statusCode: 500 });
  }

  // 7. Parse response
  const plan = parseRestylePlan(textBlock.text);

  return { plan };
}

// ─── Apply Restyle Plan ─────────────────────────────────────────────

export async function applyRestylePlan(
  scope: DataScope,
  funnelId: string,
  input: ApplyRestyleInput
): Promise<{
  success: boolean;
  applied: { fieldChanges: number; sectionChanges: number; variantChanges: number };
}> {
  const { plan } = input;

  // 1. Load funnel (verify access)
  const funnel = await funnelsRepo.findFunnelById(scope, funnelId);
  if (!funnel) {
    throw Object.assign(new Error('Funnel not found'), { statusCode: 404 });
  }

  let fieldChanges = 0;
  let sectionChanges = 0;

  // 2. Apply field changes (whitelist)
  if (plan.changes.length > 0) {
    const updates: Record<string, unknown> = {};

    for (const change of plan.changes) {
      const dbColumn = ALLOWED_FIELD_UPDATES[change.field];
      if (dbColumn) {
        updates[dbColumn] = change.to;
        fieldChanges++;
      }
    }

    if (Object.keys(updates).length > 0) {
      await funnelsRepo.updateFunnel(scope, funnelId, updates);
    }
  }

  // 3. Apply section changes (add/remove/reorder) — individual try/catch
  for (const sectionChange of plan.sectionChanges) {
    try {
      if (sectionChange.action === 'add' && sectionChange.pageLocation) {
        const sortOrder = await funnelsRepo.getMaxSortOrder(funnelId, sectionChange.pageLocation);
        await funnelsRepo.createSection({
          funnel_page_id: funnelId,
          section_type: sectionChange.sectionType,
          page_location: sectionChange.pageLocation,
          sort_order: sortOrder,
          is_visible: true,
          config: {},
        });
        sectionChanges++;
      } else if (sectionChange.action === 'remove') {
        // Find matching section to remove
        const sections = await funnelsRepo.findSections(funnelId);
        const match = sections.find((s) => s.sectionType === sectionChange.sectionType);
        if (match) {
          await funnelsRepo.deleteSection(match.id, funnelId);
          sectionChanges++;
        }
      } else if (sectionChange.action === 'reorder' && sectionChange.position !== undefined) {
        const sections = await funnelsRepo.findSections(funnelId);
        const match = sections.find((s) => s.sectionType === sectionChange.sectionType);
        if (match) {
          await funnelsRepo.updateSection(match.id, funnelId, {
            sort_order: sectionChange.position,
            updated_at: new Date().toISOString(),
          });
          sectionChanges++;
        }
      }
    } catch (err) {
      logApiError('restyle.service/applyRestylePlan/sectionChange', err, {
        action: sectionChange.action,
        sectionType: sectionChange.sectionType,
        funnelId,
      });
    }
  }

  // 4. Apply variant changes
  let variantChanges = 0;
  for (const variantChange of plan.sectionVariantChanges || []) {
    try {
      // Validate variant against SECTION_VARIANTS whitelist
      const sectionType = await funnelsRepo.getSectionType(variantChange.sectionId, funnelId);
      if (sectionType) {
        const allowedVariants = SECTION_VARIANTS[sectionType as keyof typeof SECTION_VARIANTS];
        if (allowedVariants && !allowedVariants.includes(variantChange.toVariant as never)) {
          logApiError(
            'restyle.service/applyRestylePlan/variantChange',
            new Error(
              `Invalid variant "${variantChange.toVariant}" for section type "${sectionType}". Allowed: ${allowedVariants.join(', ')}`
            ),
            { sectionId: variantChange.sectionId, toVariant: variantChange.toVariant, funnelId }
          );
          continue;
        }
      }

      await funnelsRepo.updateSection(variantChange.sectionId, funnelId, {
        variant: variantChange.toVariant,
      });
      variantChanges++;
    } catch (err) {
      logApiError('restyle.service/applyRestylePlan/variantChange', err, {
        sectionId: variantChange.sectionId,
        toVariant: variantChange.toVariant,
        funnelId,
      });
    }
  }

  return { success: true, applied: { fieldChanges, sectionChanges, variantChanges } };
}

// ─── Vision Analysis (private) ──────────────────────────────────────

async function analyzeUrls(urls: string[]): Promise<string> {
  const anthropic = createAnthropicClient('restyle-vision');
  const visionPrompt = buildVisionPrompt();
  const analyses: string[] = [];

  // Filter out unsafe URLs before processing (SSRF prevention)
  const safeUrls = urls.filter((url) => {
    const safe = validateExternalUrl(url);
    if (!safe) {
      logApiError('restyle.service/analyzeUrls/urlValidation', new Error('Rejected unsafe URL'), {
        url,
        reason: 'SSRF prevention: URL failed external validation',
      });
    }
    return safe;
  });

  const urlsToProcess = safeUrls.slice(0, MAX_VISION_URLS);

  for (const url of urlsToProcess) {
    try {
      const response = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url } },
              { type: 'text', text: visionPrompt },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        analyses.push(textBlock.text);
      }
    } catch (err) {
      logApiError('restyle.service/analyzeUrls', err, { url });
      // Skip failed URLs — don't block
    }
  }

  return analyses.join('\n\n---\n\n');
}

// ─── Error Helper ───────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
