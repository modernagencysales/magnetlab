/**
 * POST /api/post-campaigns/[id]/test-dm — preview rendered DM for a campaign.
 * Renders the DM template with test variables. No DM is sent.
 * Auth required. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import * as repo from '@/server/repositories/post-campaigns.repo';
import { renderDmTemplate } from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { data: campaign, error } = await repo.getCampaign(session.user.id, id);

    if (error || !campaign) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build funnel URL from funnel_page_id if present, otherwise use a fallback.
    let funnelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.magnetlab.app'}/p/your-username/your-lead-magnet`;

    if (campaign.funnel_page_id) {
      const supabase = createSupabaseAdminClient();
      const { data: funnelPage } = await supabase
        .from('funnel_pages')
        .select('slug, user_id')
        .eq('id', campaign.funnel_page_id)
        .single();

      if (funnelPage?.slug) {
        const { data: user } = await supabase
          .from('users')
          .select('username')
          .eq('id', funnelPage.user_id)
          .single();

        if (user?.username) {
          funnelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.magnetlab.app'}/p/${user.username}/${funnelPage.slug}`;
        }
      }
    }

    const rendered_dm = renderDmTemplate(campaign.dm_template, {
      name: 'Test User',
      funnel_url: funnelUrl,
    });

    return NextResponse.json({
      rendered_dm,
      note: 'Preview only. No DM was sent.',
    });
  } catch (error) {
    logError('api/post-campaigns/[id]/test-dm', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
