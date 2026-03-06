/**
 * Client-side API error types.
 * Mirrors backend ErrorCodes from lib/api/errors.ts for consistent handling.
 */

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  AI_GENERATION_ERROR: 'AI_GENERATION_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;
}

export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof Error &&
    'code' in err &&
    typeof (err as ApiError).code === 'string' &&
    'status' in err &&
    typeof (err as ApiError).status === 'number'
  );
}

/**
 * Parse a failed response into an ApiError.
 */
export async function parseApiError(response: Response): Promise<ApiError> {
  let body: { error?: string; code?: string; message?: string } = {};
  try {
    const text = await response.text();
    if (text) body = JSON.parse(text) as typeof body;
  } catch {
    // ignore
  }
  const message = body.error ?? body.message ?? (response.statusText || 'Request failed');
  const code = (body.code as ErrorCode) ?? ErrorCodes.INTERNAL_ERROR;
  const err = new Error(message) as ApiError;
  err.name = 'ApiError';
  err.code = Object.values(ErrorCodes).includes(code) ? code : ErrorCodes.INTERNAL_ERROR;
  err.status = response.status;
  return err;
}
