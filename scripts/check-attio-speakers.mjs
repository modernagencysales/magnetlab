// Check what participant/speaker data Attio provides on meetings with recordings
import { readFileSync } from 'fs';

const content = readFileSync('.env.local', 'utf8');
function getEnv(name) {
  const m = content.match(new RegExp(name + '="([^"]+)"'));
  if (!m) return '';
  let val = m[1];
  if (val.endsWith('\\n')) val = val.slice(0, -2);
  return val.trim();
}

const ATTIO_KEY = getEnv('ATTIO_API_KEY');

async function attioGet(path) {
  const res = await fetch('https://api.attio.com/v2' + path, {
    headers: { Authorization: 'Bearer ' + ATTIO_KEY }
  });
  if (res.status >= 400) throw new Error('Attio ' + res.status + ': ' + (await res.text()));
  return res.json();
}

async function main() {
  // Paginate through meetings to find ones with completed recordings
  let found = 0;
  let cursor = null;

  do {
    const params = new URLSearchParams({
      limit: '200', sort: 'start_desc',
      ends_from: '2025-01-01T00:00:00Z',
      starts_before: '2026-12-31T00:00:00Z'
    });
    if (cursor) params.set('cursor', cursor);
    const page = await attioGet('/meetings?' + params);

    for (const meeting of page.data) {
      if (found >= 3) break;
      const meetingId = meeting.id.meeting_id;

      try {
        const recRes = await attioGet('/meetings/' + meetingId + '/call_recordings');
        const recs = (recRes.data || []).filter(r => r.status === 'completed');
        if (recs.length === 0) continue;

        found++;
        console.log('\n========================================');
        console.log('Meeting:', meeting.title);
        console.log('========================================');
        console.log('Participants:');
        for (const p of (meeting.participants || [])) {
          console.log('  ', p.email_address, p.is_organizer ? '(organizer)' : '', 'status:', p.status);
        }

        for (const rec of recs) {
          const recId = rec.id.call_recording_id;
          console.log('\nRecording ID:', recId);
          console.log('Recording keys:', Object.keys(rec));
          console.log('Recording speakers field:', JSON.stringify(rec.speakers, null, 2));

          // Get transcript segments to see speaker objects
          const transRes = await attioGet('/meetings/' + meetingId + '/call_recordings/' + recId + '/transcript');
          const segments = (transRes.data && transRes.data.transcript) || [];
          const uniqueSpeakers = new Map();
          for (const seg of segments) {
            if (seg.speaker && !uniqueSpeakers.has(seg.speaker.name)) {
              uniqueSpeakers.set(seg.speaker.name, seg.speaker);
            }
          }
          console.log('\nTranscript speakers (unique from segments):');
          for (const [name, speaker] of uniqueSpeakers) {
            console.log('  ', JSON.stringify(speaker));
          }
        }
      } catch {
        continue;
      }
    }

    cursor = (page.pagination && page.pagination.next_cursor) || null;
    if (found >= 3) break;
  } while (cursor);
}

main().catch(e => console.error('FATAL:', e));
