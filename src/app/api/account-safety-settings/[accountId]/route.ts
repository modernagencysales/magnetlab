/**
 * PATCH /api/account-safety-settings/[accountId]
 * Update safety settings for a specific LinkedIn account.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as safetyService from '@/server/services/account-safety.service';
import type { SafetyLimitsInput } from '@/lib/types/post-campaigns';

const VALID_FIELDS: (keyof SafetyLimitsInput)[] = [
  'maxDmsPerDay',
  'maxConnectionRequestsPerDay',
  'maxConnectionAcceptsPerDay',
  'maxCommentsPerDay',
  'maxLikesPerDay',
  'minActionDelayMs',
  'maxActionDelayMs',
  'operatingHoursStart',
  'operatingHoursEnd',
  'timezone',
];

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { accountId } = await params;
    if (!accountId) {
      return ApiErrors.validationError('accountId is required');
    }

    const body = await request.json();

    // Filter through whitelist
    const input: SafetyLimitsInput = {};
    for (const key of VALID_FIELDS) {
      if (key in body) {
        (input as Record<string, unknown>)[key] = body[key];
      }
    }

    // Validate numeric fields are positive integers
    const numericFields: (keyof SafetyLimitsInput)[] = [
      'maxDmsPerDay',
      'maxConnectionRequestsPerDay',
      'maxConnectionAcceptsPerDay',
      'maxCommentsPerDay',
      'maxLikesPerDay',
      'minActionDelayMs',
      'maxActionDelayMs',
    ];

    for (const field of numericFields) {
      if (field in input) {
        const val = input[field];
        if (typeof val !== 'number' || val < 0 || !Number.isInteger(val)) {
          return ApiErrors.validationError(`${field} must be a non-negative integer`);
        }
      }
    }

    // Validate time format
    if (input.operatingHoursStart && !TIME_REGEX.test(input.operatingHoursStart)) {
      return ApiErrors.validationError('operatingHoursStart must be in HH:MM format');
    }
    if (input.operatingHoursEnd && !TIME_REGEX.test(input.operatingHoursEnd)) {
      return ApiErrors.validationError('operatingHoursEnd must be in HH:MM format');
    }

    // Validate min < max delay
    if (input.minActionDelayMs !== undefined && input.maxActionDelayMs !== undefined) {
      if (input.minActionDelayMs > input.maxActionDelayMs) {
        return ApiErrors.validationError('minActionDelayMs must be <= maxActionDelayMs');
      }
    }

    const settings = await safetyService.updateAccountSettings(
      session.user.id,
      accountId,
      input as Record<string, unknown>
    );

    return NextResponse.json({ settings });
  } catch (error) {
    logApiError('account-safety-settings/PATCH', error);
    return ApiErrors.internalError('Failed to update account safety settings');
  }
}
