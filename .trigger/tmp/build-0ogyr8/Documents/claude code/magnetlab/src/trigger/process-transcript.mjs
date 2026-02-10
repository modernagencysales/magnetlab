import {
  generateEmbedding
} from "../../../../../chunk-DKPAWPJO.mjs";
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
  task
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/process-transcript.ts
init_esm();

// src/lib/ai/content-pipeline/transcript-classifier.ts
init_esm();
async function classifyTranscript(transcript) {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 50,
    messages: [
      {
        role: "user",
        content: `Classify this call transcript as either "coaching" or "sales".

Coaching calls: mentoring, teaching, advising, strategy sessions, consulting
Sales calls: discovery, demos, pitches, negotiations, closing

Respond with ONLY the word "coaching" or "sales".

TRANSCRIPT (first 3000 chars):
${transcript.slice(0, 3e3)}`
      }
    ]
  });
  const text = response.content[0].type === "text" ? response.content[0].text.trim().toLowerCase() : "";
  if (text === "coaching" || text === "sales") {
    return text;
  }
  return "coaching";
}
__name(classifyTranscript, "classifyTranscript");

// src/lib/ai/content-pipeline/knowledge-extractor.ts
init_esm();
async function extractKnowledgeFromTranscript(transcript, transcriptType, context) {
  const typeGuidance = transcriptType === "coaching" ? `This is a GROUP COACHING CALL where the host teaches. Focus heavily on:
- Insights: methods, frameworks, principles, mental models, strategies, tactical advice, stories with lessons
- Questions: what participants ask or push back on (these reveal what the audience cares about and struggles with)
- Product Intel: any mentions of the product, what it does, what's missing, feature requests` : `This is a SALES CALL between a sales rep and a prospect. Focus heavily on:
- Questions: prospect questions, objections, pain points, concerns, what confuses them
- Product Intel: feature requests, gaps mentioned, competitor comparisons, what resonated, what didn't land
- Insights: anything the sales rep explains well about the approach, methodology, or value proposition`;
  const prompt = `Role: You are a knowledge extraction specialist. Your job is to mine transcripts for business-valuable information and organize it into a structured knowledge base.

Input:
${context?.callTitle ? `Title: ${context.callTitle}` : ""}
${context?.participants?.length ? `Participants: ${context.participants.join(", ")}` : ""}
${context?.callDate ? `Date: ${context.callDate}` : ""}
Transcript Type: ${transcriptType}

${typeGuidance}

Task: Extract every piece of valuable knowledge from this transcript. For each entry, provide:

1. **category**: One of:
   - "insight" — anything the host teaches, believes, recommends, or explains. Frameworks, principles, tips, stories with lessons, mental models, tactical advice, strategies.
   - "question" — what participants/prospects ask, push back on, or express confusion about. Include the question AND the host's answer if one was given.
   - "product_intel" — mentions of the product or service: feature requests, gaps, praise, complaints, comparisons to competitors, what resonated with prospects.

2. **speaker**: Who originated this content:
   - "host" — the teacher/sales rep (the authority)
   - "participant" — coaching attendee or prospect
   - "unknown" — when the transcript doesn't make the speaker clear

3. **content**: The actual knowledge, written to be standalone and useful without the original transcript.

4. **context**: 1-2 sentences explaining what prompted this

5. **tags**: 2-5 lowercase freeform tags describing the topics. Be specific ("cold email subject lines") not generic ("marketing").

Rules:
- Extract the RICHEST version if the same point comes up multiple times.
- Every entry must be useful on its own.
- For insights: capture the reasoning and examples, not just the conclusion.
- For questions: always pair with the answer if one was given.
- Don't extract small talk, logistics, or low-value exchanges.
- Preserve specific numbers, names, timeframes, and examples.

THE TRANSCRIPT FOLLOWS:
-------------------------------
${transcript.slice(0, 25e3)}${transcript.length > 25e3 ? "\n... [truncated]" : ""}

Return your response as valid JSON in this exact format:
{
  "entries": [
    {
      "category": "insight|question|product_intel",
      "speaker": "host|participant|unknown",
      "content": "The full extracted knowledge, standalone and useful",
      "context": "1-2 sentences of what prompted this",
      "tags": ["specific", "lowercase", "tags"]
    }
  ],
  "total_count": number
}`;
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 8e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textContent.text);
}
__name(extractKnowledgeFromTranscript, "extractKnowledgeFromTranscript");

