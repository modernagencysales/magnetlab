// API Route: Email Subscriber CSV Import
// POST — Preview or confirm CSV import of subscribers
//   ?confirm=true  → perform the import (upsert)
//   (no confirm)   → preview only (validate rows, return valid/invalid)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidRow {
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface InvalidRow {
  row: number;
  email: string;
  reason: string;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()));

  return { headers, rows };
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  return -1;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm') === 'true';

    // Parse multipart form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return ApiErrors.validationError('Request must be multipart/form-data');
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return ApiErrors.validationError('Missing file field (must be a CSV file)');
    }

    if (file.size === 0) {
      return ApiErrors.validationError('CSV file is empty');
    }

    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      return ApiErrors.validationError('CSV file must be under 5MB');
    }

    const text = await file.text();
    const { headers, rows } = parseCSV(text);

    if (headers.length === 0) {
      return ApiErrors.validationError('CSV file has no headers');
    }

    // Locate columns by header name (flexible matching)
    const emailIdx = findColumnIndex(headers, ['email', 'email_address', 'e-mail']);
    const firstNameIdx = findColumnIndex(headers, ['first_name', 'firstname', 'first name', 'fname']);
    const lastNameIdx = findColumnIndex(headers, ['last_name', 'lastname', 'last name', 'lname']);

    if (emailIdx === -1) {
      return ApiErrors.validationError(
        'CSV must have an "email" column. Found columns: ' + headers.join(', ')
      );
    }

    // Validate each row
    const valid: ValidRow[] = [];
    const invalid: InvalidRow[] = [];
    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // 1-indexed, skip header row
      const rawEmail = row[emailIdx] || '';
      const email = rawEmail.toLowerCase().trim();

      if (!email) {
        invalid.push({ row: rowNumber, email: rawEmail, reason: 'Email is empty' });
        continue;
      }

      if (!EMAIL_REGEX.test(email)) {
        invalid.push({ row: rowNumber, email, reason: 'Invalid email format' });
        continue;
      }

      if (seenEmails.has(email)) {
        invalid.push({ row: rowNumber, email, reason: 'Duplicate email in CSV' });
        continue;
      }

      seenEmails.add(email);
      valid.push({
        email,
        first_name: (firstNameIdx !== -1 ? row[firstNameIdx]?.trim() : null) || null,
        last_name: (lastNameIdx !== -1 ? row[lastNameIdx]?.trim() : null) || null,
      });
    }

    // Preview mode: return valid/invalid breakdown
    if (!confirm) {
      return NextResponse.json({
        valid,
        invalid,
        total: rows.length,
      });
    }

    // Confirm mode: upsert all valid rows
    if (valid.length === 0) {
      return NextResponse.json({ imported: 0, skipped: invalid.length });
    }

    // Fetch existing subscribers to avoid overwriting names
    const emails = valid.map((v) => v.email);
    const { data: existingSubscribers } = await supabase
      .from('email_subscribers')
      .select('email, first_name, last_name')
      .eq('team_id', teamId)
      .in('email', emails);

    const existingByEmail = new Map<string, { first_name: string | null; last_name: string | null }>();
    if (existingSubscribers) {
      for (const sub of existingSubscribers) {
        existingByEmail.set(sub.email, {
          first_name: sub.first_name,
          last_name: sub.last_name,
        });
      }
    }

    // Build upsert rows, preserving existing names
    const upsertRows = valid.map((row) => {
      const existing = existingByEmail.get(row.email);
      return {
        team_id: teamId,
        email: row.email,
        first_name: row.first_name || existing?.first_name || null,
        last_name: row.last_name || existing?.last_name || null,
        source: 'import' as const,
        status: 'active' as const,
      };
    });

    // Upsert in batches of 500 to avoid payload limits
    const BATCH_SIZE = 500;
    let imported = 0;

    for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
      const batch = upsertRows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase
        .from('email_subscribers')
        .upsert(batch, { onConflict: 'team_id,email', count: 'exact' });

      if (error) {
        logApiError('email/subscribers/import/upsert', error, {
          teamId,
          batchStart: i,
          batchSize: batch.length,
        });
        return ApiErrors.databaseError(
          `Import failed at row ${i + 1}. ${imported} rows were imported before the failure.`
        );
      }

      imported += count ?? batch.length;
    }

    return NextResponse.json({
      imported,
      skipped: invalid.length,
    });
  } catch (error) {
    logApiError('email/subscribers/import', error);
    return ApiErrors.internalError('Failed to import subscribers');
  }
}
