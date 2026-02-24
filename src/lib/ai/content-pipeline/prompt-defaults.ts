// src/lib/ai/content-pipeline/prompt-defaults.ts
//
// Hardcoded prompt defaults — used as fallback when DB prompt is inactive or missing.
// Each key is the prompt slug. Keep in sync with DB seeds.

export interface PromptVariable {
  name: string;
  description: string;
  example: string;
}

export interface PromptDefault {
  slug: string;
  name: string;
  category: 'content_writing' | 'knowledge' | 'learning' | 'email' | 'scoring';
  description: string;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  variables: PromptVariable[];
}

export const PROMPT_DEFAULTS: Record<string, PromptDefault> = {};

// ============================================
// style-guidelines
// Source: src/lib/ai/content-pipeline/post-writer.ts → getBaseStyleGuidelines()
// ============================================

PROMPT_DEFAULTS['style-guidelines'] = {
  slug: 'style-guidelines',
  name: 'Base Style Guidelines',
  category: 'content_writing',
  description:
    'Base writing style guidelines injected into post-writer and post-polish prompts. Used by getBaseStyleGuidelines().',
  system_prompt: '',
  user_prompt: `Voice:
- Direct, conversational, authoritative but not arrogant
- No-BS, results-focused, slightly contrarian
- Use industry jargon naturally to signal expertise
- Confident claims backed by specifics, not hype
- STRONG POINT OF VIEW. Take a stance. Have an opinion. Don't hedge.

Writing style (CRITICAL):
The goal is writing that sounds like a smart person explaining something to a peer. Not a copywriter. Not a LinkedIn guru. Not an AI.

Sentence construction: Most sentences should be real sentences with actual construction. Subject, verb, object. Clauses. Actual flow. Short punchy fragments are reserved for genuine dramatic moments only.

GOOD: "So now his only option is to cold email 12,000 people and ask them to join his list after they've already gotten what they wanted. He'll convert some percentage, but the leverage is gone."
BAD: "12,000 people. Cold email. No leverage. Gone."

Paragraph construction: Paragraphs should be 1-4 sentences. They should flow into each other.

Making points: Make your points through explanation and specifics. Do not make points through declaration, repetition, or rhythm.
BAD: "The lead magnet is not the point. The email list is the point."
GOOD: "The lead magnet was never supposed to be the deliverable. It's the exchange mechanism. Someone raises their hand, you send them to an opt-in page, they give you their email, and then they get access."

Forbidden patterns:
Phrases: "it all comes down to," "the secret is," "game-changer," "next level," "here's the thing," "here's the deal," "here's what most people miss," "let me explain," "the truth is," "the reality is," "killer," "insane," "crushing it," "absolute game-changer," "genius," "let's dive in," "let's go," "let's break it down," "don't wait," "stick with me"

Structures to avoid:
- Three-item dramatic lists: "Every X, every Y, every Z."
- Stacked one-liner declarations: "That's the game. That's it. Full stop."
- Repetition for emphasis: "Not one. Not two. Not three."
- Throat-clearing before a point: "Here's what most people don't realize:"

Formatting:
- Short paragraphs (1-4 sentences max)
- Strategic line breaks for emphasis, but not after every sentence
- Numbered lists only when teaching a process
- Occasional all-caps for ONE key word, not whole phrases
- No headers or bold text
- No emojis
- No em dashes. Use periods or commas instead.
- No hashtags

Hook requirements:
- First line must stop the scroll
- Use a number when possible
- Start with "I" about 70% of the time
- Make a bold claim OR present a result OR create a knowledge gap
- 1-2 sentences max`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 4000,
  variables: [],
};

// ============================================
// post-writer-freeform
// Source: src/lib/ai/content-pipeline/post-writer.ts → writePostFreeform()
// ============================================

