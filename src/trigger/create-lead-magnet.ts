import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import {
  generateLeadMagnetIdeasParallel,
  getExtractionQuestions,
  processContentExtraction,
  generatePostVariations,
  polishLeadMagnetContent,
} from "@/lib/ai/lead-magnet-generator";
import { generateEmailSequence, generateDefaultEmailSequence } from "@/lib/ai/email-sequence-generator";
import { logApiError } from "@/lib/api/errors";
import { fireGtmLeadMagnetDeployedWebhook } from "@/lib/webhooks/gtm-system";
import Anthropic from "@anthropic-ai/sdk";
import type {
  LeadMagnetArchetype,
  LeadMagnetConcept,
  BusinessContext,
  BusinessType,
  ExtractedContent,
  PostWriterInput,
  PostWriterResult,
} from "@/lib/types/lead-magnet";
import type { EmailGenerationContext } from "@/lib/types/email";

// ============================================
// TYPES
// ============================================

export interface CreateLeadMagnetPipelinePayload {
  userId: string;
  userName: string | null;
  username: string | null;
  archetype: LeadMagnetArchetype;
  businessContext: {
    businessDescription: string;
    credibilityMarkers: string[];
    urgentPains: string[];
    processes: string[];
    tools: string[];
    results: string[];
    frequentQuestions: string[];
    successExample?: string;
  };
  topic?: string;
  autoPublishFunnel: boolean;
  autoSchedulePost: boolean;
  scheduledTime?: string;
  leadMagnetId: string;
}

// ============================================
// HELPERS
// ============================================

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables");
  }
  return new Anthropic({ apiKey, timeout: 120_000 });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

async function generateExtractionAnswers(
  archetype: LeadMagnetArchetype,
  concept: LeadMagnetConcept,
  businessContext: CreateLeadMagnetPipelinePayload["businessContext"]
): Promise<Record<string, string>> {
  const questions = getExtractionQuestions(archetype);

  if (!questions || questions.length === 0) {
    throw new Error(`No extraction questions found for archetype: ${archetype}`);
  }

  const questionsFormatted = questions
    .map((q) => `- id: "${q.id}"\n  question: "${q.question}"\n  required: ${q.required}`)
    .join("\n\n");

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

  const response = await getAnthropicClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text response from Claude for extraction answers");
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse extraction answers response");
  }

  return JSON.parse(jsonMatch[0]) as Record<string, string>;
}

function selectBestConcept(
  concepts: LeadMagnetConcept[],
  targetArchetype: LeadMagnetArchetype,
  topic?: string
): LeadMagnetConcept {
  const archetypeMatch = concepts.find((c) => c.archetype === targetArchetype);
  if (archetypeMatch) return archetypeMatch;

  if (topic) {
    const topicLower = topic.toLowerCase();
    const topicMatch = concepts.find(
      (c) =>
        c.title.toLowerCase().includes(topicLower) ||
        c.painSolved.toLowerCase().includes(topicLower) ||
        c.contents.toLowerCase().includes(topicLower)
    );
    if (topicMatch) return topicMatch;
  }

  return concepts[0];
}

// ============================================
// TRIGGER.DEV TASK
// ============================================

