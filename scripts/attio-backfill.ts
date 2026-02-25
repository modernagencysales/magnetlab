/**
 * Attio Call Recording Backfill Script
 *
 * Pulls all existing call recordings from Attio and inserts them into
 * the MagnetLab cp_call_transcripts table with deduplication.
 *
 * Usage:
 *   npx tsx scripts/attio-backfill.ts
 *
 * Required env vars:
 *   ATTIO_API_KEY              - Attio API bearer token
 *   ATTIO_DEFAULT_USER_ID      - MagnetLab user ID to attribute recordings to
 *   NEXT_PUBLIC_SUPABASE_URL   - Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  - Supabase service role key
 *
 * Optional:
 *   DRY_RUN=1                  - Log what would be inserted without writing
 */

import { createClient } from '@supabase/supabase-js';

// --- Minimal Attio client (standalone, no path aliases) ---

const ATTIO_BASE = 'https://api.attio.com/v2';

async function attioGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${ATTIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attio API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

interface Meeting {
  id: { meeting_id: string };
  title: string | null;
  start: { datetime: string } | null;
  end: { datetime: string } | null;
  participants: { email_address: string }[];
}

interface CallRecording {
  id: { call_recording_id: string; meeting_id: string };
  status: string;
}

interface TranscriptSegment {
  speech: string;
  start_time: number;
  end_time: number;
  speaker: { name: string };
}

interface TranscriptPage {
  data: {
    transcript: TranscriptSegment[];
  };
  pagination: { next_cursor: string | null };
}

interface Paginated<T> {
  data: T[];
  pagination?: { next_cursor: string | null };
  next_cursor?: string | null; // fallback
}

/**
 * Fetch full paginated transcript and assemble into readable text.
 * Groups consecutive words by speaker into paragraphs.
 *
 * NOTE: This duplicates logic from src/lib/integrations/attio.ts
 * (getFullTranscript + assembleTranscript). Kept standalone because
 * scripts run without path aliases.
 */
async function fetchAndAssembleTranscript(
  meetingId: string,
  recordingId: string,
  apiKey: string
): Promise<string> {
  const allSegments: TranscriptSegment[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ limit: '500' });
    if (cursor) params.set('cursor', cursor);

    const page = await attioGet<TranscriptPage>(
      `/meetings/${meetingId}/call_recordings/${recordingId}/transcript?${params}`,
      apiKey
    );
    allSegments.push(...(page.data?.transcript || []));
    cursor = page.pagination?.next_cursor || null;
  } while (cursor);

  if (allSegments.length === 0) return '';

  // Group consecutive words by same speaker into paragraphs
  const paragraphs: string[] = [];
  let currentSpeaker = '';
  let currentWords: string[] = [];

  for (const seg of allSegments) {
    const speaker = seg.speaker?.name || 'Unknown';
    if (speaker !== currentSpeaker) {
      if (currentWords.length > 0) {
        paragraphs.push(`${currentSpeaker}: ${currentWords.join(' ')}`);
      }
      currentSpeaker = speaker;
      currentWords = [seg.speech];
    } else {
      currentWords.push(seg.speech);
    }
  }
  if (currentWords.length > 0) {
    paragraphs.push(`${currentSpeaker}: ${currentWords.join(' ')}`);
  }

  return paragraphs.join('\n\n');
}

// --- Main ---

async function main() {
  const apiKey = process.env.ATTIO_API_KEY;
  const userId = process.env.ATTIO_DEFAULT_USER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dryRun = process.env.DRY_RUN === '1';

  if (!apiKey || !userId || !supabaseUrl || !supabaseKey) {
    console.error('Missing required env vars. See script header for details.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Starting Attio backfill...');
  if (dryRun) console.log('DRY RUN — no data will be written');

  // Step 1: Fetch all meetings (paginated)
  let allMeetings: Meeting[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ limit: '200', sort: 'start_asc' });
    if (cursor) params.set('cursor', cursor);

    const page = await attioGet<Paginated<Meeting>>(`/meetings?${params}`, apiKey);
    allMeetings = allMeetings.concat(page.data);
    cursor = page.pagination?.next_cursor || page.next_cursor || null;
    console.log(`  Fetched ${allMeetings.length} meetings so far...`);
  } while (cursor);

  console.log(`Total meetings: ${allMeetings.length}`);

  // Step 2: For each meeting, check for call recordings
  let inserted = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;

  for (const meeting of allMeetings) {
    const meetingId = meeting.id.meeting_id;

    let recordings: CallRecording[] = [];
    let recCursor: string | null = null;

    try {
      do {
        const params = new URLSearchParams({ limit: '200' });
        if (recCursor) params.set('cursor', recCursor);

        const page = await attioGet<Paginated<CallRecording>>(
          `/meetings/${meetingId}/call_recordings?${params}`,
          apiKey
        );
        recordings = recordings.concat(page.data);
        recCursor = page.pagination?.next_cursor || page.next_cursor || null;
      } while (recCursor);
    } catch {
      // No recordings for this meeting — skip
      continue;
    }

    if (recordings.length === 0) continue;

    for (const recording of recordings) {
      const recordingId = recording.id.call_recording_id;

      if (recording.status !== 'completed') {
        skipped++;
        continue;
      }

      const externalId = `attio:${recordingId}`;

      // Check for duplicate
      const { data: existing } = await supabase
        .from('cp_call_transcripts')
        .select('id')
        .eq('external_id', externalId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        duplicates++;
        console.log(`  SKIP (duplicate) ${meeting.title || meetingId}`);
        continue;
      }

      // Fetch and assemble transcript from paginated word-level segments
      let assembledTranscript: string;
      try {
        assembledTranscript = await fetchAndAssembleTranscript(meetingId, recordingId, apiKey);
      } catch (err) {
        console.error(`  ERROR fetching transcript for ${meetingId}/${recordingId}:`, err);
        errors++;
        continue;
      }

      if (!assembledTranscript || assembledTranscript.trim().length === 0) {
        skipped++;
        console.log(`  SKIP (empty transcript) ${meeting.title || meetingId}`);
        continue;
      }

      const durationMinutes =
        meeting.start?.datetime && meeting.end?.datetime
          ? Math.round(
              (new Date(meeting.end.datetime).getTime() -
                new Date(meeting.start.datetime).getTime()) /
                60_000
            )
          : null;

      const participants = meeting.participants
        .filter((p) => p.email_address)
        .map((p) => p.email_address);

      const row = {
        user_id: userId,
        source: 'attio',
        external_id: externalId,
        title: meeting.title || null,
        call_date: meeting.start?.datetime || null,
        duration_minutes: durationMinutes,
        participants: participants.length > 0 ? participants : null,
        raw_transcript: assembledTranscript,
      };

      if (dryRun) {
        console.log(`  DRY: Would insert "${meeting.title}" (${durationMinutes}min)`);
        inserted++;
        continue;
      }

      const { error: insertError } = await supabase
        .from('cp_call_transcripts')
        .insert(row);

      if (insertError) {
        console.error(`  ERROR inserting ${meetingId}:`, insertError.message);
        errors++;
      } else {
        inserted++;
        console.log(`  INSERTED "${meeting.title}" (${durationMinutes}min, ${participants.length} participants)`);
      }
    }
  }

  console.log('\n--- Backfill complete ---');
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Duplicates: ${duplicates}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (!dryRun && inserted > 0) {
    console.log(
      '\nNote: Transcripts have been inserted but NOT processed through the AI pipeline.'
    );
    console.log(
      'To trigger processing, you can re-deploy with Trigger.dev or manually trigger process-transcript for each new ID.'
    );
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
