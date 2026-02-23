import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { editId, tags, note } = body;

    if (!editId || typeof editId !== 'string') {
      return NextResponse.json({ error: 'editId is required' }, { status: 400 });
    }

    if (tags && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 });
    }

    if (note && typeof note !== 'string') {
      return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
    }

    if (note && note.length > 500) {
      return NextResponse.json({ error: 'Note must be 500 characters or less' }, { status: 400 });
    }

    // Get team scope to prevent IDOR -- user must belong to the team that owns the edit
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return NextResponse.json({ error: 'Team context required' }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();

    // Verify the edit record exists AND belongs to user's team
    const { data: editRecord, error: fetchError } = await supabase
      .from('cp_edit_history')
      .select('id')
      .eq('id', editId)
      .eq('team_id', scope.teamId)
      .maybeSingle();

    if (fetchError) {
      logError('edit-feedback', fetchError, { editId });
      return NextResponse.json({ error: 'Failed to find edit record' }, { status: 500 });
    }

    if (!editRecord) {
      return NextResponse.json({ error: 'Edit record not found' }, { status: 404 });
    }

    // Update with feedback
    const updateData: Record<string, unknown> = {};
    if (tags && tags.length > 0) {
      updateData.edit_tags = tags;
    }
    if (note) {
      updateData.ceo_note = note;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No feedback provided' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('cp_edit_history')
      .update(updateData)
      .eq('id', editId);

    if (updateError) {
      logError('edit-feedback', updateError, { editId });
      return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('edit-feedback', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
