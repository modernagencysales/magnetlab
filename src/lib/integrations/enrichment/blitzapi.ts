import type { EmailFinderProvider, EmailFinderResult, EmailFinderParams } from './types';

export class BlitzApiProvider implements EmailFinderProvider {
  name = 'blitzapi';

  isConfigured(): boolean {
    return !!process.env.BLITZ_API_KEY;
  }

  async findEmail(params: EmailFinderParams): Promise<EmailFinderResult> {
    const apiKey = process.env.BLITZ_API_KEY;
    if (!apiKey) {
      return { email: null, confidence: 0, provider: this.name };
    }

    const linkedinUrl = params.linkedin_url || params.linkedinUrl;

    if (!linkedinUrl) {
      return { email: null, confidence: 0, provider: this.name };
    }

    try {
      const response = await fetch('https://api.blitz-api.ai/v2/enrichment/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          person_linkedin_url: linkedinUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`BlitzAPI error: ${response.status}`);
      }

      const data = await response.json() as { found?: boolean; email?: string };
      if (data.found && data.email) {
        return {
          email: data.email,
          confidence: 90,
          provider: this.name,
        };
      }

      return { email: null, confidence: 0, provider: this.name };
    } catch {
      return { email: null, confidence: 0, provider: this.name };
    }
  }
}
