import { interpolatePrompt } from '@/lib/services/prompt-registry';

describe('interpolatePrompt', () => {
  it('replaces simple {{variable}} placeholders', () => {
    const template = 'Hello {{name}}, welcome to {{place}}.';
    const result = interpolatePrompt(template, { name: 'Alice', place: 'Wonderland' });
    expect(result).toBe('Hello Alice, welcome to Wonderland.');
  });

  it('replaces multiple occurrences of same variable', () => {
    const template = '{{x}} and {{x}} again';
    const result = interpolatePrompt(template, { x: 'test' });
    expect(result).toBe('test and test again');
  });

  it('removes unreplaced placeholders', () => {
    const template = 'Start {{missing}} end';
    const result = interpolatePrompt(template, {});
    expect(result).toBe('Start  end');
  });

  it('handles empty variables object', () => {
    const template = 'No vars here';
    const result = interpolatePrompt(template, {});
    expect(result).toBe('No vars here');
  });

  it('handles multiline templates', () => {
    const template = 'Line1 {{a}}\nLine2 {{b}}';
    const result = interpolatePrompt(template, { a: 'X', b: 'Y' });
    expect(result).toBe('Line1 X\nLine2 Y');
  });

  it('does not replace partial matches like {name}', () => {
    const template = '{name} vs {{name}}';
    const result = interpolatePrompt(template, { name: 'test' });
    expect(result).toBe('{name} vs test');
  });

  it('handles variables with underscores and numbers', () => {
    const template = '{{idea_title}} by {{author2}}';
    const result = interpolatePrompt(template, { idea_title: 'Hello', author2: 'Bob' });
    expect(result).toBe('Hello by Bob');
  });
});
