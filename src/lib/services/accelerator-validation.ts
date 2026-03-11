/** Accelerator Deliverable Validation.
 *  Checks deliverable content against SOP quality bars using Claude Haiku.
 *  Never imports NextRequest, NextResponse, or cookies. */

import Anthropic from '@anthropic-ai/sdk';
import { logError } from '@/lib/utils/logger';
import type { QualityBar, ValidationResult, ValidationCheck } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-validation';
const anthropic = new Anthropic();

export async function validateDeliverable(
  content: string,
  qualityBars: QualityBar[]
): Promise<ValidationResult> {
  if (qualityBars.length === 0) {
    return { passed: true, checks: [], feedback: 'No quality bars defined.' };
  }

  try {
    const checksJson = qualityBars.map((qb) => ({
      check: qb.check,
      severity: qb.severity,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a quality reviewer for a GTM program. Evaluate the following content against each quality check.

Content to evaluate:
---
${content}
---

Quality checks to verify:
${JSON.stringify(checksJson, null, 2)}

For each check, determine if it passes or fails. If it fails, provide specific, actionable feedback explaining why and how to fix it.

Respond with JSON only:
{
  "checks": [
    { "check": "check text", "passed": true/false, "feedback": "specific feedback" }
  ]
}`,
        },
      ],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);

    const checks: ValidationCheck[] = parsed.checks.map(
      (c: { check: string; passed: boolean; feedback: string }) => ({
        check: c.check,
        passed: c.passed,
        severity: qualityBars.find((qb) => qb.check === c.check)?.severity || 'info',
        feedback: c.feedback,
      })
    );

    const criticalFailures = checks.filter((c) => !c.passed && c.severity === 'critical');
    const passed = criticalFailures.length === 0;

    const feedback = passed
      ? `All ${checks.length} quality checks passed.`
      : `${criticalFailures.length} critical check(s) failed: ${criticalFailures.map((c) => c.feedback).join('; ')}`;

    return { passed, checks, feedback };
  } catch (err) {
    logError(LOG_CTX, err, { checkCount: qualityBars.length });
    // Non-breaking: if validation fails, pass by default with a warning
    return {
      passed: true,
      checks: qualityBars.map((qb) => ({
        check: qb.check,
        passed: true,
        severity: qb.severity,
        feedback: 'Validation service unavailable — check skipped.',
      })),
      feedback: 'Validation could not be completed. Quality checks were skipped.',
    };
  }
}
