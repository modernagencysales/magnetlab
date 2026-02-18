// Resend Domains API Client
// Used to programmatically manage email domain verification on the platform Resend account

import { logError, logInfo } from '@/lib/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface ResendDomainRecord {
  record: string;      // "SPF" | "DKIM" | "DMARC" | "MX"
  name: string;        // DNS record name
  type: string;        // "TXT" | "MX" | "CNAME"
  value: string;       // DNS record value
  ttl: string;         // "Auto" or numeric
  status: string;      // "not_started" | "pending" | "verified" | "failed"
  priority?: number;   // For MX records
}

export interface ResendDomainResponse {
  id: string;
  name: string;
  status: string;      // "not_started" | "pending" | "verified" | "failed"
  region: string;
  records: ResendDomainRecord[];
  created_at: string;
  error?: { message: string; name: string };
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const RESEND_API_BASE = 'https://api.resend.com';

function getApiKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error('RESEND_API_KEY is not set in environment variables');
  }
  return key;
}

// =============================================================================
// INTERNAL FETCH HELPER
// =============================================================================

/**
 * Make an authenticated request to the Resend API
 */
async function resendFetch<T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }
): Promise<T> {
  const apiKey = getApiKey();
  const method = options?.method ?? 'GET';
  const url = `${RESEND_API_BASE}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorMessage = data.message || data.error?.message || `HTTP ${response.status}`;
    const errorName = data.name || data.error?.name || 'ResendError';
    logError('integrations/resend-domains', new Error(errorMessage), {
      method,
      path,
      status: response.status,
      errorName,
    });

    // Return error shape so callers can inspect the error
    return {
      ...data,
      error: { message: errorMessage, name: errorName },
    } as T;
  }

  return data as T;
}

// =============================================================================
// DOMAIN MANAGEMENT
// =============================================================================

/**
 * Create a new domain on Resend for email sending
 *
 * POST /domains
 * Returns domain ID + DNS records (SPF, DKIM, MX) that must be configured
 */
export async function createResendDomain(domain: string): Promise<ResendDomainResponse> {
  logInfo('integrations/resend-domains', `Creating domain: ${domain}`, { domain });

  const result = await resendFetch<ResendDomainResponse>('/domains', {
    method: 'POST',
    body: { name: domain },
  });

  if (result.error) {
    logError('integrations/resend-domains', new Error(result.error.message), {
      action: 'createResendDomain',
      domain,
      errorName: result.error.name,
    });
  } else {
    logInfo('integrations/resend-domains', `Domain created: ${domain}`, {
      id: result.id,
      status: result.status,
      recordCount: result.records?.length ?? 0,
    });
  }

  return result;
}

/**
 * Get a domain's current status and per-record verification statuses
 *
 * GET /domains/{resendDomainId}
 */
export async function getResendDomain(resendDomainId: string): Promise<ResendDomainResponse> {
  const result = await resendFetch<ResendDomainResponse>(`/domains/${resendDomainId}`);

  return result;
}

/**
 * Trigger async DNS verification for a domain
 *
 * POST /domains/{resendDomainId}/verify
 * Returns just the domain ID; verification happens asynchronously
 */
export async function verifyResendDomain(
  resendDomainId: string
): Promise<{ id: string; error?: { message: string } }> {
  logInfo('integrations/resend-domains', `Verifying domain: ${resendDomainId}`, { resendDomainId });

  const result = await resendFetch<{ id: string; error?: { message: string; name: string } }>(
    `/domains/${resendDomainId}/verify`,
    { method: 'POST' }
  );

  if (result.error) {
    logError('integrations/resend-domains', new Error(result.error.message), {
      action: 'verifyResendDomain',
      resendDomainId,
    });
  } else {
    logInfo('integrations/resend-domains', `Verification triggered for domain: ${resendDomainId}`);
  }

  return result;
}

/**
 * Delete a domain from Resend
 *
 * DELETE /domains/{resendDomainId}
 */
export async function deleteResendDomain(
  resendDomainId: string
): Promise<{ id: string; deleted: boolean; error?: { message: string } }> {
  logInfo('integrations/resend-domains', `Deleting domain: ${resendDomainId}`, { resendDomainId });

  const result = await resendFetch<{ id: string; deleted: boolean; error?: { message: string; name: string } }>(
    `/domains/${resendDomainId}`,
    { method: 'DELETE' }
  );

  if (result.error) {
    logError('integrations/resend-domains', new Error(result.error.message), {
      action: 'deleteResendDomain',
      resendDomainId,
    });
  } else {
    logInfo('integrations/resend-domains', `Domain deleted: ${resendDomainId}`, {
      deleted: result.deleted,
    });
  }

  return result;
}
