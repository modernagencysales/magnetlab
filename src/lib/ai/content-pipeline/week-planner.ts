import { getTopIdeas } from './idea-scorer';
import { cosineSimilarity, generateEmbedding, createIdeaEmbeddingText, createTemplateEmbeddingText } from '@/lib/ai/embeddings';
import type {
  ContentIdea,
  PostTemplate,
  PostingSlot,
  PlannedPost,
  ContentPillar,
  PillarDistribution,
  BusinessContext,
} from '@/lib/types/content-pipeline';
import type { ScoringContext } from './idea-scorer';

interface WeekPlanInput {
  userId: string;
  weekStartDate: string;
  postsPerWeek: number;
  pillarDistribution: PillarDistribution;
  ideas: ContentIdea[];
  templates: PostTemplate[];
  slots: PostingSlot[];
  businessContext?: BusinessContext | null;
  recentPostTitles: string[];
}

interface WeekPlanResult {
  plannedPosts: PlannedPost[];
  generationNotes: string;
}

const PILLAR_KEYS: ContentPillar[] = [
  'moments_that_matter',
  'teaching_promotion',
  'human_personal',
  'collaboration_social_proof',
];

export function validatePillarDistribution(dist: PillarDistribution): boolean {
  const sum =
    dist.moments_that_matter +
    dist.teaching_promotion +
    dist.human_personal +
    dist.collaboration_social_proof;
  return sum === 100 && Object.values(dist).every((v) => v >= 0 && v <= 100);
}

export function getSuggestedDistribution(): PillarDistribution {
  return {
    moments_that_matter: 25,
    teaching_promotion: 35,
    human_personal: 20,
    collaboration_social_proof: 20,
  };
}

function getPostCountPerPillar(
  total: number,
  dist: PillarDistribution
): Record<ContentPillar, number> {
  const raw: Record<string, number> = {};
  let allocated = 0;

  for (const pillar of PILLAR_KEYS) {
    const pct = dist[pillar];
    const count = Math.floor((pct / 100) * total);
    raw[pillar] = count;
    allocated += count;
  }

  // Distribute remainder to the pillar with highest percentage
  let remainder = total - allocated;
  const sorted = [...PILLAR_KEYS].sort((a, b) => dist[b] - dist[a]);
  let i = 0;
  while (remainder > 0) {
    raw[sorted[i % sorted.length]]++;
    remainder--;
    i++;
  }

  return raw as Record<ContentPillar, number>;
}

function getSlotsForWeek(slots: PostingSlot[]): Array<{ day: number; time: string }> {
  const activeSlots = slots.filter((s) => s.is_active);
  if (activeSlots.length === 0) {
    // Default: one slot per day at 9 AM
    return Array.from({ length: 7 }, (_, i) => ({ day: i, time: '09:00' }));
  }

  const weekSlots: Array<{ day: number; time: string }> = [];
  for (const slot of activeSlots) {
    if (slot.day_of_week !== null) {
      weekSlots.push({ day: slot.day_of_week, time: slot.time_of_day });
    } else {
      // Slot applies to all days
      for (let d = 0; d < 7; d++) {
        weekSlots.push({ day: d, time: slot.time_of_day });
      }
    }
  }

  return weekSlots.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));
}

async function matchIdeasToTemplates(
  ideas: ContentIdea[],
  templates: PostTemplate[]
): Promise<Map<string, { templateId: string; templateName: string; score: number } | null>> {
  const matches = new Map<string, { templateId: string; templateName: string; score: number } | null>();

  if (templates.length === 0) {
    ideas.forEach((idea) => matches.set(idea.id, null));
    return matches;
  }

  // Generate embeddings for ideas and templates
  const ideaTexts = ideas.map((idea) => createIdeaEmbeddingText(idea));
  const templateTexts = templates.map((t) => createTemplateEmbeddingText(t));

  try {
    const [ideaEmbeddings, templateEmbeddings] = await Promise.all([
      Promise.all(ideaTexts.map((t) => generateEmbedding(t))),
      Promise.all(templateTexts.map((t) => generateEmbedding(t))),
    ]);

    for (let i = 0; i < ideas.length; i++) {
      let bestScore = 0;
      let bestIdx = -1;

      for (let j = 0; j < templates.length; j++) {
        const score = cosineSimilarity(ideaEmbeddings[i], templateEmbeddings[j]);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = j;
        }
      }

      if (bestIdx >= 0 && bestScore > 0.5) {
        matches.set(ideas[i].id, {
          templateId: templates[bestIdx].id,
          templateName: templates[bestIdx].name,
          score: bestScore,
        });
      } else {
        matches.set(ideas[i].id, null);
      }
    }
  } catch {
    // Fallback: no template matching if embeddings fail
    ideas.forEach((idea) => matches.set(idea.id, null));
  }

  return matches;
}

