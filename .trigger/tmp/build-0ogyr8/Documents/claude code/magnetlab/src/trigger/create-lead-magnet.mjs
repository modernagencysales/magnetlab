import {
  generateLeadMagnetIdeasParallel,
  generatePostVariations,
  getExtractionQuestions,
  logApiError,
  polishLeadMagnetContent,
  processContentExtraction
} from "../../../../../chunk-WZ67LIHF.mjs";
import "../../../../../chunk-RWH646ED.mjs";
import "../../../../../chunk-DKPAWPJO.mjs";
import {
  sdk_default
} from "../../../../../chunk-HJL3WNPY.mjs";
import "../../../../../chunk-POHWGI23.mjs";
import {
  createSupabaseAdminClient
} from "../../../../../chunk-MDZYQ24F.mjs";
import {
  task
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/create-lead-magnet.ts
init_esm();

// src/lib/ai/email-sequence-generator.ts
init_esm();
function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }
  return new sdk_default({ apiKey, timeout: 3e4 });
}
__name(getAnthropicClient, "getAnthropicClient");
var EMAIL_SEQUENCE_SYSTEM_PROMPT = `You are an expert email copywriter creating a 5-email welcome sequence for someone who just downloaded a lead magnet. Your emails:

## SUBJECT LINE RULES
- Maximum 5 words
- Lowercase is fine (feels more personal)
- NO clickbait - be direct: "your scripts are here" not "You Won't BELIEVE What's Inside..."
- Match the casual, direct tone of the email

## EMAIL STRUCTURE RULES
- Sender's name appears 3+ times: greeting, first sentence, signature
- 6th grade reading level - short sentences, simple words
- ONE clear CTA per email (no multiple links)
- Include a "reply trigger" question or statement in each email to encourage engagement
- Sign off with sender's name

## EMAIL SEQUENCE (5 emails)

### Email 1: Immediate Delivery (Day 0)
- Deliver the lead magnet (clear download/access link)
- Quick intro: who you are, why this will help
- Reply trigger: Ask them to reply with one word to confirm they got it
- Very short - they want the content, not a novel

### Email 2: 24 Hours Later
- Check if they've had a chance to use it
- Link to your best video or content piece that complements the lead magnet
- Share one quick tip from the lead magnet
- Reply trigger: Ask what their biggest challenge is

### Email 3: 48 Hours Later
- Share 3-5 best free resources (not your products, genuine value)
- Position yourself as a curator of great content
- Reply trigger: Ask which resource they're most excited to check out

### Email 4: 72 Hours Later
- Invite to community OR share a case study/success story
- Show social proof of the methodology working
- Reply trigger: Ask if they have questions about implementing

### Email 5: 96 Hours Later
- Set newsletter expectations (what to expect, how often)
- Ask about topics they want covered
- Reply trigger: Ask them to hit reply with their #1 topic request

## TONE
- Conversational, like texting a smart friend
- No hype or corporate speak
- Real, authentic, occasionally funny
- Never use: "unleash", "supercharge", "game-changer", "unlock", "revolutionary"

## FORMAT
Return exactly 5 emails as a JSON array. Each email object has:
- day: number (0, 1, 2, 3, or 4)
- subject: string (max 5 words, lowercase ok)
- body: string (the full email content with {{first_name}} for personalization)
- replyTrigger: string (the specific question/prompt to encourage replies)`;
async function generateEmailSequence(input) {
  const { context } = input;
  const contextParts = [];
  contextParts.push(`LEAD MAGNET TITLE: ${context.leadMagnetTitle}`);
  contextParts.push(`FORMAT: ${context.leadMagnetFormat}`);
  contextParts.push(`CONTENTS: ${context.leadMagnetContents}`);
  contextParts.push(`SENDER NAME: ${context.senderName}`);
  contextParts.push(`BUSINESS DESCRIPTION: ${context.businessDescription}`);
  if (context.bestVideoUrl && context.bestVideoTitle) {
    contextParts.push(`BEST VIDEO TO LINK (Email 2): ${context.bestVideoTitle} - ${context.bestVideoUrl}`);
  }
  if (context.contentLinks && context.contentLinks.length > 0) {
    const links = context.contentLinks.map((l, i) => `${i + 1}. ${l.title} - ${l.url}`).join("\n");
    contextParts.push(`FREE RESOURCES TO SHARE (Email 3):
${links}`);
  }
  if (context.communityUrl) {
    contextParts.push(`COMMUNITY URL (Email 4): ${context.communityUrl}`);
  }
  const prompt = `${EMAIL_SEQUENCE_SYSTEM_PROMPT}

## CONTEXT
${contextParts.join("\n\n")}

Generate the 5-email welcome sequence. Return ONLY valid JSON - an array of 5 email objects:
[
  { "day": 0, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 1, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 2, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 3, "subject": "...", "body": "...", "replyTrigger": "..." },
  { "day": 4, "subject": "...", "body": "...", "replyTrigger": "..." }
]

IMPORTANT:
- Use {{first_name}} for personalization in the email body
- Include the actual URLs provided above in the relevant emails
- Each email should be complete and ready to send
- Sign off with "${context.senderName}" in each email`;
  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in AI response");
  }
  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Could not find JSON array in AI response");
  }
  const emails = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(emails) || emails.length !== 5) {
    throw new Error(`Expected 5 emails, got ${emails?.length || 0}`);
  }
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    if (typeof email.day !== "number" || email.day < 0 || email.day > 4) {
      throw new Error(`Email ${i + 1} has invalid day: ${email.day}`);
    }
    if (!email.subject || typeof email.subject !== "string") {
      throw new Error(`Email ${i + 1} missing subject`);
    }
    if (!email.body || typeof email.body !== "string") {
      throw new Error(`Email ${i + 1} missing body`);
    }
    if (!email.replyTrigger || typeof email.replyTrigger !== "string") {
      throw new Error(`Email ${i + 1} missing replyTrigger`);
    }
  }
  emails.sort((a, b) => a.day - b.day);
  return emails;
}
__name(generateEmailSequence, "generateEmailSequence");
function generateDefaultEmailSequence(leadMagnetTitle, senderName) {
  return [
    {
      day: 0,
      subject: "your download is ready",
      body: `Hey {{first_name}},

${senderName} here - your ${leadMagnetTitle} is ready!

[DOWNLOAD LINK]

Let me know you got it by replying with "got it" - I read every reply.

${senderName}`,
      replyTrigger: 'Reply with "got it" to confirm you received it'
    },
    {
      day: 1,
      subject: "did you get it?",
      body: `Hey {{first_name}},

${senderName} again - just checking in.

Did you have a chance to check out the ${leadMagnetTitle} yet?

Quick tip: [INSERT TIP FROM LEAD MAGNET]

What's your biggest challenge with this? Hit reply and let me know.

${senderName}`,
      replyTrigger: "What's your biggest challenge with this?"
    },
    {
      day: 2,
      subject: "free resources for you",
      body: `Hey {{first_name}},

${senderName} here with some free resources that complement what you downloaded:

1. [Resource 1]
2. [Resource 2]
3. [Resource 3]

Which one are you most excited to dive into? Reply and let me know!

${senderName}`,
      replyTrigger: "Which resource are you most excited to check out?"
    },
    {
      day: 3,
      subject: "quick question",
      body: `Hey {{first_name}},

${senderName} here.

I'm curious - have you had a chance to implement anything from the ${leadMagnetTitle}?

If you have questions, just hit reply. I read and respond to every email.

${senderName}`,
      replyTrigger: "Have any questions about implementing this?"
    },
    {
      day: 4,
      subject: "what should I cover next?",
      body: `Hey {{first_name}},

${senderName} one more time.

I'll be sending you valuable content regularly - strategies, tips, and insights.

But I want to make sure I'm covering topics YOU care about.

Hit reply with your #1 topic request and I'll make sure to cover it.

${senderName}`,
      replyTrigger: "What topic should I cover next?"
    }
  ];
}
__name(generateDefaultEmailSequence, "generateDefaultEmailSequence");

