/** Action Executor.
 *  Executes registered actions with retry + timeout support.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { logError } from '@/lib/utils/logger';
import type { ActionContext, ActionResult } from './types';
import { getAction } from './registry';

const LOG_CTX = 'action-executor';

// ─── Configuration ───────────────────────────────────────

/** Default timeout per action (30s). Long-running actions override via options. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Max retries for transient failures. */
const DEFAULT_MAX_RETRIES = 2;

/** Base delay between retries (exponential backoff: 500ms, 1s, 2s). */
const RETRY_BASE_DELAY_MS = 500;

/** Errors that indicate transient failures worth retrying. */
const RETRYABLE_PATTERNS = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'rate limit',
  'too many requests',
  '429',
  '502',
  '503',
  '504',
  'socket hang up',
  'network error',
  'fetch failed',
];

// ─── Options ────────────────────────────────────────────

export interface ExecuteActionOptions {
  /** Timeout in ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Max retry attempts for transient failures. Defaults to 2. */
  maxRetries?: number;
  /** Disable retries entirely (e.g., for mutations). */
  noRetry?: boolean;
}

// ─── Helpers ────────────────────────────────────────────

function isRetryableError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern.toLowerCase()));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Action "${label}" timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// ─── Executor ───────────────────────────────────────────

export async function executeAction(
  ctx: ActionContext,
  name: string,
  args: Record<string, unknown>,
  options?: ExecuteActionOptions
): Promise<ActionResult> {
  const action = getAction(name);
  if (!action) {
    return { success: false, error: `Unknown action: ${name}` };
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.noRetry ? 0 : (options?.maxRetries ?? DEFAULT_MAX_RETRIES);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(action.handler(ctx, args), timeoutMs, name);
      return result;
    } catch (error) {
      lastError = error;

      // Only retry transient errors, not business logic failures
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        logError(LOG_CTX, error, {
          action: name,
          attempt: attempt + 1,
          maxRetries,
          retryInMs: delay,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Non-retryable or exhausted retries
      break;
    }
  }

  const message = lastError instanceof Error ? lastError.message : 'Action execution failed';
  if (maxRetries > 0) {
    logError(LOG_CTX, lastError, { action: name, exhaustedRetries: true });
  }
  return { success: false, error: message };
}

export function actionRequiresConfirmation(name: string): boolean {
  const action = getAction(name);
  return action?.requiresConfirmation ?? false;
}
