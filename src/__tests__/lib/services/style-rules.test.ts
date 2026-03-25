import { compileRuleText, getGlobalStyleRules } from '@/lib/services/style-rules';

// Mock the prompt registry
jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { getPrompt } from '@/lib/services/prompt-registry';
import { logError } from '@/lib/utils/logger';
const mockGetPrompt = getPrompt as jest.MockedFunction<typeof getPrompt>;
const mockLogError = logError as jest.MockedFunction<typeof logError>;

describe('style-rules', () => {
  describe('compileRuleText', () => {
    it('returns empty string for empty rules', () => {
      expect(compileRuleText([])).toBe('');
    });

    it('compiles single rule into numbered format with preamble', () => {
      const result = compileRuleText([{ rule_text: 'Never use placeholder text.' }]);
      expect(result).toContain('follow these rules');
      expect(result).toContain('1. Never use placeholder text.');
    });

    it('compiles multiple rules in order', () => {
      const result = compileRuleText([
        { rule_text: 'Rule one.' },
        { rule_text: 'Rule two.' },
        { rule_text: 'Rule three.' },
      ]);
      expect(result).toContain('1. Rule one.');
      expect(result).toContain('2. Rule two.');
      expect(result).toContain('3. Rule three.');
    });

    it('separates rules with double newlines', () => {
      const result = compileRuleText([{ rule_text: 'A.' }, { rule_text: 'B.' }]);
      expect(result).toContain('1. A.\n\n2. B.');
    });
  });

  describe('getGlobalStyleRules', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns user_prompt from the prompt registry', async () => {
      mockGetPrompt.mockResolvedValue({
        slug: 'global-style-rules',
        name: 'Global Style Rules',
        category: 'learning',
        description: '',
        system_prompt: '',
        user_prompt: '1. Never use placeholders.',
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        max_tokens: 0,
        variables: [],
        is_active: true,
        source: 'db' as const,
      });

      const result = await getGlobalStyleRules();
      expect(result).toBe('1. Never use placeholders.');
      expect(mockGetPrompt).toHaveBeenCalledWith('global-style-rules');
    });

    it('returns empty string when user_prompt is empty', async () => {
      mockGetPrompt.mockResolvedValue({
        slug: 'global-style-rules',
        name: 'Global Style Rules',
        category: 'learning',
        description: '',
        system_prompt: '',
        user_prompt: '',
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        max_tokens: 0,
        variables: [],
        is_active: true,
        source: 'db' as const,
      });

      const result = await getGlobalStyleRules();
      expect(result).toBe('');
    });

    it('returns empty string and logs error when prompt registry throws', async () => {
      mockGetPrompt.mockRejectedValue(new Error('No prompt found'));

      const result = await getGlobalStyleRules();
      expect(result).toBe('');
      expect(mockLogError).toHaveBeenCalledWith('style-rules', expect.any(Error), {
        slug: 'global-style-rules',
      });
    });
  });
});
