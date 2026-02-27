import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach/client';
import type { SignalType } from '@/lib/types/signals';

// ============================================
// GET — List signal leads with filters
// ============================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const icpMatch = searchParams.get('icp_match');
    const signalType = searchParams.get('signal_type') as SignalType | null;
    const minScore = searchParams.get('min_score');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    const supabase = createSupabaseAdminClient();

    // Build query with related signal_events
    let query = supabase
      .from('signal_leads')
      .select(
        '*, signal_events(id, signal_type, comment_text, sentiment, keyword_matched, detected_at)',
        { count: 'exact' }
      )
      .eq('user_id', session.user.id)
      .order('compound_score', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (icpMatch === 'true') {
      query = query.eq('icp_match', true);
    } else if (icpMatch === 'false') {
      query = query.eq('icp_match', false);
    }

    if (minScore) {
      const minScoreNum = parseInt(minScore, 10);
      if (!isNaN(minScoreNum)) {
        query = query.gte('compound_score', minScoreNum);
      }
    }

    // Paginate
    query = query.range(offset, offset + limit - 1);

    const { data: leads, error, count } = await query;

    if (error) {
      logError('api/signals/leads', error, { userId: session.user.id });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Post-filter by signal_type if specified
    // We need to filter leads that have at least one event of the requested type.
    // Since Supabase can't do this in a single query with the relation approach,
    // we post-filter. Note: this may reduce the returned count below `limit`.
    let filteredLeads = leads || [];
    let total = count || 0;

    if (signalType) {
      filteredLeads = filteredLeads.filter((lead) => {
        const events = (lead as Record<string, unknown>).signal_events as
          | Array<{ signal_type: string }>
          | undefined;
        return events?.some((e) => e.signal_type === signalType) ?? false;
      });
      // Adjust total for signal_type post-filtering
      total = filteredLeads.length;
    }

    return NextResponse.json({
      leads: filteredLeads,
      total,
      page,
      limit,
    });
  } catch (error) {
    logError('api/signals/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Bulk actions (exclude, push)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, lead_ids, campaign_id } = body as {
      action: string;
      lead_ids: string[];
      campaign_id?: string;
    };

    if (!action || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json(
        { error: 'action and lead_ids[] are required' },
        { status: 400 }
      );
    }

    if (lead_ids.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 leads per bulk action' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // ---- EXCLUDE ----
    if (action === 'exclude') {
      const { error } = await supabase
        .from('signal_leads')
        .update({ status: 'excluded', updated_at: new Date().toISOString() })
        .in('id', lead_ids)
        .eq('user_id', session.user.id);

      if (error) {
        logError('api/signals/leads/exclude', error, { userId: session.user.id });
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, excluded: lead_ids.length });
    }

    // ---- PUSH ----
    if (action === 'push') {
      if (!campaign_id) {
        return NextResponse.json(
          { error: 'campaign_id is required for push action' },
          { status: 400 }
        );
      }

      // Fetch leads scoped to user
      const { data: leads, error: fetchError } = await supabase
        .from('signal_leads')
        .select('id, linkedin_url, first_name, last_name, headline, compound_score, signal_count')
        .in('id', lead_ids)
        .eq('user_id', session.user.id);

      if (fetchError) {
        logError('api/signals/leads/push-fetch', fetchError, { userId: session.user.id });
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!leads || leads.length === 0) {
        return NextResponse.json(
          { error: 'No matching leads found' },
          { status: 404 }
        );
      }

      // Map to HeyReach format (trailing slash on LinkedIn URL is required)
      const heyreachLeads = leads.map((lead) => ({
        profileUrl: lead.linkedin_url.endsWith('/')
          ? lead.linkedin_url
          : `${lead.linkedin_url}/`,
        firstName: lead.first_name || undefined,
        lastName: lead.last_name || undefined,
        customVariables: {
          compound_score: String(lead.compound_score ?? 0),
          signal_count: String(lead.signal_count ?? 0),
          headline: lead.headline || '',
        },
      }));

      // Push to HeyReach
      const result = await pushLeadsToHeyReach(campaign_id, heyreachLeads);

      if (result.success) {
        // Mark leads as pushed
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('signal_leads')
          .update({
            status: 'pushed',
            heyreach_campaign_id: campaign_id,
            heyreach_pushed_at: now,
            heyreach_error: null,
            updated_at: now,
          })
          .in('id', leads.map((l) => l.id))
          .eq('user_id', session.user.id);

        if (updateError) {
          logError('api/signals/leads/push-update', updateError, { userId: session.user.id });
          // Push succeeded but DB update failed -- log but still report success
        }

        return NextResponse.json({
          success: true,
          added: result.added,
        });
      }

      // Push failed -- record error on leads
      const { error: errorUpdateErr } = await supabase
        .from('signal_leads')
        .update({
          heyreach_error: result.error || 'Unknown push error',
          updated_at: new Date().toISOString(),
        })
        .in('id', leads.map((l) => l.id))
        .eq('user_id', session.user.id);

      if (errorUpdateErr) {
        logError('api/signals/leads/push-error-update', errorUpdateErr, {
          userId: session.user.id,
        });
      }

      return NextResponse.json(
        { success: false, added: 0, error: result.error },
        { status: 502 }
      );
    }

    // Unknown action
    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    logError('api/signals/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
