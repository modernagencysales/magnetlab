import type { EmailValidatorProvider, EmailValidationResult } from './types';

export class ZeroBounceProvider implements EmailValidatorProvider {
  name = 'zerobounce';

  isConfigured(): boolean {
    return !!process.env.ZEROBOUNCE_API_KEY;
  }

  async validateEmail(email: string): Promise<EmailValidationResult> {
    const apiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!apiKey) {
      return { email, is_valid: true, status: 'unknown', provider: this.name };
    }

    try {
      const url = `https://api.zerobounce.net/v2/validate?api_key=${apiKey}&email=${encodeURIComponent(email)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`ZeroBounce API error: ${response.status}`);

      const data: Record<string, unknown> = await response.json();
      const status =
        data.status === 'valid'
          ? 'valid' as const
          : data.status === 'catch-all'
            ? 'catch_all' as const
            : data.status === 'invalid'
              ? 'invalid' as const
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
