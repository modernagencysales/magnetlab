import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

/**
 * Builds a rich prompt section from a TeamVoiceProfile for injection into AI writing prompts.
 * Returns empty string if profile is null/undefined.
 */
export function buildVoicePromptSection(
  profile: TeamVoiceProfile | null | undefined,
  contentType: 'linkedin' | 'email'
): string {
  if (!profile) return '';

  const sections: string[] = [];

  sections.push('## Writing Style (learned from author edits)');

  if (profile.tone) sections.push(`Tone: ${profile.tone}`);

  if (profile.vocabulary_preferences) {
    const { avoid, prefer } = profile.vocabulary_preferences;
    if (avoid?.length) sections.push(`Vocabulary: AVOID: ${avoid.join(', ')}`);
    if (prefer?.length) sections.push(`Vocabulary: PREFER: ${prefer.join(', ')}`);
  }

  if (profile.banned_phrases?.length) {
    sections.push(`NEVER use these phrases: ${profile.banned_phrases.join(', ')}`);
  }

  const structurePatterns = profile.structure_patterns?.[contentType];
  if (structurePatterns?.length) {
    sections.push(`Structure (${contentType}): ${structurePatterns.join('. ')}`);
  }

  if (profile.cta_style) sections.push(`CTA style: ${profile.cta_style}`);

  const lengthTarget = profile.content_length?.[contentType];
  if (lengthTarget) sections.push(`Length target: ${lengthTarget}`);

  if (profile.storytelling_style) sections.push(`Storytelling: ${profile.storytelling_style}`);

  if (profile.edit_patterns?.length) {
    sections.push('\n## Learned patterns (from recent edits):');
    const topPatterns = profile.edit_patterns
      .filter(p => p.confidence >= 0.3)
      .slice(0, 5);
    for (const p of topPatterns) {
      sections.push(`- ${p.description} (${p.count}x, confidence: ${(p.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (profile.positive_examples?.length) {
    sections.push('\n## Approved examples (author marked "Good as-is"):');
    sections.push(`${profile.positive_examples.length} examples on file — match this quality.`);
  }

  return sections.join('\n');
}
