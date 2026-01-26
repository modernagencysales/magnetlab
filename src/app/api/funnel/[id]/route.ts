// API Route: Funnel Page CRUD
// GET, PUT, DELETE /api/funnel/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single funnel page
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('funnel_pages')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    console.error('Get funnel error:', error);
    return NextResponse.json({ error: 'Failed to get funnel page' }, { status: 500 });
  }
}

// PUT - Update a funnel page
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Build update object with snake_case keys
    const updateData: Record<string, unknown> = {};

    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.optinHeadline !== undefined) updateData.optin_headline = body.optinHeadline;
    if (body.optinSubline !== undefined) updateData.optin_subline = body.optinSubline;
    if (body.optinButtonText !== undefined) updateData.optin_button_text = body.optinButtonText;
    if (body.optinSocialProof !== undefined) updateData.optin_social_proof = body.optinSocialProof;
    if (body.thankyouHeadline !== undefined) updateData.thankyou_headline = body.thankyouHeadline;
    if (body.thankyouSubline !== undefined) updateData.thankyou_subline = body.thankyouSubline;
    if (body.vslUrl !== undefined) updateData.vsl_url = body.vslUrl;
    if (body.calendlyUrl !== undefined) updateData.calendly_url = body.calendlyUrl;
    if (body.qualificationPassMessage !== undefined) updateData.qualification_pass_message = body.qualificationPassMessage;
    if (body.qualificationFailMessage !== undefined) updateData.qualification_fail_message = body.qualificationFailMessage;

    // Check for slug collision if updating slug
    if (body.slug) {
      const { data: existing } = await supabase
        .from('funnel_pages')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('slug', body.slug)
        .neq('id', id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'A funnel with this slug already exists' },
          { status: 409 }
        );
      }
    }

    const { data, error } = await supabase
      .from('funnel_pages')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update funnel error:', error);
      return NextResponse.json({ error: 'Failed to update funnel page' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
    }

    return NextResponse.json({ funnel: funnelPageFromRow(data as FunnelPageRow) });
  } catch (error) {
    console.error('Update funnel error:', error);
    return NextResponse.json({ error: 'Failed to update funnel page' }, { status: 500 });
  }
}

// DELETE - Delete a funnel page
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('funnel_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Delete funnel error:', error);
      return NextResponse.json({ error: 'Failed to delete funnel page' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete funnel error:', error);
    return NextResponse.json({ error: 'Failed to delete funnel page' }, { status: 500 });
  }
}
