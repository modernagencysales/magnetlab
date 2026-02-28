import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class ProspeoProvider implements EmailFinderProvider {
  name = 'prospeo';

  isConfigured(): boolean {
    return !!process.env.PROSPEO_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.PROSPEO_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const firstName = params.first_name || params.firstName || '';
    const lastName = params.last_name || params.lastName || '';
    const domain = params.company_domain || params.domain || '';

    if (!firstName || !lastName || !domain) {
      return { email: null, confidence: 0, provider: this.name };
    }

    try {
      const body: Record<string, unknown> = {
        only_verified_email: true,
        data: {
          first_name: firstName,
          last_name: lastName,
          company_website: domain,
          ...(params.linkedin_url || params.linkedinUrl
            ? { linkedin_url: params.linkedin_url || params.linkedinUrl }
            : {}),
        },
      };

      const response = await fetch('https://api.prospeo.io/enrich-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-KEY': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Prospeo API error: ${response.status}`);
      }

      const data = await response.json() as { error?: boolean; person?: { email?: { email?: string; status?: string } } };
      if (!data.error && data.person?.email?.email) {
        const status = data.person.email.status;
        return {
          email: data.person.email.email,
          confidence: status === 'verified' ? 95 : 70,
          provider: this.name,
        };
      }

      return { email: null, confidence: 0, provider: this.name };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
