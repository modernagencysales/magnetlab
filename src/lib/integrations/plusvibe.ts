// Simplified PlusVibe client for adding leads to campaigns.
// Full client in gtm-system — this only implements what magnetlab needs.

const PLUSVIBE_BASE_URL = 'https://api.plusvibe.ai/api/v1';

export interface PlusVibeLeadPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  linkedin_person_url?: string;
  custom_variables?: Record<string, string>;
}

interface AddLeadsResponse {
  success: boolean;
  added?: number;
  error?: string;
}

/**
 * Add leads to a PlusVibe campaign.
 * Variables are sent WITHOUT `custom_` prefix — PlusVibe auto-prefixes them.
 * Templates reference them as {{custom_variable_name}}.
 */
export async function addLeadsToPlusVibeCampaign(
  campaignId: string,
  leads: PlusVibeLeadPayload[]
): Promise<AddLeadsResponse> {
  const apiKey = process.env.PLUSVIBE_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'PLUSVIBE_API_KEY not configured' };
  }

  try {
    const response = await fetch(`${PLUSVIBE_BASE_URL}/lead/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        campaign_id: campaignId,
        leads: leads.map((lead) => ({
          email: lead.email,
          first_name: lead.first_name || '',
          last_name: lead.last_name || '',
          company_name: lead.company_name || '',
          linkedin_person_url: lead.linkedin_person_url || '',
          custom_variables: lead.custom_variables || {},
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `PlusVibe API error ${response.status}: ${text}` };
    }

    const data = await response.json();
    return { success: true, added: data.added_count ?? leads.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown PlusVibe error',
    };
  }
}
