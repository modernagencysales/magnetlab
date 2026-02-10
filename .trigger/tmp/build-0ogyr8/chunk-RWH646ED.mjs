import {
  generateEmbedding
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

// src/lib/services/knowledge-brain.ts
init_esm();

// src/lib/ai/content-pipeline/tag-clusterer.ts
init_esm();

// src/lib/services/knowledge-brain.ts
async function searchKnowledge(userId, query, options = {}) {
  const { category, tags, limit = 10, threshold = 0.7 } = options;
  const queryEmbedding = await generateEmbedding(query);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cp_match_knowledge_entries", {
    query_embedding: JSON.stringify(queryEmbedding),
    p_user_id: userId,
    threshold,
    match_count: limit
  });
  if (error) {
    console.error("Knowledge search failed:", error.message);
    return { entries: [], error: error.message };
  }
  let results = data || [];
  if (category) {
    results = results.filter((entry) => entry.category === category);
  }
  if (tags && tags.length > 0) {
    results = results.filter(
      (entry) => tags.some((tag) => entry.tags?.includes(tag))
    );
  }
  return { entries: results };
}
__name(searchKnowledge, "searchKnowledge");
async function getRelevantContext(userId, topic, maxEntries = 15) {
  return searchKnowledge(userId, topic, {
    limit: maxEntries,
    threshold: 0.65
  });
}
__name(getRelevantContext, "getRelevantContext");

// src/lib/ai/content-pipeline/briefing-agent.ts
init_esm();
async function buildContentBrief(userId, topic, options = {}) {
  const { maxEntries = 15, includeCategories = ["insight", "question", "product_intel"] } = options;
  const searchResult = await searchKnowledge(userId, topic, {
    limit: maxEntries,
    threshold: 0.6
  });
  if (searchResult.error) {
    console.warn("Knowledge search error in briefing-agent:", searchResult.error);
  }
  const allEntries = searchResult.entries;
  const insights = allEntries.filter((e) => e.category === "insight" && includeCategories.includes("insight"));
  const questions = allEntries.filter((e) => e.category === "question" && includeCategories.includes("question"));
  const productIntel = allEntries.filter((e) => e.category === "product_intel" && includeCategories.includes("product_intel"));
  const compiledContext = compileContext(insights, questions, productIntel);
  let suggestedAngles = [];
  if (allEntries.length >= 3) {
    suggestedAngles = await generateSuggestedAngles(topic, compiledContext);
  }
  return {
    topic,
    relevantInsights: insights,
    relevantQuestions: questions,
    relevantProductIntel: productIntel,
    compiledContext,
    suggestedAngles
  };
}
__name(buildContentBrief, "buildContentBrief");
function compileContext(insights, questions, productIntel) {
  const sections = [];
  if (insights.length > 0) {
    sections.push("VALIDATED INSIGHTS FROM YOUR CALLS:");
    for (const entry of insights.slice(0, 8)) {
      sections.push(`- ${entry.content}${entry.context ? ` (Context: ${entry.context})` : ""}`);
    }
  }
  if (questions.length > 0) {
    sections.push("\nQUESTIONS YOUR AUDIENCE ACTUALLY ASKS:");
    for (const entry of questions.slice(0, 5)) {
      sections.push(`- ${entry.content}`);
    }
  }
  if (productIntel.length > 0) {
    sections.push("\nPRODUCT/SERVICE INTEL:");
    for (const entry of productIntel.slice(0, 5)) {
      sections.push(`- ${entry.content}`);
    }
  }
  return sections.join("\n");
}
__name(compileContext, "compileContext");
async function generateSuggestedAngles(topic, context) {
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `Given this topic and knowledge base context, suggest 3-5 unique angles for a LinkedIn post.

TOPIC: ${topic}

CONTEXT:
${context.slice(0, 3e3)}

Return ONLY a JSON array of strings, each being a one-sentence angle description.
Example: ["Contrarian take on why X actually hurts more than it helps", "Step-by-step breakdown of the process that generated $Y"]`
        }
      ]
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "[]";
    return parseJsonResponse(text);
  } catch {
    return [];
  }
}
__name(generateSuggestedAngles, "generateSuggestedAngles");
async function buildContentBriefForIdea(userId, idea) {
  const searchQuery = [
    idea.title,
    idea.core_insight
  ].filter(Boolean).join(" ");
  return buildContentBrief(userId, searchQuery);
}
__name(buildContentBriefForIdea, "buildContentBriefForIdea");

export {
  getRelevantContext,
  buildContentBrief,
  buildContentBriefForIdea
};
//# sourceMappingURL=chunk-RWH646ED.mjs.map
