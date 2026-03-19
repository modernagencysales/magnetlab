/**
 * Outreach Campaigns Service
 * Business logic for outreach campaigns and leads.
 * Never imports from the route layer. Side effects must not block core returns.
 */

import { logError } from '@/lib/utils/logger';
import * as repo from '@/server/repositories/outreach-campaigns.repo';
import * as queueRepo from '@/server/repositories/linkedin-action-queue.repo';
import type {
  OutreachCampaign,
  OutreachCampaignLead,
  OutreachCampaignStatus,
  OutreachLeadStatus,
  OutreachPreset,
  CreateOutreachCampaignInput,
  UpdateOutreachCampaignInput,
  AddOutreachLeadInput,
  OutreachTemplateVars,
  OutreachCampaignStats,
  OutreachCampaignProgress,
} from '@/lib/types/outreach-campaigns';

// ─── Result Types ────────────────────────────────────────────────────────────

type ServiceSuccess<T> = { success: true; data: T };
type ServiceError = {
  success: false;
  error: 'validation' | 'not_found' | 'database';
  message?: string;
};
type ServiceResult<T> = ServiceSuccess<T> | ServiceError;

// ─── Internal Types ──────────────────────────────────────────────────────────

/** Extended update input that allows status changes — used internally by activate/pause. */
type UpdateWithStatus = UpdateOutreachCampaignInput & { status?: OutreachCampaignStatus };

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_PRESETS: OutreachPreset[] = ['warm_connect', 'direct_connect', 'nurture'];
const MAX_LEADS_PER_CALL = 500;
const LINKEDIN_PROFILE_URL_REGEX = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/;

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateCampaignInput(
  input: CreateOutreachCampaignInput
): ServiceResult<CreateOutreachCampaignInput> {
  if (!input.name?.trim()) {
    return { success: false, error: 'validation', message: 'Campaign name is required' };
  }
  if (!input.preset || !VALID_PRESETS.includes(input.preset)) {
    return {
      success: false,
      error: 'validation',
      message: `Preset must be one of: ${VALID_PRESETS.join(', ')}`,
    };
  }
  if (!input.first_message_template?.trim()) {
    return {
      success: false,
      error: 'validation',
      message: 'First message template is required',
    };
  }
  if (!input.unipile_account_id?.trim()) {
    return { success: false, error: 'validation', message: 'LinkedIn account is required' };
  }
  return { success: true, data: input };
}

/** Return true if the URL looks like a LinkedIn profile /in/ URL. */
function isValidLinkedInProfileUrl(url: string): boolean {
  return LINKEDIN_PROFILE_URL_REGEX.test(url);
}

// ─── Template Rendering ──────────────────────────────────────────────────────

/**
 * Replace {{name}} and {{company}} placeholders in an outreach template.
 * Falls back to empty string for missing values.
 */
export function renderTemplate(template: string, vars: OutreachTemplateVars): string {
  return template
    .replace(/\{\{name\}\}/g, vars.name ?? '')
    .replace(/\{\{company\}\}/g, vars.company ?? '');
}

// ─── Campaign CRUD ───────────────────────────────────────────────────────────

export async function createCampaign(
  userId: string,
  teamId: string | null,
  input: CreateOutreachCampaignInput
): Promise<ServiceResult<OutreachCampaign>> {
  const validation = validateCampaignInput(input);
  if (!validation.success) return validation;

  const { data, error } = await repo.createCampaign(userId, teamId, validation.data);
  if (error) {
    logError('outreach-campaigns/createCampaign', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'database', message: 'Failed to create campaign' };
  }
  return { success: true, data };
}

export async function getCampaign(
  userId: string,
  id: string
): Promise<
  ServiceResult<
    OutreachCampaign & { stats: OutreachCampaignStats; progress: OutreachCampaignProgress }
  >
