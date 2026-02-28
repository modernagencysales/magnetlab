/**
 * API Keys Service
 * Business logic for API key create, list, revoke. No Supabase in callers.
 */

import { generateApiKey } from '@/lib/auth/api-key';
import * as keysRepo from '@/server/repositories/keys.repo';

/** Caller must validate name (required, max 100 chars). */
export async function createKey(userId: string, name: string) {
  const trimmed = name.trim();
  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  const row = await keysRepo.createKey(userId, {
    keyHash,
    keyPrefix,
    name: trimmed,
  });

  return {
    id: row.id,
    key: rawKey,
    name: row.name,
    prefix: keyPrefix,
    createdAt: row.created_at,
  };
}

export async function listKeys(userId: string) {
  const rows = await keysRepo.listKeysByUserId(userId);
  return {
    keys: rows.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.key_prefix,
      isActive: k.is_active,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at,
    })),
  };
}

export async function revokeKey(userId: string, keyId: string) {
  await keysRepo.revokeKeyByIdAndUser(keyId, userId);
  return { success: true };
}