// src/lib/webhooks/gtm-system.ts
init_esm();
var GTM_SYSTEM_WEBHOOK_URL = process.env.GTM_SYSTEM_WEBHOOK_URL;
var GTM_SYSTEM_WEBHOOK_SECRET = process.env.GTM_SYSTEM_WEBHOOK_SECRET;
var GTM_WEBHOOK_TIMEOUT_MS = 5e3;
async function fireGtmLeadMagnetDeployedWebhook(data) {
  if (!GTM_SYSTEM_WEBHOOK_URL || !GTM_SYSTEM_WEBHOOK_SECRET) {
    return;
  }
  const payload = {
    event: "lead_magnet.deployed",
    source: "magnetlab",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    data
  };
  try {
    const response = await fetch(
      `${GTM_SYSTEM_WEBHOOK_URL}/api/webhooks/magnetlab`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": GTM_SYSTEM_WEBHOOK_SECRET
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GTM_WEBHOOK_TIMEOUT_MS)
      }
    );
    if (response.ok) {
      console.log("[gtm-system] lead_magnet.deployed webhook delivered successfully");
    } else {
      console.error(
        `[gtm-system] lead_magnet.deployed webhook failed with status ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      "[gtm-system] lead_magnet.deployed webhook error:",
      err instanceof Error ? err.message : err
    );
  }
}
__name(fireGtmLeadMagnetDeployedWebhook, "fireGtmLeadMagnetDeployedWebhook");

// src/trigger/create-lead-magnet.ts
function getAnthropicClient2() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }
  return new sdk_default({ apiKey, timeout: 3e4 });
}
__name(getAnthropicClient2, "getAnthropicClient");
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 60);
}
__name(slugify, "slugify");
async function generateExtractionAnswers(archetype, concept, businessContext) {
  const questions = getExtractionQuestions(archetype);
  if (!questions || questions.length === 0) {
    throw new Error(`No extraction questions found for archetype: ${archetype}`);
  }
  const questionsFormatted = questions.map((q) => `- id: "${q.id}"
  question: "${q.question}"
  required: ${q.required}`).join("\n\n");
  const prompt = `You are an expert content strategist. Given the business context below and a lead magnet concept, generate detailed, authentic-sounding answers to the content extraction questions. These answers should be substantive (3-8 sentences each for required questions) and draw directly from the business context provided.

BUSINESS CONTEXT:
- Business Description: ${businessContext.businessDescription}
- Credibility Markers: ${businessContext.credibilityMarkers?.join(", ") || "None specified"}
- Urgent Pains: ${businessContext.urgentPains?.join("; ") || "None specified"}
- Processes: ${businessContext.processes?.join(", ") || "None specified"}
- Tools: ${businessContext.tools?.join(", ") || "None specified"}
- Results: ${businessContext.results?.join("; ") || "None specified"}
- Frequent Questions: ${businessContext.frequentQuestions?.join("; ") || "None specified"}
- Success Example: ${businessContext.successExample || "None specified"}

LEAD MAGNET CONCEPT:
- Title: ${concept.title}
- Archetype: ${concept.archetypeName}
- Pain Solved: ${concept.painSolved}
- Contents: ${concept.contents}
- Delivery Format: ${concept.deliveryFormat}

EXTRACTION QUESTIONS TO ANSWER:
${questionsFormatted}

Generate answers that:
1. Are specific and detailed, not generic
2. Include real-sounding numbers, examples, and specifics from the business context
3. Sound like a knowledgeable practitioner sharing their expertise
4. Address each question thoroughly (3-8 sentences for required questions, 2-4 for optional)

Return ONLY valid JSON as an object where keys are the question IDs and values are the answer strings:
{
  "${questions[0]?.id || "example"}": "Detailed answer here...",
  ...
}`;
  const response = await getAnthropicClient2().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4e3,
    messages: [{ role: "user", content: prompt }]
  });
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude for extraction answers");
  }
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse extraction answers response");
  }
  return JSON.parse(jsonMatch[0]);
}
__name(generateExtractionAnswers, "generateExtractionAnswers");
function selectBestConcept(concepts, targetArchetype, topic) {
  const archetypeMatch = concepts.find((c) => c.archetype === targetArchetype);
  if (archetypeMatch) return archetypeMatch;
  if (topic) {
    const topicLower = topic.toLowerCase();
    const topicMatch = concepts.find(
      (c) => c.title.toLowerCase().includes(topicLower) || c.painSolved.toLowerCase().includes(topicLower) || c.contents.toLowerCase().includes(topicLower)
    );
    if (topicMatch) return topicMatch;
  }
  return concepts[0];
}
__name(selectBestConcept, "selectBestConcept");
var createLeadMagnetPipeline = task({
  id: "create-lead-magnet-pipeline",
  retry: {
    maxAttempts: 1
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { userId, userName, username, archetype, businessContext, topic, leadMagnetId } = payload;
    const supabase = createSupabaseAdminClient();
    const updateStatus = /* @__PURE__ */ __name(async (status) => {
      await supabase.from("lead_magnets").update({ status }).eq("id", leadMagnetId);
    }, "updateStatus");
    try {
      await updateStatus("processing");
      const fullBusinessContext = {
        businessDescription: businessContext.businessDescription,
        credibilityMarkers: businessContext.credibilityMarkers || [],
        urgentPains: businessContext.urgentPains || [],
        templates: [],
        processes: businessContext.processes || [],
        tools: businessContext.tools || [],
        frequentQuestions: businessContext.frequentQuestions || [],
        results: businessContext.results || [],
        successExample: businessContext.successExample,
        businessType: "coach-consultant"
      };
      const ideationResult = await generateLeadMagnetIdeasParallel(fullBusinessContext, void 0, userId);
      if (!ideationResult?.concepts?.length) {
        await updateStatus("failed");
        throw new Error("Ideation returned no concepts");
      }
      const selectedConcept = selectBestConcept(ideationResult.concepts, archetype, topic);
      const extractionAnswers = await generateExtractionAnswers(
        archetype,
        selectedConcept,
        businessContext
      );
      const extractedContent = await processContentExtraction(
        archetype,
        selectedConcept,
        extractionAnswers,
        void 0,
        userId
      );
      const postInput = {
        leadMagnetTitle: selectedConcept.title,
        format: selectedConcept.deliveryFormat,
        contents: selectedConcept.contents,
        problemSolved: selectedConcept.painSolved,
        credibility: fullBusinessContext.credibilityMarkers.join(", ") || "Industry expert",
        audience: fullBusinessContext.businessDescription,
        audienceStyle: "casual-direct",
        proof: fullBusinessContext.results.join("; ") || "Proven results with clients",
        ctaWord: "MAGNET",
        urgencyAngle: selectedConcept.whyNowHook
      };
      const postResult = await generatePostVariations(postInput, userId);
      await supabase.from("lead_magnets").update({
        title: selectedConcept.title,
        archetype,
        concept: selectedConcept,
        extracted_content: extractedContent,
        linkedin_post: postResult.variations[0]?.post || null,
        post_variations: postResult.variations,
        dm_template: postResult.dmTemplate,
        cta_word: postResult.ctaWord,
        scheduled_time: payload.scheduledTime || null,
        status: "draft"
      }).eq("id", leadMagnetId);
      let funnelResult = null;
      if (payload.autoPublishFunnel) {
        try {
          const slug = slugify(selectedConcept.title);
          let finalSlug = slug;
          let slugSuffix = 0;
          while (true) {
            const { data: slugExists } = await supabase.from("funnel_pages").select("id").eq("user_id", userId).eq("slug", finalSlug).single();
            if (!slugExists) break;
            slugSuffix++;
            finalSlug = `${slug}-${slugSuffix}`;
          }
          const funnelInsertData = {
            lead_magnet_id: leadMagnetId,
            user_id: userId,
            slug: finalSlug,
            optin_headline: selectedConcept.title,
            optin_subline: `Solve "${selectedConcept.painSolved}" with this free ${selectedConcept.deliveryFormat}.`,
            optin_button_text: "Get Free Access",
            optin_social_proof: null,
            thankyou_headline: "Thanks! Check your email.",
            thankyou_subline: "Your download is on the way.",
            theme: "dark",
            primary_color: "#8b5cf6",
            background_style: "solid"
          };
          let { data: funnel, error: funnelError } = await supabase.from("funnel_pages").insert(funnelInsertData).select().single();
          if (funnelError?.code === "23505") {
            finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
            ({ data: funnel, error: funnelError } = await supabase.from("funnel_pages").insert({ ...funnelInsertData, slug: finalSlug }).select().single());
          }
          if (funnelError || !funnel) {
            logApiError("create-lead-magnet-pipeline/funnel-create", funnelError, {
              userId,
              leadMagnetId
            });
          } else {
            try {
              const polished = await polishLeadMagnetContent(extractedContent, selectedConcept);
              await supabase.from("lead_magnets").update({
                polished_content: polished,
                polished_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("id", leadMagnetId);
            } catch (polishError) {
              logApiError("create-lead-magnet-pipeline/polish", polishError, {
                userId,
                leadMagnetId,
                note: "Non-critical, continuing with publish"
              });
            }
            if (username) {
              await supabase.from("funnel_pages").update({
                is_published: true,
                published_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("id", funnel.id);
              const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/p/${username}/${finalSlug}`;
              funnelResult = {
                id: funnel.id,
                slug: finalSlug,
                url: publicUrl
              };
            } else {
              funnelResult = {
                id: funnel.id,
                slug: finalSlug,
                url: null
              };
            }
          }
        } catch (funnelErr) {
          logApiError("create-lead-magnet-pipeline/funnel", funnelErr, {
            userId,
            leadMagnetId,
            note: "Non-critical, lead magnet created successfully"
          });
        }
      }
      try {
        const { data: brandKit } = await supabase.from("brand_kits").select("business_description, sender_name, best_video_url, best_video_title, content_links, community_url").eq("user_id", userId).single();
        const senderName = brandKit?.sender_name || userName || "Your Friend";
        const emailContext = {
          leadMagnetTitle: selectedConcept.title,
          leadMagnetFormat: selectedConcept.deliveryFormat,
          leadMagnetContents: selectedConcept.contents,
          senderName,
          businessDescription: brandKit?.business_description || businessContext.businessDescription,
          bestVideoUrl: brandKit?.best_video_url || void 0,
          bestVideoTitle: brandKit?.best_video_title || void 0,
          contentLinks: brandKit?.content_links,
          communityUrl: brandKit?.community_url || void 0,
          audienceStyle: "casual-direct"
        };
        let emails;
        try {
          emails = await generateEmailSequence({ context: emailContext });
        } catch (aiError) {
          logApiError("create-lead-magnet-pipeline/email-ai", aiError, {
            leadMagnetId,
            note: "Falling back to default sequence"
          });
          emails = generateDefaultEmailSequence(selectedConcept.title, senderName);
        }
        await supabase.from("email_sequences").upsert(
          {
            lead_magnet_id: leadMagnetId,
            user_id: userId,
            emails,
            status: "draft"
          },
          { onConflict: "lead_magnet_id" }
        );
      } catch (emailErr) {
        logApiError("create-lead-magnet-pipeline/email", emailErr, {
          userId,
          leadMagnetId,
          note: "Non-critical"
        });
      }
      await updateStatus(funnelResult?.url ? "published" : "draft");
      fireGtmLeadMagnetDeployedWebhook({
        leadMagnetId,
        leadMagnetTitle: selectedConcept.title,
        archetype,
        funnelPageUrl: funnelResult?.url ?? null,
        funnelPageSlug: funnelResult?.slug ?? null,
        scheduledPostId: null,
        postVariations: postResult.variations.map((v) => ({
          hookType: v.hookType,
          post: v.post,
          whyThisAngle: v.whyThisAngle
        }))
      }).catch(() => {
      });
      return {
        success: true,
        leadMagnetId,
        title: selectedConcept.title,
        funnelPage: funnelResult
      };
    } catch (error) {
      await updateStatus("failed");
      logApiError("create-lead-magnet-pipeline", error, { userId, leadMagnetId });
      throw error;
    }
  }, "run")
});
export {
  createLeadMagnetPipeline
};
//# sourceMappingURL=create-lead-magnet.mjs.map
