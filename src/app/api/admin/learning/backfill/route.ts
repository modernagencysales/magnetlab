/** Backfill edit classifications. Super-admin only. Re-runs AI classification on unclassified edits. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { classifyEditPatterns } from '@/lib/ai/content-pipeline/edit-classifier';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  // Find edits with no classification (NULL or empty object)
  const { data: edits, error } = await supabase
    .from('cp_edit_history')
    .select('id, content_type, field_name, original_text, edited_text')
    .or('auto_classified_changes.is.null,auto_classified_changes.eq.{}')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!edits || edits.length === 0) {
    return NextResponse.json({ message: 'No unclassified edits found', classified: 0 });
  }

  const results: { id: string; patternCount: number }[] = [];
  const errors: { id: string; error: string }[] = [];

  // Process sequentially to avoid rate limits
  for (const edit of edits) {
    try {
      const result = await classifyEditPatterns({
        originalText: edit.original_text,
        editedText: edit.edited_text,
        contentType: edit.content_type,
        fieldName: edit.field_name,
      });

      const { error: updateError } = await supabase
        .from('cp_edit_history')
        .update({ auto_classified_changes: result })
        .eq('id', edit.id);

      if (updateError) {
        errors.push({ id: edit.id, error: updateError.message });
      } else {
        results.push({ id: edit.id, patternCount: result.patterns.length });
      }
    } catch (err) {
      errors.push({ id: edit.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    message: `Classified ${results.length} of ${edits.length} edits`,
    classified: results.length,
    withPatterns: results.filter((r) => r.patternCount > 0).length,
    empty: results.filter((r) => r.patternCount === 0).length,
    errors: errors.length > 0 ? errors : undefined,
    details: results,
  });
}