PROMPT_DEFAULTS['post-writer-freeform'] = {
  slug: 'post-writer-freeform',
  name: 'Post Writer (Freeform)',
  category: 'content_writing',
  description:
    'Writes a LinkedIn post from a content idea using freeform style. Used by writePostFreeform().',
  system_prompt: '',
  user_prompt: `You are writing a LinkedIn post. Write the post without any preamble. Your first word is the first word of the post.

{{style_guidelines}}
{{voice_section}}
{{voice_style_section}}

Audience: {{target_audience}}
What this means for your writing:
- Match technical depth to their sophistication level
- Reference their specific reality and daily frustrations
- Don't write like you're introducing basic concepts
- Use "you" to speak directly to them
- If the post doesn't feel like it was written specifically for this person, rewrite it.

CONTEXT FOR THIS POST:
Title: {{idea_title}}
Core Insight: {{idea_core_insight}}
Full Context: {{idea_full_context}}
Why Post-Worthy: {{idea_why_post_worthy}}
Content Type: {{idea_content_type}}
{{knowledge_section}}
Using this context:
- Pull exact numbers and metrics
- Use the specific stories and examples provided. Do not generalize them.
- Include step-by-step details when a process is described
- Preserve memorable phrasing when it's strong

Post structure by type:
Story/Lesson: Hook with outcome > Setup situation > Mistake/turning point > Consequence > Takeaway
Framework/Process: Hook with result > Why it matters > Numbered steps with specifics
Contrarian/Reframe: Bold claim > What most people do wrong > Why it fails > What to do instead
Trend/Observation: Hook with shift > How it used to work > What changed > What to do

Length: Either SHORT (under 100 words, punchy, one idea) or LONG (300+ words, comprehensive). Pick based on how much substance the idea has.

Now write the post. Return ONLY valid JSON:
{
  "content": "The complete LinkedIn post",
  "variations": [
    {"id": "v1", "content": "Alternative version with different hook", "hook_type": "question|bold_statement|story|statistic", "selected": false},
    {"id": "v2", "content": "Second alternative version", "hook_type": "question|bold_statement|story|statistic", "selected": false}
  ],
  "dm_template": "Short DM (max 200 chars) using {first_name} and [LINK] placeholder",
  "cta_word": "simple keyword like interested, send, link"
}`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 4000,
  variables: [
    {
      name: 'style_guidelines',
      description: 'Base style guidelines from the style-guidelines prompt',
      example: 'Voice:\n- Direct, conversational...',
    },
    {
      name: 'voice_section',
      description:
        'Author voice section with first-person context, built by buildVoiceSection()',
      example:
        'YOU ARE WRITING AS: Tim Smith, CEO\nFIRST-PERSON CONTEXT: I run a B2B agency...',
    },
    {
      name: 'voice_style_section',
      description:
        'Learned writing style patterns from buildVoicePromptSection()',
      example: '## Writing Style (learned from author edits)\nTone: direct and conversational',
    },
    {
      name: 'target_audience',
      description: 'Target audience for the post',
      example: 'B2B professionals, agency owners, and marketers',
    },
    {
      name: 'idea_title',
      description: 'Title of the content idea',
      example: 'Why Most Lead Magnets Fail',
    },
    {
      name: 'idea_core_insight',
      description: 'Core insight of the content idea',
      example:
        'Lead magnets fail because they deliver the outcome instead of creating an exchange mechanism.',
    },
    {
      name: 'idea_full_context',
      description: 'Full context for the content idea',
      example: 'During our coaching call, we discussed how...',
    },
    {
      name: 'idea_why_post_worthy',
      description: 'Why this idea is worth posting about',
      example:
        'Contrarian take that challenges conventional wisdom about lead magnets.',
    },
    {
      name: 'idea_content_type',
      description: 'Type of content (story, framework, contrarian, etc.)',
      example: 'contrarian',
    },
    {
      name: 'knowledge_section',
      description:
        'Optional AI Brain knowledge context from calls (injected when available)',
      example:
        'KNOWLEDGE BASE CONTEXT (from your calls):\n- Client saw 3x conversion after switching...',
    },
  ],
};

// ============================================
// post-writer-template
// Source: src/lib/ai/content-pipeline/post-writer.ts → writePostWithTemplate()
// ============================================

