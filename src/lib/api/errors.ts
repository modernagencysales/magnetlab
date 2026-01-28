/**
 * Standardized API Error Handling
 *
 * Provides consistent error responses across all API routes.
 */

import { NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';

// Error codes for client-side handling
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // AI-specific
  AI_GENERATION_ERROR: 'AI_GENERATION_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

interface ApiErrorOptions {
  code: ErrorCode;
  message: string;
  status: number;
  details?: unknown;
}

/**
 * Create a standardized API error response
 */
export function apiError(options: ApiErrorOptions): NextResponse {
  const body: Record<string, unknown> = {
    error: options.message,
    code: options.code,
  };

  if (options.details !== undefined) {
    body.details = options.details;
  }

  return NextResponse.json(body, { status: options.status });
}

// Common error responses
export const ApiErrors = {
  unauthorized: (message = 'Unauthorized') =>
    apiError({ code: ErrorCodes.UNAUTHORIZED, message, status: 401 }),

  forbidden: (message = 'Access denied') =>
    apiError({ code: ErrorCodes.FORBIDDEN, message, status: 403 }),

  notFound: (resource = 'Resource') =>
    apiError({ code: ErrorCodes.NOT_FOUND, message: `${resource} not found`, status: 404 }),

  validationError: (message: string, details?: unknown) =>
    apiError({ code: ErrorCodes.VALIDATION_ERROR, message, status: 400, details }),

  conflict: (message: string) =>
    apiError({ code: ErrorCodes.CONFLICT, message, status: 409 }),

  rateLimited: (message = 'Too many requests. Please try again later.') =>
    apiError({ code: ErrorCodes.RATE_LIMITED, message, status: 429 }),

  usageLimitExceeded: (message = 'Usage limit exceeded. Please upgrade your plan.') =>
    apiError({ code: ErrorCodes.USAGE_LIMIT_EXCEEDED, message, status: 403 }),

  internalError: (message = 'An unexpected error occurred') =>
    apiError({ code: ErrorCodes.INTERNAL_ERROR, message, status: 500 }),

  databaseError: (message = 'Database operation failed') =>
    apiError({ code: ErrorCodes.DATABASE_ERROR, message, status: 500 }),

  aiError: (message = 'AI generation failed') =>
    apiError({ code: ErrorCodes.AI_GENERATION_ERROR, message, status: 500 }),
};

/**
 * Wrap an API handler with standard error handling
 */
export function withErrorHandling<T>(
  handler: () => Promise<T>,
  errorMessage = 'An unexpected error occurred'
): Promise<T | NextResponse> {
  return handler().catch((error: unknown) => {
    console.error('API Error:', error);
    return ApiErrors.internalError(errorMessage);
  });
}

/**
 * Log error with context (for structured logging)
 * Re-exports logError from utils/logger for convenience in API routes.
 */
export function logApiError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  logError(context, error, metadata);
}
