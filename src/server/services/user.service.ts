/**
 * User Service
 * Business logic for username and defaults. No Supabase in callers.
 */

import * as userRepo from '@/server/repositories/user.repo';

const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;

/** Caller must validate username format and that it's not reserved (DB constraint). */
export async function setUsername(userId: string, username: string): Promise<{ username: string }> {
  const taken = await userRepo.isUsernameTakenByOther(username, userId);
  if (taken) {
    const err = new Error('USERNAME_TAKEN');
    (err as Error & { code: string }).code = 'USERNAME_TAKEN';
    throw err;
  }
  const updated = await userRepo.updateUsername(userId, username);
  return { username: updated };
}

export async function getUsername(userId: string): Promise<{ username: string | null }> {
  const username = await userRepo.getUsername(userId);
  return { username };
}

export async function getDefaults(userId: string) {
  const row = await userRepo.getDefaults(userId);
  return {
    defaultVslUrl: row.default_vsl_url,
    defaultFunnelTemplate: row.default_funnel_template || 'social_proof',
  };
}

const VALID_TEMPLATE_IDS = ['minimal', 'social_proof', 'authority', 'full_suite'];
const VALID_VSL_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'loom.com', 'www.loom.com'];

/** Caller may validate defaultVslUrl and defaultFunnelTemplate. */
export async function updateDefaults(
  userId: string,
  payload: { defaultVslUrl?: string | null; defaultFunnelTemplate?: string }
) {
  if (payload.defaultFunnelTemplate !== undefined && !VALID_TEMPLATE_IDS.includes(payload.defaultFunnelTemplate)) {
    const err = new Error('VALIDATION: Invalid funnel template ID');
    (err as Error & { code: string }).code = 'VALIDATION';
    throw err;
  }
  if (payload.defaultVslUrl !== undefined && payload.defaultVslUrl && typeof payload.defaultVslUrl === 'string') {
    try {
      const url = new URL(payload.defaultVslUrl);
      const ok = VALID_VSL_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
      if (!ok) {
        const err = new Error('VALIDATION: Video URL must be from YouTube, Vimeo, or Loom');
        (err as Error & { code: string }).code = 'VALIDATION';
        throw err;
      }
    } catch (e) {
      if ((e as Error).message?.startsWith('VALIDATION:')) throw e;
      const err = new Error('VALIDATION: Invalid video URL format');
      (err as Error & { code: string }).code = 'VALIDATION';
      throw err;
    }
  }

  const updates: { default_vsl_url?: string | null; default_funnel_template?: string } = {
    default_vsl_url: payload.defaultVslUrl?.trim() || null,
  };
  if (payload.defaultFunnelTemplate !== undefined) {
    updates.default_funnel_template = payload.defaultFunnelTemplate;
  }
  const row = await userRepo.updateDefaults(userId, updates);
  return {
    defaultVslUrl: row.default_vsl_url,
    defaultFunnelTemplate: row.default_funnel_template,
  };
}

export function validateUsernameFormat(username: string): boolean {
  return typeof username === 'string' && USERNAME_REGEX.test(username);
}
