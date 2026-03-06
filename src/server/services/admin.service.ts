/**
 * Admin Service (super-admin only)
 * Prompts list/get/restore and import-subscribers.
 */

import { savePrompt } from '@/lib/services/prompt-registry';
import * as adminRepo from '@/server/repositories/admin.repo';

export async function listPrompts() {
  const data = await adminRepo.listPrompts();
  return data;
}

export async function getPromptBySlug(slug: string) {
  const prompt = await adminRepo.getPromptBySlug(slug);
  if (!prompt) return null;
  const promptId = (prompt as { id: string }).id;
  const versions = await adminRepo.getPromptVersions(promptId);
  return { prompt, versions };
}

export async function restorePrompt(
  slug: string,
  versionId: string,
  userEmail: string,
) {
  const version = await adminRepo.getVersionById(versionId);
  if (!version) return null;
  const v = version as {
    system_prompt: string;
    user_prompt: string;
    model: string;
    temperature: number;
    max_tokens: number;
    version: number;
  };
  const newVersion = await savePrompt(
    slug,
    {
      system_prompt: v.system_prompt,
      user_prompt: v.user_prompt,
      model: v.model,
      temperature: v.temperature,
      max_tokens: v.max_tokens,
    },
    userEmail,
    `Restored from version ${v.version}`,
  );
  return { version: newVersion };
}

export async function assertTeamOwnership(teamId: string, userId: string): Promise<boolean> {
  const team = await adminRepo.getTeamOwner(teamId);
  if (!team) return false;
  return team.owner_id === userId;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

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
            i++;
          } else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else current += ch;
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

export async function importSubscribersCsv(
  teamId: string,
  csvData: string,
  userId: string,
): Promise<{ imported: number; skipped: number; total: number; errors: string[] }> {
  const owned = await assertTeamOwnership(teamId, userId);
  if (!owned) throw new Error('FORBIDDEN');

  const rows = parseCsv(csvData);
  if (rows.length === 0) throw new Error('CSV_EMPTY');
  const firstRow = rows[0];
  if (!('email' in firstRow)) throw new Error('CSV_MISSING_EMAIL');

  const validRecords: adminRepo.EmailSubscriberRecord[] = [];
  const seenEmails = new Set<string>();
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawEmail = (row.email || '').trim().toLowerCase();
    if (!rawEmail || !EMAIL_RE.test(rawEmail)) {
      skipped++;
      if (rawEmail) errors.push(`Row ${i + 2}: invalid email "${rawEmail}"`);
      continue;
    }
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

  if (validRecords.length === 0) throw new Error('NO_VALID_EMAILS');

  const BATCH_SIZE = 100;
  let imported = 0;
  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE);
    try {
      const { count } = await adminRepo.upsertEmailSubscribersBatch(batch);
      imported += count;
    } catch (err) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${(err as Error).message}`);
      skipped += batch.length;
    }
  }

  return { imported, skipped, total: rows.length, errors };
}
