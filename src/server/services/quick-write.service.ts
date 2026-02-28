/**
 * Quick Write Service
 * Raw thought → AI post + polish → save as pipeline post.
 */

import { quickWrite } from "@/lib/ai/content-pipeline/quick-writer";
import * as postsRepo from "@/server/repositories/posts.repo";
import * as teamRepo from "@/server/repositories/team.repo";
import type { PipelinePost } from "@/lib/types/content-pipeline";

export interface QuickWriteInput {
  raw_thought: string;
  template_structure?: string | null;
  style_instructions?: string | null;
  target_audience?: string | null;
  profileId?: string | null;
}

export interface QuickWriteResult {
  post: PipelinePost;
  synthetic_idea: { title?: string; core_insight?: string; full_context?: string; why_post_worthy?: string; content_type?: string };
}

export async function executeQuickWrite(
  userId: string,
  input: QuickWriteInput,
): Promise<QuickWriteResult> {
  let voiceOptions: {
    voiceProfile?: Record<string, unknown>;
    authorName?: string;
    authorTitle?: string;
  } = {};
  if (input.profileId) {
    const profile = await teamRepo.findProfileVoiceAndName(input.profileId);
    if (profile) {
      voiceOptions = {
        voiceProfile: profile.voice_profile as Record<string, unknown>,
        authorName: profile.full_name ?? undefined,
        authorTitle: profile.title ?? undefined,
      };
    }
  }

  const result = await quickWrite(input.raw_thought, {
    templateStructure: input.template_structure ?? undefined,
    styleInstructions: input.style_instructions ?? undefined,
    targetAudience: input.target_audience ?? undefined,
    ...voiceOptions,
  });

  const post = await postsRepo.createPost(userId, {
    draft_content: result.post.content,
    final_content: result.polish.polished,
    dm_template: result.post.dm_template ?? null,
    cta_word: result.post.cta_word ?? null,
    variations: result.post.variations ?? null,
    status: "draft",
    hook_score: result.polish.hookScore?.score ?? null,
    polish_status: "polished",
    polish_notes: result.polish.changes.join("; "),
    team_profile_id: input.profileId ?? null,
  });

  return {
    post,
    synthetic_idea: result.syntheticIdea,
  };
}
