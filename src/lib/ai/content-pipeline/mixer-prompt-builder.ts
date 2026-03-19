/** Mixer prompt builder. Constructs prompts from selected ingredients. Never imports from Next.js, React, or Supabase. Pure function. */

import type { StyleProfile, TeamVoiceProfile } from '@/lib/types/content-pipeline';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MixerPromptInput {
  exploit?: {
    name: string;
    description: string;
    example_posts: string[];
    prompt_template?: string;
  };
  knowledge?: {
    topic: string;
    entries: Array<{ content: string; context?: string }>;
  };
  style?: {
    style_profile: StyleProfile;
    example_posts?: string[];
  };
  teamVoiceProfile?: TeamVoiceProfile;
  template?: {
    name: string;
    structure: string;
    example_posts?: string[];
  };
  creative?: {
    content_text: string;
    source_platform?: string;
  };
  trend?: {
    topic: string;
    context?: string;
  };
  recycled?: {
    content: string;
    engagement_stats?: string;
  };
  idea?: {
    title: string;
    core_insight: string;
    key_points?: string[];
  };
  hook?: string;
  instructions?: string;
  count: number;
  output: 'drafts' | 'ideas';
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function buildExploitSection(exploit: NonNullable<MixerPromptInput['exploit']>): string {
  const parts: string[] = [];
  parts.push(`\n## FORMAT (Exploit)\nUse this proven content format as the structural backbone.\n`);
  parts.push(`Name: ${exploit.name}`);
  parts.push(`How it works: ${exploit.description}`);
  if (exploit.prompt_template) {
    parts.push(`Template guidance: ${exploit.prompt_template}`);
  }
  if (exploit.example_posts.length > 0) {
    parts.push(`\nExample posts using this format:`);
    exploit.example_posts.forEach((post, i) => {
      parts.push(`\n--- Example ${i + 1} ---\n${post}`);
    });
  }
  return parts.join('\n');
}

function buildKnowledgeSection(knowledge: NonNullable<MixerPromptInput['knowledge']>): string {
  const parts: string[] = [];
  parts.push(
    `\n## SUBSTANCE (Knowledge)\nDraw on this specific knowledge as the source of truth for the post.\n`
  );
  parts.push(`Topic: ${knowledge.topic}`);
  parts.push(`\nKnowledge entries:`);
  knowledge.entries.forEach((entry, i) => {
    parts.push(`\n[${i + 1}] ${entry.content}`);
    if (entry.context) {
      parts.push(`    Context: ${entry.context}`);
    }
  });
  return parts.join('\n');
}

function buildTemplateSection(template: NonNullable<MixerPromptInput['template']>): string {
  const parts: string[] = [];
  parts.push(
    `\n## STRUCTURE (Template)\nUse this structural template as a loose guide — adapt it, don't copy it.\n`
  );
  parts.push(`Template: ${template.name}`);
  parts.push(`Structure:\n${template.structure}`);
  if (template.example_posts && template.example_posts.length > 0) {
    parts.push(`\nTemplate examples:`);
    template.example_posts.forEach((post, i) => {
      parts.push(`\n--- Example ${i + 1} ---\n${post}`);
    });
  }
  return parts.join('\n');
}

function buildCreativeSection(creative: NonNullable<MixerPromptInput['creative']>): string {
  const parts: string[] = [];
  parts.push(
    `\n## INSPIRATION (Creative)\nUse this content as creative inspiration — extract patterns, angles, or approaches. Do not copy.\n`
  );
  if (creative.source_platform) {
    parts.push(`Source: ${creative.source_platform}`);
  }
  parts.push(`\n${creative.content_text}`);
  return parts.join('\n');
}

function buildTrendSection(trend: NonNullable<MixerPromptInput['trend']>): string {
  const parts: string[] = [];
  parts.push(
    `\n## TIMING (Trend)\nThis post should feel timely and connected to current conversation.\n`
  );
  parts.push(`Trending topic: ${trend.topic}`);
  if (trend.context) {
    parts.push(`Context: ${trend.context}`);
  }
  return parts.join('\n');
}

function buildRecycledSection(recycled: NonNullable<MixerPromptInput['recycled']>): string {
  const parts: string[] = [];
  parts.push(
    `\n## REMIX (Recycled Content)\nRemix this existing post with a fresh angle. Same core insight, different presentation.\n`
  );
  parts.push(`Original content:\n${recycled.content}`);
  if (recycled.engagement_stats) {
    parts.push(`\nEngagement stats: ${recycled.engagement_stats}`);
  }
  return parts.join('\n');
}

function buildIdeaSection(idea: NonNullable<MixerPromptInput['idea']>): string {
  const parts: string[] = [];
  parts.push(`\n## IDEA\nBuild this post around the following idea.\n`);
  parts.push(`Title: ${idea.title}`);
  parts.push(`Core insight: ${idea.core_insight}`);
  if (idea.key_points && idea.key_points.length > 0) {
    parts.push(`Key points:\n${idea.key_points.map((p) => `- ${p}`).join('\n')}`);
  }
  return parts.join('\n');
}

function buildOutputFormat(count: number, output: 'drafts' | 'ideas'): string {
  if (output === 'ideas') {
    return `
## Output Format
Return a JSON array of exactly ${count} idea object(s). Each object:
{
  "title": "short descriptive title",
  "core_insight": "the central idea in 1-2 sentences",
  "hook": "proposed first line",
  "key_points": ["point 1", "point 2", "point 3"],
  "content_type": "story | insight | tip | framework | case_study | question | listicle | contrarian",
  "relevance_score": 0.0-1.0
}

Return ONLY the JSON array. No preamble, no explanation.`;
  }

  return `
## Output Format
Return a JSON array of exactly ${count} draft post(s). Each object:
{
  "content": "the full post text, ready to publish",
  "hook_type": "brief label for the hook approach used",
  "angle": "1-sentence summary of the angle taken"
}

Return ONLY the JSON array. No preamble, no explanation.`;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

/**
 * Builds a voice section from a StyleProfile and/or TeamVoiceProfile.
 * TeamVoiceProfile takes precedence and is marked with [Override].
 * Returns empty string when both args are undefined or null.
 */
export function buildMixerVoiceSection(
  style?: MixerPromptInput['style'],
  teamVoice?: TeamVoiceProfile
): string {
  if (!style && !teamVoice) return '';

  const parts: string[] = [];
  parts.push(`\n## VOICE\n`);

  if (style) {
    const { style_profile, example_posts } = style;

    parts.push(`Tone: ${style_profile.tone}`);
    parts.push(`Sentence length: ${style_profile.sentence_length}`);
    parts.push(`Vocabulary level: ${style_profile.vocabulary}`);

    const fmt = style_profile.formatting;
    const fmtRules: string[] = [];
    if (fmt.uses_emojis) fmtRules.push('uses emojis');
    if (!fmt.uses_emojis) fmtRules.push('no emojis');
    if (fmt.uses_line_breaks) fmtRules.push('uses line breaks');
    if (fmt.uses_lists) fmtRules.push('uses lists');
    if (fmt.uses_bold) fmtRules.push('uses bold');
    if (fmtRules.length > 0) {
      parts.push(`Formatting: ${fmtRules.join(', ')}`);
    }
    parts.push(`Avg paragraphs: ${fmt.avg_paragraphs}`);

    if (style_profile.hook_patterns.length > 0) {
      parts.push(`Hook patterns: ${style_profile.hook_patterns.join('; ')}`);
    }
    if (style_profile.cta_patterns.length > 0) {
      parts.push(`CTA patterns: ${style_profile.cta_patterns.join('; ')}`);
    }
    if (style_profile.banned_phrases.length > 0) {
      parts.push(`Banned phrases (never use): ${style_profile.banned_phrases.join(', ')}`);
    }
    if (style_profile.signature_phrases.length > 0) {
      parts.push(
        `Signature phrases (use naturally): ${style_profile.signature_phrases.join(', ')}`
      );
    }

    if (example_posts && example_posts.length > 0) {
      parts.push(`\nStyle examples:`);
      example_posts.forEach((post, i) => {
        parts.push(`\n--- Example ${i + 1} ---\n${post}`);
      });
    }
  }

  if (teamVoice) {
    parts.push(`\n[Override] Author-specific voice (takes precedence over style above):`);

    if (teamVoice.tone) {
      parts.push(`[Override] Tone: ${teamVoice.tone}`);
    }
    if (teamVoice.first_person_context) {
      parts.push(`[Override] First-person context: ${teamVoice.first_person_context}`);
    }
    if (teamVoice.perspective_notes) {
      parts.push(`[Override] Perspective: ${teamVoice.perspective_notes}`);
    }
    if (teamVoice.storytelling_style) {
      parts.push(`[Override] Storytelling style: ${teamVoice.storytelling_style}`);
    }
    if (teamVoice.signature_phrases?.length) {
      parts.push(
        `[Override] Signature phrases (use naturally): ${teamVoice.signature_phrases.join(', ')}`
      );
    }
    if (teamVoice.banned_phrases?.length) {
      parts.push(`[Override] Banned phrases (never use): ${teamVoice.banned_phrases.join(', ')}`);
    }
    if (teamVoice.hook_patterns?.length) {
      parts.push(`[Override] Hook patterns: ${teamVoice.hook_patterns.join('; ')}`);
    }
    if (teamVoice.industry_jargon?.length) {
      parts.push(`[Override] Domain terms: ${teamVoice.industry_jargon.join(', ')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Builds the full mixer prompt from selected ingredients.
 * Each ingredient type contributes a labeled section.
 * baseStyleGuidelines (from getBaseStyleGuidelines()) is always appended.
 */
export function buildMixerPrompt(input: MixerPromptInput, baseStyleGuidelines: string): string {
  const parts: string[] = [];

  // System section
  parts.push(
    `You are a LinkedIn content specialist. You will generate ${
      input.output === 'ideas' ? 'content ideas' : 'post drafts'
    } by combining the provided ingredients.`
  );
  parts.push(
    `Each ingredient plays a specific role. Blend them — don't just list them. The result should feel like one cohesive piece of content, not a mashup of parts.`
  );

  // Ingredient sections (each conditional)
  if (input.exploit) {
    parts.push(buildExploitSection(input.exploit));
  }
  if (input.knowledge) {
    parts.push(buildKnowledgeSection(input.knowledge));
  }
  if (input.idea) {
    parts.push(buildIdeaSection(input.idea));
  }

  const voiceSection = buildMixerVoiceSection(input.style, input.teamVoiceProfile);
  if (voiceSection) {
    parts.push(voiceSection);
  }

  if (input.template) {
    parts.push(buildTemplateSection(input.template));
  }
  if (input.creative) {
    parts.push(buildCreativeSection(input.creative));
  }
  if (input.trend) {
    parts.push(buildTrendSection(input.trend));
  }
  if (input.recycled) {
    parts.push(buildRecycledSection(input.recycled));
  }

  if (input.hook) {
    parts.push(`\n## HOOK\nUse this as the opening line (or adapt it closely):\n${input.hook}`);
  }
  if (input.instructions) {
    parts.push(`\n## ADDITIONAL DIRECTION\n${input.instructions}`);
  }

  // Base style guidelines always last before output format
  parts.push(`\n## Base Style Guidelines\n${baseStyleGuidelines}`);

  // Output format
  parts.push(buildOutputFormat(input.count, input.output));

  return parts.join('\n');
}