PROMPT_DEFAULTS['post-writer-template'] = {
  slug: 'post-writer-template',
  name: 'Post Writer (Template)',
  category: 'content_writing',
  description:
    'Writes a LinkedIn post by combining a template with user-provided information. Used by writePostWithTemplate().',
  system_prompt: '',
  user_prompt: `You are creating a LinkedIn post by combining a template with user-provided information.

TEMPLATE:
{{template_structure}}

{{template_examples}}
{{voice_section}}
{{voice_style_section}}

CONTEXT FOR THIS POST:
Title: {{idea_title}}
Core Insight: {{idea_core_insight}}
Full Context: {{idea_full_context}}
Why Post-Worthy: {{idea_why_post_worthy}}
Content Type: {{idea_content_type}}
{{knowledge_section}}
Target Audience: {{target_audience}}

GUIDELINES:
- Start with a powerful, attention-grabbing hook
- Direct, conversational tone that's authoritative but not arrogant
- Include specific numbers and data points
- Short paragraphs, strategic line breaks
- Adhere strictly to the template format
- No emojis, hashtags, or em dashes
- Avoid cliches

Return ONLY valid JSON:
{
  "content": "The complete LinkedIn post following the template",
  "variations": [
    {"id": "v1", "content": "Alternative version with different hook", "hook_type": "question|bold_statement|story|statistic", "selected": false},
    {"id": "v2", "content": "Second alternative version", "hook_type": "question|bold_statement|story|statistic", "selected": false}
  ],
  "dm_template": "Short DM (max 200 chars) using {first_name} and [LINK] placeholder",
  "cta_word": "simple keyword like interested, send, link"
}`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 4000,
  variables: [
    {
      name: 'template_structure',
      description: 'The post template structure to follow',
      example:
        'Hook: [Bold claim with number]\n\nSetup: [1-2 sentences of context]\n\nSteps:\n1. ...',
    },
    {
      name: 'template_examples',
      description:
        'Example posts using this template (optional, up to 2 examples)',
      example:
        'EXAMPLE POSTS USING THIS TEMPLATE:\nI spent $50k on ads before I realized...',
    },
    {
      name: 'voice_section',
      description:
        'Author voice section with first-person context, built by buildVoiceSection()',
      example:
        'YOU ARE WRITING AS: Tim Smith, CEO\nFIRST-PERSON CONTEXT: I run a B2B agency...',
    },
    {
      name: 'voice_style_section',
      description:
        'Learned writing style patterns from buildVoicePromptSection()',
      example: '## Writing Style (learned from author edits)\nTone: direct and conversational',
    },
    {
      name: 'idea_title',
      description: 'Title of the content idea',
      example: 'Why Most Lead Magnets Fail',
    },
    {
      name: 'idea_core_insight',
      description: 'Core insight of the content idea',
      example:
        'Lead magnets fail because they deliver the outcome instead of creating an exchange mechanism.',
    },
    {
      name: 'idea_full_context',
      description: 'Full context for the content idea',
      example: 'During our coaching call, we discussed how...',
    },
    {
      name: 'idea_why_post_worthy',
      description: 'Why this idea is worth posting about',
      example:
        'Contrarian take that challenges conventional wisdom about lead magnets.',
    },
    {
      name: 'idea_content_type',
      description: 'Type of content (story, framework, contrarian, etc.)',
      example: 'contrarian',
    },
    {
      name: 'knowledge_section',
      description:
        'Optional AI Brain knowledge context from calls (injected when available)',
      example:
        'KNOWLEDGE BASE CONTEXT (from your calls):\n- Client saw 3x conversion after switching...',
    },
    {
      name: 'target_audience',
      description: 'Target audience for the post',
      example: 'B2B professionals, agency owners, and marketers',
    },
  ],
};

// ============================================
// post-rewrite-section
// Source: src/lib/ai/content-pipeline/post-writer.ts → rewriteSection()
// ============================================

PROMPT_DEFAULTS['post-rewrite-section'] = {
  slug: 'post-rewrite-section',
  name: 'Post Section Rewriter',
  category: 'content_writing',
  description:
    'Rewrites a specific section (hook, body, or CTA) of an existing LinkedIn post. Used by rewriteSection().',
  system_prompt: '',
  user_prompt: `{{section_instruction}}

CURRENT POST:
{{post_content}}

{{feedback_section}}

{{style_guidelines}}

Return ONLY the complete rewritten post (not just the changed section).`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 2000,
  variables: [
    {
      name: 'section_instruction',
      description:
        'Instruction for which section to rewrite. One of: "Rewrite just the opening/hook (first 1-2 sentences) to be more attention-grabbing.", "Rewrite the main body while keeping the same hook and CTA.", "Rewrite just the call-to-action at the end to be more engaging."',
      example:
        'Rewrite just the opening/hook (first 1-2 sentences) to be more attention-grabbing.',
    },
    {
      name: 'post_content',
      description: 'The current complete post text',
      example: 'I spent $50k on LinkedIn ads last year.\n\nHere is what I learned...',
    },
    {
      name: 'feedback_section',
      description: 'Optional feedback from the user about the rewrite',
      example: 'FEEDBACK: Make the hook more specific with a dollar amount',
    },
    {
      name: 'style_guidelines',
      description: 'Base style guidelines from the style-guidelines prompt',
      example: 'Voice:\n- Direct, conversational...',
    },
  ],
};

// ============================================
// banned-ai-phrases
// Source: src/lib/ai/content-pipeline/post-polish.ts → AI_PHRASES array
// ============================================

PROMPT_DEFAULTS['banned-ai-phrases'] = {
  slug: 'banned-ai-phrases',
  name: 'Banned AI Phrases',
  category: 'scoring',
  description:
    'List of AI-sounding phrases that are detected and flagged during post polishing. Used by detectAIPatterns().',
  system_prompt: '',
  user_prompt: JSON.stringify(
    [
      "Here's the thing",
      'Let me explain',
      'game-changer',
      'game changer',
      'At the end of the day',
      'In this article',
      'As a matter of fact',
      "It's important to note",
      'In conclusion',
      'Moving forward',
      'That being said',
      'Dive deep',
      'deep dive',
      'Unlock your potential',
      'Level up',
      'Take it to the next level',
      'Leverage',
      'synergy',
      'paradigm shift',
      'low-hanging fruit',
      'value proposition',
      'circle back',
      'touch base',
      'think outside the box',
      'drill down',
      'bandwidth',
      'unpack this',
      'double down',
      'at scale',
      'pivot',
      'disrupt',
      'ideate',
      'align on',
      'needle-moving',
      'mission-critical',
      'world-class',
      'best-in-class',
      'cutting-edge',
      'state-of-the-art',
      'next-generation',
      'holistic approach',
      'ecosystem',
      'robust',
      'seamless',
      'comprehensive',
    ],
    null,
    2
  ),
  model: 'claude-sonnet-4-6',
  temperature: 0,
  max_tokens: 0,
  variables: [],
};

