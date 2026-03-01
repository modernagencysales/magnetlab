/**
 * A/B Experiments Service
 * Business logic for experiments CRUD and AI suggestions. No Supabase in callers.
 */

import * as abRepo from '@/server/repositories/ab-experiments.repo';
import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import { parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';

export const VALID_TEST_FIELDS = ['headline', 'subline', 'vsl_url', 'pass_message'] as const;
export type TestField = (typeof VALID_TEST_FIELDS)[number];

const TEST_FIELD_TO_COLUMN: Record<TestField, string> = {
  headline: 'thankyou_headline',
  subline: 'thankyou_subline',
  vsl_url: 'vsl_url',
  pass_message: 'qualification_pass_message',
};

export function isValidTestField(value: string): value is TestField {
  return VALID_TEST_FIELDS.includes(value as TestField);
}

export async function listExperiments(userId: string, funnelPageId?: string) {
  const experiments = await abRepo.listExperiments(userId, funnelPageId);
  return { experiments };
}

export async function createExperiment(
  userId: string,
  body: { funnelPageId: string; name: string; testField: string; variantValue?: string | null; variantLabel?: string }
) {
  const control = await abRepo.getControlFunnelPage(body.funnelPageId, userId);
  if (!control) return { error: 'NOT_FOUND' as const, message: 'Funnel page' };

  const hasActive = await abRepo.hasActiveExperiment(body.funnelPageId);
  if (hasActive) return { error: 'CONFLICT' as const, message: 'An active experiment already exists for this funnel page. Complete or delete it first.' };

  if (!isValidTestField(body.testField)) {
    return { error: 'VALIDATION' as const, message: `testField must be one of: ${VALID_TEST_FIELDS.join(', ')}` };
  }

  const experiment = await abRepo.createExperiment(userId, {
    funnelPageId: body.funnelPageId,
    name: body.name,
    testField: body.testField,
  });

  const variantData: Record<string, unknown> = {};
  for (const field of abRepo.CLONE_FIELDS) {
    variantData[field] = control[field];
  }
  const dbColumn = TEST_FIELD_TO_COLUMN[body.testField as TestField];
  variantData[dbColumn] = body.variantValue ?? null;
  variantData.slug = `${control.slug}-variant-${Date.now()}`;
  variantData.experiment_id = experiment.id;
  variantData.is_variant = true;
  variantData.variant_label = body.variantLabel || 'Variant B';
  variantData.is_published = true;

  try {
    const variant = await abRepo.createVariantPage(variantData);
    await abRepo.linkControlToExperiment(body.funnelPageId, experiment.id);
    return { experiment: { id: experiment.id }, variant: { id: variant.id } };
  } catch (err) {
    await abRepo.deleteExperimentById(experiment.id);
    throw err;
  }
}

export async function getExperimentById(id: string, userId: string) {
  const experiment = await abRepo.getExperimentById(id, userId);
  if (!experiment) return null;

  const variants = await abRepo.getVariantsForExperiment(id, experiment.funnel_page_id);
  const variantIds = variants.map((v) => v.id);
  const [viewsByVariant, completionsByVariant] = await Promise.all([
    abRepo.getPageViewCountsByFunnelPage(variantIds),
    abRepo.getFunnelLeadCountsByFunnelPage(variantIds),
  ]);

  const variantStats = variants.map((v) => {
    const views = viewsByVariant[v.id] ?? 0;
    const completions = completionsByVariant[v.id] ?? 0;
    return {
      funnelPageId: v.id,
      isVariant: v.is_variant,
      label: v.is_variant ? (v.variant_label || 'Variant B') : 'Control',
      views,
      completions,
      completionRate: views > 0 ? Math.round((completions / views) * 10000) / 100 : 0,
      headline: v.thankyou_headline,
      subline: v.thankyou_subline,
      vslUrl: v.vsl_url,
      passMessage: v.qualification_pass_message,
    };
  });

  return { experiment, variants: variantStats };
}

export async function patchExperiment(
  id: string,
  userId: string,
  body: { action: string; winnerId?: string }
) {
  const experiment = await abRepo.getExperimentById(id, userId);
  if (!experiment) return null;

  const now = new Date().toISOString();

  if (body.action === 'pause') {
    if (experiment.status !== 'running') return { error: 'VALIDATION' as const, message: 'Can only pause a running experiment' };
    await abRepo.updateExperimentStatus(id, { status: 'paused', updated_at: now });
    return { status: 'paused' as const };
  }

  if (body.action === 'resume') {
    if (experiment.status !== 'paused') return { error: 'VALIDATION' as const, message: 'Can only resume a paused experiment' };
    await abRepo.updateExperimentStatus(id, { status: 'running', updated_at: now });
    return { status: 'running' as const };
  }

  if (body.action === 'declare_winner') {
    if (!body.winnerId) return { error: 'VALIDATION' as const, message: 'winnerId is required to declare a winner' };
    const winnerPage = await abRepo.getWinnerPage(body.winnerId, id, experiment.funnel_page_id);
    if (!winnerPage) return { error: 'VALIDATION' as const, message: 'Winner must be a variant in this experiment' };

    const dbColumn = TEST_FIELD_TO_COLUMN[experiment.test_field as TestField];
    if (winnerPage.is_variant) {
      const winningValue = winnerPage[dbColumn];
      await abRepo.updateFunnelPageField(experiment.funnel_page_id, dbColumn, winningValue);
    }

    await abRepo.updateExperimentStatus(id, {
      status: 'completed',
      winner_id: body.winnerId,
      completed_at: now,
      updated_at: now,
    });
    await abRepo.unpublishVariantsAndClearExperiment(id);
    await abRepo.clearControlExperimentId(experiment.funnel_page_id);
    return { status: 'completed' as const, winnerId: body.winnerId };
  }

  return { error: 'VALIDATION' as const, message: 'action must be one of: pause, resume, declare_winner' };
}

export async function deleteExperiment(id: string, userId: string) {
  const experiment = await abRepo.getExperimentForDelete(id, userId);
  if (!experiment) return null;

  await abRepo.deleteVariantPages(id);
  await abRepo.clearControlExperimentId(experiment.funnel_page_id);
  await abRepo.deleteExperimentById(id);
  return { deleted: true };
}

// ─── Suggest ───────────────────────────────────────────────────────────────

interface Suggestion {
  label: string;
  value: string | null;
  rationale: string;
}

export async function suggestVariants(
  userId: string,
  body: { funnelPageId: string; testField: string }
): Promise<{ suggestions: Suggestion[] }> {
  if (!isValidTestField(body.testField)) {
    throw new Error(`testField must be one of: ${VALID_TEST_FIELDS.join(', ')}`);
  }

  if (body.testField === 'vsl_url') {
    return {
      suggestions: [
        { label: 'Remove video', value: null, rationale: 'Test if removing video increases survey completion.' },
      ],
    };
  }

  const funnelPage = await abRepo.getFunnelPageForSuggest(body.funnelPageId, userId);
  if (!funnelPage) throw new Error('NOT_FOUND');

  let leadMagnetContext = '';
  const lmId = funnelPage.lead_magnet_id as string | undefined;
  if (lmId) leadMagnetContext = await abRepo.getLeadMagnetContext(lmId);

  const dbColumn = TEST_FIELD_TO_COLUMN[body.testField as TestField];
  const currentValue = (funnelPage[dbColumn] as string) || '';
  const fieldLabels: Record<TestField, string> = {
    headline: 'thank-you page headline',
    subline: 'thank-you page subline/subtitle',
    pass_message: 'qualification pass message (shown to qualified leads)',
    vsl_url: 'vsl_url',
  };
  const fieldLabel = fieldLabels[body.testField as TestField] || body.testField;

  const anthropic = createAnthropicClient('ab-experiments-suggest');
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a conversion rate optimization (CRO) expert. Generate 3 A/B test variant suggestions for a lead magnet funnel page.

**Field being tested:** ${fieldLabel}
**Current value:** "${currentValue}"
${leadMagnetContext ? `\n**Context:**\n${leadMagnetContext}` : ''}

Generate 3 alternative variants that could plausibly outperform the current copy. Each should test a different CRO hypothesis (e.g., urgency, specificity, social proof, curiosity, benefit-focused, etc.).

Respond with a JSON array of exactly 3 objects:
[
  { "label": "Variant B", "value": "the new copy", "rationale": "Why this might convert better" },
  { "label": "Variant C", "value": "the new copy", "rationale": "Why this might convert better" },
  { "label": "Variant D", "value": "the new copy", "rationale": "Why this might convert better" }
]

Rules:
- Keep values concise and punchy (appropriate length for the field type)
- Each variant should be meaningfully different from the current and from each other
- Rationale should be 1 sentence explaining the CRO hypothesis
- Labels must be "Variant B", "Variant C", "Variant D"
- Return ONLY the JSON array, no other text`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from AI');
  const suggestions = parseJsonResponse<Suggestion[]>(textBlock.text);
  return { suggestions };
}
