import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { savePrompt } from '@/lib/services/prompt-registry';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { slug } = await params;
  const { version_id } = await request.json();

  if (!version_id) {
    return NextResponse.json(
      { error: 'version_id is required' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // Fetch the version to restore
  const { data: version, error } = await supabase
    .from('ai_prompt_versions')
    .select('*')
    .eq('id', version_id)
    .single();

  if (error || !version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  try {
    // Save as a new version (restore)
    const newVersion = await savePrompt(
      slug,
      {
        system_prompt: version.system_prompt,
        user_prompt: version.user_prompt,
        model: version.model,
        temperature: version.temperature,
        max_tokens: version.max_tokens,
      },
      session.user.email || session.user.id,
      `Restored from version ${version.version}`
    );

    return NextResponse.json({ version: newVersion });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