// ============================================
// hook-scoring-config
// Source: src/lib/ai/content-pipeline/post-polish.ts → HOOK_STRENGTH_FACTORS + HOOK_WEAKNESS_FACTORS
// ============================================

PROMPT_DEFAULTS['hook-scoring-config'] = {
  slug: 'hook-scoring-config',
  name: 'Hook Scoring Configuration',
  category: 'scoring',
  description:
    'Configuration for hook strength/weakness scoring factors and their weights. Used by scoreHook().',
  system_prompt: '',
  user_prompt: JSON.stringify(
    {
      base_score: 5,
      min_score: 1,
      max_score: 10,
      strength_factors: {
        hasNumbers: {
          weight: 2,
          pattern: '\\$?\\d+[,.\\d]*%?',
          description: 'Contains specific numbers or dollar amounts',
        },
        hasSpecificTimeframe: {
          weight: 1.5,
          pattern: '\\d+\\s*(days?|weeks?|months?|years?|hours?)',
          description: 'Mentions a specific timeframe',
        },
        isShort: {
          weight: 1,
          max_length: 80,
          description: 'Hook is 80 characters or less',
        },
        hasContrast: {
          weight: 1.5,
          pattern: '\\b(but|instead|not|never|stop|quit|wrong|mistake)\\b',
          description: 'Uses contrast or negation words',
        },
        hasFirstPerson: {
          weight: 1,
          pattern: '\\b(I|my|me|we|our)\\b',
          description: 'Uses first-person perspective',
        },
        hasQuestion: {
          weight: 0.5,
          pattern: '\\?',
          description: 'Contains a question mark',
        },
        hasCuriosity: {
          weight: 1.5,
          pattern:
            '\\b(secret|surprising|unexpected|weird|strange|crazy|one thing|single)\\b',
          description: 'Creates curiosity gap',
        },
        hasOutcome: {
          weight: 2,
          pattern:
            '\\b(revenue|profit|sales|customers|followers|growth|doubled|tripled|increased)\\b',
          description: 'References a concrete business outcome',
        },
      },
      weakness_factors: {
        isGeneric: {
          penalty: 2,
          pattern:
            '^(Tips for|Thoughts on|Some thoughts|How to|Ways to|Things to|Ideas for)\\b',
          suggestion:
            'Start with a specific result or story instead of generic intro',
        },
        isVague: {
          penalty: 1.5,
          pattern:
            '\\b(better|improve|great|good|important|essential|key|must)\\b',
          requires_no_numbers: true,
          suggestion: 'Add specific numbers or outcomes',
        },
        isTooLong: {
          penalty: 1,
          min_length: 120,
          suggestion: 'Shorten to under 80 characters for maximum impact',
        },
        hasAIPatterns: {
          penalty: 2,
          uses_ai_detection: true,
          suggestion: 'Remove AI-sounding phrases',
        },
        lacksSpecificity: {
          penalty: 1.5,
          requires_no_numbers: true,
          requires_no_first_person: true,
          suggestion:
            'Add personal experience (I, my, we) or specific data',
        },
      },
    },
    null,
    2
  ),
  model: 'claude-sonnet-4-6',
  temperature: 0,
  max_tokens: 0,
  variables: [],
};

// ============================================
// post-polish-rewrite
// Source: src/lib/ai/content-pipeline/post-polish.ts → buildPolishPrompt()
// ============================================

