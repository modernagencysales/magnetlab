/**
 * @jest-environment node
 */
import { validateDeliverable } from '@/lib/services/accelerator-validation';
import type { QualityBar } from '@/lib/types/accelerator';

// Mock Anthropic — jest.mock is hoisted above variable declarations, so the
// factory must be self-contained. We expose the inner mock via the module so
// tests can configure return values via jest.mocked(Anthropic).
jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  const MockAnthropic = jest.fn(() => ({ messages: { create: mockCreate } }));
  (MockAnthropic as unknown as Record<string, unknown>)._mockCreate = mockCreate;
  return { __esModule: true, default: MockAnthropic };
});

import Anthropic from '@anthropic-ai/sdk';

// Helper to access the shared mockCreate fn
const getMockCreate = () => (Anthropic as unknown as { _mockCreate: jest.Mock })._mockCreate;

describe('accelerator-validation', () => {
  beforeEach(() => {
    getMockCreate().mockReset();
  });

  describe('validateDeliverable', () => {
    it('passes when all critical checks pass', async () => {
      const qualityBars: QualityBar[] = [
        { check: 'ICP names a specific person', severity: 'critical' },
        { check: 'Documents their language', severity: 'warning' },
      ];
      const content =
        'Caroline is a 15-person video agency owner in Austin who says "I am drowning in project management"';

      getMockCreate().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checks: [
                { check: 'ICP names a specific person', passed: true, feedback: 'Names Caroline' },
                { check: 'Documents their language', passed: true, feedback: 'Quotes their words' },
              ],
            }),
          },
        ],
      });

      const result = await validateDeliverable(content, qualityBars);
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(2);
    });

    it('fails when a critical check fails', async () => {
      const qualityBars: QualityBar[] = [
        { check: 'ICP names a specific person', severity: 'critical' },
      ];
      const content = 'Marketing agencies are my target market';

      getMockCreate().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              checks: [
                {
                  check: 'ICP names a specific person',
                  passed: false,
                  feedback: '"Marketing agencies" is a category, not a person. Name your Caroline.',
                },
              ],
            }),
          },
        ],
      });

      const result = await validateDeliverable(content, qualityBars);
      expect(result.passed).toBe(false);
    });

    it('returns passed with empty quality bars', async () => {
      const result = await validateDeliverable('any content', []);
      expect(result.passed).toBe(true);
      expect(result.checks).toHaveLength(0);
      expect(result.feedback).toBe('No quality bars defined.');
    });

    it('degrades gracefully on API error', async () => {
      getMockCreate().mockRejectedValue(new Error('API timeout'));

      const qualityBars: QualityBar[] = [{ check: 'Test check', severity: 'critical' }];
      const result = await validateDeliverable('content', qualityBars);
      expect(result.passed).toBe(true); // Fails open
      expect(result.feedback).toContain('could not be completed');
    });
  });
});
