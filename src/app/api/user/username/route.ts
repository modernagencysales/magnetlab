// API Route: Update User Username
// PUT /api/user/username

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Validate username format
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters, lowercase letters, numbers, hyphens, and underscores only' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Check if username is already taken by another user
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .neq('id', session.user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 409 }
      );
    }

    // Update username
    const { data, error } = await supabase
      .from('users')
      .update({ username })
      .eq('id', session.user.id)
      .select('username')
      .single();

    if (error) {
      console.error('Update username error:', error);

      // Check for constraint violations
      if (error.code === '23514') {
        // Check constraint violation
        if (error.message.includes('check_username_not_reserved')) {
          return NextResponse.json(
            { error: 'This username is reserved and cannot be used' },
            { status: 400 }
          );
        }
        if (error.message.includes('check_username_format')) {
          return NextResponse.json(
            { error: 'Invalid username format' },
            { status: 400 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Failed to update username' },
        { status: 500 }
      );
    }

    return NextResponse.json({ username: data.username });
  } catch (error) {
    console.error('Update username error:', error);
    return NextResponse.json(
      { error: 'Failed to update username' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('id', session.user.id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch username' },
        { status: 500 }
      );
    }

    return NextResponse.json({ username: data.username });
  } catch (error) {
    console.error('Get username error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch username' },
      { status: 500 }
    );
  }
}
