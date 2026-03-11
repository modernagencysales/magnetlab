/**
 * Creative Strategy Plays Service
 * Business logic for play CRUD, results, templates, feedback, assignments.
 * Shared resource — no DataScope. Auth gated by isSuperAdmin() in route layer.
 * Never imports from Next.js HTTP layer.
 */

import { logError } from '@/lib/utils/logger';
import * as playsRepo from '@/server/repositories/cs-plays.repo';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';

import type {
  CsPlay,
  CsPlayResult,
  CsPlayTemplate,
  CsPlayFeedback,
  CsPlayAssignment,
  PlayWithStats,
  PlayFilters,
} from '@/lib/types/creative-strategy';
import type {
  CreatePlayInput,
  UpdatePlayInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  PlayFeedbackInput,
} from '@/lib/validations/creative-strategy';

// ─── Play reads ─────────────────────────────────────────────────────────────

export async function listPlays(filters: PlayFilters) {
  const { data, count } = await playsRepo.findPlays(filters);
  return {
    plays: data,
    total: count,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function getPlayById(id: string): Promise<PlayWithStats | null> {
  const play = await playsRepo.findPlayById(id);
  if (!play) return null;

  const [signalCount, results, usageCount, feedback] = await Promise.all([
    playsRepo.countSignalsByPlayId(id),
    playsRepo.findResultsByPlayId(id),
    playsRepo.countPostsByPlayId(id),
    playsRepo.countFeedbackByPlayId(id),
  ]);

  const multipliers = results.map((r) => r.multiplier).filter((m): m is number => m !== null);

  const avgMultiplier =
    multipliers.length > 0 ? multipliers.reduce((a, b) => a + b, 0) / multipliers.length : null;

  const promotionSuggestion = computePromotionSuggestion(play, avgMultiplier, multipliers);

  return {
    ...play,
    signal_count: signalCount,
    test_count: results.length,
    avg_multiplier: avgMultiplier ? Math.round(avgMultiplier * 100) / 100 : null,
    usage_count: usageCount,
    feedback_up: feedback.up,
    feedback_down: feedback.down,
    promotion_suggestion: promotionSuggestion,
  };
}

// ─── Play writes ────────────────────────────────────────────────────────────

export async function createPlay(input: CreatePlayInput, createdBy: string): Promise<CsPlay> {
  // Validate all signal IDs exist
  const signalChecks = await Promise.all(
    input.signal_ids.map((id) => signalsRepo.findSignalById(id))
  );
  const missing = input.signal_ids.filter((_, i) => !signalChecks[i]);
  if (missing.length > 0) {
    throw Object.assign(new Error(`Signals not found: ${missing.join(', ')}`), { statusCode: 400 });
  }

  const play = await playsRepo.createPlay({
    title: input.title,
    thesis: input.thesis,
    exploit_type: input.exploit_type,
    format_instructions: input.format_instructions,
    status: 'draft',
    visibility: 'internal',
    niches: input.niches ?? null,
    created_by: createdBy,
  });

  // Link signals to play
  await playsRepo.linkSignalsToPlay(play.id, input.signal_ids);

  // Mark signals as used (side effect — must never block play creation)
  try {
    await Promise.all(input.signal_ids.map((id) => signalsRepo.updateSignalStatus(id, 'used')));
  } catch (error) {
    logError('cs-plays.createPlay', error, {
      playId: play.id,
      step: 'mark_signals_used',
    });
  }

  return play;
}

export async function updatePlay(id: string, input: UpdatePlayInput): Promise<CsPlay> {
  const existing = await playsRepo.findPlayById(id);
  if (!existing) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.updatePlay(id, input);
}

export async function deletePlay(id: string): Promise<void> {
  const existing = await playsRepo.findPlayById(id);
  if (!existing) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  await playsRepo.deletePlay(id);
}

// ─── Play results ───────────────────────────────────────────────────────────

export async function getPlayResults(playId: string) {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  const results = await playsRepo.findResultsByPlayId(playId);

  // Compute niche breakdown
  const nicheMap = new Map<string, { count: number; totalMultiplier: number }>();
  for (const result of results) {
    const niche = result.niche ?? 'unknown';
    const entry = nicheMap.get(niche) ?? { count: 0, totalMultiplier: 0 };
    entry.count += 1;
    if (result.multiplier !== null) entry.totalMultiplier += result.multiplier;
    nicheMap.set(niche, entry);
  }

  const nicheBreakdown = Array.from(nicheMap.entries()).map(([niche, stats]) => ({
    niche,
    count: stats.count,
    avg_multiplier:
      stats.count > 0 ? Math.round((stats.totalMultiplier / stats.count) * 100) / 100 : null,
  }));

  return { results, niche_breakdown: nicheBreakdown };
}

export async function addPlayResult(
  insert: Omit<CsPlayResult, 'id' | 'tested_at'>
): Promise<CsPlayResult> {
  const play = await playsRepo.findPlayById(insert.play_id);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  const result = await playsRepo.createPlayResult(insert);

  // Update last_used_at on the play (side effect — must never block result creation)
  try {
    await playsRepo.updatePlay(insert.play_id, {
      last_used_at: new Date().toISOString(),
    });
  } catch (error) {
    logError('cs-plays.addPlayResult', error, {
      playId: insert.play_id,
      step: 'update_last_used',
    });
  }

  return result;
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function getTemplatesByPlayId(playId: string): Promise<CsPlayTemplate[]> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.findTemplatesByPlayId(playId);
}

export async function createTemplate(input: CreateTemplateInput): Promise<CsPlayTemplate> {
  const play = await playsRepo.findPlayById(input.play_id);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.createTemplate({
    play_id: input.play_id,
    name: input.name,
    structure: input.structure,
    media_instructions: input.media_instructions,
    example_output: input.example_output,
  });
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<CsPlayTemplate> {
  return playsRepo.updateTemplate(id, input);
}

export async function deleteTemplate(id: string): Promise<void> {
  await playsRepo.deleteTemplate(id);
}

// ─── Feedback ───────────────────────────────────────────────────────────────

export async function submitFeedback(
  playId: string,
  userId: string,
  input: PlayFeedbackInput
): Promise<CsPlayFeedback> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.upsertFeedback(playId, userId, input.rating, input.note ?? null);
}

export async function getFeedbackByPlayId(playId: string): Promise<CsPlayFeedback[]> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.findFeedbackByPlayId(playId);
}

// ─── Assignments ────────────────────────────────────────────────────────────

export async function getAssignmentsByUserId(userId: string): Promise<CsPlayAssignment[]> {
  return playsRepo.findAssignmentsByUserId(userId);
}

export async function assignPlay(
  playId: string,
  userId: string,
  assignedBy: string
): Promise<CsPlayAssignment> {
  const play = await playsRepo.findPlayById(playId);
  if (!play) {
    throw Object.assign(new Error('Play not found'), { statusCode: 404 });
  }

  return playsRepo.createAssignment({
    play_id: playId,
    user_id: userId,
    assigned_by: assignedBy,
    status: 'active',
  });
}

// ─── Promotion suggestion (private) ────────────────────────────────────────

function computePromotionSuggestion(
  play: CsPlay,
  avgMultiplier: number | null,
  multipliers: number[]
): 'promote' | 'decline' | null {
  if (multipliers.length < 3) return null;

  // Promote: testing status + avg >= 5 + low variance
  if (play.status === 'testing' && avgMultiplier !== null && avgMultiplier >= 5) {
    const mean = avgMultiplier;
    const variance = multipliers.reduce((sum, m) => sum + (m - mean) ** 2, 0) / multipliers.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = stdDev / mean;
    if (coeffOfVariation < 0.5) return 'promote';
  }

  // Decline: proven status + recent 5 results avg < 2
  if (play.status === 'proven' && multipliers.length >= 5) {
    const recent5 = multipliers.slice(0, 5);
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length;
    if (recentAvg < 2) return 'decline';
  }

  return null;
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