// src/lib/ai/content-pipeline/content-extractor.ts
init_esm();
async function extractIdeasFromTranscript(transcript, context) {
  const prompt = `Role: You are a content strategist extracting post-worthy ideas from video transcripts. Your job is to identify every distinct idea that contains enough substance to write a standalone LinkedIn post with real value. You extract aggressively—capture everything needed to write the post, or skip the idea entirely.

Input:
${context?.callTitle ? `Title: ${context.callTitle}` : ""}
${context?.participants?.length ? `Participants: ${context.participants.join(", ")}` : ""}
${context?.callDate ? `Date: ${context.callDate}` : ""}

Task: Extract every idea from this transcript that could become a high-quality LinkedIn post. For each idea, provide:

1. **Core insight** (1-2 sentences capturing the actual takeaway)

2. **Full context** (Extract ALL of the following that exist in the transcript):
   - The complete story or example with setup, details, and outcome
   - Exact numbers, timeframes, dollar amounts, or metrics mentioned
   - The step-by-step process or mechanism if one is described
   - Who specifically this applies to or came from
   - What the situation was before vs. after
   - Any failures, mistakes, or "what not to do" mentioned
   - The reasoning or logic behind why this works
   - Any memorable phrasing, analogies, or quotable language worth preserving

3. **Why it's post-worthy** (what makes this interesting, counterintuitive, or actionable)

Quality gate—only extract ideas that have at least TWO of the following:
- A specific story, case study, or real example with details
- Exact numbers, metrics, or timeframes
- A step-by-step process or clear mechanism
- A contrarian take with the actual reasoning behind it
- A concrete before/after or problem/solution structure
- A memorable analogy, framework, or reframe

Do NOT extract:
- Observations without supporting detail
- Opinions without the argument or evidence behind them
- Advice that's just "what" without "how" or "why"
- Ideas where you'd have to invent details to make a full post
- Generic insights that could apply to any business

Extraction principle: When in doubt, include more detail from the transcript rather than less.

THE TRANSCRIPT FOLLOWS:
-------------------------------
${transcript.slice(0, 25e3)}${transcript.length > 25e3 ? "\n... [truncated]" : ""}

Content Pillar Classification:
Assign exactly ONE pillar to each idea based on its THEMATIC focus:
- "moments_that_matter": Career milestones, business turning points, achievements, lessons from pivotal moments
- "teaching_promotion": How-tos, educational content, frameworks, tips, expertise sharing
- "human_personal": Personal stories, vulnerabilities, life lessons, behind-the-scenes, failures and learnings
- "collaboration_social_proof": Partnerships, client wins, testimonials, case studies, shoutouts

Return your response as valid JSON in this exact format:
{
  "ideas": [
    {
      "title": "Working title for this idea (5-10 words)",
      "core_insight": "1-2 sentences capturing the actual takeaway",
      "full_context": "Complete extracted context including stories, numbers, processes, quotes",
      "why_post_worthy": "What makes this interesting, counterintuitive, or actionable",
      "content_type": "story|insight|tip|framework|case_study|question|listicle|contrarian",
      "content_pillar": "moments_that_matter|teaching_promotion|human_personal|collaboration_social_proof",
      "post_ready": true or false
    }
  ],
  "total_count": number,
  "post_ready_count": number
}`;
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 8e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textContent.text);
}
__name(extractIdeasFromTranscript, "extractIdeasFromTranscript");

