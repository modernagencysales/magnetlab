// API Route: Admin Subscriber Import
// POST — Bulk import subscribers from CSV or external sources
//
// Authenticated, admin-only: caller must own the target team.
// CSV import: parses CSV rows, normalizes emails, upserts into email_subscribers.
// Other sources (resend, positive_replies, purchasers): stubs returning 501.

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportSource = 'csv' | 'resend' | 'positive_replies' | 'purchasers';

interface ImportRequest {
  source: ImportSource;
  data?: string; // CSV string for csv source
  teamId: string;
}

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Minimal RFC-4180-ish CSV parser that handles:
 * - Quoted fields (including embedded commas and escaped double-quotes)
 * - Header row mapping
 */
function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return []; // need header + at least one data row

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Auth
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // 2. Parse body
    let body: ImportRequest;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON body');
    }

    const { source, data, teamId } = body;

    // 3. Validate source
    const validSources: ImportSource[] = ['csv', 'resend', 'positive_replies', 'purchasers'];
    if (!source || !validSources.includes(source)) {
      return ApiErrors.validationError(
        `Invalid source. Must be one of: ${validSources.join(', ')}`
      );
    }

    // 4. Validate teamId
    if (!teamId || !isValidUUID(teamId)) {
      return ApiErrors.validationError('Valid teamId (UUID) is required');
    }

    // 5. Verify the caller owns the team
    const supabase = createSupabaseAdminClient();
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return ApiErrors.notFound('Team');
    }

    if (team.owner_id !== session.user.id) {
      return ApiErrors.forbidden('You do not own this team');
    }

    // 6. Handle non-CSV sources (stubs)
    if (source !== 'csv') {
      return NextResponse.json(
        { message: `Source '${source}' import not yet implemented` },
        { status: 501 }
      );
    }

    // 7. CSV import
    if (!data || typeof data !== 'string' || data.trim().length === 0) {
      return ApiErrors.validationError('CSV data is required for csv source');
    }

    const rows = parseCsv(data);
    if (rows.length === 0) {
      return ApiErrors.validationError('CSV must contain a header row and at least one data row');
    }

    // Check that email column exists
    const firstRow = rows[0];
    if (!('email' in firstRow)) {
      return ApiErrors.validationError('CSV must have an "email" column');
    }

    // Process rows
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Batch upsert: collect valid rows first
    const validRecords: Array<{
      team_id: string;
      email: string;
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      source: string;
      status: string;
      metadata: Record<string, unknown>;
    }> = [];

    const seenEmails = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawEmail = (row.email || '').trim().toLowerCase();

      if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
        skipped++;
        if (rawEmail) {
          errors.push(`Row ${i + 2}: invalid email "${rawEmail}"`);
        }
        continue;
      }

      // Deduplicate within the CSV itself
      if (seenEmails.has(rawEmail)) {
        skipped++;
        continue;
      }
      seenEmails.add(rawEmail);

      validRecords.push({
        team_id: teamId,
        email: rawEmail,
        first_name: row.first_name?.trim() || null,
        last_name: row.last_name?.trim() || null,
        company: row.company?.trim() || null,
        source: 'csv_import',
        status: 'active',
        metadata: { imported_at: new Date().toISOString() },
      });
    }

    if (validRecords.length === 0) {
      return ApiErrors.validationError('No valid email addresses found in CSV');
    }

    // Upsert in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
      const batch = validRecords.slice(i, i + BATCH_SIZE);
      const { error: upsertError, count } = await supabase
        .from('email_subscribers')
        .upsert(batch, {
          onConflict: 'team_id,email',
          ignoreDuplicates: false,
        });

      if (upsertError) {
        logApiError('admin/import-subscribers', upsertError, { teamId, batchStart: i });
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${upsertError.message}`);
        skipped += batch.length;
      } else {
        imported += count ?? batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logApiError('admin/import-subscribers', error);
    return ApiErrors.internalError('Failed to import subscribers');
  }
}
