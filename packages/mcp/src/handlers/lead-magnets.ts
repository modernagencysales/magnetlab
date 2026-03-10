import { MagnetLabClient } from '../client.js';
import type { Archetype, LeadMagnetStatus, FunnelTheme, BackgroundStyle } from '../constants.js';

/** Generate URL-safe slug from a title. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

// ─── Brain Enrichment ─────────────────────────────────────

interface BrainEntry {
  id: string;
  content: string;
  category?: string;
  knowledge_type?: string;
  quality_score?: number;
  tags?: string[];
  topics?: string[];
}

interface Position {
  thesis?: string;
  stance_type?: string;
  key_arguments?: string[];
  unique_data_points?: Array<{ claim: string; evidence_strength?: string }>;
  stories?: Array<{ hook: string; arc: string; lesson: string }>;
  specific_recommendations?: Array<{ recommendation: string; reasoning: string }>;
  voice_markers?: string[];
  differentiators?: string[];
  contradictions?: Array<{ tension: string; resolution?: string }>;
  coverage_gaps?: string[];
  supporting_entry_ids?: string[];
}

/**
 * Build concept fields from a synthesized Position.
 * Returns only brain-derived fields — caller merges with manual concept.
 */
export function enrichConceptFromPosition(position: Position): Record<string, unknown> {
  const concept: Record<string, unknown> = {};

  if (position.thesis) {
    concept.painSolved = position.thesis;
  }

  if (position.differentiators?.length) {
    concept.whyNowHook = position.differentiators[0];
  }

  if (position.stories?.length) {
    const story = position.stories[0];
    concept.hook = `${story.hook} — ${story.lesson}`;
  } else if (position.unique_data_points?.length) {
    concept.hook = position.unique_data_points[0].claim;
  }

  if (position.coverage_gaps?.length) {
    concept.pain_points = position.coverage_gaps;
  }

  if (position.key_arguments?.length) {
    concept.key_takeaways = position.key_arguments;
  }

  if (position.specific_recommendations?.length) {
    concept.cta_angle = position.specific_recommendations[0].recommendation;
  }

  // Build contents summary from arguments + recommendations
  const parts: string[] = [];
  if (position.key_arguments?.length) {
    parts.push(...position.key_arguments);
  }
  if (position.specific_recommendations?.length) {
    parts.push(...position.specific_recommendations.map((r) => r.recommendation));
  }
  if (parts.length > 0) {
    concept.contents = parts.join('. ');
  }

  return concept;
}

/**
 * Build basic concept fields from raw knowledge entries (fallback when no position).
 */
function enrichConceptFromEntries(entries: BrainEntry[]): Record<string, unknown> {
  const insights = entries.filter(
    (e) => e.category === 'insight' || e.knowledge_type === 'insight'
  );
  const questions = entries.filter(
    (e) => e.category === 'question' || e.knowledge_type === 'question'
  );
  const stories = entries.filter((e) => e.knowledge_type === 'story');

  const concept: Record<string, unknown> = {};

  if (insights.length > 0) {
    concept.painSolved = insights[0].content;
    concept.key_takeaways = insights.slice(0, 5).map((e) => e.content);
  }

  if (questions.length > 0) {
    concept.pain_points = questions.slice(0, 3).map((e) => e.content);
  }

  if (stories.length > 0) {
    concept.hook = stories[0].content;
  }

  return concept;
}

/**
 * Merge two concept objects. Manual fields take priority over brain-derived ones.
 */
