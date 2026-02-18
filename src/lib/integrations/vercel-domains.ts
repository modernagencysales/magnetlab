// Vercel Domains API Client
// Used to programmatically manage custom domains on Vercel projects

import { logError, logInfo } from '@/lib/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

export interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
  error?: { code: string; message: string };
}

interface VercelDomainConfig {
  cnames: string[];
  aValues: string[];
  conflicts: Array<{ name: string; type: string; value: string }>;
  acceptedChallenges: string[];
  misconfigured: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const VERCEL_API_BASE = 'https://api.vercel.com';

function getConfig() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    throw new Error('VERCEL_TOKEN is not set in environment variables');
  }

  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    throw new Error('VERCEL_PROJECT_ID is not set in environment variables');
  }

  const teamId = process.env.VERCEL_TEAM_ID || null;

  return { token, projectId, teamId };
}

/**
 * Append teamId query parameter to a URL if VERCEL_TEAM_ID is set
 */
function withTeamId(url: string, teamId: string | null): string {
  if (!teamId) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}teamId=${teamId}`;
}

/**
 * Make an authenticated request to the Vercel API
 */
async function vercelFetch<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const { token, teamId } = getConfig();
  const url = withTeamId(`${VERCEL_API_BASE}${path}`, teamId);

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const errorMessage = data.error?.message || data.message || `HTTP ${response.status}`;
    const errorCode = data.error?.code || 'UNKNOWN';
    logError('integrations/vercel-domains', new Error(errorMessage), {
      method,
      path,
      status: response.status,
      errorCode,
    });

    // Return error shape for domain responses so callers can inspect the error
    return {
      ...data,
      error: { code: errorCode, message: errorMessage },
    } as T;
  }

  return data as T;
}

// =============================================================================
// DOMAIN MANAGEMENT
// =============================================================================

/**
 * Add a custom domain to the Vercel project
 *
 * POST /v10/projects/{projectId}/domains
 */
export async function addDomain(domain: string): Promise<VercelDomainResponse> {
  const { projectId } = getConfig();

  logInfo('integrations/vercel-domains', `Adding domain: ${domain}`, { domain, projectId });

  const result = await vercelFetch<VercelDomainResponse>(
    'POST',
    `/v10/projects/${projectId}/domains`,
    { name: domain }
  );

  if (result.error) {
    logError('integrations/vercel-domains', new Error(result.error.message), {
      action: 'addDomain',
      domain,
      errorCode: result.error.code,
    });
  } else {
    logInfo('integrations/vercel-domains', `Domain added: ${domain}`, {
      verified: result.verified,
      hasVerification: !!result.verification?.length,
    });
  }

  return result;
}

/**
 * Check the verification and SSL status of a domain
 *
 * GET /v10/projects/{projectId}/domains/{domain}
 */
export async function checkDomain(domain: string): Promise<VercelDomainResponse> {
  const { projectId } = getConfig();

  const result = await vercelFetch<VercelDomainResponse>(
    'GET',
    `/v10/projects/${projectId}/domains/${domain}`
  );

  return result;
}

/**
 * Remove a custom domain from the Vercel project
 *
 * DELETE /v10/projects/{projectId}/domains/{domain}
 */
export async function removeDomain(domain: string): Promise<{ success: boolean }> {
  const { projectId } = getConfig();

  logInfo('integrations/vercel-domains', `Removing domain: ${domain}`, { domain, projectId });

  const result = await vercelFetch<Record<string, unknown>>(
    'DELETE',
    `/v10/projects/${projectId}/domains/${domain}`
  );

  if (result.error) {
    const error = result.error as { code: string; message: string };
    logError('integrations/vercel-domains', new Error(error.message), {
      action: 'removeDomain',
      domain,
      errorCode: error.code,
    });
    return { success: false };
  }

  logInfo('integrations/vercel-domains', `Domain removed: ${domain}`);
  return { success: true };
}

/**
 * Get DNS configuration for a domain (CNAME and A records needed)
 *
 * GET /v6/domains/{domain}/config
 *
 * Returns null if the domain is not found or API returns an error.
 */
export async function getDomainConfig(
  domain: string
): Promise<{ cnames: string[]; aRecords: string[] } | null> {
  const result = await vercelFetch<VercelDomainConfig & { error?: { code: string; message: string } }>(
    'GET',
    `/v6/domains/${domain}/config`
  );

  if (result.error) {
    logError('integrations/vercel-domains', new Error(result.error.message), {
      action: 'getDomainConfig',
      domain,
      errorCode: result.error.code,
    });
    return null;
  }

  return {
    cnames: result.cnames || [],
    aRecords: result.aValues || [],
  };
}
