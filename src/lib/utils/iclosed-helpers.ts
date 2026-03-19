/** iClosed Helpers. Pure utility functions for booking URL pre-fill. No React imports, no side effects. */

// ─── Phone Normalization ────────────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format for iClosed.
 * - Already has '+' prefix -> pass through
 * - 10 digits (US/CA) -> prepend '+1'
 * - 11 digits starting with '1' (US/CA with country code) -> prepend '+'
 * - Otherwise -> prepend '+' (best effort)
 */
export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return undefined;
  if (phone.startsWith('+')) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// ─── URL Builder ────────────────────────────────────────────────────────────

/**
 * Build an iClosed booking URL with pre-filled lead data + survey answers.
 * Supports: iclosedName, iclosedEmail, iclosedPhone, custom survey answer fields.
 */
export function buildIClosedUrl(
  eventUrl: string,
  options?: {
    leadEmail?: string | null;
    leadName?: string | null;
    leadPhone?: string | null;
    surveyAnswers?: Record<string, string>;
  }
): string {
  if (!eventUrl) return '';
  if (!options) return eventUrl;

  try {
    const url = new URL(eventUrl);
    const params = url.searchParams;

    if (options.leadName) params.set('iclosedName', options.leadName);
    if (options.leadEmail) params.set('iclosedEmail', options.leadEmail);
    const normalizedPhone = normalizePhone(options.leadPhone ?? undefined);
    if (normalizedPhone) params.set('iclosedPhone', normalizedPhone);

    if (options.surveyAnswers) {
      for (const [key, value] of Object.entries(options.surveyAnswers)) {
        if (value) params.set(key, value);
      }
    }

    return url.toString();
  } catch {
    return eventUrl;
  }
}