function mergeConcepts(
  brainConcept: Record<string, unknown>,
  manualConcept: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...brainConcept };
  for (const [key, value] of Object.entries(manualConcept)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * Enrich a lead magnet concept using the AI Brain.
 * Searches knowledge, synthesizes position, and builds concept fields.
 */
async function enrichFromBrain(
  client: MagnetLabClient,
  title: string,
  brainQuery?: string,
  knowledgeEntryIds?: string[]
): Promise<{
  concept: Record<string, unknown>;
  brain_entries_used: number;
  position_used: boolean;
}> {
  const query = brainQuery || title;

  // Step 1: Search brain for relevant entries
  let entries: BrainEntry[] = [];
  try {
    const searchResult = (await client.searchKnowledge({ query, limit: 20 })) as {
      entries?: BrainEntry[];
    };
    entries = searchResult?.entries || [];
  } catch {
    // Brain search failed — continue without
  }

  // Step 2: Extract dominant topic slug from entries
  const topicCounts = new Map<string, number>();
  for (const entry of entries) {
    for (const topic of entry.topics || []) {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    }
  }

  let dominantTopic: string | null = null;
  let maxCount = 0;
  for (const [topic, count] of topicCounts) {
    if (count > maxCount) {
      dominantTopic = topic;
      maxCount = count;
    }
  }

  // Step 3: Try to synthesize position
  let position: Position | null = null;
  if (dominantTopic) {
    try {
      const posResult = (await client.synthesizePosition({ topic: dominantTopic })) as {
        position?: Position;
      };
      position = posResult?.position || null;
    } catch {
      // Position synthesis failed — fall back to raw entries
    }
  }

  // Step 4: Build concept from position or entries
  let concept: Record<string, unknown>;
  if (position) {
    concept = enrichConceptFromPosition(position);
  } else if (entries.length > 0) {
    concept = enrichConceptFromEntries(entries);
  } else {
    concept = {};
  }

  // Step 5: Store brain metadata for content generation
  concept._brain_entry_ids = [...(knowledgeEntryIds || []), ...entries.map((e) => e.id)].filter(
    (id, i, arr) => arr.indexOf(id) === i
  ); // dedupe

  if (position) {
    concept._brain_position = position;
  }

  if (position?.unique_data_points?.length) {
    concept._brain_data_points = position.unique_data_points.map((dp) => dp.claim);
  }

  if (position?.stories?.length) {
    concept._brain_stories = position.stories.map((s) => `${s.hook}: ${s.arc} → ${s.lesson}`);
  }

  if (position?.voice_markers?.length) {
    concept._brain_voice_markers = position.voice_markers;
  }

  return {
    concept,
    brain_entries_used: entries.length,
    position_used: !!position,
  };
}

// ─── Handler ──────────────────────────────────────────────

/**
 * Handle lead magnet related tool calls.
 */
export async function handleLeadMagnetTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_lead_magnets':
      return client.listLeadMagnets({
        status: args.status as LeadMagnetStatus | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_lead_magnet':
      return client.getLeadMagnet(args.id as string);

    case 'magnetlab_create_lead_magnet': {
      // Brain enrichment: search + synthesize + merge
      let finalConcept = (args.concept as Record<string, unknown>) || {};
      let brainMeta: { brain_entries_used?: number; position_used?: boolean } = {};

      if (args.use_brain) {
        const brainResult = await enrichFromBrain(
          client,
          args.title as string,
          args.brain_query as string | undefined,
          args.knowledge_entry_ids as string[] | undefined
        );

        // Merge: manual concept fields take priority over brain-derived
        finalConcept = mergeConcepts(brainResult.concept, finalConcept);
        brainMeta = {
          brain_entries_used: brainResult.brain_entries_used,
          position_used: brainResult.position_used,
        };
      }

      const leadMagnet = await client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: Object.keys(finalConcept).length > 0 ? finalConcept : (args.concept as unknown),
      });

      const funnelConfig = args.funnel_config as Record<string, unknown> | undefined;
      if (!funnelConfig) {
        if (brainMeta.brain_entries_used !== undefined) {
          return { ...(leadMagnet as Record<string, unknown>), ...brainMeta };
        }
        return leadMagnet;
      }

      // Extract lead magnet ID from response
      const lmId = (leadMagnet as Record<string, unknown>).id as string;
      if (!lmId) {
        return {
          ...(leadMagnet as Record<string, unknown>),
          funnel_error: 'Could not extract lead magnet ID',
        };
      }

      const slug = (funnelConfig.slug as string) || slugify(args.title as string);
      const shouldPublish = funnelConfig.publish === true;

      try {
        const funnelResult = await client.createFunnel({
          leadMagnetId: lmId,
          slug,
          optinHeadline: funnelConfig.optin_headline as string | undefined,
          optinSubline: funnelConfig.optin_subline as string | undefined,
          optinButtonText: funnelConfig.optin_button_text as string | undefined,
          optinSocialProof: funnelConfig.optin_social_proof as string | undefined,
          thankyouHeadline: funnelConfig.thankyou_headline as string | undefined,
          thankyouSubline: funnelConfig.thankyou_subline as string | undefined,
          theme: funnelConfig.theme as FunnelTheme | undefined,
          primaryColor: funnelConfig.primary_color as string | undefined,
          backgroundStyle: funnelConfig.background_style as BackgroundStyle | undefined,
          vslUrl: funnelConfig.vsl_url as string | undefined,
          calendlyUrl: funnelConfig.calendly_url as string | undefined,
          logoUrl: funnelConfig.logo_url as string | undefined,
          qualificationFormId: funnelConfig.qualification_form_id as string | undefined,
        });

        const funnelData = funnelResult as Record<string, unknown>;
        let publishResult: { publicUrl?: string | null } | undefined;

        if (shouldPublish) {
          const funnelId =
            ((funnelData.funnel as Record<string, unknown>)?.id as string) ||
            (funnelData.id as string);
          if (funnelId) {
            try {
              publishResult = (await client.publishFunnel(funnelId)) as {
                publicUrl?: string | null;
              };
            } catch (publishErr) {
              return {
                lead_magnet: leadMagnet,
                funnel: funnelData,
                publish_error: publishErr instanceof Error ? publishErr.message : 'Publish failed',
                ...brainMeta,
              };
            }
          }
        }

        return {
          lead_magnet: leadMagnet,
          funnel: funnelData,
          ...(publishResult?.publicUrl ? { public_url: publishResult.publicUrl } : {}),
          ...brainMeta,
        };
      } catch (funnelErr) {
        return {
          lead_magnet: leadMagnet,
          funnel_error: funnelErr instanceof Error ? funnelErr.message : 'Funnel creation failed',
          ...brainMeta,
        };
      }
    }

    case 'magnetlab_generate_lead_magnet_content':
      return client.generateLeadMagnetContent(args.lead_magnet_id as string);

    case 'magnetlab_delete_lead_magnet':
      return client.deleteLeadMagnet(args.id as string);

    case 'magnetlab_get_lead_magnet_stats':
      return client.getLeadMagnetStats(args.lead_magnet_id as string);

    case 'magnetlab_analyze_competitor':
      return client.analyzeCompetitor({ url: args.url as string });

    case 'magnetlab_generate_lead_magnet_posts':
      return client.generateLeadMagnetPosts(args.lead_magnet_id as string);

    case 'magnetlab_analyze_transcript':
      return client.analyzeTranscript({ transcript: args.transcript as string });

    case 'magnetlab_lead_magnet_status': {
      const lmId = args.lead_magnet_id as string;

      // Fetch lead magnet, funnel, and email sequence in parallel
      const [lmResult, funnelResult, seqResult] = await Promise.all([
        client.getLeadMagnet(lmId).catch(() => null),
        client.getFunnelByTarget({ leadMagnetId: lmId }).catch(() => ({ funnel: null })),
        client.getEmailSequence(lmId).catch(() => ({ emailSequence: null })),
      ]);

      if (!lmResult) {
        throw new Error(`Lead magnet ${lmId} not found`);
      }

      const lm = lmResult as Record<string, unknown>;
      const concept = lm.concept as Record<string, unknown> | undefined;
      const funnel = (funnelResult as { funnel: Record<string, unknown> | null })?.funnel;
      const seq = (seqResult as { emailSequence: Record<string, unknown> | null })?.emailSequence;

      const hasConcept = !!concept && Object.keys(concept).length > 0;
      const hasContent = !!(lm.extracted_content || lm.polished_content);
      const hasPosts = !!(lm.linkedin_post || lm.post_variations);
      const brainEnriched = !!(concept?._brain_position || concept?._brain_entry_ids);
      const brainEntryCount = Array.isArray(concept?._brain_entry_ids)
        ? (concept._brain_entry_ids as string[]).length
        : 0;

      const funnelPublished = funnel?.status === 'published';
      const seqStatus = seq?.status as string | undefined;
      const seqEmails = Array.isArray(seq?.emails) ? (seq.emails as unknown[]).length : 0;

      // Determine what's missing
      const missing: string[] = [];
      if (!hasConcept)
        missing.push('No concept — create_lead_magnet was called without concept data');
      if (!hasContent) missing.push('No content — call magnetlab_generate_lead_magnet_content');
      if (!funnel) missing.push('No funnel — call magnetlab_create_funnel');
      if (funnel && !funnelPublished)
        missing.push('Funnel not published — call magnetlab_publish_funnel');
      if (!seq) missing.push('No email sequence — call magnetlab_generate_email_sequence');
      if (seq && seqStatus !== 'active')
        missing.push('Email sequence not active — call magnetlab_activate_email_sequence');

      // Determine next step
      let nextStep: string;
      if (!hasConcept)
        nextStep = 'Add a concept to this lead magnet or recreate with use_brain=true';
      else if (!hasContent) nextStep = 'Generate content: magnetlab_generate_lead_magnet_content';
      else if (!funnel) nextStep = 'Create funnel: magnetlab_create_funnel';
      else if (!seq) nextStep = 'Generate email sequence: magnetlab_generate_email_sequence';
      else if (seqStatus !== 'active')
        nextStep = 'Activate email sequence: magnetlab_activate_email_sequence';
      else if (!funnelPublished) nextStep = 'Publish funnel: magnetlab_publish_funnel';
      else nextStep = 'Complete — lead magnet is live with active email sequence';

      return {
        lead_magnet: {
          id: lm.id,
          title: lm.title,
          status: lm.status,
          has_concept: hasConcept,
          has_content: hasContent,
          has_posts: hasPosts,
          brain_enriched: brainEnriched,
          brain_entries_used: brainEntryCount,
        },
        funnel: funnel
          ? {
              exists: true,
              id: funnel.id,
              slug: funnel.slug,
              is_published: funnelPublished,
              public_url: funnel.public_url || funnel.publicUrl || null,
            }
          : { exists: false },
        email_sequence: seq
          ? {
              exists: true,
              status: seqStatus,
              email_count: seqEmails,
            }
          : { exists: false },
        missing,
        next_step: nextStep,
      };
    }

    default:
      throw new Error(`Unknown lead magnet tool: ${name}`);
  }
}
