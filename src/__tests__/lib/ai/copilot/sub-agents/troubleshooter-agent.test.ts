/**
 * @jest-environment node
 */

import { buildTroubleshooterPrompt } from '@/lib/ai/copilot/sub-agents/troubleshooter-agent';
import type { DiagnosticRule } from '@/lib/types/accelerator';

describe('troubleshooter-agent prompt', () => {
  const mockRules: DiagnosticRule[] = [
    {
      id: 'r-1',
      symptom: 'Low email open rate',
      module_id: 'm4',
      metric_key: 'email_open_rate',
      threshold_operator: '<',
      threshold_value: 20,
      diagnostic_questions: ['Are subject lines personalized?', 'What is your sending volume?'],
      common_causes: [
        {
          cause: 'Generic subject lines',
          fix: 'Use first name + pain point in subject',
          severity: 'critical',
        },
      ],
      priority: 10,
    },
  ];

  const mockMetrics = [
    { metric_key: 'email_open_rate', value: 12, status: 'below' as const },
    { metric_key: 'email_sent', value: 50, status: 'at' as const },
  ];

  it('includes identity section', () => {
    const prompt = buildTroubleshooterPrompt([], [], 'guide_me');
    expect(prompt).toContain('Troubleshooter');
    expect(prompt).toContain('diagnos');
  });

  it('includes triggered diagnostic rules', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('Low email open rate');
    expect(prompt).toContain('Generic subject lines');
    expect(prompt).toContain('Are subject lines personalized?');
  });

  it('includes current metrics snapshot', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('email_open_rate');
    expect(prompt).toContain('12');
    expect(prompt).toContain('below');
  });

  it('adapts coaching mode', () => {
    const doIt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'do_it');
    expect(doIt).toContain('Do It For Me');

    const teachMe = buildTroubleshooterPrompt(mockRules, mockMetrics, 'teach_me');
    expect(teachMe).toContain('Teach Me');
  });

  it('includes handoff protocol', () => {
    const prompt = buildTroubleshooterPrompt(mockRules, mockMetrics, 'guide_me');
    expect(prompt).toContain('diagnostic_report');
    expect(prompt).toContain('needs_escalation');
  });
});
