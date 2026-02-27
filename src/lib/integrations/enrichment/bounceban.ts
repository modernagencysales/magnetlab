import type { EmailValidatorProvider, EmailValidationResult } from './types';

export class BounceBanProvider implements EmailValidatorProvider {
  name = 'bounceban';

  isConfigured(): boolean {
    return !!process.env.BOUNCEBAN_API_KEY;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    const apiKey = process.env.BOUNCEBAN_API_KEY;
    if (!apiKey) {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }

    try {
      const url = `https://api-waterfall.bounceban.com/v1/verify/single?email=${encodeURIComponent(email)}&timeout=80`;
      const response = await fetch(url, {
        headers: { Authorization: apiKey },
      });

      if (response.status === 408) {
        return { email, is_valid: true, status: 'unknown', provider: this.name };
      }

      if (!response.ok) {
        throw new Error(`BounceBan API error: ${response.status}`);
      }

      const data: Record<string, unknown> = await response.json();
      const result = data.result as string;
      const status =
        result === 'deliverable'
          ? 'valid' as const
          : result === 'undeliverable'
            ? 'invalid' as const
            : result === 'risky'
              ? 'catch_all' as const
              : 'unknown' as const;

      return {
        email,
        is_valid: status === 'valid' || status === 'catch_all',
        status,
        provider: this.name,
      };
    } catch {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }
  }
}
