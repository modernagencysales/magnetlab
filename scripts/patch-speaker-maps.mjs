// Patch speaker_map on existing Attio transcripts that don't have one yet
// Reads raw_transcript to extract speaker names, fetches meeting from Attio for participants
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
const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const HOST_EMAILS = new Set([
  'tim@keen.digital',
  'tim@modernagencysales.com',
  'vlad@modernagencysales.com',
]);
const HOST_COMPANY = 'Modern Agency Sales / Keen Digital';

async function attioGet(path) {
  const res = await fetch('https://api.attio.com/v2' + path, {
    headers: { Authorization: 'Bearer ' + ATTIO_KEY }
  });
  if (res.status >= 400) throw new Error('Attio ' + res.status + ': ' + (await res.text()));
  return res.json();
}

async function supabaseQuery(table, params) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + params, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
  });
  return res.json();
}

async function supabasePatch(table, id, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
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

function extractSpeakerNamesFromTranscript(rawTranscript) {
  const names = new Set();
  // Pattern: "Speaker Name: text"
  const lines = rawTranscript.split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z][^:]{1,50}):\s/);
    if (m) names.add(m[1].trim());
  }
  return [...names];
}

function buildSpeakerMap(participants, speakerNames) {
  const map = {};
  for (const name of speakerNames) {
    if (name === 'Unknown') continue;
    const nameLower = name.toLowerCase();
    const nameParts = nameLower.split(/\s+/).filter(p => p.length > 0);
    const isKnownHost = nameLower === 'tim keen' || nameLower === 'vlad timinski';

    const matched = participants.find(p => {
      if (!p.email_address) return false;
      const emailLocal = p.email_address.split('@')[0].toLowerCase().replace(/[._-]/g, '');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
      if (firstName.length > 2 && emailLocal.startsWith(firstName)) return true;
      if (lastName && lastName.length >= 4 && emailLocal.includes(lastName)) return true;
      return false;
    });

    const email = matched?.email_address || null;
    const isHost = isKnownHost || (email ? HOST_EMAILS.has(email) : false);

    let role = 'unknown';
    if (isHost) role = 'host';
    else if (email) role = 'client';
    else role = 'guest';

    map[name] = { role, company: isHost ? HOST_COMPANY : null, email };
  }
  return Object.keys(map).length > 0 ? map : null;
}

async function main() {
  // Get ALL attio transcripts (re-patch with improved matching)
  const transcripts = await supabaseQuery('cp_call_transcripts',
    'source=eq.attio&select=id,external_id,title,raw_transcript,participants&order=created_at.asc'
  );

  console.log('Transcripts to patch:', transcripts.length);

  for (const t of transcripts) {
    console.log('\n---', t.title);

    // Extract speaker names from raw_transcript
    const speakerNames = extractSpeakerNamesFromTranscript(t.raw_transcript || '');
    console.log('  Speakers in transcript:', speakerNames.join(', '));

    // Get meeting from Attio for participant data
    let participants = [];
    if (t.external_id) {
      const recId = t.external_id.replace('attio:', '');
      // We need to find which meeting this recording belongs to
      // We can search through meetings, but that's expensive. Instead, use the participants
      // already stored in the transcript record.
      if (t.participants && t.participants.length > 0) {
        participants = t.participants.map(email => ({
          email_address: email,
          is_organizer: false, // We don't have this from the stored data
        }));
        // Mark known host emails as organizer
        for (const p of participants) {
          if (HOST_EMAILS.has(p.email_address)) {
            p.is_organizer = true;
          }
        }
      }
    }

    console.log('  Participants:', participants.map(p => p.email_address).join(', '));

    const speakerMap = buildSpeakerMap(participants, speakerNames);
    if (!speakerMap) {
      console.log('  SKIP: No speaker map could be built');
      continue;
    }

    console.log('  Speaker map:');
    for (const [name, info] of Object.entries(speakerMap)) {
      console.log('    ', name, '->', info.role, info.company || '(unknown company)', info.email || '(no email)');
    }

    // Patch
    await supabasePatch('cp_call_transcripts', t.id, { speaker_map: speakerMap });
    console.log('  PATCHED');
  }

  console.log('\nDone!');
}

main().catch(e => console.error('FATAL:', e));
