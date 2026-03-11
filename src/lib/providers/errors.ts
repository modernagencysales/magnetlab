/** Provider Errors.
 *  Shared error types for all provider implementations.
 *  Never imports NextRequest, NextResponse, or cookies. */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs: number;

  constructor(providerId: string, retryAfterMs: number = 60_000) {
    super(`Rate limited by ${providerId}`, providerId, 429);
    this.name = 'ProviderRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(providerId: string) {
    super(`${providerId} is temporarily unavailable`, providerId, 503);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(providerId: string) {
    super(`Authentication failed for ${providerId}`, providerId, 401);
    this.name = 'ProviderAuthError';
  }
}
