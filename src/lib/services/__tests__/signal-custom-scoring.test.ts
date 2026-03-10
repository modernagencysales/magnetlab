import { computeCustomVariableScore } from '@/lib/services/signal-engine';
import type { SignalCustomVariable } from '@/lib/types/signals';

function makeVar(
  overrides: Partial<SignalCustomVariable> &
    Pick<SignalCustomVariable, 'name' | 'field_type' | 'scoring_rule'>
): SignalCustomVariable {
  return {
    id: 'test-id',
    user_id: 'test-user',
    display_order: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('computeCustomVariableScore', () => {
  it('returns 0 when custom_data is null', () => {
    const vars = [
      makeVar({
        name: 'authority_score',
        field_type: 'number',
        scoring_rule: { ranges: [{ min: 0, max: 100, weight: 10 }] },
      }),
    ];
    expect(computeCustomVariableScore(vars, null)).toBe(0);
  });

  it('scores number ranges correctly', () => {
    const vars = [
      makeVar({
        name: 'authority_score',
        field_type: 'number',
        scoring_rule: {
          ranges: [
            { min: 80, weight: 15 },
            { min: 50, max: 79, weight: 10 },
            { min: 0, max: 49, weight: 3 },
          ],
        },
      }),
    ];
    expect(computeCustomVariableScore(vars, { authority_score: 85 })).toBe(15);
    expect(computeCustomVariableScore(vars, { authority_score: 60 })).toBe(10);
    expect(computeCustomVariableScore(vars, { authority_score: 30 })).toBe(3);
  });

  it('scores booleans correctly', () => {
    const vars = [
      makeVar({
        name: 'has_viewed_blueprint',
        field_type: 'boolean',
        scoring_rule: { when_true: 10, when_false: 0 },
      }),
    ];
    expect(computeCustomVariableScore(vars, { has_viewed_blueprint: true })).toBe(10);
    expect(computeCustomVariableScore(vars, { has_viewed_blueprint: false })).toBe(0);
  });

  it('scores text keywords correctly', () => {
    const vars = [
      makeVar({
        name: 'qualified',
        field_type: 'text',
        scoring_rule: { contains: { qualified: 10, promising: 5 }, default: 0 },
      }),
    ];
    expect(computeCustomVariableScore(vars, { qualified: 'qualified' })).toBe(10);
    // "not qualified" still contains "qualified" — substring match, first-match-wins
    expect(computeCustomVariableScore(vars, { qualified: 'not qualified' })).toBe(10);
    expect(computeCustomVariableScore(vars, { qualified: 'promising lead' })).toBe(5);
    // No keyword match → default
    expect(computeCustomVariableScore(vars, { qualified: 'unknown status' })).toBe(0);
  });

  it('sums scores across multiple variables', () => {
    const vars = [
      makeVar({
        name: 'authority_score',
        field_type: 'number',
        scoring_rule: { ranges: [{ min: 80, weight: 15 }] },
      }),
      makeVar({
        name: 'has_viewed_blueprint',
        field_type: 'boolean',
        scoring_rule: { when_true: 10, when_false: 0 },
      }),
    ];
    expect(
      computeCustomVariableScore(vars, { authority_score: 90, has_viewed_blueprint: true })
    ).toBe(25);
  });

  it('returns 0 for missing data fields', () => {
    const vars = [
      makeVar({
        name: 'authority_score',
        field_type: 'number',
        scoring_rule: { ranges: [{ min: 0, weight: 10 }] },
      }),
    ];
    expect(computeCustomVariableScore(vars, { other_field: 42 })).toBe(0);
  });
});
