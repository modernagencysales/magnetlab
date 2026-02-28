/**
 * Integrations Service
 * Resend settings, email-marketing connected/disconnect, GoHighLevel disconnect.
 */

import { EMAIL_MARKETING_PROVIDERS } from '@/lib/integrations/email-marketing';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';
import { logApiError } from '@/lib/api/errors';
import * as integrationsRepo from '@/server/repositories/integrations.repo';

export async function updateResendSettings(
  userId: string,
  payload: { fromEmail?: string | null; fromName?: string | null }
) {
  const { data: existing, error: fetchError } = await integrationsRepo.getResendIntegration(userId);
  if (fetchError || !existing) {
    return { success: false, error: 'not_found' as const };
  }

  const updatedMetadata = {
    ...((existing.metadata as Record<string, unknown>) || {}),
    fromEmail: payload.fromEmail ?? null,
    fromName: payload.fromName ?? null,
  };

  const { error } = await integrationsRepo.updateResendIntegrationMetadata(existing.id, updatedMetadata);
  if (error) {
    logApiError('integrations/resend/settings', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function getConnectedEmailMarketingProviders(userId: string) {
  const { data, error } = await integrationsRepo.getActiveEmailMarketingServiceNames(
    userId,
    EMAIL_MARKETING_PROVIDERS
  );
  if (error) {
    logApiError('email-marketing/connected', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true, providers: data ?? [] };
}

export async function disconnectEmailMarketing(userId: string, provider: string) {
  await deleteUserIntegration(userId, provider);
  const { error } = await integrationsRepo.deactivateFunnelIntegrationsForProvider(userId, provider);
  if (error) {
    logApiError('email-marketing/disconnect', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function disconnectGohighlevel(userId: string) {
  await deleteUserIntegration(userId, 'gohighlevel');
  const { error } = await integrationsRepo.deactivateFunnelIntegrationsForProvider(userId, 'gohighlevel');
  if (error) {
    logApiError('gohighlevel/disconnect', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function disconnectHeyreach(userId: string) {
  await deleteUserIntegration(userId, 'heyreach');
  const { error } = await integrationsRepo.deactivateFunnelIntegrationsForProvider(userId, 'heyreach');
  if (error) {
    logApiError('heyreach/disconnect', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}