> {
  const { data, error } = await repo.getCampaign(userId, id);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('outreach-campaigns/getCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }

  const [stats, progress] = await Promise.all([
    repo.getCampaignStats(id),
    repo.getCampaignProgress(id),
  ]);

  return { success: true, data: { ...data, stats, progress } };
}

export async function listCampaigns(
  userId: string,
  status?: OutreachCampaignStatus
): Promise<ServiceResult<OutreachCampaign[]>> {
  const { data, error } = await repo.listCampaigns(userId, status);
  if (error) {
    logError('outreach-campaigns/listCampaigns', error, { userId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: data ?? [] };
}

export async function updateCampaign(
  userId: string,
  id: string,
  input: UpdateOutreachCampaignInput
): Promise<ServiceResult<OutreachCampaign>> {
  const { data, error } = await repo.updateCampaign(userId, id, input);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('outreach-campaigns/updateCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

export async function deleteCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<{ id: string }>> {
  // Cancel queued actions first — side effect, must not block core delete
  try {
    await queueRepo.cancelByCampaign(id);
  } catch (err) {
    logError('outreach-campaigns/deleteCampaign/cancelQueue', err, { userId, id });
  }

  const { error } = await repo.deleteCampaign(userId, id);
  if (error) {
    logError('outreach-campaigns/deleteCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: { id } };
}

export async function activateCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<OutreachCampaign>> {
  // Validate: campaign exists
  const { data: campaign, error: fetchError } = await repo.getCampaign(userId, id);
  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('outreach-campaigns/activateCampaign', fetchError, { userId, id });
    return { success: false, error: 'database', message: fetchError.message };
  }
  if (!campaign) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }

  // Validate: has first_message_template
  if (!campaign.first_message_template?.trim()) {
    return {
      success: false,
      error: 'validation',
      message: 'Campaign must have a first message template before activation',
    };
  }

  // Validate: has at least one lead
  const stats = await repo.getCampaignStats(id);
  if (stats.total === 0) {
    return {
      success: false,
      error: 'validation',
      message: 'Campaign must have at least one lead before activation',
    };
  }

  const { data, error } = await repo.updateCampaign(userId, id, {
    status: 'active',
  } as UpdateWithStatus);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('outreach-campaigns/activateCampaign/update', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

export async function pauseCampaign(
  userId: string,
  id: string
): Promise<ServiceResult<OutreachCampaign>> {
  // Cancel queued actions — side effect, must not block status update
  try {
    await queueRepo.cancelByCampaign(id);
  } catch (err) {
    logError('outreach-campaigns/pauseCampaign/cancelQueue', err, { userId, id });
  }

  const { data, error } = await repo.updateCampaign(userId, id, {
    status: 'paused',
  } as UpdateWithStatus);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Campaign not found' };
    }
    logError('outreach-campaigns/pauseCampaign', error, { userId, id });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Campaign not found' };
  }
  return { success: true, data };
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export async function addLeads(
  userId: string,
  campaignId: string,
  leads: AddOutreachLeadInput[]
): Promise<ServiceResult<{ inserted: number }>> {
  if (leads.length > MAX_LEADS_PER_CALL) {
    return {
      success: false,
      error: 'validation',
      message: `Maximum ${MAX_LEADS_PER_CALL} leads per call`,
    };
  }

  // Validate LinkedIn URLs
  const invalid = leads.filter((l) => !isValidLinkedInProfileUrl(l.linkedin_url));
  if (invalid.length > 0) {
    return {
      success: false,
      error: 'validation',
      message: `Invalid LinkedIn profile URL(s): ${invalid.map((l) => l.linkedin_url).join(', ')}`,
    };
  }

  const { inserted, error } = await repo.bulkAddLeads(userId, campaignId, leads);
  if (error) {
    logError('outreach-campaigns/addLeads', error, { userId, campaignId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: { inserted } };
}

export async function listLeads(
  userId: string,
  campaignId: string,
  status?: OutreachLeadStatus
): Promise<ServiceResult<OutreachCampaignLead[]>> {
  const { data, error } = await repo.listLeads(userId, campaignId, status);
  if (error) {
    logError('outreach-campaigns/listLeads', error, { userId, campaignId });
    return { success: false, error: 'database', message: error.message };
  }
  return { success: true, data: data ?? [] };
}

export async function getLead(
  userId: string,
  leadId: string
): Promise<ServiceResult<OutreachCampaignLead>> {
  const { data, error } = await repo.getLead(userId, leadId);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Lead not found' };
    }
    logError('outreach-campaigns/getLead', error, { userId, leadId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Lead not found' };
  }
  return { success: true, data };
}

export async function skipLead(
  userId: string,
  leadId: string
): Promise<ServiceResult<OutreachCampaignLead>> {
  // Cancel queued actions for this lead — side effect, must not block core skip
  try {
    await queueRepo.cancelByLead(leadId);
  } catch (err) {
    logError('outreach-campaigns/skipLead/cancelQueue', err, { userId, leadId });
  }

  const { data, error } = await repo.skipLead(leadId);
  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'not_found', message: 'Lead not found' };
    }
    logError('outreach-campaigns/skipLead', error, { userId, leadId });
    return { success: false, error: 'database', message: error.message };
  }
  if (!data) {
    return { success: false, error: 'not_found', message: 'Lead not found' };
  }
  return { success: true, data };
}

// ─── Error Helper ────────────────────────────────────────────────────────────

/** Extract statusCode from a service error, defaulting to 500. */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
