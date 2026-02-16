// API Route: External Account Creation for Intro Offer
// POST /api/external/create-account
//
// Creates a magnetlab user account, team, team profile, and pro subscription
// for intro offer clients. Authenticated via Bearer token (same as create-lead-magnet).

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/create-account/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: Request) {
  try {
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { email, full_name, linkedin_url, company, job_title } = body as {
      email?: string;
      full_name?: string;
      linkedin_url?: string;
      company?: string;
      job_title?: string;
    };

    if (!email || !full_name) {
      return ApiErrors.validationError('email and full_name are required');
    }

    const supabase = createSupabaseAdminClient();

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { user_id: existing.id, already_existed: true },
      });
    }

    // Create user record (no password yet — set during handoff)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        email,
        name: full_name,
      })
      .select('id')
      .single();

    if (userError) {
      logApiError('external/create-account/user', userError);
      return ApiErrors.internalError('Failed to create user');
    }

    // Create pro subscription
    await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan: 'pro',
      status: 'active',
    });

    // Create team + team profile if linkedin/company provided
    if (linkedin_url || company) {
      // Create a team for this user
      const { data: team } = await supabase
        .from('teams')
        .insert({
          name: company || `${full_name}'s Team`,
          owner_id: user.id,
        })
        .select('id')
        .single();

      if (team) {
        await supabase.from('team_profiles').insert({
          team_id: team.id,
          user_id: user.id,
          email,
          full_name,
          linkedin_url: linkedin_url || null,
          title: job_title || null,
          role: 'owner',
          status: 'active',
          is_default: true,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { user_id: user.id, already_existed: false },
    }, { status: 201 });
  } catch (error) {
    logApiError('external/create-account', error);
    return ApiErrors.internalError('Failed to create account');
  }
}
