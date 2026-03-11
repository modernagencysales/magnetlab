/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import { getDiagnosticRules, matchRulesToMetrics } from '@/lib/services/accelerator-troubleshooter';

describe('accelerator-troubleshooter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDiagnosticRules', () => {
    it('returns rules for a module', async () => {
      const rules = [{ id: 'r-1', symptom: 'Low open rate', module_id: 'm4' }];
      mockFrom.mockReturnValue(createChain(rules));
      const result = await getDiagnosticRules('m4');
      expect(result).toHaveLength(1);
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue(createChain(null, { message: 'error' }));
      const result = await getDiagnosticRules('m4');
      expect(result).toEqual([]);
    });
  });

  describe('matchRulesToMetrics', () => {
    it('matches rules where metric is below threshold', () => {
      const rules = [
        {
          id: 'r-1',
          symptom: 'Low open rate',
          module_id: 'm4',
          metric_key: 'email_open_rate' as const,
          threshold_operator: '<' as const,
          threshold_value: 20,
          diagnostic_questions: ['Are your subject lines personalized?'],
          common_causes: [
            {
              cause: 'Generic subjects',
              fix: 'Use first name + pain point',
              severity: 'critical' as const,
            },
          ],
          priority: 10,
        },
        {
          id: 'r-2',
          symptom: 'High bounce rate',
          module_id: 'm4',
          metric_key: 'email_bounce_rate' as const,
          threshold_operator: '>' as const,
          threshold_value: 5,
          diagnostic_questions: ['When did you validate emails?'],
          common_causes: [
            { cause: 'Stale list', fix: 'Re-validate', severity: 'warning' as const },
          ],
          priority: 20,
        },
      ];

      const metrics = [
        { metric_key: 'email_open_rate', value: 15 },
        { metric_key: 'email_bounce_rate', value: 3 },
      ];

      const matched = matchRulesToMetrics(rules, metrics);
      expect(matched).toHaveLength(1);
      expect(matched[0].symptom).toBe('Low open rate');
    });

    it('returns empty when all metrics are healthy', () => {
      const rules = [
        {
          id: 'r-1',
          symptom: 'Low open rate',
          module_id: 'm4',
          metric_key: 'email_open_rate' as const,
          threshold_operator: '<' as const,
          threshold_value: 20,
          diagnostic_questions: [],
          common_causes: [],
          priority: 10,
        },
      ];
      const metrics = [{ metric_key: 'email_open_rate', value: 45 }];
      const matched = matchRulesToMetrics(rules, metrics);
      expect(matched).toHaveLength(0);
    });

    it('skips rules without metric_key', () => {
      const rules = [
        {
          id: 'r-1',
          symptom: 'General issue',
          module_id: 'm4',
          metric_key: null,
          threshold_operator: null,
          threshold_value: null,
          diagnostic_questions: [],
          common_causes: [],
          priority: 10,
        },
      ];
      const metrics = [{ metric_key: 'email_open_rate', value: 45 }];
      const matched = matchRulesToMetrics(rules, metrics);
      expect(matched).toHaveLength(0);
    });
  });
});
