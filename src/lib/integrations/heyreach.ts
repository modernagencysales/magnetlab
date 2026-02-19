// HeyReach API: push leads to outreach campaigns
// Docs: https://api.heyreach.io/api/public
// Note: AddLeadsToCampaign is the correct endpoint (NOT AddLeadsToListV2 which returns 404)

const HEYREACH_BASE_URL = 'https://api.heyreach.io/api/public';

export async function pushLeadsToHeyReach(
  campaignId: string,
  leads: Array<{
    profileUrl: string;
    firstName?: string;
    lastName?: string;
    customVariables?: Record<string, string>;
  }>
): Promise<{ success: boolean; added: number; error?: string }> {
  const apiKey = process.env.HEYREACH_API_KEY;
  if (!apiKey) {
    return { success: false, added: 0, error: 'HEYREACH_API_KEY not set' };
  }

  if (leads.length === 0) {
    return { success: true, added: 0 };
  }

  // Ensure LinkedIn URLs have trailing slash
  const normalizedLeads = leads.slice(0, 100).map(lead => ({
    profileUrl: lead.profileUrl.endsWith('/') ? lead.profileUrl : `${lead.profileUrl}/`,
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    customVariables: lead.customVariables,
  }));

  try {
    const response = await fetch(`${HEYREACH_BASE_URL}/campaign/AddLeadsToCampaign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        campaignId: Number(campaignId),
        accountLeadPairs: normalizedLeads.map(lead => ({
          linkedInAccountId: null,
          lead: {
            profileUrl: lead.profileUrl,
            firstName: lead.firstName,
            lastName: lead.lastName,
            ...lead.customVariables,
          },
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, added: 0, error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true, added: normalizedLeads.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, added: 0, error: message };
  }
}
