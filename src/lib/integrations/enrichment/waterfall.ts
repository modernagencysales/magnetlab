import { getConfiguredFinders, getValidator } from './index';
import type { WaterfallResult, EmailFinderParams } from './types';

export async function waterfallEmailFind(params: EmailFinderParams): Promise<WaterfallResult> {
  const finders = getConfiguredFinders();
  const validator = getValidator();
  const attempts: WaterfallResult['attempts'] = [];

  for (const finder of finders) {
    try {
      const result = await finder.findEmail(params);
      attempts.push({ provider: finder.name, email: result.email });

      if (!result.email) continue;

      // Validate with ZeroBounce if available
      if (validator) {
        const validation = await validator.validateEmail(result.email);
        if (validation.is_valid) {
          return {
            email: result.email,
            provider: finder.name,
            confidence: result.confidence,
            validated: true,
            validation_status: validation.status,
            attempts,
          };
        }
        // Invalid email - continue to next finder
        attempts[attempts.length - 1].error = `validation_failed:${validation.status}`;
        continue;
      }

      // No validator - accept the email as-is
      return {
        email: result.email,
        provider: finder.name,
        confidence: result.confidence,
        validated: false,
        attempts,
      };
    } catch (error) {
      attempts.push({
        provider: finder.name,
        email: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // All finders exhausted
  return {
    email: null,
    provider: null,
    confidence: 0,
    validated: false,
    attempts,
  };
}
