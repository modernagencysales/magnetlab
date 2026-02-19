// Attio Call Recording Backfill — fetches all completed recordings and inserts into MagnetLab
//
// Usage:
//   ATTIO_API_KEY=... ATTIO_DEFAULT_USER_ID=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/attio-backfill-run.mjs
//   Add DRY_RUN=1 to preview without writing.

const ATTIO_KEY = process.env.ATTIO_API_KEY;
const USER_ID = process.env.ATTIO_DEFAULT_USER_ID;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!ATTIO_KEY || !USER_ID || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required env vars. Need: ATTIO_API_KEY, ATTIO_DEFAULT_USER_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function attioGet(path) {
  const res = await fetch('https://api.attio.com/v2' + path, {
    headers: { Authorization: 'Bearer ' + ATTIO_KEY }
  });
  if (res.status >= 400) throw new Error('Attio ' + res.status + ': ' + (await res.text()));
  return res.json();
}

async function supabaseInsert(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(data)
  });
  const body = await res.json();
  if (res.status >= 400) throw new Error(JSON.stringify(body));
  return body;
}

async function supabaseSelect(table, query) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  return res.json();
}

// Known host emails — these people are from the MAS / Keen Digital team
const HOST_EMAILS = new Set([
  'tim@keen.digital',
  'tim@modernagencysales.com',
  'vlad@modernagencysales.com',
]);
const HOST_COMPANY = 'Modern Agency Sales / Keen Digital';

// Fetch all paginated transcript segments and assemble into readable text + speaker names
async function getFullTranscript(meetingId, recordingId) {
  const allSegments = [];
  let cursor = null;

  do {
    const params = cursor ? '?cursor=' + cursor : '';
    const body = await attioGet('/meetings/' + meetingId + '/call_recordings/' + recordingId + '/transcript' + params);
    const segments = (body.data && body.data.transcript) || [];
    allSegments.push(...segments);
    cursor = (body.pagination && body.pagination.next_cursor) || null;
  } while (cursor);

  if (allSegments.length === 0) return { text: '', speakerNames: [] };

  // Collect unique speaker names from segments
  const speakerNamesSet = new Set();

  // Group consecutive words by speaker
  let transcript = '';
  let currentSpeaker = null;
  let currentLine = '';

  for (const seg of allSegments) {
    const speaker = (seg.speaker && seg.speaker.name) || 'Unknown';
    speakerNamesSet.add(speaker);
    if (speaker !== currentSpeaker) {
      if (currentLine) {
        transcript += currentSpeaker + ': ' + currentLine.trim() + '\n\n';
      }
      currentSpeaker = speaker;
      currentLine = seg.speech + ' ';
    } else {
      currentLine += seg.speech + ' ';
    }
  }
  if (currentLine) {
    transcript += currentSpeaker + ': ' + currentLine.trim() + '\n\n';
  }

  return { text: transcript.trim(), speakerNames: [...speakerNamesSet] };
}

// Build speaker_map from meeting participants + transcript speaker names
function buildSpeakerMap(meeting, speakerNames) {
  const participants = meeting.participants || [];
  const speakerMap = {};

  for (const name of speakerNames) {
    if (name === 'Unknown') continue;

    const nameLower = name.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter(p => p.length > 0);
    const isKnownHost = nameLower === 'tim keen' || nameLower === 'vlad timinski';

    // Match speaker name to participant email (strict matching)
    const matchedParticipant = participants.find(p => {
      if (!p.email_address) return false;
      const emailLocal = p.email_address.split('@')[0].toLowerCase().replace(/[._-]/g, '');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
      if (firstName.length > 2 && emailLocal.startsWith(firstName)) return true;
      if (lastName && lastName.length >= 4 && emailLocal.includes(lastName)) return true;
      return false;
    });

    const email = matchedParticipant?.email_address || null;
    const isHost = isKnownHost || (email ? HOST_EMAILS.has(email) : false);

    let role = 'unknown';
    if (isHost) role = 'host';
    else if (email) role = 'client';
    else role = 'guest';

    speakerMap[name] = {
      role,
      company: isHost ? HOST_COMPANY : null,
      email: email || null,
    };
  }

  return Object.keys(speakerMap).length > 0 ? speakerMap : null;
}

