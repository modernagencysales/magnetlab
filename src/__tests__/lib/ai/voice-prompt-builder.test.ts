/**
 * @jest-environment node
 */

import { buildVoicePromptSection } from '@/lib/ai/content-pipeline/voice-prompt-builder';
import type { TeamVoiceProfile, EditPattern } from '@/lib/types/content-pipeline';

describe('buildVoicePromptSection', () => {
  // ----------------------------------------
  // Null / undefined / empty
  // ----------------------------------------

  it('returns empty string for null profile', () => {
    expect(buildVoicePromptSection(null, 'linkedin')).toBe('');
  });

  it('returns empty string for undefined profile', () => {
    expect(buildVoicePromptSection(undefined, 'email')).toBe('');
  });

  it('returns just the header for an empty profile object', () => {
    const profile: TeamVoiceProfile = {};
    const result = buildVoicePromptSection(profile, 'linkedin');
    expect(result).toBe('## Writing Style (learned from author edits)');
  });

  // ----------------------------------------
  // Full profile
  // ----------------------------------------

  it('includes all sections for a full voice profile', () => {
    const profile: TeamVoiceProfile = {
      tone: 'conversational and direct',
      vocabulary_preferences: {
        avoid: ['synergy', 'leverage'],
        prefer: ['practical', 'results'],
      },
      banned_phrases: ['game-changer', 'deep dive'],
      structure_patterns: {
        linkedin: ['Start with a bold claim', 'End with a question'],
        email: ['Open with a story', 'Close with CTA'],
      },
      cta_style: 'Soft ask, no hype',
      content_length: {
        linkedin: '200-400 words',
        email: '100-200 words',
      },
      storytelling_style: 'Personal anecdotes with lessons',
      edit_patterns: [
        {
          pattern: 'shortened_hook',
          description: 'Shortened the opening hook',
          confidence: 0.8,
          count: 5,
          first_seen: '2026-02-01',
          last_seen: '2026-02-20',
        },
      ],
      positive_examples: [
        { content_id: 'post-1', type: 'linkedin_post', note: 'Great tone' },
        { content_id: 'post-2', type: 'linkedin_post', note: 'Perfect CTA' },
      ],
    };

    const result = buildVoicePromptSection(profile, 'linkedin');

    expect(result).toContain('## Writing Style (learned from author edits)');
    expect(result).toContain('Tone: conversational and direct');
    expect(result).toContain('Vocabulary: AVOID: synergy, leverage');
    expect(result).toContain('Vocabulary: PREFER: practical, results');
    expect(result).toContain('NEVER use these phrases: game-changer, deep dive');
    expect(result).toContain('Structure (linkedin): Start with a bold claim. End with a question');
    expect(result).toContain('CTA style: Soft ask, no hype');
    expect(result).toContain('Length target: 200-400 words');
    expect(result).toContain('Storytelling: Personal anecdotes with lessons');
    expect(result).toContain('Shortened the opening hook (5x, confidence: 80%)');
    expect(result).toContain('2 examples on file');
  });

  // ----------------------------------------
  // LinkedIn vs email content type
  // ----------------------------------------

  it('picks linkedin structure_patterns for linkedin contentType', () => {
    const profile: TeamVoiceProfile = {
      structure_patterns: {
        linkedin: ['Hook first', 'CTA at end'],
        email: ['Subject line first', 'PS line'],
      },
      content_length: {
        linkedin: '300 words',
        email: '150 words',
      },
    };

    const result = buildVoicePromptSection(profile, 'linkedin');

    expect(result).toContain('Structure (linkedin): Hook first. CTA at end');
    expect(result).toContain('Length target: 300 words');
    expect(result).not.toContain('Subject line first');
    expect(result).not.toContain('150 words');
  });

  it('picks email structure_patterns for email contentType', () => {
    const profile: TeamVoiceProfile = {
      structure_patterns: {
        linkedin: ['Hook first', 'CTA at end'],
        email: ['Subject line first', 'PS line'],
      },
      content_length: {
        linkedin: '300 words',
        email: '150 words',
      },
    };

    const result = buildVoicePromptSection(profile, 'email');

    expect(result).toContain('Structure (email): Subject line first. PS line');
    expect(result).toContain('Length target: 150 words');
    expect(result).not.toContain('Hook first');
    expect(result).not.toContain('300 words');
  });

  // ----------------------------------------
  // Edit patterns filtering
  // ----------------------------------------

  it('filters edit patterns by confidence >= 0.3', () => {
    const profile: TeamVoiceProfile = {
      edit_patterns: [
        {
          pattern: 'high_confidence',
          description: 'High confidence pattern',
          confidence: 0.8,
          count: 10,
          first_seen: '2026-02-01',
          last_seen: '2026-02-20',
        },
        {
          pattern: 'threshold',
          description: 'Exactly at threshold',
          confidence: 0.3,
          count: 3,
          first_seen: '2026-02-01',
          last_seen: '2026-02-20',
        },
        {
          pattern: 'low_confidence',
          description: 'Below threshold',
          confidence: 0.29,
          count: 2,
          first_seen: '2026-02-01',
          last_seen: '2026-02-20',
        },
        {
          pattern: 'zero_confidence',
          description: 'Zero confidence',
          confidence: 0,
          count: 1,
          first_seen: '2026-02-01',
          last_seen: '2026-02-20',
        },
      ],
    };

    const result = buildVoicePromptSection(profile, 'linkedin');

    expect(result).toContain('High confidence pattern (10x, confidence: 80%)');
    expect(result).toContain('Exactly at threshold (3x, confidence: 30%)');
    expect(result).not.toContain('Below threshold');
    expect(result).not.toContain('Zero confidence');
  });

  it('only includes top 5 edit patterns', () => {
    const patterns: EditPattern[] = [];
    for (let i = 0; i < 8; i++) {
      patterns.push({
        pattern: `pattern_${i}`,
        description: `Pattern number ${i}`,
        confidence: 0.9 - i * 0.05,
        count: 10 - i,
        first_seen: '2026-02-01',
        last_seen: '2026-02-20',
      });
    }

    const profile: TeamVoiceProfile = { edit_patterns: patterns };
    const result = buildVoicePromptSection(profile, 'linkedin');

    // First 5 should be included
    expect(result).toContain('Pattern number 0');
    expect(result).toContain('Pattern number 1');
    expect(result).toContain('Pattern number 2');
    expect(result).toContain('Pattern number 3');
    expect(result).toContain('Pattern number 4');
    // 6th, 7th, 8th should not be included
    expect(result).not.toContain('Pattern number 5');
    expect(result).not.toContain('Pattern number 6');
    expect(result).not.toContain('Pattern number 7');
  });

  // ----------------------------------------
  // Positive examples count
  // ----------------------------------------

  it('displays positive examples count', () => {
    const profile: TeamVoiceProfile = {
      positive_examples: [
        { content_id: 'a', type: 'post', note: 'good' },
        { content_id: 'b', type: 'post', note: 'great' },
        { content_id: 'c', type: 'post', note: 'perfect' },
      ],
    };

    const result = buildVoicePromptSection(profile, 'linkedin');

    expect(result).toContain('## Approved examples');
    expect(result).toContain('3 examples on file');
  });

  it('does not show positive examples section when array is empty', () => {
    const profile: TeamVoiceProfile = {
      positive_examples: [],
    };

    const result = buildVoicePromptSection(profile, 'linkedin');

    expect(result).not.toContain('Approved examples');
  });

  // ----------------------------------------
  // Partial profiles
  // ----------------------------------------

  it('handles profile with only tone', () => {
    const profile: TeamVoiceProfile = { tone: 'witty' };
    const result = buildVoicePromptSection(profile, 'linkedin');
    expect(result).toContain('Tone: witty');
    expect(result).not.toContain('Vocabulary');
    expect(result).not.toContain('NEVER use');
  });

  it('handles vocabulary_preferences with only avoid list', () => {
    const profile: TeamVoiceProfile = {
      vocabulary_preferences: { avoid: ['buzzwords'], prefer: [] },
    };
    const result = buildVoicePromptSection(profile, 'linkedin');
    expect(result).toContain('Vocabulary: AVOID: buzzwords');
    expect(result).not.toContain('Vocabulary: PREFER');
  });

  it('handles vocabulary_preferences with only prefer list', () => {
    const profile: TeamVoiceProfile = {
      vocabulary_preferences: { avoid: [], prefer: ['actionable'] },
    };
    const result = buildVoicePromptSection(profile, 'linkedin');
    expect(result).not.toContain('Vocabulary: AVOID');
    expect(result).toContain('Vocabulary: PREFER: actionable');
  });

  it('handles empty edit_patterns array', () => {
    const profile: TeamVoiceProfile = {
      edit_patterns: [],
    };
    const result = buildVoicePromptSection(profile, 'linkedin');
    expect(result).not.toContain('Learned patterns');
  });

  it('handles structure_patterns for other content type being empty', () => {
    const profile: TeamVoiceProfile = {
      structure_patterns: {
        linkedin: ['Bold hook'],
        email: [],
      },
    };

    const resultLinkedin = buildVoicePromptSection(profile, 'linkedin');
    expect(resultLinkedin).toContain('Structure (linkedin): Bold hook');

    const resultEmail = buildVoicePromptSection(profile, 'email');
    expect(resultEmail).not.toContain('Structure');
  });
});