export async function generateWeekPlan(input: WeekPlanInput): Promise<WeekPlanResult> {
  const {
    postsPerWeek,
    pillarDistribution,
    ideas,
    templates,
    slots,
    recentPostTitles,
  } = input;

  // Build scoring context
  const pillarCounts: Record<ContentPillar, number> = {
    moments_that_matter: 0,
    teaching_promotion: 0,
    human_personal: 0,
    collaboration_social_proof: 0,
  };
  const scoringContext: ScoringContext = { recentPostTitles, pillarCounts };

  // Get top ideas (2x the needed count for flexibility)
  const topIdeas = getTopIdeas(ideas, postsPerWeek * 2, scoringContext);

  // Calculate posts per pillar
  const postsPerPillar = getPostCountPerPillar(postsPerWeek, pillarDistribution);

  // Match ideas to templates
  const ideaList = topIdeas.map((ri) => ri.idea);
  const templateMatches = await matchIdeasToTemplates(ideaList, templates);

  // Get available slots for the week
  const weekSlots = getSlotsForWeek(slots);

  // Assign ideas to pillars and slots
  const plannedPosts: PlannedPost[] = [];
  const usedIdeaIds = new Set<string>();
  const notes: string[] = [];
  let slotIndex = 0;

  for (const pillar of PILLAR_KEYS) {
    const needed = postsPerPillar[pillar];
    const pillarIdeas = topIdeas
      .filter((ri) => ri.idea.content_pillar === pillar && !usedIdeaIds.has(ri.idea.id))
      .slice(0, needed);

    // If not enough ideas for this pillar, grab from unassigned
    if (pillarIdeas.length < needed) {
      const fillCount = needed - pillarIdeas.length;
      const unassigned = topIdeas
        .filter((ri) => !usedIdeaIds.has(ri.idea.id) && !pillarIdeas.some((pi) => pi.idea.id === ri.idea.id))
        .slice(0, fillCount);
      pillarIdeas.push(...unassigned);

      if (fillCount > 0) {
        notes.push(`Assigned ${fillCount} non-${pillar} idea(s) to fill the ${pillar} quota`);
      }
    }

    for (const rankedIdea of pillarIdeas) {
      if (slotIndex >= weekSlots.length) break;

      const slot = weekSlots[slotIndex % weekSlots.length];
      const match = templateMatches.get(rankedIdea.idea.id);

      plannedPosts.push({
        day: slot.day,
        time: slot.time,
        idea_id: rankedIdea.idea.id,
        template_id: match?.templateId || null,
        pillar,
        assigned_post_id: null,
        idea_title: rankedIdea.idea.title,
        idea_hook: rankedIdea.idea.hook || undefined,
        template_name: match?.templateName || undefined,
        match_score: match?.score || undefined,
      });

      usedIdeaIds.add(rankedIdea.idea.id);
      slotIndex++;
    }
  }

  // Sort by day then time
  plannedPosts.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

  if (plannedPosts.length < postsPerWeek) {
    notes.push(`Only ${plannedPosts.length} posts planned (target: ${postsPerWeek}). Need more ideas.`);
  }

  return {
    plannedPosts,
    generationNotes: notes.length > 0 ? notes.join('\n') : 'Plan generated successfully.',
  };
}
