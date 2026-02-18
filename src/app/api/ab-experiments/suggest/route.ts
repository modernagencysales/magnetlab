// API Route: A/B Experiment Variant Suggestions
// POST /api/ab-experiments/suggest — AI-powered variant suggestions for A/B testing

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

const VALID_TEST_FIELDS = ['headline', 'subline', 'vsl_url', 'pass_message'] as const;
type TestField = (typeof VALID_TEST_FIELDS)[number];

const TEST_FIELD_TO_COLUMN: Record<TestField, string> = {
  headline: 'thankyou_headline',
  subline: 'thankyou_subline',
  vsl_url: 'vsl_url',
  pass_message: 'qualification_pass_message',
};

interface Suggestion {
  label: string;
  value: string | null;
  rationale: string;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { funnelPageId, testField } = body;

    if (!funnelPageId || !testField) {
      return ApiErrors.validationError('funnelPageId and testField are required');
    }

    if (!isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnelPageId');
    }

    if (!VALID_TEST_FIELDS.includes(testField as TestField)) {
      return ApiErrors.validationError(
        `testField must be one of: ${VALID_TEST_FIELDS.join(', ')}`
      );
    }

    // For vsl_url, return a hardcoded suggestion (no AI needed)
    if (testField === 'vsl_url') {
      return NextResponse.json({
        suggestions: [
          {
            label: 'Remove video',
            value: null,
            rationale: 'Test if removing video increases survey completion.',
          },
        ],
      });
    }

    const supabase = createSupabaseAdminClient();

    // Fetch the funnel page
    const { data: funnelPage, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, lead_magnet_id, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
      .eq('id', funnelPageId)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnelPage) {
      return ApiErrors.notFound('Funnel page');
    }

    // Fetch lead magnet context if available
    let leadMagnetContext = '';
    if (funnelPage.lead_magnet_id) {
      const { data: leadMagnet } = await supabase
        .from('lead_magnets')
        .select('title, archetype, concept')
        .eq('id', funnelPage.lead_magnet_id)
        .single();

      if (leadMagnet) {
        leadMagnetContext = [
          leadMagnet.title ? `Lead Magnet Title: ${leadMagnet.title}` : '',
          leadMagnet.archetype ? `Archetype: ${leadMagnet.archetype}` : '',
          leadMagnet.concept ? `Concept: ${leadMagnet.concept}` : '',
        ].filter(Boolean).join('\n');
      }
    }

    const dbColumn = TEST_FIELD_TO_COLUMN[testField as TestField];
    const currentValue = (funnelPage as Record<string, unknown>)[dbColumn] as string || '';

    const fieldLabels: Record<TestField, string> = {
      headline: 'thank-you page headline',
      subline: 'thank-you page subline/subtitle',
      pass_message: 'qualification pass message (shown to qualified leads)',
    } as Record<TestField, string>;

    const fieldLabel = fieldLabels[testField as TestField] || testField;

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
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
    if (!textBlock || textBlock.type !== 'text') {
      return ApiErrors.aiError('No text response from AI');
    }

    const suggestions = parseJsonResponse<Suggestion[]>(textBlock.text);

    return NextResponse.json({ suggestions });
  } catch (error) {
    logApiError('ab-experiments/suggest', error);
    return ApiErrors.internalError('Failed to generate suggestions');
  }
}