PROMPT_DEFAULTS['post-polish-rewrite'] = {
  slug: 'post-polish-rewrite',
  name: 'Post Polish Rewriter',
  category: 'content_writing',
  description:
    'Rewrites a LinkedIn post to fix AI-sounding phrases and strengthen weak hooks. Used by polishPost() via buildPolishPrompt().',
  system_prompt: '',
  user_prompt: `You are an expert LinkedIn content editor. Rewrite the following post to fix these issues:

{{issues_list}}

RULES:
1. Keep the same core message and structure
2. Replace AI-sounding phrases with natural, conversational language
3. Make the hook more specific, personal, and attention-grabbing
4. Keep the same length (within 10% variance)
5. Do NOT add emojis or hashtags
6. Do NOT use em dashes
7. Use short paragraphs for readability
{{voice_style_section}}
ORIGINAL POST:
{{post_content}}

Return ONLY the rewritten post, no explanations or comments.`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 2000,
  variables: [
    {
      name: 'issues_list',
      description:
        'Newline-separated list of issues found (AI phrases, weak hook score, etc.)',
      example:
        'AI-sounding phrases found: game-changer, deep dive\nWeak hook (score: 4/10). Suggestions: Add specific numbers; Make it personal',
    },
    {
      name: 'voice_style_section',
      description:
        'Optional voice style section for author-specific polishing from buildVoicePromptSection()',
      example:
        '\n## Writing Style (learned from author edits)\nTone: direct and conversational\n\nPolish the post to match this author\'s writing style.\n',
    },
    {
      name: 'post_content',
      description: 'The original post content to be polished',
      example:
        "Here's the thing about lead magnets.\n\nThey're a game-changer for your business...",
    },
  ],
};

// ============================================
// email-newsletter
// Source: src/lib/ai/content-pipeline/email-writer.ts → writeNewsletterEmail()
// ============================================

PROMPT_DEFAULTS['email-newsletter'] = {
  slug: 'email-newsletter',
  name: 'Daily Newsletter Email',
  category: 'email',
  description:
    'Writes a daily newsletter email for a B2B audience. Used by writeNewsletterEmail().',
  system_prompt: '',
  user_prompt: `Write a daily newsletter email for a B2B audience.

TOPIC: {{topic}}
{{linkedin_topic_section}}
{{author_section}}

KNOWLEDGE CONTEXT:
{{knowledge_context}}

{{voice_style_section}}

NEWSLETTER EMAIL RULES:
- This is NOT a LinkedIn post. It should be longer, more detailed, more utility-focused.
- Include actionable takeaways the reader can use immediately.
- Use subheadings to break up the content.
- Open with a personal/relatable hook (not "Hey {{first_name}}")
- 300-500 words in the body.
- End with a soft CTA (reply to this email, check out a resource, etc.)
- Conversational but substantive — the reader should feel like they learned something.

Return ONLY valid JSON with "subject" (compelling, 5-10 words) and "body" (markdown formatted).`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 2000,
  variables: [
    {
      name: 'topic',
      description: 'The topic for the newsletter email',
      example: 'How to write cold emails that get replies',
    },
    {
      name: 'linkedin_topic_section',
      description:
        "Optional reference to today's LinkedIn post topic for thematic consistency",
      example:
        "Today's LinkedIn post topic (for thematic consistency, but write DIFFERENT content): Why most cold emails fail",
    },
    {
      name: 'author_section',
      description: 'Optional author name',
      example: 'AUTHOR: Tim Smith',
    },
    {
      name: 'knowledge_context',
      description: 'Compiled knowledge base context for the topic',
      example:
        'KEY INSIGHTS:\n- Cold emails with 3 sentences get 2x reply rate...\nSTORIES:\n- Client switched from 500 word emails to 3 sentences...',
    },
    {
      name: 'voice_style_section',
      description:
        'Learned writing style patterns from buildVoicePromptSection() for email format',
      example:
        '## Writing Style (learned from author edits)\nTone: direct and conversational\nStructure (email): Short paragraphs, subheadings',
    },
  ],
};

// ============================================
// knowledge-extractor
// Source: src/lib/ai/content-pipeline/knowledge-extractor.ts → extractKnowledgeFromTranscript()
// ============================================

