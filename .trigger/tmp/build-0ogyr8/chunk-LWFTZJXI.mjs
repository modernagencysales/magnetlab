import {
  buildContentBriefForIdea
} from "./chunk-RWH646ED.mjs";
import {
  isEmbeddingsConfigured
} from "./chunk-DKPAWPJO.mjs";
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicClient,
  parseJsonResponse
} from "./chunk-HJL3WNPY.mjs";
import {
  createSupabaseAdminClient
} from "./chunk-MDZYQ24F.mjs";
import {
  __name,
  init_esm
} from "./chunk-R7N3VW3I.mjs";

// src/lib/services/autopilot.ts
init_esm();

// src/lib/ai/content-pipeline/idea-scorer.ts
init_esm();
var SCORE_WEIGHTS = {
  relevance: 0.35,
  freshness: 0.25,
  pillarBalance: 0.25,
  hookStrength: 0.15
};
function generateSimilarityHash(idea) {
  const text = `${idea.title}|${idea.core_insight || ""}`.toLowerCase();
  const words = text.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 3).sort().slice(0, 10).join("|");
  return words;
}
__name(generateSimilarityHash, "generateSimilarityHash");
function calculateTextSimilarity(text1, text2) {
  const normalize = /* @__PURE__ */ __name((text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length > 2), "normalize");
  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));
  if (words1.size === 0 || words2.size === 0) return 0;
  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = /* @__PURE__ */ new Set([...words1, ...words2]);
  return intersection.size / union.size;
}
__name(calculateTextSimilarity, "calculateTextSimilarity");
function calculateFreshnessScore(idea, recentPostTitles) {
  if (recentPostTitles.length === 0) return 10;
  const ideaText = `${idea.title} ${idea.core_insight || ""}`;
  let maxSimilarity = 0;
  for (const title of recentPostTitles) {
    const similarity = calculateTextSimilarity(ideaText, title);
    maxSimilarity = Math.max(maxSimilarity, similarity);
  }
  return Math.max(0, 10 - maxSimilarity * 15);
}
__name(calculateFreshnessScore, "calculateFreshnessScore");
function calculatePillarBalanceScore(idea, pillarCounts) {
  const pillar = idea.content_pillar;
  if (!pillar) return 5;
  const counts = Object.values(pillarCounts);
  const totalPosts = counts.reduce((sum, count) => sum + count, 0);
  if (totalPosts === 0) return 10;
  const pillarCount = pillarCounts[pillar] || 0;
  const avgCount = totalPosts / 4;
  if (pillarCount === 0) return 10;
  if (pillarCount < avgCount) return 8;
  if (pillarCount === avgCount) return 5;
  if (pillarCount > avgCount * 1.5) return 2;
  return 4;
}
__name(calculatePillarBalanceScore, "calculatePillarBalanceScore");
function calculateHookStrengthScore(idea) {
  let score = 5;
  if (idea.core_insight && idea.core_insight.length > 20) {
    score += 1;
  }
  if (idea.title && /\d+/.test(idea.title)) {
    score += 1;
  }
  if (idea.content_type === "contrarian" || idea.content_type === "question") {
    score += 1;
  }
  if (idea.why_post_worthy && idea.why_post_worthy.length > 10) {
    score += 1;
  }
  if (idea.post_ready) {
    score += 1;
  }
  return Math.min(10, score);
}
__name(calculateHookStrengthScore, "calculateHookStrengthScore");
function scoreIdea(idea, context) {
  const factors = {
    relevance: idea.relevance_score ?? 5,
    freshness: calculateFreshnessScore(idea, context.recentPostTitles),
    pillarBalance: calculatePillarBalanceScore(idea, context.pillarCounts),
    hookStrength: calculateHookStrengthScore(idea)
  };
  const compositeScore = factors.relevance * SCORE_WEIGHTS.relevance + factors.freshness * SCORE_WEIGHTS.freshness + factors.pillarBalance * SCORE_WEIGHTS.pillarBalance + factors.hookStrength * SCORE_WEIGHTS.hookStrength;
  return {
    ideaId: idea.id,
    compositeScore: Math.min(10, Math.max(0, compositeScore)),
    factors,
    similarityHash: generateSimilarityHash(idea)
  };
}
__name(scoreIdea, "scoreIdea");
function rankIdeas(ideas, context) {
  const scoredIdeas = ideas.map((idea) => ({
    idea,
    score: scoreIdea(idea, context)
  }));
  scoredIdeas.sort((a, b) => b.score.compositeScore - a.score.compositeScore);
  return scoredIdeas;
}
__name(rankIdeas, "rankIdeas");
function getTopIdeas(ideas, count, context) {
  const ranked = rankIdeas(ideas, context);
  return ranked.slice(0, count);
}
__name(getTopIdeas, "getTopIdeas");

