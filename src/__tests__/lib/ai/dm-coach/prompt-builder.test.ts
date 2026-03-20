/**
 * Tests for DM Coach prompt builder.
 * Validates that the built prompt contains required framework sections,
 * goal-specific coaching, stage context, and conversation history.
 */

import { buildDmCoachPrompt } from '@/lib/ai/dm-coach/prompt-builder';
import type { DmCoachPromptParams } from '@/lib/ai/dm-coach/prompt-builder';

// ─── Base Params ─────────────────────────────────────────────────────────

const baseParams: DmCoachPromptParams = {
  contactName: 'John Smith',
  contactHeadline: 'CEO at TechCo',
  contactCompany: 'TechCo',
  contactLocation: 'San Francisco',
  conversationHistory: [
    {
      role: 'them' as const,
      content: 'Hey, saw your post about AI tools',
      timestamp: '2026-03-20T10:00:00Z',
    },
    {
      role: 'me' as const,
      content: 'Thanks! What caught your eye?',
      timestamp: '2026-03-20T10:05:00Z',
    },
  ],
  conversationGoal: 'book_meeting' as const,
  currentStage: 'situation' as const,
};

// ─── System Prompt Sections ──────────────────────────────────────────────

describe('buildDmCoachPrompt', () => {
  describe('system prompt sections', () => {
    it('should contain the cardinal rule (style matching)', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('CARDINAL RULE');
      expect(prompt).toContain('STYLE MATCHING');
      expect(prompt).toContain('analyze their exact style');
    });

    it('should contain the core framework', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('CORE FRAMEWORK');
      expect(prompt).toContain('Acknowledge & Listen');
      expect(prompt).toContain('Add Value');
      expect(prompt).toContain('Ask One Clear Question');
    });

    it('should contain the qualification ladder', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('QUALIFICATION LADDER');
      expect(prompt).toContain('Situation');
      expect(prompt).toContain('Pain');
      expect(prompt).toContain('Impact');
      expect(prompt).toContain('Vision');
      expect(prompt).toContain('Capability');
      expect(prompt).toContain('Commitment');
    });

    it('should contain the objection handling section', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('OBJECTION HANDLING');
      expect(prompt).toContain('Acknowledge without "but"');
      expect(prompt).toContain("This isn't the right time");
    });

    it('should contain the negative signals section', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('NEGATIVE SIGNALS');
      expect(prompt).toContain('not interested');
      expect(prompt).toContain('stop messaging');
    });
  });

  // ─── Goal-Specific Coaching ────────────────────────────────────────────

  describe('goal-specific coaching', () => {
    it('should inject coaching for book_meeting', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('GOAL: BOOK A MEETING');
      expect(prompt).toContain('Pain, Impact, and Capability');
      expect(prompt).toContain('premature meeting ask');
    });

    it('should inject coaching for build_relationship', () => {
      const prompt = buildDmCoachPrompt({
        ...baseParams,
        conversationGoal: 'build_relationship',
      });

      expect(prompt).toContain('GOAL: BUILD RELATIONSHIP');
      expect(prompt).toContain('genuine human connection');
      expect(prompt).toContain('NEVER suggest a sales call');
    });

    it('should inject coaching for promote_content', () => {
      const prompt = buildDmCoachPrompt({
        ...baseParams,
        conversationGoal: 'promote_content',
      });

      expect(prompt).toContain('GOAL: PROMOTE CONTENT');
      expect(prompt).toContain('ONE share per conversation');
      expect(prompt).toContain('thought you might find this useful');
    });
  });

  // ─── Stage Context ─────────────────────────────────────────────────────

  describe('stage context', () => {
    it('should include current stage context', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('CURRENT QUALIFICATION STAGE');
      expect(prompt).toContain('**Situation** stage');
      expect(prompt).toContain('Understanding their current state');
    });

    it('should include question themes for the current stage', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('role');
      expect(prompt).toContain('day-to-day');
      expect(prompt).toContain('tools');
      expect(prompt).toContain('team size');
    });

    it('should handle unknown stage with start instructions', () => {
      const prompt = buildDmCoachPrompt({
        ...baseParams,
        currentStage: 'unknown',
      });

      expect(prompt).toContain('**New** stage');
      expect(prompt).toContain('Start with Situation questions');
    });
  });

  // ─── Conversation Context ──────────────────────────────────────────────

  describe('conversation context', () => {
    it('should include contact info', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('**Contact:** John Smith');
      expect(prompt).toContain('**Headline:** CEO at TechCo');
      expect(prompt).toContain('**Company:** TechCo');
      expect(prompt).toContain('**Location:** San Francisco');
    });

    it('should include conversation history', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('[John]: Hey, saw your post about AI tools');
      expect(prompt).toContain('[You]: Thanks! What caught your eye?');
    });

    it('should include goal label and description in context', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('**Conversation Goal:** Book a Meeting');
      expect(prompt).toContain('Get them on a discovery call');
    });
  });

  // ─── Output Format ─────────────────────────────────────────────────────

  describe('output format', () => {
    it('should include output format instructions', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('OUTPUT FORMAT');
      expect(prompt).toContain('**Style analysis**');
      expect(prompt).toContain('**Stage**');
      expect(prompt).toContain('**Signals**');
      expect(prompt).toContain('**Suggested response**');
      expect(prompt).toContain('**Why this response**');
    });
  });

  // ─── Coaching Emphasis ─────────────────────────────────────────────────

  describe('coaching emphasis', () => {
    it('should contain coaching emphasis (teaches why)', () => {
      const prompt = buildDmCoachPrompt(baseParams);

      expect(prompt).toContain('COACH');
      expect(prompt).toContain('explain your reasoning');
      expect(prompt).toContain('TEACH');
    });
  });
});