export const createLeadMagnetPipeline = task({
  id: "create-lead-magnet-pipeline",
  retry: {
    maxAttempts: 2,
  },
  run: async (payload: CreateLeadMagnetPipelinePayload) => {
    const { userId, userName, username, archetype, businessContext, topic, leadMagnetId } = payload;
    const supabase = createSupabaseAdminClient();

    const updateStatus = async (status: string) => {
      await supabase
        .from("lead_magnets")
        .update({ status })
        .eq("id", leadMagnetId);
    };

    try {
      // ==========================================
      // STEP A: Ideation
      // ==========================================
      await updateStatus("processing");

      const fullBusinessContext: BusinessContext = {
        businessDescription: businessContext.businessDescription,
        credibilityMarkers: businessContext.credibilityMarkers || [],
        urgentPains: businessContext.urgentPains || [],
        templates: [],
        processes: businessContext.processes || [],
        tools: businessContext.tools || [],
        frequentQuestions: businessContext.frequentQuestions || [],
        results: businessContext.results || [],
        successExample: businessContext.successExample,
        businessType: "coach-consultant" as BusinessType,
      };

      const ideationResult = await generateLeadMagnetIdeasParallel(fullBusinessContext, undefined, userId);

      if (!ideationResult?.concepts?.length) {
        await updateStatus("failed");
        throw new Error("Ideation returned no concepts");
      }

      // ==========================================
      // STEP B: Select concept
      // ==========================================
      const selectedConcept = selectBestConcept(ideationResult.concepts, archetype, topic);

      // ==========================================
      // STEP C: Generate extraction answers
      // ==========================================
      const extractionAnswers = await generateExtractionAnswers(
        archetype,
        selectedConcept,
        businessContext
      );

      // ==========================================
      // STEP D: Generate content
      // ==========================================
      const extractedContent: ExtractedContent = await processContentExtraction(
        archetype,
        selectedConcept,
        extractionAnswers,
        undefined,
        userId
      );

      // ==========================================
      // STEP E: Generate post variations
      // ==========================================
      const postInput: PostWriterInput = {
        leadMagnetTitle: selectedConcept.title,
        format: selectedConcept.deliveryFormat,
        contents: selectedConcept.contents,
        problemSolved: selectedConcept.painSolved,
        credibility: fullBusinessContext.credibilityMarkers.join(", ") || "Industry expert",
        audience: fullBusinessContext.businessDescription,
        audienceStyle: "casual-direct",
        proof: fullBusinessContext.results.join("; ") || "Proven results with clients",
        ctaWord: "MAGNET",
        urgencyAngle: selectedConcept.whyNowHook,
      };

      const postResult: PostWriterResult = await generatePostVariations(postInput, userId);

      // ==========================================
      // STEP F: Update lead magnet record
      // ==========================================
      await supabase
        .from("lead_magnets")
        .update({
          title: selectedConcept.title,
          archetype,
          concept: selectedConcept,
          extracted_content: extractedContent,
          linkedin_post: postResult.variations[0]?.post || null,
          post_variations: postResult.variations,
          dm_template: postResult.dmTemplate,
          cta_word: postResult.ctaWord,
          scheduled_time: payload.scheduledTime || null,
          status: "draft",
        })
        .eq("id", leadMagnetId);

      // ==========================================
      // STEP G: Auto-publish funnel (if enabled)
      // ==========================================
      let funnelResult: { id: string; slug: string; url: string | null } | null = null;

      if (payload.autoPublishFunnel) {
        try {
          const slug = slugify(selectedConcept.title);

          // Check for slug collision
          let finalSlug = slug;
          let slugSuffix = 0;
          while (true) {
            const { data: slugExists } = await supabase
              .from("funnel_pages")
              .select("id")
              .eq("user_id", userId)
              .eq("slug", finalSlug)
              .single();

            if (!slugExists) break;
            slugSuffix++;
            finalSlug = `${slug}-${slugSuffix}`;
          }

          // Create funnel page
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
            background_style: "solid",
          };

          let { data: funnel, error: funnelError } = await supabase
            .from("funnel_pages")
            .insert(funnelInsertData)
            .select()
            .single();

          // Retry once on unique constraint violation
          if (funnelError?.code === "23505") {
            finalSlug = `${finalSlug}-${Date.now().toString(36).slice(-4)}`;
            ({ data: funnel, error: funnelError } = await supabase
              .from("funnel_pages")
              .insert({ ...funnelInsertData, slug: finalSlug })
              .select()
              .single());
          }

          if (funnelError || !funnel) {
            logApiError("create-lead-magnet-pipeline/funnel-create", funnelError, {
              userId,
              leadMagnetId,
            });
          } else {
            // Auto-polish content — must succeed before funnel is published
            let polishSucceeded = false;
            try {
              const polished = await polishLeadMagnetContent(extractedContent, selectedConcept);
              await supabase
                .from("lead_magnets")
                .update({
                  polished_content: polished,
                  polished_at: new Date().toISOString(),
                })
                .eq("id", leadMagnetId);
              polishSucceeded = true;
            } catch (polishError) {
              logApiError("create-lead-magnet-pipeline/polish", polishError, {
                userId,
                leadMagnetId,
                note: "Polish failed — funnel will NOT be published",
              });
            }

            // Only publish if polish succeeded and user has a username
            if (polishSucceeded && username) {
              await supabase
                .from("funnel_pages")
                .update({
                  is_published: true,
                  published_at: new Date().toISOString(),
                })
                .eq("id", funnel.id);

              const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL || ""}/p/${username}/${finalSlug}`;

              funnelResult = {
                id: funnel.id,
                slug: finalSlug,
                url: publicUrl,
              };
            } else {
              funnelResult = {
                id: funnel.id,
                slug: finalSlug,
                url: null,
              };
            }
          }
        } catch (funnelErr) {
          logApiError("create-lead-magnet-pipeline/funnel", funnelErr, {
            userId,
            leadMagnetId,
            note: "Non-critical, lead magnet created successfully",
          });
        }
      }

      // ==========================================
      // STEP H: Generate email sequence
      // ==========================================
      try {
        const { data: brandKit } = await supabase
          .from("brand_kits")
          .select("business_description, sender_name, best_video_url, best_video_title, content_links, community_url")
          .eq("user_id", userId)
          .single();

        const senderName = brandKit?.sender_name || userName || "Your Friend";

        const emailContext: EmailGenerationContext = {
          leadMagnetTitle: selectedConcept.title,
          leadMagnetFormat: selectedConcept.deliveryFormat,
          leadMagnetContents: selectedConcept.contents,
          senderName,
          businessDescription: brandKit?.business_description || businessContext.businessDescription,
          bestVideoUrl: brandKit?.best_video_url || undefined,
          bestVideoTitle: brandKit?.best_video_title || undefined,
          contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
          communityUrl: brandKit?.community_url || undefined,
          audienceStyle: "casual-direct",
        };

        let emails;
        try {
          emails = await generateEmailSequence({ context: emailContext });
        } catch (aiError) {
          logApiError("create-lead-magnet-pipeline/email-ai", aiError, {
            leadMagnetId,
            note: "Falling back to default sequence",
          });
          emails = generateDefaultEmailSequence(selectedConcept.title, senderName);
        }

        await supabase
          .from("email_sequences")
          .upsert(
            {
              lead_magnet_id: leadMagnetId,
              user_id: userId,
              emails,
              status: "draft",
            },
            { onConflict: "lead_magnet_id" }
          );
      } catch (emailErr) {
        logApiError("create-lead-magnet-pipeline/email", emailErr, {
          userId,
          leadMagnetId,
          note: "Non-critical",
        });
      }

      // ==========================================
      // STEP I: Update status to published
      // ==========================================
      await updateStatus(funnelResult?.url ? "published" : "draft");

      // ==========================================
      // STEP J: Fire GTM webhook
      // ==========================================
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
          whyThisAngle: v.whyThisAngle,
        })),
      }, userId).catch(() => {
        // Already logged inside the webhook function
      });

      return {
        success: true,
        leadMagnetId,
        title: selectedConcept.title,
        funnelPage: funnelResult,
      };
    } catch (error) {
      await updateStatus("failed");
      logApiError("create-lead-magnet-pipeline", error, { userId, leadMagnetId });
      throw error;
    }
  },
});