// src/lib/ai/content-pipeline/post-polish.ts
init_esm();
var AI_PHRASES = [
  "Here's the thing",
  "Let me explain",
  "game-changer",
  "game changer",
  "At the end of the day",
  "In this article",
  "As a matter of fact",
  "It's important to note",
  "In conclusion",
  "Moving forward",
  "That being said",
  "Dive deep",
  "deep dive",
  "Unlock your potential",
  "Level up",
  "Take it to the next level",
  "Leverage",
  "synergy",
  "paradigm shift",
  "low-hanging fruit",
  "value proposition",
  "circle back",
  "touch base",
  "think outside the box",
  "drill down",
  "bandwidth",
  "unpack this",
  "double down",
  "at scale",
  "pivot",
  "disrupt",
  "ideate",
  "align on",
  "needle-moving",
  "mission-critical",
  "world-class",
  "best-in-class",
  "cutting-edge",
  "state-of-the-art",
  "next-generation",
  "holistic approach",
  "ecosystem",
  "robust",
  "seamless",
  "comprehensive"
];
var AI_STRUCTURAL_PATTERNS = [
  /^(Every [a-z]+\.\s*){3,}/im,
  /That's the game\./i,
  /That's it\./i,
  /Full stop\./i,
  /Period\./i,
  /End of story\./i,
  /That's the secret\./i,
  /That's the key\./i,
  /(\b\w+\b)(\.|,)\s+\1(\.|,)\s+\1/i,
  /\bWant to know (the secret|what|how|why)\?/i,
  /\bHere's what (most people|nobody|everyone) (gets wrong|doesn't know|misses)/i,
  /\bwith that said\b/i,
  /\bhaving said that\b/i,
  /\bit goes without saying\b/i
];
function detectAIPatterns(text) {
  const found = [];
  for (const phrase of AI_PHRASES) {
    const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (regex.test(text)) {
      found.push(phrase);
    }
  }
  for (const pattern of AI_STRUCTURAL_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern);
      if (match) {
        found.push(match[0].trim());
      }
    }
  }
  return [...new Set(found)];
}
__name(detectAIPatterns, "detectAIPatterns");
var HOOK_STRENGTH_FACTORS = {
  hasNumbers: {
    weight: 2,
    test: /* @__PURE__ */ __name((text) => /\$?\d+[,.\d]*%?/.test(text), "test")
  },
  hasSpecificTimeframe: {
    weight: 1.5,
    test: /* @__PURE__ */ __name((text) => /\d+\s*(days?|weeks?|months?|years?|hours?)/i.test(text), "test")
  },
  isShort: {
    weight: 1,
    test: /* @__PURE__ */ __name((text) => text.length <= 80, "test")
  },
  hasContrast: {
    weight: 1.5,
    test: /* @__PURE__ */ __name((text) => /\b(but|instead|not|never|stop|quit|wrong|mistake)\b/i.test(text), "test")
  },
  hasFirstPerson: {
    weight: 1,
    test: /* @__PURE__ */ __name((text) => /\b(I|my|me|we|our)\b/i.test(text), "test")
  },
  hasQuestion: {
    weight: 0.5,
    test: /* @__PURE__ */ __name((text) => text.includes("?"), "test")
  },
  hasCuriosity: {
    weight: 1.5,
    test: /* @__PURE__ */ __name((text) => /\b(secret|surprising|unexpected|weird|strange|crazy|one thing|single)\b/i.test(text), "test")
  },
  hasOutcome: {
    weight: 2,
    test: /* @__PURE__ */ __name((text) => /\b(revenue|profit|sales|customers|followers|growth|doubled|tripled|increased)\b/i.test(text), "test")
  }
};
var HOOK_WEAKNESS_FACTORS = {
  isGeneric: {
    penalty: 2,
    test: /* @__PURE__ */ __name((text) => /^(Tips for|Thoughts on|Some thoughts|How to|Ways to|Things to|Ideas for)\b/i.test(text), "test")
  },
  isVague: {
    penalty: 1.5,
    test: /* @__PURE__ */ __name((text) => /\b(better|improve|great|good|important|essential|key|must)\b/i.test(text) && !/\d/.test(text), "test")
  },
  isTooLong: {
    penalty: 1,
    test: /* @__PURE__ */ __name((text) => text.length > 120, "test")
  },
  hasAIPatterns: {
    penalty: 2,
    test: /* @__PURE__ */ __name((text) => detectAIPatterns(text).length > 0, "test")
  },
  lacksSpecificity: {
    penalty: 1.5,
    test: /* @__PURE__ */ __name((text) => !/\d/.test(text) && !/\b(I|my|we)\b/i.test(text), "test")
  }
};
function scoreHook(hook) {
  let score = 5;
  const suggestions = [];
  for (const factor of Object.values(HOOK_STRENGTH_FACTORS)) {
    if (factor.test(hook)) {
      score += factor.weight;
    }
  }
  for (const [name, factor] of Object.entries(HOOK_WEAKNESS_FACTORS)) {
    if (factor.test(hook)) {
      score -= factor.penalty;
      switch (name) {
        case "isGeneric":
          suggestions.push("Start with a specific result or story instead of generic intro");
          break;
        case "isVague":
          suggestions.push("Add specific numbers or outcomes");
          break;
        case "isTooLong":
          suggestions.push("Shorten to under 80 characters for maximum impact");
          break;
        case "hasAIPatterns":
          suggestions.push("Remove AI-sounding phrases");
          break;
        case "lacksSpecificity":
          suggestions.push("Add personal experience (I, my, we) or specific data");
          break;
      }
    }
  }
  if (!HOOK_STRENGTH_FACTORS.hasNumbers.test(hook)) {
    suggestions.push("Consider adding specific numbers ($X, Y%, Z days)");
  }
  if (!HOOK_STRENGTH_FACTORS.hasFirstPerson.test(hook)) {
    suggestions.push("Make it personal with first-person perspective");
  }
  score = Math.max(1, Math.min(10, Math.round(score)));
  return {
    score,
    suggestions: [...new Set(suggestions)]
  };
}
__name(scoreHook, "scoreHook");
var EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;
function formatPost(content) {
  let result = content;
  result = result.replace(EMOJI_REGEX, "");
  result = result.replace(/#\w+/g, "");
  result = result.replace(/\s*—\s*/g, ", ");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.replace(/\.([A-Z])/g, ".\n\n$1");
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/\n /g, "\n");
  result = result.replace(/ \n/g, "\n");
  result = result.trim();
  return result;
}
__name(formatPost, "formatPost");
async function polishPost(content, options = {}) {
  const { rewriteAIPatterns = true, strengthenHook = true, formatOnly = false } = options;
  let polished = formatPost(content);
  const aiPatternsFound = detectAIPatterns(content);
  const changes = [];
  const hookMatch = polished.match(/^[^\n.!?]+[.!?]?/);
  const hook = hookMatch ? hookMatch[0] : polished.split("\n")[0];
  const hookScore = scoreHook(hook);
  if (formatOnly) {
    if (polished !== content) {
      changes.push("Applied formatting fixes");
    }
    return { original: content, polished, aiPatternsFound, hookScore, changes };
  }
  if (rewriteAIPatterns && aiPatternsFound.length > 0 || strengthenHook && hookScore.score < 6) {
    const prompt = buildPolishPrompt(polished, aiPatternsFound, hookScore);
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 2e3,
      messages: [{ role: "user", content: prompt }]
    });
    const rewrittenContent = response.content?.[0]?.type === "text" ? response.content[0].text : polished;
    const extractedPost = extractRewrittenPost(rewrittenContent);
    if (extractedPost) {
      polished = formatPost(extractedPost);
      if (aiPatternsFound.length > 0) {
        changes.push(`Rewrote ${aiPatternsFound.length} AI patterns`);
      }
      if (hookScore.score < 6) {
        changes.push("Strengthened hook");
      }
    }
  }
  return { original: content, polished, aiPatternsFound, hookScore, changes };
}
__name(polishPost, "polishPost");
function buildPolishPrompt(content, aiPatterns, hookScore) {
  const issues = [];
  if (aiPatterns.length > 0) {
    issues.push(`AI-sounding phrases found: ${aiPatterns.join(", ")}`);
  }
  if (hookScore.score < 6) {
    issues.push(
      `Weak hook (score: ${hookScore.score}/10). Suggestions: ${hookScore.suggestions.join("; ")}`
    );
  }
  return `You are an expert LinkedIn content editor. Rewrite the following post to fix these issues:

${issues.join("\n")}

RULES:
1. Keep the same core message and structure
2. Replace AI-sounding phrases with natural, conversational language
3. Make the hook more specific, personal, and attention-grabbing
4. Keep the same length (within 10% variance)
5. Do NOT add emojis or hashtags
6. Do NOT use em dashes
7. Use short paragraphs for readability

ORIGINAL POST:
${content}

Return ONLY the rewritten post, no explanations or comments.`;
}
__name(buildPolishPrompt, "buildPolishPrompt");
function extractRewrittenPost(response) {
  const trimmed = response.trim();
  const codeBlockMatch = trimmed.match(/```(?:text)?\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const prefixPatterns = [
    /^(?:Here['']s|Here is) (?:the )?rewritten (?:post|version)[:\s]*/i,
    /^(?:Rewritten|Updated|Revised) (?:post|version)[:\s]*/i
  ];
  let cleaned = trimmed;
  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim() || null;
}
__name(extractRewrittenPost, "extractRewrittenPost");

// src/lib/ai/content-pipeline/post-writer.ts
init_esm();
function getBaseStyleGuidelines() {
  return `Voice:
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
- 1-2 sentences max`;
}
__name(getBaseStyleGuidelines, "getBaseStyleGuidelines");
async function writePostFreeform(input) {
  const { idea, targetAudience, knowledgeContext } = input;
  const knowledgeSection = knowledgeContext ? `
KNOWLEDGE BASE CONTEXT (from your calls):
${knowledgeContext}
Use specific quotes, real numbers, and validated insights from this context.
` : "";
  const prompt = `You are writing a LinkedIn post. Write the post without any preamble. Your first word is the first word of the post.

${getBaseStyleGuidelines()}

Audience: ${targetAudience || "B2B professionals, agency owners, and marketers"}
What this means for your writing:
- Match technical depth to their sophistication level
- Reference their specific reality and daily frustrations
- Don't write like you're introducing basic concepts
- Use "you" to speak directly to them
- If the post doesn't feel like it was written specifically for this person, rewrite it.

CONTEXT FOR THIS POST:
Title: ${idea.title}
Core Insight: ${idea.core_insight}
Full Context: ${idea.full_context}
Why Post-Worthy: ${idea.why_post_worthy}
Content Type: ${idea.content_type}
${knowledgeSection}
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
}`;
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textContent.text);
}
__name(writePostFreeform, "writePostFreeform");

// src/lib/services/autopilot.ts
var PILLAR_LOOKBACK_DAYS = 14;
var AUTO_PUBLISH_WINDOW_HOURS = 24;
async function getPillarCounts(userId, days = PILLAR_LOOKBACK_DAYS) {
  const supabase = createSupabaseAdminClient();
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const { data: posts } = await supabase.from("cp_pipeline_posts").select("idea_id").eq("user_id", userId).gte("created_at", cutoffDate.toISOString()).in("status", ["approved", "scheduled", "published"]);
  const ideaIds = posts?.map((p) => p.idea_id).filter(Boolean) || [];
  if (ideaIds.length === 0) {
    return { moments_that_matter: 0, teaching_promotion: 0, human_personal: 0, collaboration_social_proof: 0 };
  }
  const { data: ideas } = await supabase.from("cp_content_ideas").select("content_pillar").in("id", ideaIds);
  const counts = {
    moments_that_matter: 0,
    teaching_promotion: 0,
    human_personal: 0,
    collaboration_social_proof: 0
  };
  for (const idea of ideas || []) {
    const pillar = idea.content_pillar;
    if (pillar && pillar in counts) {
      counts[pillar]++;
    }
  }
  return counts;
}
__name(getPillarCounts, "getPillarCounts");
async function getRecentPostTitles(userId, days = PILLAR_LOOKBACK_DAYS) {
  const supabase = createSupabaseAdminClient();
  const cutoffDate = /* @__PURE__ */ new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const { data: posts } = await supabase.from("cp_pipeline_posts").select("idea_id").eq("user_id", userId).gte("created_at", cutoffDate.toISOString());
  const ideaIds = posts?.map((p) => p.idea_id).filter(Boolean) || [];
  if (ideaIds.length === 0) return [];
  const { data: ideas } = await supabase.from("cp_content_ideas").select("title").in("id", ideaIds);
  return ideas?.map((i) => i.title) || [];
}
__name(getRecentPostTitles, "getRecentPostTitles");
function wallClockToUTC(baseDate, hours, minutes, timezone) {
  const dateStr = baseDate.toLocaleDateString("en-CA", { timeZone: timezone });
  const [y, m, d] = dateStr.split("-").map(Number);
  const naiveUTC = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false
  }).formatToParts(naiveUTC);
  const tzHour = parseInt(parts.find((p) => p.type === "hour").value);
  const tzMinute = parseInt(parts.find((p) => p.type === "minute").value);
  const tzDay = parseInt(parts.find((p) => p.type === "day").value);
  const tzTotalMinutes = tzDay * 24 * 60 + tzHour * 60 + tzMinute;
  const targetTotalMinutes = d * 24 * 60 + hours * 60 + minutes;
  const offsetMinutes = tzTotalMinutes - targetTotalMinutes;
  return new Date(naiveUTC.getTime() - offsetMinutes * 60 * 1e3);
}
__name(wallClockToUTC, "wallClockToUTC");
async function getNextScheduledTime(userId, cachedScheduledTimes) {
  const supabase = createSupabaseAdminClient();
  const { data: slots } = await supabase.from("cp_posting_slots").select("id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at, updated_at").eq("user_id", userId).eq("is_active", true).order("slot_number", { ascending: true });
  if (!slots?.length) {
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(9, 0, 0, 0);
    return tomorrow;
  }
  const now = /* @__PURE__ */ new Date();
  const candidates = [];
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    for (const slot of slots) {
      const [hours, minutes] = slot.time_of_day.split(":").map(Number);
      const tz = slot.timezone || "UTC";
      const baseDate = new Date(now.getTime() + dayOffset * 864e5);
      const candidate = wallClockToUTC(baseDate, hours, minutes, tz);
      if (candidate > now) {
        const dayName = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(candidate);
        const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        const dayInTZ = dayMap[dayName] ?? candidate.getUTCDay();
        if (slot.day_of_week === null || slot.day_of_week === dayInTZ) {
          candidates.push(candidate);
        }
      }
    }
  }
  candidates.sort((a, b) => a.getTime() - b.getTime());
  if (candidates.length > 0) {
    let scheduledTimes = cachedScheduledTimes;
    if (!scheduledTimes) {
      const { data: scheduledPosts } = await supabase.from("cp_pipeline_posts").select("scheduled_time").eq("user_id", userId).eq("status", "scheduled").not("scheduled_time", "is", null);
      scheduledTimes = new Set(
        scheduledPosts?.map((p) => new Date(p.scheduled_time).getTime()) || []
      );
    }
    for (const candidate of candidates) {
      if (!scheduledTimes.has(candidate.getTime())) {
        return candidate;
      }
    }
  }
  const fallback = /* @__PURE__ */ new Date();
  fallback.setDate(fallback.getDate() + 1);
  fallback.setUTCHours(9, 0, 0, 0);
  return fallback;
}
__name(getNextScheduledTime, "getNextScheduledTime");
async function getBufferSize(userId) {
  const supabase = createSupabaseAdminClient();
  const { count } = await supabase.from("cp_pipeline_posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_buffer", true).eq("status", "approved");
  return count || 0;
}
__name(getBufferSize, "getBufferSize");
async function runNightlyBatch(config) {
  const { userId, postsPerBatch = 3, autoPublish = false, autoPublishDelayHours = AUTO_PUBLISH_WINDOW_HOURS } = config;
  const supabase = createSupabaseAdminClient();
  const result = { postsCreated: 0, postsScheduled: 0, ideasProcessed: 0, errors: [] };
  try {
    const { data: pendingIdeas } = await supabase.from("cp_content_ideas").select("id, user_id, transcript_id, title, core_insight, full_context, why_post_worthy, post_ready, hook, key_points, target_audience, content_type, content_pillar, relevance_score, source_quote, status, composite_score, last_surfaced_at, similarity_hash, created_at, updated_at").eq("user_id", userId).eq("status", "extracted").order("created_at", { ascending: false }).limit(50);
    if (!pendingIdeas?.length) {
      return result;
    }
    const recentPostTitles = await getRecentPostTitles(userId);
    const pillarCounts = await getPillarCounts(userId);
    const scoringContext = {
      recentPostTitles,
      pillarCounts
    };
    const topIdeas = getTopIdeas(pendingIdeas, postsPerBatch, scoringContext);
    const { data: existingScheduled } = await supabase.from("cp_pipeline_posts").select("scheduled_time").eq("user_id", userId).eq("status", "scheduled").not("scheduled_time", "is", null);
    const scheduledTimesCache = new Set(
      existingScheduled?.map((p) => new Date(p.scheduled_time).getTime()) || []
    );
    for (let i = 0; i < topIdeas.length; i++) {
      const { idea, score } = topIdeas[i];
      try {
        let knowledgeContext;
        if (isEmbeddingsConfigured()) {
          try {
            const brief = await buildContentBriefForIdea(userId, idea);
            if (brief.compiledContext) {
              knowledgeContext = brief.compiledContext;
            }
          } catch {
          }
        }
        await supabase.from("cp_content_ideas").update({
          status: "writing",
          composite_score: score.compositeScore,
          similarity_hash: score.similarityHash,
          last_surfaced_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", idea.id);
        const writtenPost = await writePostFreeform({
          idea: {
            id: idea.id,
            title: idea.title,
            core_insight: idea.core_insight,
            full_context: idea.full_context,
            why_post_worthy: idea.why_post_worthy,
            content_type: idea.content_type
          },
          knowledgeContext
        });
        const polishResult = await polishPost(writtenPost.content);
        const isFirstPost = i === 0;
        const scheduledTime = isFirstPost ? await getNextScheduledTime(userId, scheduledTimesCache) : null;
        const isBuffer = !isFirstPost;
        let bufferPosition = null;
        if (isBuffer) {
          const currentBufferSize = await getBufferSize(userId);
          bufferPosition = currentBufferSize + (i - 1) + 1;
        }
        const { error: postError } = await supabase.from("cp_pipeline_posts").insert({
          user_id: userId,
          idea_id: idea.id,
          draft_content: writtenPost.content,
          final_content: polishResult.polished,
          dm_template: writtenPost.dm_template,
          cta_word: writtenPost.cta_word,
          variations: writtenPost.variations,
          status: isFirstPost ? "reviewing" : "approved",
          scheduled_time: scheduledTime?.toISOString() || null,
          hook_score: polishResult.hookScore.score,
          polish_status: polishResult.changes.length > 0 ? "polished" : "pending",
          polish_notes: polishResult.changes.length > 0 ? polishResult.changes.join("; ") : null,
          is_buffer: isBuffer,
          buffer_position: bufferPosition,
          auto_publish_after: autoPublish && isFirstPost ? new Date(Date.now() + autoPublishDelayHours * 60 * 60 * 1e3).toISOString() : null
        });
        if (postError) {
          result.errors.push(`Failed to save post for idea ${idea.id}: ${postError.message}`);
          continue;
        }
        await supabase.from("cp_content_ideas").update({ status: "written" }).eq("id", idea.id);
        result.postsCreated++;
        result.ideasProcessed++;
        if (isFirstPost && scheduledTime) {
          result.postsScheduled++;
        }
      } catch (ideaError) {
        const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
        result.errors.push(`Failed to process idea ${idea.id}: ${errorMsg}`);
        await supabase.from("cp_content_ideas").update({ status: "extracted" }).eq("id", idea.id);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Batch failed: ${errorMsg}`);
  }
  return result;
}
__name(runNightlyBatch, "runNightlyBatch");

export {
  runNightlyBatch
};
//# sourceMappingURL=chunk-LWFTZJXI.mjs.map