PROMPT_DEFAULTS['knowledge-extractor'] = {
  slug: 'knowledge-extractor',
  name: 'Knowledge Extractor',
  category: 'knowledge',
  description:
    'Extracts structured knowledge entries from call transcripts. Used by extractKnowledgeFromTranscript().',
  system_prompt: '',
  user_prompt: `Role: You are a knowledge extraction specialist. Your job is to mine transcripts for business-valuable information and organize it into a structured knowledge base.

Input:
{{call_title_line}}
{{participants_line}}
{{call_date_line}}
Transcript Type: {{transcript_type}}
{{speaker_context}}

{{type_guidance}}

Task: Extract every piece of valuable knowledge from this transcript. For each entry, provide:

1. **knowledge_type**: One of:
   - "how_to" — Process, method, steps, or technique someone can follow
   - "insight" — Strategic observation, principle, framework, or mental model
   - "story" — Specific example with outcome — client result, case study, anecdote with lesson
   - "question" — Something someone asked plus the answer if given
   - "objection" — Pushback, resistance, or concern raised — plus how it was handled
   - "mistake" — Something that went wrong, a failed approach, or a lesson from failure
   - "decision" — A choice made between alternatives, with the reasoning
   - "market_intel" — Information about competitors, market trends, pricing, or industry shifts

2. **category**: Legacy mapping from knowledge_type:
   - how_to, insight, story, mistake, decision -> "insight"
   - question, objection -> "question"
   - market_intel -> "product_intel"

3. **speaker**: Who originated this content:
   - "host" — the teacher/sales rep (the authority)
   - "participant" — coaching attendee or prospect
   - "unknown" — when the transcript doesn't make the speaker clear

4. **content**: The actual knowledge, written to be standalone and useful without the original transcript.

5. **context**: 1-2 sentences explaining what prompted this.

6. **tags**: 2-5 lowercase freeform tags describing specifics (e.g., "cold email subject lines", not "marketing").

7. **suggested_topics**: 1-3 broad topic labels for this entry (e.g., "Cold Email", "LinkedIn Outreach", "Sales Objections"). These get normalized later — just suggest natural labels.

8. **quality_score**: Rate 1-5:
   - 5: Specific + actionable + concrete details (numbers, names, timeframes) + novel
   - 4: Specific and actionable, somewhat expected but well-articulated
   - 3: Useful context, not immediately actionable but good to know
   - 2: General observation, nothing surprising
   - 1: Filler, obvious, too vague, or incomplete

9. **specificity**: true if contains concrete details (numbers, names, timeframes, specific examples), false otherwise.

10. **actionability**: One of:
    - "immediately_actionable" — someone could do this right now
    - "contextual" — useful background, informs decisions
    - "theoretical" — abstract principle or observation

Rules:
- Extract the RICHEST version if the same point comes up multiple times.
- Every entry must be useful on its own.
- For insights: capture the reasoning and examples, not just the conclusion.
- For questions: always pair with the answer if one was given.
- Don't extract small talk, logistics, or low-value exchanges.
- Preserve specific numbers, names, timeframes, and examples.

THE TRANSCRIPT FOLLOWS:
-------------------------------
{{transcript}}

Return your response as valid JSON in this exact format:
{
  "entries": [
    {
      "knowledge_type": "how_to|insight|story|question|objection|mistake|decision|market_intel",
      "category": "insight|question|product_intel",
      "speaker": "host|participant|unknown",
      "content": "The full extracted knowledge, standalone and useful",
      "context": "1-2 sentences of what prompted this",
      "tags": ["specific", "lowercase", "tags"],
      "suggested_topics": ["Cold Email", "Outbound Strategy"],
      "quality_score": 4,
      "specificity": true,
      "actionability": "immediately_actionable|contextual|theoretical"
    }
  ],
  "total_count": number
}`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 8000,
  variables: [
    {
      name: 'call_title_line',
      description: 'Title line for the call (optional)',
      example: 'Title: Weekly Coaching Call - Cold Email Mastery',
    },
    {
      name: 'participants_line',
      description: 'Participants line (optional)',
      example: 'Participants: Tim Smith, Jane Doe, Mike Johnson',
    },
    {
      name: 'call_date_line',
      description: 'Date line for the call (optional)',
      example: 'Date: 2026-02-24',
    },
    {
      name: 'transcript_type',
      description: 'Type of transcript: coaching or sales',
      example: 'coaching',
    },
    {
      name: 'speaker_context',
      description:
        'Speaker map context with roles and companies for proper attribution',
      example:
        'Speaker Context:\n- "Tim Smith" is the HOST from Modern Agency Sales\n- "Jane Doe" is a CLIENT from Acme Corp\n\nIMPORTANT: When extracting knowledge, attribute insights to the correct person and company.',
    },
    {
      name: 'type_guidance',
      description:
        'Type-specific extraction guidance (coaching vs sales focus areas)',
      example:
        'This is a GROUP COACHING CALL where the host teaches. Focus heavily on:\n- Insights: methods, frameworks, principles...',
    },
    {
      name: 'transcript',
      description:
        'The raw transcript text (truncated to 25,000 characters)',
      example: 'Tim: Welcome everyone. Today we are going to talk about...',
    },
  ],
};

// ============================================
// content-brief-angles
// Source: src/lib/ai/content-pipeline/briefing-agent.ts → generateSuggestedAngles()
// ============================================

