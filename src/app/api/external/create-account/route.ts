// API Route: External Account Creation for Intro Offer
// POST /api/external/create-account
//
// Creates a magnetlab user account, team, team profile, and pro subscription
// for intro offer clients. Authenticated via Bearer token (same as create-lead-magnet).

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createAccount } from '@/server/services/external.service';

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

    const result = await createAccount({
      email,
      full_name,
      linkedin_url,
      company,
      job_title,
    });

    if (!result.success) {
      return ApiErrors.internalError('Failed to create account');
    }

    const status = result.already_existed ? 200 : 201;
    return NextResponse.json(
      {
        success: true,
        data: { user_id: result.user_id, already_existed: result.already_existed },
      },
      { status }
    );
  } catch (error) {
    logApiError('external/create-account', error);
    return ApiErrors.internalError('Failed to create account');
  }
}
