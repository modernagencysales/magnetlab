/**
 * External Resources Service
 */

import { externalResourceFromRow, type ExternalResourceRow } from '@/lib/types/library';
import * as repo from '@/server/repositories/external-resources.repo';

export async function list(userId: string, limit: number, offset: number) {
  const data = await repo.listByUserId(userId, limit, offset);
  return { resources: (data as ExternalResourceRow[]).map(externalResourceFromRow) };
}

export async function create(
  userId: string,
  payload: { title: string; url: string; icon?: string },
) {
  const row = await repo.create(userId, payload);
  return { resource: externalResourceFromRow(row as ExternalResourceRow) };
}

export async function getById(userId: string, id: string) {
  const row = await repo.getByIdAndUser(id, userId);
  if (!row) return null;
  return { resource: externalResourceFromRow(row as ExternalResourceRow) };
}

export async function updateById(
  userId: string,
  id: string,
  updates: { title?: string; url?: string; icon?: string },
) {
  const row = await repo.updateByIdAndUser(id, userId, updates);
  if (!row) return null;
  return { resource: externalResourceFromRow(row as ExternalResourceRow) };
}

export async function deleteById(userId: string, id: string): Promise<boolean> {
  return repo.deleteByIdAndUser(id, userId);
}