PROMPT_DEFAULTS['content-brief-angles'] = {
  slug: 'content-brief-angles',
  name: 'Content Brief Angles',
  category: 'content_writing',
  description:
    'Generates 3-5 unique content angles for a LinkedIn post based on topic and knowledge context. Used by generateSuggestedAngles().',
  system_prompt: '',
  user_prompt: `Given this topic and knowledge base context, suggest 3-5 unique angles for a LinkedIn post.

TOPIC: {{topic}}

CONTEXT:
{{compiled_context}}
{{voice_style_section}}
Return ONLY a JSON array of strings, each being a one-sentence angle description.
Example: ["Contrarian take on why X actually hurts more than it helps", "Step-by-step breakdown of the process that generated $Y"]`,
  model: 'claude-sonnet-4-6',
  temperature: 1.0,
  max_tokens: 500,
  variables: [
    {
      name: 'topic',
      description: 'The topic to generate content angles for',
      example: 'Cold email personalization',
    },
    {
      name: 'compiled_context',
      description:
        'Compiled knowledge base context grouped by knowledge type (truncated to 3000 chars)',
      example:
        'KEY INSIGHTS:\n- Personalized first lines get 3x replies\n- Most people over-personalize...\n\nSTORIES:\n- Client switched to 1-sentence personalization...',
    },
    {
      name: 'voice_style_section',
      description:
        'Optional author style preferences section from buildVoicePromptSection()',
      example:
        '\nAUTHOR STYLE PREFERENCES:\n## Writing Style (learned from author edits)\nTone: direct and conversational\n\nSuggest angles that align with this author\'s voice and preferences.\n',
    },
  ],
};

// ============================================
// edit-classifier
// Source: src/lib/ai/content-pipeline/edit-classifier.ts → classifyEditPatterns()
// ============================================

PROMPT_DEFAULTS['edit-classifier'] = {
  slug: 'edit-classifier',
  name: 'Edit Pattern Classifier',
  category: 'learning',
  description:
    'Analyzes what changed between original and edited text to identify deliberate style patterns. Used by classifyEditPatterns().',
  system_prompt: '',
  user_prompt: `Analyze what changed between the original and edited text. Identify specific writing style patterns.

Content type: {{content_type}} (field: {{field_name}})

ORIGINAL:
{{original_text}}

EDITED:
{{edited_text}}

Return JSON with "patterns" array. Each pattern has:
- "pattern": short snake_case label (e.g. "shortened_hook", "removed_jargon", "added_story", "softened_cta", "made_conversational", "added_specifics", "reduced_length")
- "description": one sentence explaining the change

Only include patterns that represent deliberate style choices, not typo fixes.
Return {"patterns": []} if no meaningful style changes detected.`,
  model: 'claude-haiku-4-5-20250514',
  temperature: 1.0,
  max_tokens: 500,
  variables: [
    {
      name: 'content_type',
      description:
        'Type of content being edited (e.g., linkedin_post, email, lead_magnet)',
      example: 'linkedin_post',
    },
    {
      name: 'field_name',
      description: 'Name of the field being edited',
      example: 'content',
    },
    {
      name: 'original_text',
      description: 'The original text before editing',
      example:
        "Here's the thing about lead magnets. They're a game-changer for your business.",
    },
    {
      name: 'edited_text',
      description: 'The edited text after changes',
      example:
        'I used to think lead magnets were just PDFs. Then one generated $47k in pipeline.',
    },
  ],
};

// ============================================
// topic-summarizer
// Source: src/lib/ai/content-pipeline/topic-summarizer.ts → generateTopicSummary()
// ============================================

PROMPT_DEFAULTS['topic-summarizer'] = {
  slug: 'topic-summarizer',
  name: 'Topic Summarizer',
  category: 'knowledge',
  description:
    'Synthesizes knowledge entries about a topic into a concise 200-400 word briefing. Used by generateTopicSummary().',
  system_prompt: '',
  user_prompt: `Synthesize these knowledge entries about "{{topic_name}}" into a concise briefing (200-400 words).

Organize by THEME (not by knowledge type). Include:
- Key insights and patterns
- Actionable takeaways
- Open questions or gaps
- Notable stories or examples

Do NOT use headers or bullet points — write flowing paragraphs. Reference specific knowledge when possible.

KNOWLEDGE ENTRIES:
{{knowledge_sections}}`,
  model: 'claude-haiku-4-5-20250514',
  temperature: 1.0,
  max_tokens: 1500,
  variables: [
    {
      name: 'topic_name',
      description: 'The topic being summarized',
      example: 'Cold Email',
    },
    {
      name: 'knowledge_sections',
      description:
        'Formatted knowledge entries grouped by type, with quality-sorted entries as bullet points',
      example:
        '## Insight (5)\n- Best cold emails are 3 sentences max\n- Subject lines with numbers get 2x opens\n\n## Story (2)\n- Client switched from long form to 3 sentences, reply rate went from 2% to 8%',
    },
  ],
};

// ============================================
// style-evolution
// Source: src/trigger/evolve-writing-style.ts → evolveWritingStyle task
// ============================================

