import {
  CLAUDE_SONNET_MODEL,
  getAnthropicClient,
  parseJsonResponse
} from "../../../../../chunk-HJL3WNPY.mjs";
import "../../../../../chunk-POHWGI23.mjs";
import {
  createSupabaseAdminClient
} from "../../../../../chunk-MDZYQ24F.mjs";
import {
  logger,
  schedules_exports
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/daily-inspiration-pull.ts
init_esm();

// src/lib/ai/content-pipeline/inspiration-researcher.ts
init_esm();
async function searchTopPerformingPosts(query, platform = "linkedin") {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("SERPER_API_KEY not set, skipping web search for posts");
    return [];
  }
  const searchQuery = `site:${platform}.com ${query} top performing post`;
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10
      })
    });
    if (!response.ok) {
      console.error("Serper search failed:", response.status, response.statusText);
      return [];
    }
    const data = await response.json();
    const results = data.organic || [];
    return results.slice(0, 8).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || "",
      platform,
      author_name: extractAuthorFromTitle(r.title),
      author_url: null,
      engagement_metrics: {}
    }));
  } catch (error) {
    console.error("Error searching for posts:", error);
    return [];
  }
}
__name(searchTopPerformingPosts, "searchTopPerformingPosts");
async function searchTopLeadMagnets(query) {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("SERPER_API_KEY not set, skipping web search for lead magnets");
    return [];
  }
  const searchQuery = `${query} lead magnet free download opt-in`;
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10
      })
    });
    if (!response.ok) {
      console.error("Serper search failed:", response.status, response.statusText);
      return [];
    }
    const data = await response.json();
    const results = data.organic || [];
    return results.slice(0, 8).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || "",
      platform: "web",
      author_name: null,
      author_url: null,
      engagement_metrics: {}
    }));
  } catch (error) {
    console.error("Error searching for lead magnets:", error);
    return [];
  }
}
__name(searchTopLeadMagnets, "searchTopLeadMagnets");
async function searchCreatorContent(creatorUrl, maxResults = 8) {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("SERPER_API_KEY not set, skipping creator search");
    return [];
  }
  const creatorIdentifier = extractCreatorFromUrl(creatorUrl);
  const searchQuery = creatorIdentifier ? `"${creatorIdentifier}" linkedin post` : `site:linkedin.com "${creatorUrl}"`;
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: searchQuery,
        num: maxResults
      })
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results = data.organic || [];
    return results.slice(0, maxResults).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || "",
      platform: "linkedin",
      author_name: creatorIdentifier,
      author_url: creatorUrl,
      engagement_metrics: {}
    }));
  } catch (error) {
    console.error("Error searching creator content:", error);
    return [];
  }
}
__name(searchCreatorContent, "searchCreatorContent");
async function searchHashtagContent(hashtag, maxResults = 8) {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("SERPER_API_KEY not set, skipping hashtag search");
    return [];
  }
  const cleanHashtag = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
  const searchQuery = `site:linkedin.com "${cleanHashtag}" post`;
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: searchQuery,
        num: maxResults
      })
    });
    if (!response.ok) return [];
    const data = await response.json();
    const results = data.organic || [];
    return results.slice(0, maxResults).map((r) => ({
      title: r.title,
      content_preview: r.snippet,
      source_url: r.link || "",
      platform: "linkedin",
      author_name: extractAuthorFromTitle(r.title),
      author_url: null,
      engagement_metrics: {}
    }));
  } catch (error) {
    console.error("Error searching hashtag content:", error);
    return [];
  }
}
__name(searchHashtagContent, "searchHashtagContent");
async function analyzeInspiration(content) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 800,
    messages: [
      {
        role: "user",
        content: `Analyze this piece of content and explain why it works. Be specific and tactical.

TITLE: ${content.title || "N/A"}
CONTENT PREVIEW: ${content.content_preview || "N/A"}
PLATFORM: ${content.platform}
${content.engagement_metrics?.likes ? `LIKES: ${content.engagement_metrics.likes}` : ""}
${content.engagement_metrics?.comments ? `COMMENTS: ${content.engagement_metrics.comments}` : ""}

Return ONLY valid JSON:
{
  "hook_type": "question|bold_statement|story|statistic|number_hook|contrarian|other",
  "format": "short_form|long_form|numbered_list|bullet_list|carousel|paragraph|other",
  "topic": "The main topic or theme",
  "what_makes_it_work": "2-3 sentences explaining why this content is effective",
  "suggested_adaptation": "One sentence suggesting how the user could adapt this for their own content",
  "estimated_quality": 7
}`
      }
    ]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textContent.text);
}
__name(analyzeInspiration, "analyzeInspiration");
function extractAuthorFromTitle(title) {
  const match = title.match(/^(.+?)\s+on\s+LinkedIn/i);
  if (match) return match[1].trim();
  const match2 = title.match(/^(.+?)\s*[-|]\s*LinkedIn/i);
  if (match2) return match2[1].trim();
  return null;
}
__name(extractAuthorFromTitle, "extractAuthorFromTitle");
function extractCreatorFromUrl(url) {
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (match) return match[1].replace(/-/g, " ");
  const twitterMatch = url.match(/(?:twitter|x)\.com\/([^\/\?]+)/);
  if (twitterMatch) return `@${twitterMatch[1]}`;
  return null;
}
__name(extractCreatorFromUrl, "extractCreatorFromUrl");