async function main() {
  console.log('Starting Attio backfill...');
  if (DRY_RUN) console.log('DRY RUN — no data will be written');

  // Fetch all meetings (paginated, date-filtered)
  let allMeetings = [];
  let cursor = null;

  do {
    const params = new URLSearchParams({
      limit: '200',
      sort: 'start_desc',
      ends_from: '2025-01-01T00:00:00Z',
      starts_before: '2026-12-31T00:00:00Z'
    });
    if (cursor) params.set('cursor', cursor);
    const page = await attioGet('/meetings?' + params);
    allMeetings = allMeetings.concat(page.data);
    cursor = (page.pagination && page.pagination.next_cursor) || null;
    console.log('  Fetched', allMeetings.length, 'meetings...');
  } while (cursor);

  console.log('Total meetings:', allMeetings.length);

  let inserted = 0, duplicates = 0, skipped = 0, errors = 0;

  for (const meeting of allMeetings) {
    const meetingId = meeting.id.meeting_id;
    let recordings;
    try {
      const recRes = await attioGet('/meetings/' + meetingId + '/call_recordings');
      recordings = recRes.data || [];
    } catch {
      continue;
    }
    if (recordings.length === 0) continue;

    for (const rec of recordings) {
      const recId = rec.id.call_recording_id;
      if (rec.status !== 'completed') {
        skipped++;
        continue;
      }

      const externalId = 'attio:' + recId;

      // Check for duplicate
      const existing = await supabaseSelect(
        'cp_call_transcripts',
        'external_id=eq.' + externalId + '&user_id=eq.' + USER_ID + '&select=id'
      );
      if (existing.length > 0) {
        duplicates++;
        console.log('  SKIP (dup):', meeting.title);
        continue;
      }

      // Fetch full paginated transcript + speaker names
      let transcriptResult;
      try {
        transcriptResult = await getFullTranscript(meetingId, recId);
      } catch (e) {
        console.error('  ERROR transcript:', meeting.title, e.message);
        errors++;
        continue;
      }

      const { text: rawTranscript, speakerNames } = transcriptResult;

      if (!rawTranscript || rawTranscript.length === 0) {
        skipped++;
        console.log('  SKIP (empty):', meeting.title);
        continue;
      }

      // Build speaker_map from Attio participants + transcript speakers
      const speakerMap = buildSpeakerMap(meeting, speakerNames);

      const dur = (meeting.start && meeting.start.datetime && meeting.end && meeting.end.datetime)
        ? Math.round((new Date(meeting.end.datetime).getTime() - new Date(meeting.start.datetime).getTime()) / 60000)
        : null;
      const participants = (meeting.participants || [])
        .filter(p => p.email_address)
        .map(p => p.email_address);

      if (DRY_RUN) {
        console.log('  DRY: Would insert "' + meeting.title + '" (' + dur + 'min, ' + rawTranscript.length + ' chars)');
        if (speakerMap) console.log('    speaker_map:', JSON.stringify(speakerMap));
        inserted++;
        continue;
      }

      try {
        await supabaseInsert('cp_call_transcripts', {
          user_id: USER_ID,
          source: 'attio',
          external_id: externalId,
          title: meeting.title || null,
          call_date: (meeting.start && meeting.start.datetime) || null,
          duration_minutes: dur,
          participants: participants.length > 0 ? participants : null,
          raw_transcript: rawTranscript,
          speaker_map: speakerMap,
        });
        inserted++;
        console.log('  INSERTED:', meeting.title, '(' + dur + 'min, ' + rawTranscript.length + ' chars)');
        if (speakerMap) console.log('    speaker_map:', Object.keys(speakerMap).join(', '));
      } catch (e) {
        console.error('  ERROR insert:', meeting.title, e.message);
        errors++;
      }
    }
  }

  console.log('\n--- Backfill complete ---');
  console.log('  Inserted:', inserted);
  console.log('  Duplicates:', duplicates);
  console.log('  Skipped (processing/empty):', skipped);
  console.log('  Errors:', errors);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
