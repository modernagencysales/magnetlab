// API Route: A/B Experiment Detail
// GET /api/ab-experiments/[id] — get experiment with variant stats
// PATCH /api/ab-experiments/[id] — pause, resume, declare winner
// DELETE /api/ab-experiments/[id] — delete experiment and cleanup

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

type TestField = 'headline' | 'subline' | 'vsl_url' | 'pass_message';

const TEST_FIELD_TO_COLUMN: Record<TestField, string> = {
  headline: 'thankyou_headline',
  subline: 'thankyou_subline',
  vsl_url: 'vsl_url',
  pass_message: 'qualification_pass_message',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid experiment ID');
    }

    const supabase = createSupabaseAdminClient();

    // Fetch experiment with ownership check
    const { data: experiment, error: expError } = await supabase
      .from('ab_experiments')
      .select('id, funnel_page_id, name, status, test_field, winner_id, significance, min_sample_size, started_at, completed_at, created_at')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (expError || !experiment) {
      return ApiErrors.notFound('Experiment');
    }

    // Fetch all variant pages (control + variants)
    const { data: variants, error: variantsError } = await supabase
      .from('funnel_pages')
      .select('id, is_variant, variant_label, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
      .or(`id.eq.${experiment.funnel_page_id},experiment_id.eq.${experiment.id}`);

    if (variantsError) {
      logApiError('ab-experiments/get-variants', variantsError, { experimentId: id });
      return ApiErrors.databaseError('Failed to fetch variant data');
    }

    const variantIds = (variants || []).map((v: { id: string }) => v.id);

    // Fetch page_views (thankyou page type only) and funnel_leads counts per variant in parallel
    const [viewsResult, leadsResult] = await Promise.all([
      variantIds.length > 0
        ? supabase
            .from('page_views')
            .select('funnel_page_id')
            .in('funnel_page_id', variantIds)
            .eq('page_type', 'thankyou')
        : Promise.resolve({ data: [] as { funnel_page_id: string }[], error: null }),
      variantIds.length > 0
        ? supabase
            .from('funnel_leads')
            .select('funnel_page_id')
            .in('funnel_page_id', variantIds)
        : Promise.resolve({ data: [] as { funnel_page_id: string }[], error: null }),
    ]);

    // Count views per variant
    const viewsByVariant = new Map<string, number>();
    if (viewsResult.data) {
      for (const row of viewsResult.data) {
        const fid = row.funnel_page_id;
        viewsByVariant.set(fid, (viewsByVariant.get(fid) || 0) + 1);
      }
    }

    // Count completions (leads) per variant
    const completionsByVariant = new Map<string, number>();
    if (leadsResult.data) {
      for (const row of leadsResult.data) {
        const fid = row.funnel_page_id;
        completionsByVariant.set(fid, (completionsByVariant.get(fid) || 0) + 1);
      }
    }

    // Build stats per variant
    const variantStats = (variants || []).map((v: {
      id: string;
      is_variant: boolean;
      variant_label: string | null;
      thankyou_headline: string;
      thankyou_subline: string | null;
      vsl_url: string | null;
      qualification_pass_message: string;
    }) => {
      const views = viewsByVariant.get(v.id) || 0;
      const completions = completionsByVariant.get(v.id) || 0;
      return {
        funnelPageId: v.id,
        isVariant: v.is_variant,
        label: v.is_variant ? (v.variant_label || 'Variant B') : 'Control',
        views,
        completions,
        completionRate: views > 0 ? Math.round((completions / views) * 1000) / 10 : 0,
        headline: v.thankyou_headline,
        subline: v.thankyou_subline,
        vslUrl: v.vsl_url,
        passMessage: v.qualification_pass_message,
      };
    });

    return NextResponse.json({ experiment, variants: variantStats });
  } catch (error) {
    logApiError('ab-experiments/get', error);
    return ApiErrors.internalError('Failed to fetch experiment');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid experiment ID');
    }

    const body = await request.json();
    const { action, winnerId } = body;

    if (!action) {
      return ApiErrors.validationError('action is required');
    }

    const supabase = createSupabaseAdminClient();

    // Fetch experiment with ownership check
    const { data: experiment, error: expError } = await supabase
      .from('ab_experiments')
      .select('id, funnel_page_id, status, test_field')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (expError || !experiment) {
      return ApiErrors.notFound('Experiment');
    }

    const now = new Date().toISOString();

    if (action === 'pause') {
      if (experiment.status !== 'running') {
        return ApiErrors.validationError('Can only pause a running experiment');
      }
      await supabase
        .from('ab_experiments')
        .update({ status: 'paused', updated_at: now })
        .eq('id', id);

      return NextResponse.json({ status: 'paused' });
    }

    if (action === 'resume') {
      if (experiment.status !== 'paused') {
        return ApiErrors.validationError('Can only resume a paused experiment');
      }
      await supabase
        .from('ab_experiments')
        .update({ status: 'running', updated_at: now })
        .eq('id', id);

      return NextResponse.json({ status: 'running' });
    }

    if (action === 'declare_winner') {
      if (!winnerId) {
        return ApiErrors.validationError('winnerId is required to declare a winner');
      }

      if (!isValidUUID(winnerId)) {
        return ApiErrors.validationError('Invalid winnerId');
      }

      // Verify winner is part of this experiment
      const { data: winnerPage, error: winnerError } = await supabase
        .from('funnel_pages')
        .select('id, is_variant, thankyou_headline, thankyou_subline, vsl_url, qualification_pass_message')
        .eq('id', winnerId)
        .or(`id.eq.${experiment.funnel_page_id},experiment_id.eq.${id}`)
        .single();

      if (winnerError || !winnerPage) {
        return ApiErrors.validationError('Winner must be a variant in this experiment');
      }

      const dbColumn = TEST_FIELD_TO_COLUMN[experiment.test_field as TestField];

      // If winner is a variant (not the control), copy the winning field value onto the control
      if (winnerPage.is_variant) {
        const winningValue = (winnerPage as Record<string, unknown>)[dbColumn];
        await supabase
          .from('funnel_pages')
          .update({ [dbColumn]: winningValue })
          .eq('id', experiment.funnel_page_id);
      }

      // Mark experiment as completed
      await supabase
        .from('ab_experiments')
        .update({
          status: 'completed',
          winner_id: winnerId,
          completed_at: now,
          updated_at: now,
        })
        .eq('id', id);

      // Unpublish variant rows and clear their experiment link
      await supabase
        .from('funnel_pages')
        .update({ is_published: false, experiment_id: null })
        .eq('experiment_id', id)
        .eq('is_variant', true);

      // Clear control's experiment_id
      await supabase
        .from('funnel_pages')
        .update({ experiment_id: null })
        .eq('id', experiment.funnel_page_id);

      return NextResponse.json({ status: 'completed', winnerId });
    }

    return ApiErrors.validationError('action must be one of: pause, resume, declare_winner');
  } catch (error) {
    logApiError('ab-experiments/patch', error);
    return ApiErrors.internalError('Failed to update experiment');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid experiment ID');
    }

    const supabase = createSupabaseAdminClient();

    // Fetch experiment with ownership check
    const { data: experiment, error: expError } = await supabase
      .from('ab_experiments')
      .select('id, funnel_page_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (expError || !experiment) {
      return ApiErrors.notFound('Experiment');
    }

    // Delete variant funnel_pages linked to this experiment
    await supabase
      .from('funnel_pages')
      .delete()
      .eq('experiment_id', id)
      .eq('is_variant', true);

    // Clear control's experiment_id
    await supabase
      .from('funnel_pages')
      .update({ experiment_id: null })
      .eq('id', experiment.funnel_page_id);

    // Delete the experiment itself
    await supabase
      .from('ab_experiments')
      .delete()
      .eq('id', id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logApiError('ab-experiments/delete', error);
    return ApiErrors.internalError('Failed to delete experiment');
  }
}
