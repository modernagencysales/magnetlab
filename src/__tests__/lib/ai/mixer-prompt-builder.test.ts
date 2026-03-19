/**
 * @jest-environment node
 */

import {
  buildMixerPrompt,
  buildMixerVoiceSection,
} from '@/lib/ai/content-pipeline/mixer-prompt-builder';
import type { MixerPromptInput } from '@/lib/ai/content-pipeline/mixer-prompt-builder';
import type { StyleProfile, TeamVoiceProfile } from '@/lib/types/content-pipeline';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseStyleGuidelines = 'Write clearly and conversationally.';

const exploit: NonNullable<MixerPromptInput['exploit']> = {
  name: 'The Counterintuitive Truth',
  description: 'State something that sounds wrong but is actually right.',
  example_posts: ['Most agencies fail not because of bad delivery but because of bad positioning.'],
};

const knowledge: NonNullable<MixerPromptInput['knowledge']> = {
  topic: 'Agency positioning',
  entries: [
    { content: 'Niching down by 80% increased close rate by 3x.', context: 'From discovery call' },
    { content: 'Generalist agencies compete on price. Specialists compete on expertise.' },
  ],
};

const styleProfile: StyleProfile = {
  tone: 'conversational',
  sentence_length: 'short',
  vocabulary: 'simple',
  formatting: {
    uses_emojis: false,
    uses_line_breaks: true,
    uses_lists: false,
    uses_bold: false,
    avg_paragraphs: 5,
  },
  hook_patterns: ['Start with a bold claim', 'Lead with a number'],
  cta_patterns: ['Soft ask: "What\'s your take?"'],
  banned_phrases: ['game-changer', 'deep dive'],
  signature_phrases: ["Here's what I know for sure"],
};

const teamVoice: TeamVoiceProfile = {
  tone: 'direct and no-BS',
  signature_phrases: ['No fluff'],
  banned_phrases: ['synergy'],
  hook_patterns: ['Open with a result'],
};

// ─── buildMixerPrompt ────────────────────────────────────────────────────────

describe('buildMixerPrompt', () => {
  it('builds prompt with single exploit ingredient — contains FORMAT, not SUBSTANCE or VOICE', () => {
    const input: MixerPromptInput = {
      exploit,
      count: 1,
      output: 'drafts',
    };

    const result = buildMixerPrompt(input, baseStyleGuidelines);

    expect(result).toContain('FORMAT');
    expect(result).toContain('The Counterintuitive Truth');
    expect(result).toContain('State something that sounds wrong');
    expect(result).not.toContain('SUBSTANCE');
    expect(result).not.toContain('VOICE');
  });

  it('builds prompt with multiple ingredients — contains FORMAT + SUBSTANCE + ADDITIONAL DIRECTION', () => {
    const input: MixerPromptInput = {
      exploit,
      knowledge,
      instructions: 'Keep it under 300 words.',
      count: 2,
      output: 'drafts',
    };

    const result = buildMixerPrompt(input, baseStyleGuidelines);

    expect(result).toContain('FORMAT');
    expect(result).toContain('SUBSTANCE');
    expect(result).toContain('ADDITIONAL DIRECTION');
    expect(result).toContain('Keep it under 300 words.');
    expect(result).toContain('Agency positioning');
    expect(result).toContain('Niching down by 80%');
  });

  it('builds ideas output format — contains "ideas" and "relevance_score"', () => {
    const input: MixerPromptInput = {
      knowledge,
      count: 3,
      output: 'ideas',
    };

    const result = buildMixerPrompt(input, baseStyleGuidelines);

    expect(result).toContain('ideas');
    expect(result).toContain('relevance_score');
    expect(result).toContain('core_insight');
    // Should NOT contain the drafts-only field
    expect(result).not.toContain('"angle"');
  });

  it('includes all sections when all ingredients are provided', () => {
    const input: MixerPromptInput = {
      exploit,
      knowledge,
      style: { style_profile: styleProfile, example_posts: ['An example post here.'] },
      teamVoiceProfile: teamVoice,
      template: {
        name: 'Story Arc',
        structure: 'Hook → Conflict → Resolution → CTA',
        example_posts: ['Example template post.'],
      },
      creative: { content_text: 'Some viral post text.', source_platform: 'LinkedIn' },
      trend: { topic: 'AI taking over agency work', context: 'Lots of discussion in March 2026' },
      recycled: { content: 'Old post about pricing strategy.', engagement_stats: '200 likes' },
      idea: {
        title: 'Why most agencies underprice',
        core_insight: 'Fear-based pricing destroys margins.',
        key_points: ['Clients pay for outcomes', 'Positioning sets price anchors'],
      },
      hook: 'Most agencies leave $10k/month on the table.',
      instructions: 'Be direct. No hedging.',
      count: 2,
      output: 'drafts',
    };

    const result = buildMixerPrompt(input, baseStyleGuidelines);

    expect(result).toContain('FORMAT');
    expect(result).toContain('SUBSTANCE');
    expect(result).toContain('VOICE');
    expect(result).toContain('STRUCTURE');
    expect(result).toContain('INSPIRATION');
    expect(result).toContain('TIMING');
    expect(result).toContain('REMIX');
    expect(result).toContain('IDEA');
    expect(result).toContain('HOOK');
    expect(result).toContain('ADDITIONAL DIRECTION');
    expect(result).toContain(baseStyleGuidelines);
  });
});

// ─── buildMixerVoiceSection ──────────────────────────────────────────────────

describe('buildMixerVoiceSection', () => {
  it('builds from StyleProfile only — contains tone, banned phrases, hook patterns', () => {
    const result = buildMixerVoiceSection({ style_profile: styleProfile }, undefined);

    expect(result).toContain('VOICE');
    expect(result).toContain('conversational'); // tone
    expect(result).toContain('game-changer'); // banned phrase
    expect(result).toContain('deep dive'); // banned phrase
    expect(result).toContain('Start with a bold claim'); // hook pattern
    expect(result).toContain("Here's what I know for sure"); // signature phrase
    // Should not contain [Override] labels since no teamVoice
    expect(result).not.toContain('[Override]');
  });

  it('merges TeamVoiceProfile with [Override] precedence markers', () => {
    const result = buildMixerVoiceSection({ style_profile: styleProfile }, teamVoice);

    expect(result).toContain('VOICE');
    // StyleProfile fields
    expect(result).toContain('conversational');
    // TeamVoiceProfile fields marked as override
    expect(result).toContain('[Override]');
    expect(result).toContain('[Override] Tone: direct and no-BS');
    expect(result).toContain('[Override] Banned phrases (never use): synergy');
    expect(result).toContain('[Override] Hook patterns: Open with a result');
  });

  it('returns empty string when both args are undefined', () => {
    expect(buildMixerVoiceSection(undefined, undefined)).toBe('');
  });

  it('returns empty string when both args are null-equivalent (not provided)', () => {
    // Calling with no arguments (both default to undefined)
    expect(buildMixerVoiceSection()).toBe('');
  });

  it('builds from TeamVoiceProfile only when style is undefined', () => {
    const result = buildMixerVoiceSection(undefined, teamVoice);

    expect(result).toContain('VOICE');
    expect(result).toContain('[Override]');
    expect(result).toContain('[Override] Tone: direct and no-BS');
    expect(result).toContain('[Override] Banned phrases (never use): synergy');
  });
});
