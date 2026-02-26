import { repairJson } from '@/lib/utils/repair-json';

describe('repairJson', () => {
  it('parses valid JSON unchanged', () => {
    const valid = '{"key": "value", "arr": [1, 2]}';
    expect(repairJson(valid)).toEqual({ key: 'value', arr: [1, 2] });
  });

  it('fixes trailing comma before closing brace', () => {
    const broken = '{"key": "value",}';
    expect(repairJson(broken)).toEqual({ key: 'value' });
  });

  it('fixes trailing comma before closing bracket', () => {
    const broken = '{"arr": [1, 2,]}';
    expect(repairJson(broken)).toEqual({ arr: [1, 2] });
  });

  it('closes unclosed braces', () => {
    const broken = '{"sections": [{"id": "a"}]';
    expect(repairJson(broken)).toEqual({ sections: [{ id: 'a' }] });
  });

  it('closes unclosed brackets', () => {
    const broken = '{"arr": [1, 2';
    expect(repairJson(broken)).toEqual({ arr: [1, 2] });
  });

  it('handles deeply truncated JSON', () => {
    const broken = '{"sections": [{"id": "a", "blocks": [{"type": "paragraph"';
    const result = repairJson(broken);
    expect(result).toBeTruthy();
    expect(result.sections).toBeDefined();
  });

  it('throws on completely invalid input', () => {
    expect(() => repairJson('not json at all')).toThrow();
  });

  it('strips markdown code fences', () => {
    const wrapped = '```json\n{"key": "value"}\n```';
    expect(repairJson(wrapped)).toEqual({ key: 'value' });
  });
});