// src/trigger/process-transcript.ts
var processTranscript = task({
  id: "process-transcript",
  maxDuration: 600,
  // 10 minutes — 4 sequential AI calls + embedding batches
  retry: { maxAttempts: 2 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { userId, transcriptId } = payload;
    const supabase = createSupabaseAdminClient();
    logger.info("Processing transcript", { userId, transcriptId });
    const { data: transcript, error: fetchError } = await supabase.from("cp_call_transcripts").select("id, user_id, source, external_id, title, call_date, duration_minutes, participants, raw_transcript, summary, extracted_topics, transcript_type, ideas_extracted_at, knowledge_extracted_at, created_at").eq("id", transcriptId).eq("user_id", userId).single();
    if (fetchError || !transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }
    if (transcript.knowledge_extracted_at && transcript.ideas_extracted_at) {
      logger.info("Transcript already processed, skipping", { transcriptId });
      return {
        transcriptId,
        transcriptType: transcript.transcript_type,
        knowledgeEntries: 0,
        contentIdeas: 0,
        postReadyIdeas: 0,
        skipped: true
      };
    }
    logger.info("Step 1: Classifying transcript");
    const transcriptType = await classifyTranscript(transcript.raw_transcript);
    await supabase.from("cp_call_transcripts").update({ transcript_type: transcriptType }).eq("id", transcriptId);
    logger.info("Classified transcript", { transcriptType });
    logger.info("Step 2: Extracting knowledge");
    const knowledgeResult = await extractKnowledgeFromTranscript(
      transcript.raw_transcript,
      transcriptType,
      {
        callTitle: transcript.title,
        participants: transcript.participants,
        callDate: transcript.call_date
      }
    );
    logger.info("Extracted knowledge entries", { count: knowledgeResult.total_count });
    logger.info("Step 3: Generating embeddings and saving knowledge");
    const tagCounts = /* @__PURE__ */ new Map();
    const embeddingTexts = knowledgeResult.entries.map(
      (entry) => `${entry.category}: ${entry.content}
Context: ${entry.context || ""}`
    );
    const embeddings = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < embeddingTexts.length; i += BATCH_SIZE) {
      const batch = embeddingTexts.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((text) => generateEmbedding(text)));
      for (const result of results) {
        embeddings.push(result.status === "fulfilled" ? result.value : null);
      }
    }
    const knowledgeInserts = knowledgeResult.entries.map((entry, idx) => {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      return {
        user_id: userId,
        transcript_id: transcriptId,
        category: entry.category,
        speaker: entry.speaker,
        content: entry.content,
        context: entry.context,
        tags: entry.tags,
        transcript_type: transcriptType,
        embedding: embeddings[idx] ? JSON.stringify(embeddings[idx]) : null
      };
    });
    if (knowledgeInserts.length > 0) {
      const { error: knowledgeError } = await supabase.from("cp_knowledge_entries").insert(knowledgeInserts);
      if (knowledgeError) {
        logger.error("Failed to insert knowledge entries", {
          error: knowledgeError.message
        });
      }
    }
    await Promise.allSettled(
      Array.from(tagCounts).map(
        ([tagName, count]) => supabase.rpc("cp_increment_tag_count", {
          p_user_id: userId,
          p_tag_name: tagName,
          p_count: count
        }).then(({ error }) => {
          if (error) logger.warn("Failed to increment tag", { tagName, error: error.message });
        })
      )
    );
    await supabase.from("cp_call_transcripts").update({ knowledge_extracted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", transcriptId);
    logger.info("Step 4: Extracting content ideas");
    const ideasResult = await extractIdeasFromTranscript(
      transcript.raw_transcript,
      {
        callTitle: transcript.title,
        participants: transcript.participants,
        callDate: transcript.call_date
      }
    );
    logger.info("Extracted content ideas", {
      count: ideasResult.total_count,
      postReady: ideasResult.post_ready_count
    });
    if (ideasResult.ideas.length > 0) {
      const ideaInserts = ideasResult.ideas.map((idea) => ({
        user_id: userId,
        transcript_id: transcriptId,
        title: idea.title,
        core_insight: idea.core_insight,
        full_context: idea.full_context,
        why_post_worthy: idea.why_post_worthy,
        post_ready: idea.post_ready,
        content_type: idea.content_type,
        content_pillar: idea.content_pillar,
        status: "extracted"
      }));
      const { error: ideasError } = await supabase.from("cp_content_ideas").insert(ideaInserts);
      if (ideasError) {
        logger.error("Failed to insert content ideas", {
          error: ideasError.message
        });
      }
    }
    await supabase.from("cp_call_transcripts").update({ ideas_extracted_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", transcriptId);
    logger.info("Transcript processing complete", {
      transcriptId,
      knowledgeEntries: knowledgeResult.total_count,
      contentIdeas: ideasResult.total_count,
      postReadyIdeas: ideasResult.post_ready_count
    });
    return {
      transcriptId,
      transcriptType,
      knowledgeEntries: knowledgeResult.total_count,
      contentIdeas: ideasResult.total_count,
      postReadyIdeas: ideasResult.post_ready_count
    };
  }, "run")
});
export {
  processTranscript
};
//# sourceMappingURL=process-transcript.mjs.map
