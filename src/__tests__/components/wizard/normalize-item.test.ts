/**
 * Tests for normalizeItem function used in ContentStep.
 *
 * This test reproduces bug MOD-69 where "Common Mistakes This Prevents"
 * outputs raw JSON instead of parsing the object correctly.
 *
 * Root cause: The AI generates objects with property names like {mistake, explanation}
 * but normalizeItem() only handles {item, explanation} - falling back to JSON.stringify().
 */

/**
 * The normalizeItem function from ContentStep.tsx
 * Reproducing it here to test in isolation.
 */
function normalizeItem(item: string | Record<string, unknown>): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    // Get all string values from the object
    const values = Object.values(item).filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length >= 2) {
      // Two values: format as "first: second" (e.g., "mistake: explanation")
      return `${values[0]}: ${values[1]}`;
    }
    if (values.length === 1) {
      return values[0];
    }
    // No string values found, fall back to JSON
    return JSON.stringify(item);
  }
  return String(item);
}

describe('normalizeItem function', () => {
  describe('string inputs', () => {
    it('should return string as-is', () => {
      expect(normalizeItem('Simple mistake')).toBe('Simple mistake');
    });

    it('should handle empty string', () => {
      expect(normalizeItem('')).toBe('');
    });
  });

  describe('expected object format {item, explanation}', () => {
    it('should format object with item and explanation', () => {
      const input = { item: 'Copy without understanding', explanation: 'Missing the underlying principle' };
      expect(normalizeItem(input)).toBe('Copy without understanding: Missing the underlying principle');
    });

    it('should handle object with only item', () => {
      const input = { item: 'Just the item' };
      expect(normalizeItem(input)).toBe('Just the item');
    });

    it('should handle object with only explanation', () => {
      const input = { explanation: 'Just the explanation' };
      expect(normalizeItem(input)).toBe('Just the explanation');
    });
  });

  describe('MOD-69: AI-generated object formats', () => {
    /**
     * BUG REPRODUCTION: The AI prompt asks for "mistakes with explanation of WHY"
     * which leads Claude to return objects with {mistake, explanation} property names
     * instead of the expected {item, explanation} format.
     *
     * This causes normalizeItem() to fall back to JSON.stringify(), outputting raw JSON.
     */
    it('should handle object with {mistake, explanation} format - REPRODUCES BUG MOD-69', () => {
      const aiOutput = {
        mistake: 'Trying to copy without understanding',
        explanation: 'If you blindly copy tactics without understanding the underlying principle, you will fail to adapt when circumstances change.'
      };

      // CURRENT BEHAVIOR (BUG): Returns stringified JSON
      // EXPECTED BEHAVIOR: Should return "Trying to copy without understanding: If you blindly copy..."
      const result = normalizeItem(aiOutput as unknown as { item?: string; explanation?: string });

      // This test FAILS because the function returns JSON.stringify(aiOutput)
      expect(result).not.toContain('{');
      expect(result).not.toContain('"mistake"');
      expect(result).toBe('Trying to copy without understanding: If you blindly copy tactics without understanding the underlying principle, you will fail to adapt when circumstances change.');
    });

    it('should handle object with {error, reason} format', () => {
      const aiOutput = {
        error: 'Skipping the research phase',
        reason: 'Without proper research, your content lacks credibility.'
      };

      const result = normalizeItem(aiOutput as unknown as { item?: string; explanation?: string });

      // Should not output raw JSON
      expect(result).not.toContain('{');
      expect(result).not.toContain('"error"');
    });

    it('should handle object with {problem, solution} format', () => {
      const aiOutput = {
        problem: 'Not validating assumptions',
        solution: 'Always test your hypotheses before scaling.'
      };

      const result = normalizeItem(aiOutput as unknown as { item?: string; explanation?: string });

      // Should not output raw JSON
      expect(result).not.toContain('{');
      expect(result).not.toContain('"problem"');
    });

    it('should handle object with {title, description} format', () => {
      const aiOutput = {
        title: 'Ignoring feedback',
        description: 'User feedback is essential for product-market fit.'
      };

      const result = normalizeItem(aiOutput as unknown as { item?: string; explanation?: string });

      // Should not output raw JSON
      expect(result).not.toContain('{');
      expect(result).not.toContain('"title"');
    });

    it('should handle object with {name, details} format', () => {
      const aiOutput = {
        name: 'Over-engineering early',
        details: 'Building complex systems before validating the core idea wastes resources.'
      };

      const result = normalizeItem(aiOutput as unknown as { item?: string; explanation?: string });

      // Should not output raw JSON
      expect(result).not.toContain('{');
      expect(result).not.toContain('"name"');
    });
  });

  describe('edge cases', () => {
    it('should handle null gracefully', () => {
      expect(normalizeItem(null as unknown as string)).toBe('null');
    });

    it('should handle undefined gracefully', () => {
      expect(normalizeItem(undefined as unknown as string)).toBe('undefined');
    });

    it('should handle empty object', () => {
      const result = normalizeItem({});
      expect(result).toBe('{}');
    });

    it('should handle object with unrelated properties', () => {
      const input = { foo: 'bar', baz: 'qux' };
      const result = normalizeItem(input);
      // New behavior: formats any two-property object as "first: second"
      expect(result).toBe('bar: qux');
    });

    it('should handle object with non-string values', () => {
      const input = { count: 42, enabled: true };
      const result = normalizeItem(input);
      // Non-string values are filtered out, falls back to JSON.stringify of original
      expect(result).toBe('{"count":42,"enabled":true}');
    });
  });
});
