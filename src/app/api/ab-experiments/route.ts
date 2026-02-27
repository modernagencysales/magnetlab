// API Route: A/B Experiments
// GET /api/ab-experiments?funnelPageId=xxx — list experiments for a funnel page
// POST /api/ab-experiments — create experiment + clone variant

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

const VALID_TEST_FIELDS = ['headline', 'subline', 'vsl_url', 'pass_message', 'thankyou_layout'] as const;
type TestField = (typeof VALID_TEST_FIELDS)[number];

// Map logical test field names to actual DB column names on funnel_pages
const TEST_FIELD_TO_COLUMN: Record<TestField, string> = {
  headline: 'thankyou_headline',
  subline: 'thankyou_subline',
  vsl_url: 'vsl_url',
  pass_message: 'qualification_pass_message',
  thankyou_layout: 'thankyou_layout',
};

// Fields to copy when cloning a funnel_page as a variant
const CLONE_FIELDS = [
  'lead_magnet_id', 'user_id', 'team_id',
  'optin_headline', 'optin_subline', 'optin_button_text', 'optin_social_proof',
  'thankyou_headline', 'thankyou_subline', 'vsl_url', 'calendly_url',
  'qualification_pass_message', 'qualification_fail_message',
  'theme', 'primary_color', 'background_style', 'logo_url',
  'qualification_form_id', 'font_family', 'font_url',
  'target_type', 'library_id', 'external_resource_id',
  'thankyou_layout',
] as const;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const funnelPageId = searchParams.get('funnelPageId');

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('ab_experiments')
      .select('id, funnel_page_id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (funnelPageId) {
      if (!isValidUUID(funnelPageId)) {
        return ApiErrors.validationError('Invalid funnelPageId');
      }
      query = query.eq('funnel_page_id', funnelPageId);
    }

    const { data, error } = await query;

    if (error) {
      logApiError('ab-experiments/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch experiments');
    }

    return NextResponse.json({ experiments: data || [] });
  } catch (error) {
    logApiError('ab-experiments/list', error);
    return ApiErrors.internalError('Failed to fetch experiments');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { funnelPageId, name, testField, variantValue, variantLabel } = body;

    // Validate required fields
    if (!funnelPageId || !name || !testField) {
      return ApiErrors.validationError('funnelPageId, name, and testField are required');
    }

    if (!isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnelPageId');
    }

    // Validate testField
    if (!VALID_TEST_FIELDS.includes(testField as TestField)) {
      return ApiErrors.validationError(
        `testField must be one of: ${VALID_TEST_FIELDS.join(', ')}`
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify ownership: must be a non-variant funnel page owned by this user
    const { data: controlRow, error: controlError } = await supabase
      .from('funnel_pages')
      .select('id, slug, lead_magnet_id, user_id, team_id, optin_headline, optin_subline, optin_button_text, optin_social_proof, thankyou_headline, thankyou_subline, vsl_url, calendly_url, qualification_pass_message, qualification_fail_message, theme, primary_color, background_style, logo_url, qualification_form_id, font_family, font_url, target_type, library_id, external_resource_id, thankyou_layout')
      .eq('id', funnelPageId)
      .eq('user_id', session.user.id)
      .eq('is_variant', false)
      .single();

    if (controlError || !controlRow) {
      return ApiErrors.notFound('Funnel page');
    }

    const control = controlRow as Record<string, unknown>;

    // Check for existing draft or running experiment on this funnel page
    const { data: existing } = await supabase
      .from('ab_experiments')
      .select('id, status')
      .eq('funnel_page_id', funnelPageId)
      .in('status', ['draft', 'running'])
      .limit(1);

    if (existing && existing.length > 0) {
      return ApiErrors.conflict(
        'An active experiment already exists for this funnel page. Complete or delete it first.'
      );
    }

    // Create experiment
    const { data: experiment, error: expError } = await supabase
      .from('ab_experiments')
      .insert({
        funnel_page_id: funnelPageId,
        user_id: session.user.id,
        name,
        test_field: testField,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (expError || !experiment) {
      logApiError('ab-experiments/create-experiment', expError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create experiment');
    }

    // Clone control funnel_page as variant
    const variantData: Record<string, unknown> = {};
    for (const field of CLONE_FIELDS) {
      variantData[field] = control[field];
    }

    // Override the tested field with the variant value
    const dbColumn = TEST_FIELD_TO_COLUMN[testField as TestField];
    variantData[dbColumn] = variantValue ?? null;

    // Set variant metadata
    variantData.slug = `${control.slug}-variant-${Date.now()}`;
    variantData.experiment_id = experiment.id;
    variantData.is_variant = true;
    variantData.variant_label = variantLabel || 'Variant B';
    variantData.is_published = true;

    const { data: variant, error: variantError } = await supabase
      .from('funnel_pages')
      .insert(variantData)
      .select('id')
      .single();

    if (variantError || !variant) {
      // Cleanup: delete the experiment if variant creation fails
      logApiError('ab-experiments/create-variant', variantError, {
        userId: session.user.id,
        experimentId: experiment.id,
      });
      await supabase.from('ab_experiments').delete().eq('id', experiment.id);
      return ApiErrors.databaseError('Failed to create variant page');
    }

    // Link control to experiment
    const { error: linkError } = await supabase
      .from('funnel_pages')
      .update({ experiment_id: experiment.id })
      .eq('id', funnelPageId);

    if (linkError) {
      logApiError('ab-experiments/link-control', linkError, {
        userId: session.user.id,
        experimentId: experiment.id,
      });
    }

    return NextResponse.json(
      { experiment: { id: experiment.id }, variant: { id: variant.id } },
      { status: 201 }
    );
  } catch (error) {
    logApiError('ab-experiments/create', error);
    return ApiErrors.internalError('Failed to create experiment');
  }
}