// src/trigger/daily-inspiration-pull.ts
var dailyInspirationPull = schedules_exports.task({
  id: "daily-inspiration-pull",
  cron: "0 6 * * *",
  // 6 AM UTC daily
  maxDuration: 600,
  // 10 minutes
  run: /* @__PURE__ */ __name(async () => {
    const supabase = createSupabaseAdminClient();
    logger.info("Starting daily inspiration pull");
    const hasSerper = Boolean(process.env.SERPER_API_KEY);
    if (!hasSerper) {
      logger.warn("SERPER_API_KEY not set. Skipping daily inspiration pull.");
      return { skipped: true, reason: "SERPER_API_KEY not configured" };
    }
    const { data: sources, error: sourcesError } = await supabase.from("cp_inspiration_sources").select("id, user_id, source_type, source_value, priority, is_active").eq("is_active", true).order("priority", { ascending: false });
    if (sourcesError || !sources || sources.length === 0) {
      logger.info("No active inspiration sources found");
      return { usersProcessed: 0, totalPulls: 0 };
    }
    const userSources = /* @__PURE__ */ new Map();
    for (const source of sources) {
      const existing = userSources.get(source.user_id) || [];
      existing.push(source);
      userSources.set(source.user_id, existing);
    }
    logger.info("Processing inspiration pulls", {
      users: userSources.size,
      totalSources: sources.length
    });
    let totalPulls = 0;
    let totalAutoSaved = 0;
    const errors = [];
    for (const [userId, userSourceList] of userSources) {
      try {
        logger.info("Processing user inspiration", { userId, sources: userSourceList.length });
        const userPulls = [];
        for (const source of userSourceList) {
          try {
            const content = await fetchContentForSource(source);
            if (content.length === 0) {
              logger.info("No content found for source", {
                sourceId: source.id,
                type: source.source_type,
                value: source.source_value
              });
              continue;
            }
            const analyzed = await analyzeContentBatch(content);
            for (const { item, analysis } of analyzed) {
              if (!item.source_url) continue;
              const isStandout = analysis && analysis.estimated_quality >= 8;
              userPulls.push({
                user_id: userId,
                source_id: source.id,
                content_type: "post",
                title: item.title,
                content_preview: item.content_preview?.slice(0, 500) || null,
                source_url: item.source_url,
                platform: item.platform,
                author_name: item.author_name,
                author_url: item.author_url,
                engagement_metrics: item.engagement_metrics || {},
                ai_analysis: analysis ? { ...analysis } : {},
                pulled_at: (/* @__PURE__ */ new Date()).toISOString(),
                saved_to_swipe_file: isStandout ?? false
              });
              if (isStandout) {
                totalAutoSaved++;
              }
            }
            await supabase.from("cp_inspiration_sources").update({ last_pulled_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", source.id);
          } catch (sourceError) {
            const msg = sourceError instanceof Error ? sourceError.message : String(sourceError);
            logger.error("Failed to process source", {
              sourceId: source.id,
              error: msg
            });
            errors.push(`source ${source.id}: ${msg}`);
          }
        }
        if (userPulls.length > 0) {
          const BATCH_SIZE = 20;
          for (let i = 0; i < userPulls.length; i += BATCH_SIZE) {
            const batch = userPulls.slice(i, i + BATCH_SIZE);
            const { error: insertError } = await supabase.from("cp_inspiration_pulls").upsert(batch, {
              onConflict: "user_id,source_url",
              ignoreDuplicates: true
            });
            if (insertError) {
              logger.error("Failed to insert inspiration pulls", {
                userId,
                error: insertError.message,
                batchIndex: i
              });
            }
          }
          totalPulls += userPulls.length;
          const standouts = userPulls.filter((p) => p.saved_to_swipe_file);
          for (const standout of standouts) {
            try {
              await supabase.from("swipe_file_posts").insert({
                content: standout.content_preview || standout.title || "",
                hook: standout.title?.slice(0, 100) || null,
                source_url: standout.source_url,
                author_name: standout.author_name,
                notes: standout.ai_analysis?.what_makes_it_work || null,
                submitted_by: userId,
                status: "approved"
              });
            } catch {
            }
          }
        }
        logger.info("User inspiration pull complete", {
          userId,
          pullsCreated: userPulls.length,
          autoSaved: userPulls.filter((p) => p.saved_to_swipe_file).length
        });
      } catch (userError) {
        const msg = userError instanceof Error ? userError.message : String(userError);
        logger.error("Failed to process user", { userId, error: msg });
        errors.push(`user ${userId}: ${msg}`);
      }
    }
    logger.info("Daily inspiration pull complete", {
      usersProcessed: userSources.size,
      totalPulls,
      totalAutoSaved,
      errors: errors.length
    });
    return {
      usersProcessed: userSources.size,
      totalPulls,
      totalAutoSaved,
      errors
    };
  }, "run")
});
async function fetchContentForSource(source) {
  const maxResults = Math.min(3 + source.priority, 8);
  switch (source.source_type) {
    case "creator":
      return searchCreatorContent(source.source_value, maxResults);
    case "search_term":
      return searchTopPerformingPosts(source.source_value, "linkedin");
    case "hashtag":
      return searchHashtagContent(source.source_value, maxResults);
    case "competitor": {
      const [posts, leadMagnets] = await Promise.all([
        searchTopPerformingPosts(`"${source.source_value}"`, "linkedin"),
        searchTopLeadMagnets(source.source_value)
      ]);
      const lmResults = leadMagnets.map((lm) => ({
        ...lm,
        platform: "web"
      }));
      return [...posts.slice(0, 4), ...lmResults.slice(0, 4)];
    }
    default:
      return [];
  }
}
__name(fetchContentForSource, "fetchContentForSource");
async function analyzeContentBatch(items) {
  const results = [];
  const BATCH_SIZE = 3;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const analysisResults = await Promise.allSettled(
      batch.map((item) => analyzeInspiration(item))
    );
    for (let j = 0; j < batch.length; j++) {
      const result = analysisResults[j];
      results.push({
        item: batch[j],
        analysis: result.status === "fulfilled" ? result.value : null
      });
    }
  }
  return results;
}
__name(analyzeContentBatch, "analyzeContentBatch");
export {
  dailyInspirationPull
};
//# sourceMappingURL=daily-inspiration-pull.mjs.map
