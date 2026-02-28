import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as adminService from '@/server/services/admin.service';

const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let body: { source?: string; data?: string; teamId?: string };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON body');
    }

    const { source, data, teamId } = body;
    const validSources = ['csv', 'resend', 'positive_replies', 'purchasers'];
    if (!source || !validSources.includes(source)) {
      return ApiErrors.validationError(
        `Invalid source. Must be one of: ${validSources.join(', ')}`,
      );
    }

    if (!teamId || !isValidUUID(teamId)) {
      return ApiErrors.validationError('Valid teamId (UUID) is required');
    }

    if (source !== 'csv') {
      return NextResponse.json(
        { message: `Source '${source}' import not yet implemented` },
        { status: 501 },
      );
    }

    if (!data || typeof data !== 'string' || data.trim().length === 0) {
      return ApiErrors.validationError('CSV data is required for csv source');
    }
    if (data.length > MAX_CSV_SIZE) {
      return ApiErrors.validationError('CSV data exceeds maximum size of 5MB');
    }

    const rows = adminService.parseCsv(data);
    if (rows.length === 0) {
      return ApiErrors.validationError('CSV must contain a header row and at least one data row');
    }
    if (!('email' in rows[0])) {
      return ApiErrors.validationError('CSV must have an "email" column');
    }

    try {
      const result = await adminService.importSubscribersCsv(
        teamId,
        data,
        session.user.id,
      );
      return NextResponse.json({
        success: true,
        ...result,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'FORBIDDEN') return ApiErrors.forbidden('You do not own this team');
      if (msg === 'CSV_EMPTY') return ApiErrors.validationError('CSV must contain a header row and at least one data row');
      if (msg === 'CSV_MISSING_EMAIL') return ApiErrors.validationError('CSV must have an "email" column');
      if (msg === 'NO_VALID_EMAILS') return ApiErrors.validationError('No valid email addresses found in CSV');
      logApiError('admin/import-subscribers', err);
      return ApiErrors.internalError('Failed to import subscribers');
    }
  } catch (error) {
    logApiError('admin/import-subscribers', error);
    return ApiErrors.internalError('Failed to import subscribers');
  }
}
