import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class LeadMagicProvider implements EmailFinderProvider {
  name = 'leadmagic';

  isConfigured(): boolean {
    return !!process.env.LEADMAGIC_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.LEADMAGIC_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const firstName = params.first_name || params.firstName || '';
    const lastName = params.last_name || params.lastName || '';
    const domain = params.company_domain || params.domain || '';

    try {
      const response = await fetch('https://api.leadmagic.io/v1/people/email-finder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          domain,
        }),
      });

      if (!response.ok) {
        throw new Error(`LeadMagic API error: ${response.status}`);
      }

      const data: Record<string, unknown> = await response.json();

      if (!data.email) {
        return { email: null, confidence: 0, provider: this.name };
      }

      const confidence =
        data.status === 'valid' ? 95 :
        data.status === 'valid_catch_all' ? 80 :
        data.status === 'catch_all' ? 60 :
        50;

      return {
        email: data.email as string,
        confidence,
        provider: this.name,
      };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
