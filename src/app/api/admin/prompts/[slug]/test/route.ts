import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { interpolatePrompt } from '@/lib/services/prompt-registry';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { system_prompt, user_prompt, test_variables } = await request.json();

  return NextResponse.json({
    interpolated_system: interpolatePrompt(
      system_prompt || '',
      test_variables || {}
    ),
    interpolated_user: interpolatePrompt(
      user_prompt || '',
      test_variables || {}
    ),
  });
}
