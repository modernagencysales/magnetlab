import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { generateApiKey } from '@/lib/auth/api-key';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const name = body.name?.trim();
    if (!name || name.length > 100) {
      return ApiErrors.validationError('name is required (max 100 chars)');
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: session.user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
      })
      .select('id, name, created_at')
      .single();

    if (error) {
      logApiError('keys/create', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create API key');
    }

    return NextResponse.json(
      { id: data.id, key: rawKey, name: data.name, prefix: keyPrefix, createdAt: data.created_at },
      { status: 201 }
    );
  } catch (error) {
    logApiError('keys/create', error);
    return ApiErrors.internalError();
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, is_active, last_used_at, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logApiError('keys/list', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to list API keys');
    }

    const keys = (data || []).map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.key_prefix,
      isActive: k.is_active,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
    }));

    return NextResponse.json({ keys });
  } catch (error) {
    logApiError('keys/list', error);
    return ApiErrors.internalError();
  }
}
