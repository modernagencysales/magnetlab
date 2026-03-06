/**
 * Content Pipeline Transcripts Service
 * List, create (paste/upload), get, update, delete, reprocess. Triggers Trigger.dev process-transcript.
 */

import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { logError, logWarn, logInfo } from '@/lib/utils/logger';
import * as cpTranscriptsRepo from '@/server/repositories/cp-transcripts.repo';

export async function list(
  userId: string,
  teamId: string | null,
  speakerProfileId: string | null,
  limit: number
) {
  const { data: items, error } = await cpTranscriptsRepo.listTranscripts(
    userId,
    teamId,
    speakerProfileId,
    limit
  );
  if (error) {
    logError('cp/transcripts', error, { action: 'list' });
    return { success: false, error: 'database' as const };
  }
  const profileIds = [...new Set(items.map((t) => t.speaker_profile_id).filter(Boolean))] as string[];
  const profileMap = await cpTranscriptsRepo.getProfileNames(profileIds);
  const enriched = items.map((t) => ({
    ...t,
    speaker_name: t.speaker_profile_id ? profileMap[t.speaker_profile_id] || null : null,
  }));
  return { success: true, transcripts: enriched };
}

export async function createFromPaste(
  userId: string,
  payload: {
    transcript: string;
    title?: string;
    speakerProfileId?: string | null;
    source?: string;
  }
) {
  let teamId: string | null = null;
  if (payload.speakerProfileId) {
    teamId = await cpTranscriptsRepo.getTeamIdBySpeakerProfileId(payload.speakerProfileId);
  } else {
    teamId = await cpTranscriptsRepo.getTeamIdByOwnerId(userId);
  }

  const { data: record, error } = await cpTranscriptsRepo.insertTranscript({
    user_id: userId,
    source: payload.source ?? 'paste',
    title: payload.title ?? 'Pasted Transcript',
    raw_transcript: payload.transcript.trim(),
    team_id: teamId,
    speaker_profile_id: payload.speakerProfileId ?? null,
  });
  if (error || !record) {
    logError('cp/transcripts', error ?? new Error('No record'), { detail: error?.message });
    return { success: false, error: 'database' as const };
  }
  try {
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId,
      transcriptId: record.id,
      teamId: teamId ?? undefined,
      speakerProfileId: payload.speakerProfileId ?? undefined,
    });
  } catch (triggerError) {
    logWarn('cp/transcripts', 'Failed to trigger process-transcript', { error: String(triggerError) });
  }
  return { success: true, transcript_id: record.id };
}

export async function createFromUpload(userId: string, payload: { title: string; raw_transcript: string }) {
  const { data: record, error } = await cpTranscriptsRepo.insertTranscript({
    user_id: userId,
    source: 'upload',
    title: payload.title,
    raw_transcript: payload.raw_transcript,
  });
  if (error || !record) {
    logError('cp/transcripts/upload', error ?? new Error('No record'), {});
    return { success: false, error: 'database' as const };
  }
  try {
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId,
      transcriptId: record.id,
    });
  } catch (triggerError) {
    logWarn('cp/transcripts/upload', 'Failed to trigger process-transcript', { detail: String(triggerError) });
  }
  return { success: true, transcript_id: record.id };
}

export async function getById(userId: string, id: string) {
  const { data: transcript, error } = await cpTranscriptsRepo.getTranscriptById(id, userId);
  if (error || !transcript) return { success: false, error: 'not_found' as const };

  const [knowledgeCount, ideasCount] = await Promise.all([
    cpTranscriptsRepo.getKnowledgeCount(id),
    cpTranscriptsRepo.getIdeasCount(id),
  ]);
  let speakerName: string | null = null;
  if (transcript.speaker_profile_id) {
    speakerName = await cpTranscriptsRepo.getSpeakerName(transcript.speaker_profile_id);
  }
  return {
    success: true,
    transcript: {
      ...transcript,
      speaker_name: speakerName,
      knowledge_count: knowledgeCount,
      ideas_count: ideasCount,
    },
  };
}

const ALLOWED_FIELDS = ['title', 'call_date', 'participants', 'duration_minutes', 'transcript_type', 'speaker_map'];

export async function update(userId: string, id: string, body: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) filtered[key] = body[key];
  }
  if (Object.keys(filtered).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No valid fields provided' };
  }
  const { data, error } = await cpTranscriptsRepo.updateTranscript(id, userId, filtered);
  if (error) {
    logError('cp/transcripts', error, { step: 'transcript_update_error' });
    return { success: false, error: 'database' as const };
  }
  return { success: true, transcript: data };
}

export async function deleteTranscript(userId: string, id: string) {
  const { error } = await cpTranscriptsRepo.deleteTranscript(id, userId);
  if (error) {
    logError('cp/transcripts', error, { action: 'delete' });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function reprocess(userId: string, id: string) {
  const { data: transcript, error: fetchError } = await cpTranscriptsRepo.getTranscriptForReprocess(id, userId);
  if (fetchError || !transcript) return { success: false, error: 'not_found' as const };
  if (!transcript.knowledge_extracted_at && !transcript.ideas_extracted_at) {
    return { success: false, error: 'conflict' as const, message: 'Transcript is currently being processed' };
  }

  const existingEntries = await cpTranscriptsRepo.getKnowledgeEntriesForTranscript(id);
  const tagCounts = new Map<string, number>();
  for (const entry of existingEntries) {
    for (const tag of entry.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }

  await cpTranscriptsRepo.deleteKnowledgeByTranscriptId(id);
  await cpTranscriptsRepo.deleteIdeasByTranscriptId(id);
  await Promise.allSettled(
    Array.from(tagCounts).map(([tagName, count]) =>
      cpTranscriptsRepo.decrementTagCount(userId, tagName, count)
    )
  );
  await cpTranscriptsRepo.resetExtractionTimestamps(id);

  try {
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId,
      transcriptId: id,
      teamId: transcript.team_id ?? undefined,
      speakerProfileId: transcript.speaker_profile_id ?? undefined,
    });
  } catch (triggerError) {
    logWarn('cp/transcripts/reprocess', 'Failed to trigger process-transcript', { error: String(triggerError) });
  }
  logInfo('cp/transcripts/reprocess', 'Reprocess triggered', {
    transcriptId: id,
    deletedEntries: existingEntries.length,
    decrementedTags: tagCounts.size,
  });
  return { success: true };
}
