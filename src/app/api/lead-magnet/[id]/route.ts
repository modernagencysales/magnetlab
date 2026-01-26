// API Route: Lead Magnet CRUD
// GET, PUT, DELETE /api/lead-magnet/[id]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single lead magnet
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Get lead magnet error:', error);
    return NextResponse.json({ error: 'Failed to get lead magnet' }, { status: 500 });
  }
}

// PUT - Update a lead magnet
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = await createSupabaseServerClient();

    // Remove fields that shouldn't be updated directly
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, user_id: _userId, created_at: _createdAt, ...updateData } = body;

    const { data, error } = await supabase
      .from('lead_magnets')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('Update error:', error);
      return NextResponse.json({ error: 'Failed to update lead magnet' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Update lead magnet error:', error);
    return NextResponse.json({ error: 'Failed to update lead magnet' }, { status: 500 });
  }
}

// DELETE - Delete a lead magnet
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('lead_magnets')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete lead magnet' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete lead magnet error:', error);
    return NextResponse.json({ error: 'Failed to delete lead magnet' }, { status: 500 });
  }
}