PROMPT_DEFAULTS['style-evolution'] = {
  slug: 'style-evolution',
  name: 'Style Evolution',
  category: 'learning',
  description:
    'Analyzes edit patterns and evolves a voice profile based on consistent style changes. Used by evolveWritingStyle Trigger.dev task.',
  system_prompt: '',
  user_prompt: `You are a writing style analyst. Given a current voice profile and recent edit patterns, produce an updated voice profile.

CURRENT VOICE PROFILE:
{{current_profile_json}}

RECENT EDIT PATTERNS ({{edit_count}} edits analyzed):
{{aggregated_patterns}}

SAMPLE EDITS (most recent 5):
{{sample_edits}}

Return a JSON voice profile that:
1. Preserves existing preferences that weren't contradicted
2. Updates preferences based on consistent patterns (3+ occurrences)
3. Adds new patterns with confidence scores
4. Separates linkedin vs email structure patterns
5. Includes vocabulary_preferences (avoid/prefer lists) based on actual word replacements

Return ONLY the JSON object, no explanation.`,
  model: 'claude-sonnet-4-5-20250514',
  temperature: 1.0,
  max_tokens: 2000,
  variables: [
    {
      name: 'current_profile_json',
      description: 'Current voice profile as JSON string',
      example:
        '{\n  "tone": "direct and conversational",\n  "banned_phrases": ["game-changer"],\n  "evolution_version": 2\n}',
    },
    {
      name: 'edit_count',
      description: 'Total number of edits analyzed',
      example: '12',
    },
    {
      name: 'aggregated_patterns',
      description:
        'Aggregated edit patterns with counts and descriptions',
      example:
        '- shortened_hook (5x): Consistently shortens hooks to under 10 words\n- removed_jargon (3x): Removes business jargon in favor of plain language',
    },
    {
      name: 'sample_edits',
      description:
        'Up to 5 most recent edits with original, edited text, CEO notes, and tags',
      example:
        'Original: "Here\'s the thing about lead magnets..."\nEdited: "I spent $50k testing lead magnets..."\nCEO note: More specific, lead with results\nTags: shortened_hook, added_specifics\n---\nOriginal: ...',
    },
  ],
};

// ============================================
// voice-prompt-template
// Source: src/lib/ai/content-pipeline/voice-prompt-builder.ts → buildVoicePromptSection()
// ============================================

PROMPT_DEFAULTS['voice-prompt-template'] = {
  slug: 'voice-prompt-template',
  name: 'Voice Prompt Template',
  category: 'learning',
  description:
    'Template structure used to build voice prompt sections from a TeamVoiceProfile. Used by buildVoicePromptSection(). Each section is conditionally included based on profile data availability.',
  system_prompt: '',
  user_prompt: `## Writing Style (learned from author edits)
{{tone_line}}
{{vocabulary_avoid_line}}
{{vocabulary_prefer_line}}
{{banned_phrases_line}}
{{structure_line}}
{{cta_style_line}}
{{length_target_line}}
{{storytelling_line}}

## Learned patterns (from recent edits):
{{edit_patterns_list}}

## Approved examples (author marked "Good as-is"):
{{positive_examples_count}} examples on file — match this quality.`,
  model: 'claude-sonnet-4-6',
  temperature: 0,
  max_tokens: 0,
  variables: [
    {
      name: 'tone_line',
      description: 'Tone descriptor from profile',
      example: 'Tone: direct and conversational',
    },
    {
      name: 'vocabulary_avoid_line',
      description: 'Comma-separated list of words to avoid',
      example: 'Vocabulary: AVOID: leverage, synergy, game-changer',
    },
    {
      name: 'vocabulary_prefer_line',
      description: 'Comma-separated list of preferred words',
      example: 'Vocabulary: PREFER: specific, concrete, actionable',
    },
    {
      name: 'banned_phrases_line',
      description: 'Comma-separated list of banned phrases',
      example:
        "NEVER use these phrases: here's the thing, at the end of the day",
    },
    {
      name: 'structure_line',
      description:
        'Structure patterns for the content type (linkedin or email)',
      example:
        'Structure (linkedin): Short hooks under 10 words. End with question CTA.',
    },
    {
      name: 'cta_style_line',
      description: 'Preferred CTA style',
      example: 'CTA style: Question-based, not command-based',
    },
    {
      name: 'length_target_line',
      description: 'Target content length for the content type',
      example: 'Length target: 200-300 words',
    },
    {
      name: 'storytelling_line',
      description: 'Preferred storytelling approach',
      example: 'Storytelling: Lead with specific outcome, then backstory',
    },
    {
      name: 'edit_patterns_list',
      description:
        'Recent edit patterns with descriptions, counts, and confidence scores (filtered to confidence >= 30%)',
      example:
        '- Consistently shortens hooks to under 10 words (5x, confidence: 83%)\n- Removes business jargon in favor of plain language (3x, confidence: 50%)',
    },
    {
      name: 'positive_examples_count',
      description:
        'Number of positive examples (posts marked "Good as-is") on file',
      example: '7',
    },
  ],
};
