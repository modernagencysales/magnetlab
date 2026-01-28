/**
 * Structured Logging Utility
 *
 * Provides consistent JSON logging for all parts of the application.
 * Does not depend on Next.js, so can be used in tests and library code.
 */

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  context: string;
  message: string;
  stack?: string;
  timestamp: string;
  [key: string]: unknown;
}

/**
 * Log an error with context and optional metadata
 */
export function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const entry: LogEntry = {
    level: 'error',
    context,
    message: errorMessage,
    stack: errorStack,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console.error(JSON.stringify(entry));
}

/**
 * Log a warning with context
 */
export function logWarn(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level: 'warn',
    context,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console.warn(JSON.stringify(entry));
}

/**
 * Log info with context
 */
export function logInfo(
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const entry: LogEntry = {
    level: 'info',
    context,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  console.info(JSON.stringify(entry));
}
